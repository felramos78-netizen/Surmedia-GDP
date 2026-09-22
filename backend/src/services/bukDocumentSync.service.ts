import type { LegalEntity, Prisma, PrismaClient } from '@prisma/client'
import { BUK_ENTITIES, listBukEmployees, findBukEmployees, listEmployeeFiles, type BukEmployeeRef, type BukFile } from './bukApi.service'
import { normalizeRut } from '../utils/rut'
import { fold } from '../utils/text'

// Sincroniza la metadata de los documentos BUK a la tabla buk_documents para
// que GDP "recuerde" qué documentos tiene cada colaborador sin consultar BUK
// cada vez, y los clasifica en categorías por palabras clave.

const CONCURRENCY = 6
const CHUNK = 1000
const AUTO_SYNC_AFTER_MS = 24 * 60 * 60_000

// ── Categorías ────────────────────────────────────────────────────────────────

// Semilla inicial, armada con los nombres reales de BUK (sep-2026). Se edita
// desde la UI. El orden es la prioridad: gana la primera que coincide, por eso
// las específicas (p.ej. "Anexo teletrabajo") van antes que las genéricas.
const DEFAULT_CATEGORIES: { name: string; group: string; keywords: string[]; required?: boolean }[] = [
  { name: 'Liquidación de sueldo',          group: 'Remuneraciones',       keywords: ['liquidac'] },
  { name: 'Certificado de vacaciones',      group: 'Vacaciones',           keywords: ['certificado de vacacion', 'comprobante de vacacion', 'vacaciones progresivas'] },
  { name: 'Carta oferta',                   group: 'Contratación',         keywords: ['carta oferta'] },
  { name: 'Anexo pacto horas extras',       group: 'Anexos de contrato',   keywords: ['pacto de hhee', 'pacto de horas extra', 'horas extra', 'hhee'] },
  { name: 'Anexo reajuste de remuneración', group: 'Anexos de contrato',   keywords: ['reajuste', 'cambio renta', 'cambio de renta'] },
  { name: 'Anexo teletrabajo',              group: 'Anexos de contrato',   keywords: ['teletrabajo'] },
  { name: 'Anexo uso de redes sociales',    group: 'Anexos de contrato',   keywords: ['redes sociales'] },
  { name: 'Anexo contrato indefinido',      group: 'Anexos de contrato',   keywords: ['anexo indefinido', 'contrato indefinido', 'paso a indefinido'] },
  { name: 'Anexo cambio de cargo',          group: 'Anexos de contrato',   keywords: ['cambio de cargo'] },
  { name: 'Anexo (otros)',                  group: 'Anexos de contrato',   keywords: ['anexo'] },
  { name: 'Contrato de trabajo',            group: 'Contratación',         keywords: ['contrato'], required: true },
  { name: 'RIOHS',                          group: 'Seguridad y salud (SSO)', keywords: ['riohs', 'reglamento interno'], required: true },
  { name: 'ODI',                            group: 'Seguridad y salud (SSO)', keywords: ['odi'], required: true },
  { name: 'IRL',                            group: 'Seguridad y salud (SSO)', keywords: ['irl'], required: true },
  { name: 'Entrega de EPP',                 group: 'Seguridad y salud (SSO)', keywords: ['epp', 'elementos de proteccion'] },
  { name: 'Difusión de protocolos',         group: 'Seguridad y salud (SSO)', keywords: ['difusi', 'protocolo', 'ley karin'] },
  { name: 'Consentimiento informado',       group: 'Seguridad y salud (SSO)', keywords: ['consentimiento'] },
  { name: 'Capacitación',                   group: 'Capacitación',         keywords: ['capacitaci', 'charla'] },
  { name: 'Entrega de equipos',             group: 'Equipamiento',         keywords: ['entrega de equipo', 'nota de entrega', 'notas de entrega', 'formato entrega'] },
  { name: 'Certificado de antigüedad',      group: 'Certificados',         keywords: ['antiguedad', 'antigedad', 'cert ant'] },
  { name: 'Certificado de título',          group: 'Documentos personales', keywords: ['certificado de titulo'] },
  { name: 'Certificado AFP / salud',        group: 'Documentos personales', keywords: ['afp', 'fonasa', 'isapre', 'certificado de afiliacion'] },
  { name: 'Certificado de antecedentes',    group: 'Documentos personales', keywords: ['certificado de antecedentes', 'certificado antecedentes', 'antecedentes'] },
  { name: 'Cédula de identidad',            group: 'Documentos personales', keywords: ['cedula', 'carnet'] },
  { name: 'Currículum',                     group: 'Documentos personales', keywords: ['cv', 'curriculum'] },
  { name: 'Amonestación',                   group: 'Relaciones laborales', keywords: ['amonestaci'] },
  { name: 'Carta de aviso de término',      group: 'Desvinculación',       keywords: ['carta aviso', 'carta de aviso', 'aviso de termino'] },
  { name: 'Finiquito',                      group: 'Desvinculación',       keywords: ['finiquito'] },
]

