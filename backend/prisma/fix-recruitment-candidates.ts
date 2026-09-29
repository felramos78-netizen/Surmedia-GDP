// Corrige candidatos importados con la primera versión del extractor de CVs:
//   1. Emails / LinkedIn con texto pegado ("...@gmail.comcontacto") → limpios
//   2. Candidatos que juntaban CVs de personas distintas (unión por nombre mal extraído, ej. "Sobre Mí"):
//      se separan según el email de cada archivo.
//
//   npx tsx --env-file=.env prisma/fix-recruitment-candidates.ts           → simulación
//   npx tsx --env-file=.env prisma/fix-recruitment-candidates.ts --apply   → aplica
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { randomUUID } from 'crypto'
import { extractCvText, parseCvData, cleanEmail, cleanLinkedinUrl } from '../src/services/cvParser.service'
import { absolutePath, candidateSearchText } from '../src/services/recruitmentDriveImport.service'

const prisma = new PrismaClient()
const APPLY  = process.argv.includes('--apply')

async function main() {
  const cands = await prisma.candidate.findMany({ include: { files: true, applications: true } })
  const emails = new Map(cands.filter(c => c.email).map(c => [c.email!, c.id]))
  const log: string[] = []
  const stats = { emails: 0, linkedin: 0, emailConflicts: 0, split: 0, newCandidates: 0 }

  // Datos de cada archivo de candidatos con más de un CV (para detectar uniones erróneas)
  const parsed = new Map<string, ReturnType<typeof parseCvData>>()
  for (const c of cands.filter(c => c.files.length > 1)) {
    for (const f of c.files) {
      try {
        const { text, links } = await extractCvText(readFileSync(absolutePath(f.drivePath)), extname(f.fileName).toLowerCase())
        parsed.set(f.id, parseCvData(text, links, f.fileName))
      } catch { /* archivo ilegible: se queda con el candidato actual */ }
    }
  }

  await prisma.$transaction(async tx => {
    for (const c of cands) {
      // 1. Limpieza de email y LinkedIn
      const data: Record<string, any> = {}
      const email = cleanEmail(c.email)
      if (email !== c.email) {
        if (email && emails.has(email) && emails.get(email) !== c.id) {
          stats.emailConflicts++; log.push(`  email ya usado por otro candidato: ${c.fullName} (${email})`)
        } else {
          data.email = email; stats.emails++
          if (c.email) emails.delete(c.email)
          if (email) emails.set(email, c.id)
        }
      }
      const li = cleanLinkedinUrl(c.linkedinUrl)
      if (li !== c.linkedinUrl) { data.linkedinUrl = li; stats.linkedin++ }
      if (Object.keys(data).length) {
        await tx.candidate.update({ where: { id: c.id }, data: { ...data, searchText: candidateSearchText({ ...c, ...data }) } })
        Object.assign(c, data)
      }

      // 2. Separar CVs con emails distintos
      if (c.files.length < 2) continue
      const groups = new Map<string, typeof c.files>()
      for (const f of c.files) {
        const e = parsed.get(f.id)?.email ?? ''
        groups.set(e, [...(groups.get(e) ?? []), f])
      }
      const keyed = [...groups.keys()].filter(Boolean)
      if (keyed.length < 2) continue
      // Se queda con el grupo de su email (o el primero); los archivos sin email se quedan también
      const keep = keyed.includes(c.email ?? '') ? c.email! : keyed[0]
      stats.split++
      log.push(`  separar "${c.fullName}": ${keyed.length} personas (${c.files.length} archivos)`)
      for (const key of keyed.filter(k => k !== keep)) {
        const files = groups.get(key)!
        const d = parsed.get(files[0].id)!
        const id = randomUUID()
        const newEmail = emails.has(key) ? null : key
        if (newEmail) emails.set(newEmail, id)
        const nc = {
          id, fullName: d.fullName ?? files[0].fileName, email: newEmail, phone: d.phone,
          rut: d.rut && !cands.some(x => x.rut === d.rut) ? d.rut : null, linkedinUrl: d.linkedinUrl, source: c.source,
        }
        await tx.candidate.create({ data: { ...nc, searchText: candidateSearchText(nc) } })
        stats.newCandidates++
        log.push(`    → nuevo candidato "${nc.fullName}" con ${files.length} archivo(s)`)
        await tx.candidateFile.updateMany({ where: { id: { in: files.map(f => f.id) } }, data: { candidateId: id } })
        // Postulaciones: la nueva persona postula a las vacantes de sus archivos (misma etapa)
        for (const openingId of new Set(files.map(f => f.jobOpeningId).filter(Boolean) as string[])) {
          const orig = c.applications.find(a => a.jobOpeningId === openingId)
          await tx.candidateApplication.create({
            data: { candidateId: id, jobOpeningId: openingId, stage: orig?.stage ?? 'RECIBIDO', isArchived: orig?.isArchived ?? false },
          })
          // Si el candidato original ya no tiene archivos en esa vacante, se le quita la postulación
          const remaining = c.files.filter(f => f.jobOpeningId === openingId && !files.includes(f))
          c.files = c.files.filter(f => !files.includes(f))
          if (!remaining.length && orig) await tx.candidateApplication.delete({ where: { id: orig.id } })
        }
      }
    }
    console.log(log.join('\n'))
    console.log(stats)
    if (!APPLY) throw new Error('__SIMULACION__')
  }, { timeout: 120_000, maxWait: 20_000 })
  console.log('✔ Aplicado')
}

main()
  .catch(e => { if (e.message === '__SIMULACION__') console.log('Simulación: nada se guardó. Usar --apply.'); else { console.error(e); process.exit(1) } })
  .finally(() => prisma.$disconnect())
