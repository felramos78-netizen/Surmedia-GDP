// Importa las planillas "Preselección*.xlsx" de cada vacante (carpeta de Reclutamiento en Drive):
//   - perfil del candidato (título, universidad, ciudad, años, último trabajo…) → solo campos vacíos
//   - columnas de puntos ("Puntos Ciudad", "Puntaje Adobe", "P1"…) → criterios MANUAL de la vacante + puntajes
//   - "Observaciones" / "Comentario" → comentario de la postulación (si está vacío)
// El candidato se busca entre los postulantes de esa vacante por email, nombre de archivo o nombre.
//
//   npx tsx --env-file=.env prisma/import-preseleccion.ts           → simulación
//   npx tsx --env-file=.env prisma/import-preseleccion.ts --apply   → aplica
import { PrismaClient } from '@prisma/client'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { fold } from '../src/utils/text'
import { RECRUITMENT_ROOT, parseYears } from '../src/services/recruitmentDriveImport.service'
import { candidateSearchText } from '../src/services/recruitmentDriveImport.service'

const prisma = new PrismaClient()
const APPLY  = process.argv.includes('--apply')

type ProfileField = 'professionalTitle' | 'institution' | 'city' | 'yearsExperience' | 'lastEmployer' | 'lastPosition'
  | 'sector' | 'skills' | 'tools' | 'certifications' | 'availability'

// Encabezado (normalizado) → campo
function fieldFor(h: string): ProfileField | 'name' | 'email' | 'phone' | 'file' | 'notes' | null {
  if (/^nombre( y apellido)?$/.test(h)) return 'name'
  if (/^(correo|email|mail)/.test(h)) return 'email'
  if (/^telefono/.test(h)) return 'phone'
  if (/^titulo/.test(h)) return 'professionalTitle'
  if (/^universidad/.test(h)) return 'institution'
  if (/^ubicacion/.test(h)) return 'city'
  if (/^anos (de )?exp/.test(h)) return 'yearsExperience'
  if (/^ultimo lugar/.test(h)) return 'lastEmployer'
  if (/^(ultimo cargo|cargo)/.test(h)) return 'lastPosition'
  if (/^sector/.test(h)) return 'sector'
  if (/competencias/.test(h)) return 'skills'
  if (/^herramientas/.test(h)) return 'tools'
  if (/^certificaciones/.test(h)) return 'certifications'
  if (/^disponibilidad/.test(h)) return 'availability'
  if (/^(observaciones|comentario)/.test(h)) return 'notes'
  if (/^(archivo|nombre del archivo)$/.test(h)) return 'file'
  return null
}

const FIELD_LABEL: Record<string, string> = {
  professionalTitle: 'Título', institution: 'Universidad', city: 'Ciudad', yearsExperience: 'Años de experiencia',
  lastEmployer: 'Último lugar de trabajo', lastPosition: 'Último cargo', skills: 'Competencias', tools: 'Herramientas',
}

/** Columnas de puntaje: "Puntos Ciudad", "Puntaje Adobe", "P1" (puntúa la columna anterior). "TOTAL"/"Puntaje" es el total. */
function scoreColumns(headers: string[]): { idx: number; name: string }[] {
  const out: { idx: number; name: string }[] = []
  headers.forEach((raw, i) => {
    const h = fold(raw)
    let m
    if ((m = h.match(/^(puntos|puntaje) (.+)$/))) out.push({ idx: i, name: raw.replace(/^\s*(puntos|puntaje)\s+/i, '').trim() })
    else if (/^p\d$/.test(h)) {
      const prev = fieldFor(fold(headers[i - 1] ?? ''))
      out.push({ idx: i, name: (prev && FIELD_LABEL[prev]) || String(headers[i - 1] ?? raw).trim() })
    }
  })
  return out
}

const tokens = (s: string) => fold(s).split(' ').filter(w => w.length > 2)

function findSheets(): { opening: string; path: string }[] {
  const out: { opening: string; path: string }[] = []
  const walk = (dir: string, rel: string[]) => {
    for (const n of readdirSync(dir)) {
      const abs = join(dir, n)
      if (statSync(abs).isDirectory()) walk(abs, [...rel, n])
      else if (rel.length && /^preselecci/i.test(fold(n)) && n.endsWith('.xlsx') && !n.startsWith('~$')) out.push({ opening: rel[0], path: abs })
    }
  }
  walk(RECRUITMENT_ROOT, [])
  return out
}

