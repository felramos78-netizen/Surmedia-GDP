// Importación de CVs desde la unidad compartida de Drive (sincronizada en disco por Google Drive).
//
// Estructura esperada: <raíz>/<Vacante>/[subcarpetas de etapa…]/<archivo>
//   - La carpeta de primer nivel es la vacante (JobOpening.driveFolder).
//   - Las subcarpetas indican la etapa ("No aplica", "Idóneos", "Preseleccionados", "Dudas"…);
//     "old" marca la postulación como histórica.
// Los archivos no se copian: GDP guarda la ruta relativa y el hash (para detectar archivos movidos).
import { createHash, randomUUID } from 'crypto'
import { existsSync, readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import { extname, join, sep } from 'path'
import type { PrismaClient, RecruitmentStage, CandidateSource } from '@prisma/client'
import { extractCvText, parseCvData, type CvData } from './cvParser.service'
import { fold } from '../utils/text'

export const RECRUITMENT_ROOT = process.env.RECRUITMENT_DRIVE_PATH
  ?? 'G:\\Unidades compartidas\\GDP\\Surmedia RRHH\\Reclutamiento'

const CV_EXTS = new Set(['.pdf', '.docx'])

export function absolutePath(drivePath: string): string {
  return join(RECRUITMENT_ROOT, ...drivePath.split('/'))
}

// ── Reglas de carpeta ─────────────────────────────────────────────────────────

/** Etapa según la subcarpeta más profunda que la indique. */
export function stageFromFolders(folders: string[]): { stage: RecruitmentStage; isArchived: boolean } {
  const isArchived = folders.some(f => fold(f) === 'old')
  for (const f of [...folders].reverse()) {
    const k = fold(f)
    if (/no aplica|descartad/.test(k)) return { stage: 'DESCARTADO', isArchived }
    if (/aplica|idone|preselec|seleccion|terna|top/.test(k)) return { stage: 'PRESELECCIONADO', isArchived }
    if (/duda/.test(k)) return { stage: 'EN_REVISION', isArchived }
  }
  return { stage: 'RECIBIDO', isArchived }
}

function sourceFromFile(fileName: string, openingFolder: string): CandidateSource {
  if (fold(openingFolder) === 'hunting') return 'HUNTING'
  if (/^\d{4,8}_|^applicant_/i.test(fileName)) return 'PORTAL' // Descargas de portales de empleo
  return 'DRIVE'
}

/** Documentos de la carpeta que no son CVs (cartas oferta, descripciones de cargo). */
function looksLikeCv(fileName: string): boolean {
  return !/^(carta\s*)?oferta|descripci[oó]n de cargo|perfil de cargo/i.test(fileName)
}

export function cityFromFolder(folder: string): string | null {
  const k = fold(folder)
  if (/antofagasta/.test(k)) return 'Antofagasta'
  if (/copiapo/.test(k)) return 'Copiapó'
  if (/stgo|santiago/.test(k)) return 'Santiago'
  return null
}

// ── Recorrido de la carpeta ───────────────────────────────────────────────────

interface DriveFile { drivePath: string; fileName: string; openingFolder: string; folders: string[]; size: number; mtime: Date }

function listDriveFiles(): DriveFile[] {
  if (!existsSync(RECRUITMENT_ROOT)) {
    throw new Error(`No se encuentra la carpeta de Reclutamiento (${RECRUITMENT_ROOT}). ¿Está abierto Google Drive?`)
  }
  const out: DriveFile[] = []
  const walk = (dir: string, rel: string[]) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) { walk(abs, [...rel, name]); continue }
      if (rel.length === 0) continue // Archivos sueltos en la raíz (planillas, claves…) no son de una vacante
      if (name.startsWith('~$') || !CV_EXTS.has(extname(name).toLowerCase())) continue
      out.push({
        drivePath: [...rel, name].join('/'), fileName: name,
        openingFolder: rel[0], folders: rel.slice(1), size: st.size, mtime: st.mtime,
      })
    }
  }
  walk(RECRUITMENT_ROOT, [])
  return out
}

const sha1 = (buf: Buffer) => createHash('sha1').update(buf).digest('hex')

// ── Preview ───────────────────────────────────────────────────────────────────