export async function ensureDefaultCategories(prisma: PrismaClient) {
  if (await prisma.documentCategory.count()) return
  await prisma.documentCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, required: c.required ?? false, sortOrder: (i + 1) * 10 })),
  })
}

interface CategoryRule { id: string; keywords: string[] }

async function loadRules(prisma: PrismaClient): Promise<CategoryRule[]> {
  const cats = await prisma.documentCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return cats.map(c => ({ id: c.id, keywords: c.keywords.map(fold).filter(Boolean) }))
}

// Coincidencia por inicio de palabra: "odi" encuentra "ODI Surmedia" pero no "periodo"
const matches = (text: string, kw: string) => ` ${text}`.includes(` ${kw}`)

// Primero se busca en el nombre del archivo; solo si nada coincide, en la carpeta
export function categorize(rules: CategoryRule[], filename: string, folder: string): string | null {
  const name = fold(filename), dir = fold(folder)
  for (const text of [name, dir]) {
    const rule = rules.find(r => r.keywords.some(kw => matches(text, kw)))
    if (rule) return rule.id
  }
  return null
}

// Recalcula la categoría de todos los documentos (tras editar categorías)
export async function recategorizeAll(prisma: PrismaClient) {
  const rules = await loadRules(prisma)
  const docs = await prisma.bukDocument.findMany({ select: { id: true, filename: true, folder: true, categoryId: true } })
  const changes = new Map<string | null, string[]>()
  for (const d of docs) {
    const cat = categorize(rules, d.filename, d.folder)
    if (cat === d.categoryId) continue
    changes.set(cat, [...(changes.get(cat) ?? []), d.id])
  }
  for (const [categoryId, ids] of changes) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      await prisma.bukDocument.updateMany({ where: { id: { in: ids.slice(i, i + CHUNK) } }, data: { categoryId } })
    }
  }
  return [...changes.values()].reduce((n, ids) => n + ids.length, 0)
}

// ── Sincronización ────────────────────────────────────────────────────────────

interface Ficha { legalEntity: LegalEntity; ref: BukEmployeeRef }

export interface SyncProgress { scope: string; done: number; total: number }
let running: SyncProgress | null = null
export const syncProgress = () => running