async function main() {
  const report: string[] = []
  const stats = { renamed: 0, sheets: 0, rows: 0, matched: 0, unmatched: 0, profileFields: 0, criteria: 0, scores: 0, notes: 0 }

  await prisma.$transaction(async tx => {
    for (const sheet of findSheets()) {
      const opening = await tx.jobOpening.findUnique({ where: { driveFolder: sheet.opening } })
      if (!opening) { report.push(`⚠ ${sheet.opening}: vacante no importada`); continue }
      const apps = await tx.candidateApplication.findMany({
        where: { jobOpeningId: opening.id },
        include: { candidate: { include: { files: { select: { fileName: true } } } } },
      })
      const wb = XLSX.readFile(sheet.path)
      for (const sn of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sn], { header: 1, defval: '' })
        const hi = rows.findIndex(r => r.filter(c => String(c).trim()).length >= 3)
        if (hi < 0) continue
        const headers = rows[hi].map(String)
        const cols = headers.map(h => fieldFor(fold(h)))
        if (!cols.includes('name')) continue
        stats.sheets++
        const usedApps = new Set<string>()
        const body = rows.slice(hi + 1).filter(r => String(r[cols.indexOf('name')] ?? '').trim())

        // Criterios: solo columnas de puntaje con algún valor
        let scoreCols = scoreColumns(headers).filter(c => body.some(r => typeof r[c.idx] === 'number'))
        const totalIdx = headers.findIndex(h => /^(total|puntaje)$/.test(fold(h)))
        if (!scoreCols.length && totalIdx >= 0 && body.some(r => typeof r[totalIdx] === 'number')) {
          scoreCols = [{ idx: totalIdx, name: 'Puntaje planilla' }]
        }
        const criterionId = new Map<number, string>()
        const existing = await tx.scoringCriterion.findMany({ where: { jobOpeningId: opening.id } })
        for (const [i, c] of scoreCols.entries()) {
          let crit = existing.find(e => fold(e.name) === fold(c.name))
          if (!crit) {
            crit = await tx.scoringCriterion.create({ data: { jobOpeningId: opening.id, name: c.name, type: 'MANUAL', sortOrder: existing.length + i } })
            existing.push(crit)
            stats.criteria++
          }
          criterionId.set(c.idx, crit.id)
        }

        for (const r of body) {
          stats.rows++
          const get = (f: string) => { const i = cols.indexOf(f as any); return i >= 0 ? String(r[i] ?? '').trim() : '' }
          const email = get('email').toLowerCase()
          const file  = fold(get('file'))
          const nameT = tokens(get('name'))
          if (!get('email') && !get('file') && cols.filter((f, i) => f && f !== 'name' && String(r[i] ?? '').trim()).length === 0) continue // Leyenda de criterios
          // 1) email, 2) nombre de archivo, 3) mejor coincidencia de nombre (contra nombre + archivos + email;
          //    el nombre extraído del CV puede venir mal). Sin empates y sin repetir postulante en la hoja.
          const free = apps.filter(a => !usedApps.has(a.id))
          let app =
            (email && free.find(a => a.candidate.email === email)) ||
            (file && free.find(a => a.candidate.files.some(f => fold(f.fileName) === file || fold(f.fileName).startsWith(file)))) ||
            undefined
          if (!app && nameT.length) {
            const need = Math.min(2, nameT.length)
            const scored = free
              .map(a => {
                const hay = fold([a.candidate.fullName, a.candidate.email, ...a.candidate.files.map(f => f.fileName)].join(' '))
                return { a, score: nameT.filter(t => hay.includes(t)).length }
              })
              .filter(x => x.score >= need)
              .sort((x, y) => y.score - x.score)
            if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) app = scored[0].a
          }
          if (!app) { stats.unmatched++; report.push(`  sin match: ${sheet.opening} · fila ${rows.indexOf(r) + 1} · "${get('name').slice(0, 40)}" · ${get('file').slice(0, 30)}`); continue }
          stats.matched++
          usedApps.add(app.id)

          // Perfil: solo campos vacíos
          const c = app.candidate as any
          const data: Record<string, any> = {}
          for (const f of ['professionalTitle', 'institution', 'city', 'lastEmployer', 'lastPosition', 'sector', 'skills', 'tools', 'certifications', 'availability', 'phone', 'email'] as const) {
            const v = get(f)
            if (v && !c[f] && !/^(no (especifica|informado|aplica)|n\/a|-)$/i.test(v)) data[f] = v
          }
          // Nombre mal extraído del CV (ej. "Animadora Digital"): manda el de la planilla
          const current = fold(c.fullName)
          if (nameT.length >= 2 && nameT.filter(t => current.includes(t)).length < 2) {
            data.fullName = get('name').replace(/\s+/g, ' ')
            stats.renamed++; report.push(`  nombre: "${c.fullName}" → "${data.fullName}"`)
          }
          const years = parseYears(get('yearsExperience'))
          if (years !== null && c.yearsExperience == null) data.yearsExperience = years
          if (data.email && await tx.candidate.findFirst({ where: { email: data.email, id: { not: c.id } } })) delete data.email
          if (Object.keys(data).length) {
            Object.assign(c, data)
            await tx.candidate.update({ where: { id: c.id }, data: { ...data, searchText: candidateSearchText(c) } })
            stats.profileFields += Object.keys(data).length
          }

          // Puntajes y comentario de la postulación
          const scores = { ...(app.manualScores as Record<string, number>) }
          for (const [idx, id] of criterionId) if (typeof r[idx] === 'number' && scores[id] === undefined) { scores[id] = r[idx]; stats.scores++ }
          const notes = get('notes')
          const appData: Record<string, any> = { manualScores: scores }
          if (notes && !app.notes) { appData.notes = notes; stats.notes++ }
          await tx.candidateApplication.update({ where: { id: app.id }, data: appData })
          app.manualScores = scores
        }
      }
    }
    console.log(report.join('\n'))
    console.log(stats)
    if (!APPLY) throw new Error('__SIMULACION__')
  }, { timeout: 180_000, maxWait: 20_000 })
  console.log('✔ Aplicado')
}

main()
  .catch(e => { if (e.message === '__SIMULACION__') console.log('Simulación: nada se guardó. Usar --apply.'); else { console.error(e); process.exit(1) } })
  .finally(() => prisma.$disconnect())