export interface ImportRow {
  drivePath:     string
  fileName:      string
  openingFolder: string
  folderPath:    string          // Subcarpetas bajo la vacante, para mostrar
  stage:         RecruitmentStage
  isArchived:    boolean
  source:        CandidateSource
  contentHash:   string
  sizeBytes:     number
  modifiedAt:    string
  looksLikeCv:   boolean
  data:          CvData
  /** Candidato existente al que se sumaría el archivo */
  match?:        { candidateId: string; fullName: string; reason: 'email' | 'rut' | 'linkedin' | 'mismo archivo' }
  /** El mismo archivo ya estaba importado en otra ruta que ya no existe */
  movedFrom?:    string
}

export interface ImportPreview {
  root:      string
  rows:      ImportRow[]
  unchanged: number
  removed:   { id: string; drivePath: string; candidateName: string }[]
  openings:  { folder: string; exists: boolean; fileCount: number }[]
}

type CandidateLite = { id: string; fullName: string; email: string | null; rut: string | null; linkedinUrl: string | null }

const linkedinKey = (u: string | null | undefined) =>
  u ? u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') : null

function findMatch(d: Partial<CvData>, cands: CandidateLite[]): ImportRow['match'] {
  const email = d.email?.toLowerCase()
  const li    = linkedinKey(d.linkedinUrl)
  let c: CandidateLite | undefined
  if (email && (c = cands.find(x => x.email === email))) return { candidateId: c.id, fullName: c.fullName, reason: 'email' }
  if (d.rut && (c = cands.find(x => x.rut === d.rut))) return { candidateId: c.id, fullName: c.fullName, reason: 'rut' }
  if (li && (c = cands.find(x => linkedinKey(x.linkedinUrl) === li))) return { candidateId: c.id, fullName: c.fullName, reason: 'linkedin' }
  // Sin unión por nombre: con nombres mal extraídos ("Sobre Mí") juntaba a personas distintas
  return undefined
}

export async function buildDrivePreview(prisma: PrismaClient): Promise<ImportPreview> {
  const files = listDriveFiles()
  const [known, cands, openings] = await Promise.all([
    prisma.candidateFile.findMany({ select: { id: true, drivePath: true, contentHash: true, candidateId: true, removedAt: true, candidate: { select: { fullName: true } } } }),
    prisma.candidate.findMany({ select: { id: true, fullName: true, email: true, rut: true, linkedinUrl: true } }),
    prisma.jobOpening.findMany({ select: { driveFolder: true } }),
  ])
  const byPath   = new Map(known.map(k => [k.drivePath, k]))
  const byHash   = new Map(known.map(k => [k.contentHash, k]))
  const onDisk   = new Set(files.map(f => f.drivePath))
  const rows: ImportRow[] = []
  let unchanged = 0

  for (const f of files) {
    if (byPath.has(f.drivePath)) { unchanged++; continue }
    const buf  = await readFile(absolutePath(f.drivePath))
    const hash = sha1(buf)
    const base = {
      drivePath: f.drivePath, fileName: f.fileName, openingFolder: f.openingFolder,
      folderPath: f.folders.join(' / '), ...stageFromFolders(f.folders),
      source: sourceFromFile(f.fileName, f.openingFolder), contentHash: hash,
      sizeBytes: f.size, modifiedAt: f.mtime.toISOString(), looksLikeCv: looksLikeCv(f.fileName),
    }
    const same = byHash.get(hash)
    if (same) {
      // Mismo archivo ya importado: movido (la ruta anterior ya no existe) o copiado a otra vacante
      rows.push({
        ...base,
        data: { fullName: same.candidate.fullName, email: null, phone: null, rut: null, linkedinUrl: null },
        match: { candidateId: same.candidateId, fullName: same.candidate.fullName, reason: 'mismo archivo' },
        movedFrom: onDisk.has(same.drivePath) ? undefined : same.drivePath,
      })
      continue
    }
    let data: CvData = { fullName: null, email: null, phone: null, rut: null, linkedinUrl: null }
    try {
      const { text, links } = await extractCvText(buf, extname(f.fileName).toLowerCase())
      data = parseCvData(text, links, f.fileName)
    } catch { /* PDF dañado o protegido: se completa a mano */ }
    rows.push({ ...base, data, match: findMatch(data, cands) })
  }

  const movedPaths = new Set(rows.map(r => r.movedFrom).filter(Boolean))
  const removed = known
    .filter(k => !k.removedAt && !onDisk.has(k.drivePath) && !movedPaths.has(k.drivePath))
    .map(k => ({ id: k.id, drivePath: k.drivePath, candidateName: k.candidate.fullName }))

  const knownFolders = new Set(openings.map(o => o.driveFolder))
  const folderCounts = new Map<string, number>()
  for (const f of files) folderCounts.set(f.openingFolder, (folderCounts.get(f.openingFolder) ?? 0) + 1)

  return {
    root: RECRUITMENT_ROOT,
    rows: rows.sort((a, b) => a.drivePath.localeCompare(b.drivePath, 'es')),
    unchanged,
    removed,
    openings: [...folderCounts].map(([folder, fileCount]) => ({ folder, exists: knownFolders.has(folder), fileCount })),
  }
}