async function syncFichas(prisma: PrismaClient, fichas: Ficha[], scope: string, opts: { markMissingFichas: boolean }) {
  const log = await prisma.bukDocumentSync.create({ data: { scope, status: 'RUNNING', fichas: fichas.length } })
  // Solo la sincronización total expone su progreso (la de un RUT es breve)
  const progress: SyncProgress = { scope, done: 0, total: fichas.length }
  if (scope === 'ALL') running = progress
  try {
    // 1. Leer los archivos de cada ficha en BUK
    const read: { ficha: Ficha; files: BukFile[] }[] = []
    let failed = 0, next = 0
    const worker = async () => {
      while (next < fichas.length) {
        const ficha = fichas[next++]
        try { read.push({ ficha, files: await listEmployeeFiles(ficha.legalEntity, ficha.ref.id) }) }
        catch { failed++ }
        progress.done++
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // 2. Contexto: colaboradores GDP por RUT, categorías y documentos ya registrados
    const ruts = [...new Set(read.map(r => r.ficha.ref.rut))]
    const emps = await prisma.employee.findMany({ where: { rut: { in: ruts } }, select: { id: true, rut: true } })
    const employeeByRut = new Map(emps.map(e => [normalizeRut(e.rut), e.id]))
    const rules = await loadRules(prisma)
    const readFichas = read.map(r => ({ legalEntity: r.ficha.legalEntity, bukEmployeeId: r.ficha.ref.id }))
    const existing = readFichas.length
      ? await prisma.bukDocument.findMany({
          where: { OR: readFichas },
          select: {
            id: true, legalEntity: true, bukEmployeeId: true, bukFileId: true, filename: true, folder: true, removedAt: true,
            personName: true, bukStatus: true, employeeId: true, rut: true,
          },
        })
      : []
    const existingByKey = new Map(existing.map(d => [`${d.legalEntity}|${d.bukFileId}`, d]))

    const now = new Date()
    const toCreate: Prisma.BukDocumentCreateManyInput[] = []
    const seenIds: string[] = []
    let added = 0

    for (const { ficha, files } of read) {
      const { legalEntity, ref } = ficha
      const employeeId = employeeByRut.get(ref.rut) ?? null
      // Datos de la persona (nombre, estado, vínculo GDP): se refrescan solo si cambiaron
      const stale = existing.some(d => d.legalEntity === legalEntity && d.bukEmployeeId === ref.id &&
        (d.personName !== ref.fullName || d.bukStatus !== ref.status || d.employeeId !== employeeId || d.rut !== ref.rut))
      if (stale) {
        await prisma.bukDocument.updateMany({
          where: { legalEntity, bukEmployeeId: ref.id },
          data:  { personName: ref.fullName, bukStatus: ref.status, employeeId, rut: ref.rut },
        })
      }
      for (const f of files) {
        const prev = existingByKey.get(`${legalEntity}|${f.fileId}`)
        if (!prev) {
          added++
          toCreate.push({
            legalEntity, bukEmployeeId: ref.id, bukFileId: f.fileId, rut: ref.rut,
            personName: ref.fullName, bukStatus: ref.status, employeeId,
            filename: f.filename, folder: f.folder, searchText: fold(`${f.folder} ${f.filename}`),
            bukCreatedAt: f.createdAt ? new Date(f.createdAt) : null,
            categoryId: categorize(rules, f.filename, f.folder),
            firstSeenAt: now, lastSeenAt: now,
          })
          continue
        }
        seenIds.push(prev.id)
        if (prev.filename !== f.filename || prev.folder !== f.folder) {
          await prisma.bukDocument.update({
            where: { id: prev.id },
            data:  {
              filename: f.filename, folder: f.folder, searchText: fold(`${f.folder} ${f.filename}`),
              categoryId: categorize(rules, f.filename, f.folder),
            },
          })
        }
      }
    }

    // 3. Escribir: nuevos, vistos y los que ya no están en BUK
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await prisma.bukDocument.createMany({ data: toCreate.slice(i, i + CHUNK), skipDuplicates: true })
    }
    for (let i = 0; i < seenIds.length; i += CHUNK) {
      await prisma.bukDocument.updateMany({ where: { id: { in: seenIds.slice(i, i + CHUNK) } }, data: { lastSeenAt: now, removedAt: null } })
    }
    const seen = new Set(seenIds)
    const goneIds = existing.filter(d => !seen.has(d.id) && !d.removedAt).map(d => d.id)
    for (let i = 0; i < goneIds.length; i += CHUNK) {
      await prisma.bukDocument.updateMany({ where: { id: { in: goneIds.slice(i, i + CHUNK) } }, data: { removedAt: now } })
    }
    let removed = goneIds.length
    // Sincronización total: fichas que ya no existen en BUK
    if (opts.markMissingFichas && failed === 0) {
      const r = await prisma.bukDocument.updateMany({ where: { removedAt: null, lastSeenAt: { lt: now } , NOT: { OR: readFichas } }, data: { removedAt: now } })
      removed += r.count
    }

    const filesSeen = read.reduce((n, r) => n + r.files.length, 0)
    return await prisma.bukDocumentSync.update({
      where: { id: log.id },
      data:  { status: 'OK', finishedAt: new Date(), filesSeen, filesAdded: added, filesRemoved: removed, failed },
    })
  } catch (err) {
    await prisma.bukDocumentSync.update({
      where: { id: log.id },
      data:  { status: 'ERROR', finishedAt: new Date(), error: err instanceof Error ? err.message : String(err) },
    })
    throw err
  } finally {
    if (scope === 'ALL') running = null
  }
}

// Sincroniza todas las fichas BUK de ambas razones sociales (~280 fichas, ~40 s)
export async function syncAll(prisma: PrismaClient) {
  if (running) return null
  // Se marca en curso de inmediato para que dos clics seguidos no lancen dos sincronizaciones
  running = { scope: 'ALL', done: 0, total: 0 }
  try {
    await ensureDefaultCategories(prisma)
    const fichas: Ficha[] = []
    for (const legalEntity of BUK_ENTITIES) {
      for (const ref of await listBukEmployees(legalEntity)) fichas.push({ legalEntity, ref })
    }
    return await syncFichas(prisma, fichas, 'ALL', { markMissingFichas: true })
  } finally {
    running = null
  }
}

// Sincroniza solo las fichas de un RUT (botón "Actualizar desde BUK" de la ficha)
export async function syncRut(prisma: PrismaClient, rut: string) {
  await ensureDefaultCategories(prisma)
  const fichas: Ficha[] = []
  for (const legalEntity of BUK_ENTITIES) {
    for (const ref of await findBukEmployees(legalEntity, rut)) fichas.push({ legalEntity, ref })
  }
  return syncFichas(prisma, fichas, normalizeRut(rut), { markMissingFichas: false })
}

export async function lastFullSync(prisma: PrismaClient) {
  return prisma.bukDocumentSync.findFirst({ where: { scope: 'ALL', status: 'OK' }, orderBy: { startedAt: 'desc' } })
}

// Dispara una sincronización total en segundo plano si la última tiene más de 24 h
export async function autoSyncIfStale(prisma: PrismaClient, log: (err: unknown) => void) {
  if (running) return
  const last = await lastFullSync(prisma)
  if (last && Date.now() - last.startedAt.getTime() < AUTO_SYNC_AFTER_MS) return
  syncAll(prisma).catch(log)
}