// ── Aplicar ───────────────────────────────────────────────────────────────────

export interface ApplyRow {
  drivePath:  string
  stage:      RecruitmentStage
  fullName:   string
  email:      string | null
  phone:      string | null
  rut:        string | null
  linkedinUrl: string | null
  /** Forzar candidato existente (o null para crear uno nuevo aunque haya coincidencia) */
  candidateId?: string | null
}

export function candidateSearchText(c: { fullName: string; email?: string | null; phone?: string | null; rut?: string | null }) {
  return fold([c.fullName, c.email, c.phone?.replace(/\D/g, ''), c.rut].filter(Boolean).join(' '))
}

const clean = (s: string | null | undefined) => (s && s.trim()) || null

export async function applyDriveImport(prisma: PrismaClient, input: ApplyRow[], removedIds: string[], cached?: ImportPreview) {
  // Rutas, hashes y etapas salen de la lectura de la carpeta, no del cliente
  const preview = cached ?? await buildDrivePreview(prisma)
  const rowsByPath = new Map(preview.rows.map(r => [r.drivePath, r]))

  // Vacantes (una por carpeta de primer nivel)
  const openingByFolder = new Map<string, string>()
  for (const o of await prisma.jobOpening.findMany({ select: { id: true, driveFolder: true } })) {
    if (o.driveFolder) openingByFolder.set(o.driveFolder, o.id)
  }
  const openingId = async (folder: string) => {
    let id = openingByFolder.get(folder)
    if (!id) {
      id = (await prisma.jobOpening.create({ data: { name: folder, driveFolder: folder, city: cityFromFolder(folder) } })).id
      openingByFolder.set(folder, id)
    }
    return id
  }

  const cands: (CandidateLite & { phone: string | null })[] = await prisma.candidate.findMany({
    select: { id: true, fullName: true, email: true, rut: true, linkedinUrl: true, phone: true },
  })
  const existingApps = new Map(
    (await prisma.candidateApplication.findMany({ select: { candidateId: true, jobOpeningId: true } }))
      .map(a => [`${a.candidateId}|${a.jobOpeningId}`, true]),
  )

  const newCandidates: any[] = []
  const candidateUpdates = new Map<string, Record<string, string>>()
  const newFiles: any[] = []
  const newApps = new Map<string, any>()
  const movedFiles: { from: string; to: ImportRow; stage: RecruitmentStage; openingId: string }[] = []
  const stats = { candidatesCreated: 0, candidatesUpdated: 0, files: 0, moved: 0, applications: 0, removed: 0, skipped: 0 }

  for (const inp of input) {
    const row = rowsByPath.get(inp.drivePath)
    if (!row) { stats.skipped++; continue } // Ya importado o ya no existe
    const opId = await openingId(row.openingFolder)

    if (row.movedFrom) {
      movedFiles.push({ from: row.movedFrom, to: row, stage: inp.stage, openingId: opId })
      continue
    }

    const d = {
      fullName: clean(inp.fullName) ?? row.fileName, email: clean(inp.email)?.toLowerCase() ?? null,
      phone: clean(inp.phone), rut: clean(inp.rut), linkedinUrl: clean(inp.linkedinUrl),
    }
    // Candidato: el elegido en la revisión, o la coincidencia por email/RUT/LinkedIn
    let cand: (typeof cands)[number] | undefined
    if (inp.candidateId) cand = cands.find(c => c.id === inp.candidateId)
    else if (inp.candidateId === undefined) {
      const m = findMatch(d, cands)
      if (m) cand = cands.find(c => c.id === m.candidateId)
    }

    if (cand) {
      // Completar solo los datos vacíos
      const upd: Record<string, string> = { ...(candidateUpdates.get(cand.id) ?? {}) }
      for (const k of ['email', 'rut', 'linkedinUrl', 'phone'] as const) {
        if (!cand[k] && d[k] && !cands.some(c => c !== cand && k !== 'phone' && k !== 'linkedinUrl' && c[k] === d[k])) {
          upd[k] = d[k]!; (cand as any)[k] = d[k]
        }
      }
      if (Object.keys(upd).length) candidateUpdates.set(cand.id, upd)
    } else {
      const id = randomUUID()
      cand = { id, ...d, fullName: d.fullName }
      // Evita chocar con los únicos (email / RUT) si otro candidato ya los tiene
      if (d.email && cands.some(c => c.email === d.email)) cand.email = null
      if (d.rut && cands.some(c => c.rut === d.rut)) cand.rut = null
      cands.push(cand)
      newCandidates.push({
        id, fullName: cand.fullName, email: cand.email, phone: cand.phone, rut: cand.rut,
        linkedinUrl: cand.linkedinUrl, source: row.source, searchText: candidateSearchText(cand),
      })
    }

    newFiles.push({
      candidateId: cand.id, jobOpeningId: opId, fileName: row.fileName, drivePath: row.drivePath,
      contentHash: row.contentHash, sizeBytes: row.sizeBytes, modifiedAt: new Date(row.modifiedAt),
    })
    const appKey = `${cand.id}|${opId}`
    if (!existingApps.has(appKey) && !newApps.has(appKey)) {
      newApps.set(appKey, { candidateId: cand.id, jobOpeningId: opId, stage: inp.stage, isArchived: row.isArchived })
    }
  }

  await prisma.$transaction(async tx => {
    if (newCandidates.length) stats.candidatesCreated = (await tx.candidate.createMany({ data: newCandidates })).count
    for (const [id, upd] of candidateUpdates) {
      const c = cands.find(x => x.id === id)!
      await tx.candidate.update({ where: { id }, data: { ...upd, searchText: candidateSearchText(c) } })
      stats.candidatesUpdated++
    }
    if (newFiles.length) stats.files = (await tx.candidateFile.createMany({ data: newFiles })).count
    if (newApps.size) stats.applications = (await tx.candidateApplication.createMany({ data: [...newApps.values()], skipDuplicates: true })).count

    // Archivos movidos de carpeta: nueva ruta y la etapa de la carpeta de destino
    for (const m of movedFiles) {
      const file = await tx.candidateFile.update({
        where: { drivePath: m.from },
        data: { drivePath: m.to.drivePath, fileName: m.to.fileName, jobOpeningId: m.openingId, removedAt: null },
      })
      await tx.candidateApplication.upsert({
        where:  { candidateId_jobOpeningId: { candidateId: file.candidateId, jobOpeningId: m.openingId } },
        create: { candidateId: file.candidateId, jobOpeningId: m.openingId, stage: m.stage, isArchived: m.to.isArchived },
        update: { stage: m.stage, isArchived: m.to.isArchived },
      })
      stats.moved++
    }

    const validRemoved = new Set(preview.removed.map(r => r.id))
    const ids = removedIds.filter(id => validRemoved.has(id))
    if (ids.length) stats.removed = (await tx.candidateFile.updateMany({ where: { id: { in: ids } }, data: { removedAt: new Date() } })).count
  }, { timeout: 60_000 })

  return stats
}

/** "3 años", "+5", "1-2 años", "6 meses" → años (primer número). null si no hay número. */
export function parseYears(v: string | number | null | undefined): number | null {
  if (typeof v === 'number') return v
  const s = fold(v ?? '')
  const m = s.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  return /mes/.test(s) && !/ano/.test(s) ? Math.round((n / 12) * 10) / 10 : n
}
