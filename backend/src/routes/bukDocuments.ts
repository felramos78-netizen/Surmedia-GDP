import type { FastifyPluginAsync } from 'fastify'
import { Readable } from 'stream'
import type { LegalEntity, Prisma, SignatureStatus } from '@prisma/client'
import { requireRole } from '../middleware/requireRole'
import { BUK_ENTITIES, fetchEmployeeFile } from '../services/bukApi.service'
import {
  syncAll, syncRut, syncProgress, lastFullSync, autoSyncIfStale,
  recategorizeAll, ensureDefaultCategories, loadRules, categorize, FALLBACK_CATEGORY,
} from '../services/bukDocumentSync.service'
import { fold } from '../utils/text'

// Documentos de colaboradores en BUK (ambas razones sociales). GDP guarda la
// metadata en buk_documents (sincronizada desde la API de BUK) y los archivos se
// descargan vía proxy. Acceso restringido a ADMIN porque incluye liquidaciones
// y contratos.

const ACTIVE = 'activo'

const fichaKey = (d: { legalEntity: string; bukEmployeeId: number }) => `${d.legalEntity}|${d.bukEmployeeId}`

// Raíz de un nombre de archivo sin fechas, números, nombre de la persona ni
// sufijos de versión: agrupa "2026_01_Liquidacion_Juan_Perez_F1.pdf" y
// "2025_12_Liquidacion_Ana_Diaz.pdf" como "liquidacion"
function filenameStem(filename: string, personName: string) {
  const nameWords = new Set(fold(personName).split(' '))
  return fold(filename.replace(/\.[a-z0-9]+$/i, ''))
    .split(' ')
    .filter(w => w.length > 1 && !/\d/.test(w) && !nameWords.has(w) && !/^f\d$/.test(w))
    .join(' ')
}

const docSelect = {
  id: true, bukFileId: true, filename: true, folder: true, bukCreatedAt: true,
  category: { select: { id: true, name: true } }, categoryManual: true,
  employeeSign: true, employeeSignedAt: true, companySign: true, companySignedAt: true, companySignerType: true,
} satisfies Prisma.BukDocumentSelect

type DocRow = Prisma.BukDocumentGetPayload<{ select: typeof docSelect }>

const toFile = (d: DocRow) => ({
  id:        d.id,
  fileId:    d.bukFileId,
  categoryManual: d.categoryManual,
  filename:  d.filename,
  folder:    d.folder,
  createdAt: d.bukCreatedAt?.toISOString() ?? null,
  category:  d.category,
  // Firmas: null = aún no consultadas en BUK
  employeeSign:      d.employeeSign,
  employeeSignedAt:  d.employeeSignedAt?.toISOString() ?? null,
  companySign:       d.companySign,
  companySignedAt:   d.companySignedAt?.toISOString() ?? null,
  companySignerType: d.companySignerType,
})

interface CategoryBody { name?: string; group?: string; keywords?: string[]; required?: boolean; sortOrder?: number }

function parseCategory(body: CategoryBody, partial: boolean): Prisma.DocumentCategoryUpdateInput | string {
  const data: Prisma.DocumentCategoryUpdateInput = {}
  if (body.name !== undefined || !partial) {
    if (!body.name?.trim()) return 'El nombre es obligatorio'
    data.name = body.name.trim()
  }
  if (body.group !== undefined || !partial) {
    if (!body.group?.trim()) return 'El grupo es obligatorio'
    data.group = body.group.trim()
  }
  if (body.keywords !== undefined || !partial) {
    const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
      .map(k => String(k).trim()).filter(Boolean)
    if (!keywords.length) return 'Agrega al menos una palabra clave'
    data.keywords = keywords
  }
  if (body.required !== undefined)  data.required  = !!body.required
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0)
  return data
}

const bukDocumentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', requireRole('ADMIN'))

  const prisma = fastify.prisma
  const logErr = (err: unknown) => fastify.log.error(err, 'Error sincronizando documentos BUK')

  // Última sincronización exitosa que cubre a un RUT (la total o la del RUT)
  async function syncedAtFor(rut: string) {
    const last = await prisma.bukDocumentSync.findFirst({
      where:   { status: 'OK', scope: { in: ['ALL', rut] } },
      orderBy: { finishedAt: 'desc' },
    })
    return last?.finishedAt?.toISOString() ?? null
  }

  async function employeeDocs(rut: string) {
    const rows = await prisma.bukDocument.findMany({
      where:   { rut, removedAt: null },
      select:  { ...docSelect, legalEntity: true, bukEmployeeId: true, bukStatus: true },
      orderBy: [{ legalEntity: 'asc' }, { bukCreatedAt: 'desc' }],
    })
    const entities = new Map<string, { legalEntity: LegalEntity; bukEmployeeId: number; bukStatus: string; files: ReturnType<typeof toFile>[] }>()
    for (const r of rows) {
      const key = fichaKey(r)
      if (!entities.has(key)) entities.set(key, { legalEntity: r.legalEntity, bukEmployeeId: r.bukEmployeeId, bukStatus: r.bukStatus, files: [] })
      entities.get(key)!.files.push(toFile(r))
    }
    return { rut, syncedAt: await syncedAtFor(rut), entities: [...entities.values()] }
  }

  const isFallback = async (id: string) =>
    !!(await prisma.documentCategory.findFirst({ where: { id, name: FALLBACK_CATEGORY }, select: { id: true } }))

  // ── Por colaborador ─────────────────────────────────────────────────────────

  // GET /api/documents/employee/:employeeId — documentos registrados en GDP. Si
  // el colaborador nunca se ha sincronizado, se consulta BUK en el momento.
  fastify.get<{ Params: { employeeId: string } }>('/employee/:employeeId', async (req, reply) => {
    const emp = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { rut: true } })
    if (!emp) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    let result = await employeeDocs(emp.rut)
    if (!result.entities.length && !result.syncedAt) {
      try { await syncRut(prisma, emp.rut) } catch (err) { logErr(err) }
      result = await employeeDocs(emp.rut)
    }
    return result
  })

  // POST /api/documents/employee/:employeeId/sync — "Actualizar desde BUK"
  fastify.post<{ Params: { employeeId: string } }>('/employee/:employeeId/sync', async (req, reply) => {
    const emp = await prisma.employee.findUnique({ where: { id: req.params.employeeId }, select: { rut: true } })
    if (!emp) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    try {
      await syncRut(prisma, emp.rut)
    } catch (err) {
      logErr(err)
      return reply.status(502).send({ message: 'No se pudo consultar BUK' })
    }
    return employeeDocs(emp.rut)
  })

  // ── Búsqueda ────────────────────────────────────────────────────────────────

  // GET /api/documents/search?q=&categoryId=&legalEntity=&status= — cuántos
  // documentos coinciden y quiénes los tienen. categoryId=none → sin clasificar.
  fastify.get<{ Querystring: { q?: string; categoryId?: string; legalEntity?: string; status?: string; employeeSign?: string; companySign?: string } }>('/search', async (req) => {
    void autoSyncIfStale(prisma, logErr)
    const { categoryId, legalEntity, status } = req.query
    const SIGN = ['NO_REQUERIDA', 'SIN_SOLICITAR', 'PENDIENTE', 'FIRMADA', 'RECHAZADA']
    const employeeSign = SIGN.includes(req.query.employeeSign ?? '') ? req.query.employeeSign as SignatureStatus : undefined
    const companySign  = SIGN.includes(req.query.companySign ?? '') ? req.query.companySign as SignatureStatus : undefined
    const q = fold(req.query.q)

    const scopeWhere: Prisma.BukDocumentWhereInput = {
      removedAt: null,
      ...(legalEntity && BUK_ENTITIES.includes(legalEntity as LegalEntity) ? { legalEntity: legalEntity as LegalEntity } : {}),
      ...(status ? { bukStatus: status } : {}),
    }
    const [scopeFichas, statuses, last] = await Promise.all([
      prisma.bukDocument.groupBy({ by: ['legalEntity', 'bukEmployeeId'], where: scopeWhere }),
      prisma.bukDocument.groupBy({ by: ['bukStatus'], where: { removedAt: null } }),
      lastFullSync(prisma),
    ])
    const base = {
      syncing:     syncProgress(),
      lastSyncAt:  last?.finishedAt?.toISOString() ?? null,
      statuses:    statuses.map(s => s.bukStatus).filter(Boolean).sort(),
      scopePeople: scopeFichas.length,
    }
    if (q.length < 2 && !categoryId && !employeeSign && !companySign) return { ...base, totalPeople: 0, totalFiles: 0, people: [] }

    const rows = await prisma.bukDocument.findMany({
      where: {
        ...scopeWhere,
        ...(q.length >= 2 ? { searchText: { contains: q } } : {}),
        ...(categoryId ? (categoryId === 'none'
          ? { OR: [{ categoryId: null }, { category: { name: FALLBACK_CATEGORY } }] }
          : { categoryId }) : {}),
        ...(employeeSign ? { employeeSign } : {}),
        ...(companySign ? { companySign } : {}),
      },
      select:  { ...docSelect, legalEntity: true, bukEmployeeId: true, rut: true, personName: true, bukStatus: true, employeeId: true },
      orderBy: { bukCreatedAt: 'desc' },
    })

    const people = new Map<string, {
      legalEntity: LegalEntity; bukEmployeeId: number; rut: string; fullName: string
      bukStatus: string; employeeId: string | null; files: ReturnType<typeof toFile>[]
    }>()
    for (const r of rows) {
      const key = fichaKey(r)
      if (!people.has(key)) people.set(key, {
        legalEntity: r.legalEntity, bukEmployeeId: r.bukEmployeeId, rut: r.rut, fullName: r.personName,
        bukStatus: r.bukStatus, employeeId: r.employeeId, files: [],
      })
      people.get(key)!.files.push(toFile(r))
    }
    const list = [...people.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
    return { ...base, totalPeople: list.length, totalFiles: rows.length, people: list }
  })

  // ── Dashboard ───────────────────────────────────────────────────────────────

  // GET /api/documents/summary — documentos por categoría, cobertura de los
  // obligatorios por persona activa y los nombres más frecuentes sin clasificar.
  // La cobertura es por persona (RUT), no por ficha: quien tiene el documento en
  // otra ficha (la otra razón social o una ficha anterior por recontratación)
  // cuenta como cubierto.
  fastify.get('/summary', async () => {
    await ensureDefaultCategories(prisma)
    void autoSyncIfStale(prisma, logErr)
    const live = { removedAt: null }
    const [allCategories, byCategory, catFichas, allFichas, activeRuts, catRuts, uncategorized, last] = await Promise.all([
      prisma.documentCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.bukDocument.groupBy({ by: ['categoryId'], where: live, _count: { _all: true } }),
      prisma.bukDocument.groupBy({ by: ['categoryId', 'legalEntity', 'bukEmployeeId'], where: live }),
      prisma.bukDocument.groupBy({ by: ['legalEntity', 'bukEmployeeId'], where: live }),
      prisma.bukDocument.groupBy({ by: ['rut'], where: { ...live, bukStatus: ACTIVE } }),
      prisma.bukDocument.groupBy({ by: ['categoryId', 'rut'], where: live }),
      prisma.bukDocument.findMany({ where: { ...live, OR: [{ categoryId: null }, { category: { name: FALLBACK_CATEGORY } }] }, select: { filename: true, personName: true, legalEntity: true, bukEmployeeId: true } }),
      lastFullSync(prisma),
    ])

    const countBy = (rows: { categoryId: string | null }[]) => {
      const m = new Map<string | null, number>()
      for (const r of rows) m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + 1)
      return m
    }
    const fallback   = allCategories.find(c => c.name === FALLBACK_CATEGORY) ?? null
    const categories = allCategories.filter(c => c !== fallback)
    const docs = new Map(byCategory.map(r => [r.categoryId, r._count._all]))
    const fichas = countBy(catFichas)
    const active = new Set(activeRuts.map(r => r.rut))
    const activeWith = countBy(catRuts.filter(r => active.has(r.rut)))

    // Nombres sin clasificar más frecuentes (para crear categorías nuevas)
    const stems = new Map<string, { docs: number; fichas: Set<string>; example: string }>()
    for (const d of uncategorized) {
      const stem = filenameStem(d.filename, d.personName) || '(sin nombre)'
      const s = stems.get(stem) ?? { docs: 0, fichas: new Set<string>(), example: d.filename }
      s.docs++; s.fichas.add(fichaKey(d))
      stems.set(stem, s)
    }

    return {
      syncing:      syncProgress(),
      lastSync:     last ? { at: last.finishedAt?.toISOString() ?? null, filesAdded: last.filesAdded, filesRemoved: last.filesRemoved, failed: last.failed } : null,
      totalDocs:    [...docs.values()].reduce((a, b) => a + b, 0),
      totalFichas:  allFichas.length,
      activePeople: active.size,
      uncategorizedDocs: (docs.get(null) ?? 0) + (fallback ? docs.get(fallback.id) ?? 0 : 0),
      fallbackCategory:  fallback ? { id: fallback.id, name: fallback.name } : null,
      categories: categories.map(c => ({
        id: c.id, name: c.name, group: c.group, keywords: c.keywords, required: c.required, sortOrder: c.sortOrder,
        docs:       docs.get(c.id) ?? 0,
        fichas:     fichas.get(c.id) ?? 0,
        activeWith: activeWith.get(c.id) ?? 0,
      })),
      topUncategorized: [...stems.entries()]
        .map(([stem, s]) => ({ stem, docs: s.docs, fichas: s.fichas.size, example: s.example }))
        .sort((a, b) => b.docs - a.docs)
        .slice(0, 30),
    }
  })

  // GET /api/documents/categories/:id/missing — personas activas que no tienen
  // documentos de la categoría en ninguna de sus fichas BUK
  fastify.get<{ Params: { id: string } }>('/categories/:id/missing', async (req) => {
    const live = { removedAt: null }
    const [activeFichas, withCat] = await Promise.all([
      prisma.bukDocument.groupBy({ by: ['rut', 'legalEntity', 'personName', 'employeeId'], where: { ...live, bukStatus: ACTIVE } }),
      prisma.bukDocument.groupBy({ by: ['rut'], where: { ...live, categoryId: req.params.id } }),
    ])
    const has = new Set(withCat.map(r => r.rut))
    const people = new Map<string, { rut: string; fullName: string; employeeId: string | null; legalEntities: LegalEntity[] }>()
    for (const f of activeFichas) {
      if (has.has(f.rut)) continue
      const p = people.get(f.rut) ?? { rut: f.rut, fullName: f.personName, employeeId: f.employeeId, legalEntities: [] }
      if (!p.legalEntities.includes(f.legalEntity)) p.legalEntities.push(f.legalEntity)
      p.employeeId ??= f.employeeId
      people.set(f.rut, p)
    }
    return [...people.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
  })

  // ── Categorías (CRUD) ───────────────────────────────────────────────────────
  // Cualquier cambio reclasifica todos los documentos.

  fastify.post<{ Body: CategoryBody }>('/categories', async (req, reply) => {
    const data = parseCategory(req.body ?? {}, false)
    if (typeof data === 'string') return reply.status(400).send({ message: data })
    const exists = await prisma.documentCategory.findUnique({ where: { name: data.name as string } })
    if (exists) return reply.status(409).send({ message: 'Ya existe una categoría con ese nombre' })
    const cat = await prisma.documentCategory.create({ data: data as Prisma.DocumentCategoryCreateInput })
    const reclassified = await recategorizeAll(prisma)
    return { category: cat, reclassified }
  })

  fastify.patch<{ Params: { id: string }; Body: CategoryBody }>('/categories/:id', async (req, reply) => {
    const data = parseCategory(req.body ?? {}, true)
    if (typeof data === 'string') return reply.status(400).send({ message: data })
    if (await isFallback(req.params.id)) return reply.status(400).send({ message: `"${FALLBACK_CATEGORY}" es la categoría por defecto y no se edita` })
    if (data.name) {
      const clash = await prisma.documentCategory.findFirst({ where: { name: data.name as string, NOT: { id: req.params.id } } })
      if (clash) return reply.status(409).send({ message: 'Ya existe una categoría con ese nombre' })
    }
    const cat = await prisma.documentCategory.update({ where: { id: req.params.id }, data })
    const reclassified = await recategorizeAll(prisma)
    return { category: cat, reclassified }
  })

  fastify.delete<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    if (await isFallback(req.params.id)) return reply.status(400).send({ message: `"${FALLBACK_CATEGORY}" es la categoría por defecto y no se borra` })
    // Los documentos fijados a mano en esta categoría vuelven a automático
    await prisma.bukDocument.updateMany({ where: { categoryId: req.params.id }, data: { categoryManual: false } })
    await prisma.documentCategory.delete({ where: { id: req.params.id } })
    const reclassified = await recategorizeAll(prisma)
    return { ok: true, reclassified }
  })

  // ── Categoría por documento (edición manual) ────────────────────────────────

  // Fija la categoría de uno o varios documentos (ids = id de buk_documents).
  // categoryId = null → vuelve a la clasificación automática.
  async function setCategory(ids: string[], categoryId: string | null) {
    if (categoryId) {
      await prisma.bukDocument.updateMany({ where: { id: { in: ids } }, data: { categoryId, categoryManual: true } })
      return
    }
    await ensureDefaultCategories(prisma)
    const rules = await loadRules(prisma)
    const docs = await prisma.bukDocument.findMany({ where: { id: { in: ids } }, select: { id: true, filename: true, folder: true } })
    for (const d of docs) {
      await prisma.bukDocument.update({ where: { id: d.id }, data: { categoryManual: false, categoryId: categorize(rules, d.filename, d.folder) } })
    }
  }

  fastify.patch<{ Params: { id: string }; Body: { categoryId?: string | null } }>('/files/:id/category', async (req, reply) => {
    const categoryId = req.body?.categoryId ?? null
    if (categoryId && !(await prisma.documentCategory.findUnique({ where: { id: categoryId } }))) {
      return reply.status(404).send({ message: 'Categoría no encontrada' })
    }
    await setCategory([req.params.id], categoryId)
    return { ok: true }
  })

  fastify.post<{ Body: { ids?: string[]; categoryId?: string | null } }>('/files/bulk-category', async (req, reply) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    if (!ids.length) return reply.status(400).send({ message: 'Selecciona al menos un documento' })
    const categoryId = req.body?.categoryId ?? null
    if (categoryId && !(await prisma.documentCategory.findUnique({ where: { id: categoryId } }))) {
      return reply.status(404).send({ message: 'Categoría no encontrada' })
    }
    for (let i = 0; i < ids.length; i += 1000) await setCategory(ids.slice(i, i + 1000), categoryId)
    return { ok: true, updated: ids.length }
  })

  // ── Descarga masiva ─────────────────────────────────────────────────────────

  const ZIP_MAX_FILES = 300
  const ZIP_MAX_BYTES = 500 * 1024 * 1024
  const safeName = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()

  // POST /api/documents/download-zip { ids } — ZIP con los archivos, en carpetas por categoría
  fastify.post<{ Body: { ids?: string[] } }>('/download-zip', async (req, reply) => {
    const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [])]
    if (!ids.length) return reply.status(400).send({ message: 'Selecciona al menos un documento' })
    if (ids.length > ZIP_MAX_FILES) return reply.status(400).send({ message: `Máximo ${ZIP_MAX_FILES} archivos por descarga; filtra más o descarga por partes` })

    const docs = await prisma.bukDocument.findMany({
      where:  { id: { in: ids }, removedAt: null },
      select: { legalEntity: true, bukEmployeeId: true, bukFileId: true, filename: true, rut: true, personName: true, category: { select: { name: true } } },
    })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PizZip = require('pizzip')
    const zip = new PizZip()
    const used = new Set<string>()
    let bytes = 0, next = 0, failed = 0
    const worker = async () => {
      while (next < docs.length) {
        const d = docs[next++]
        try {
          const res = await fetchEmployeeFile(d.legalEntity, d.bukEmployeeId, d.bukFileId)
          const buf = Buffer.from(await res.arrayBuffer())
          bytes += buf.length
          if (bytes > ZIP_MAX_BYTES) throw new Error('límite de tamaño')
          let path = `${safeName(d.category?.name ?? FALLBACK_CATEGORY)}/${safeName(`${d.rut} - ${d.personName} - ${d.filename}`)}`
          for (let n = 2; used.has(path); n++) path = path.replace(/(\.[^./]*)?$/, ` (${n})$1`)
          used.add(path)
          zip.file(path, buf)
        } catch { failed++ }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    if (bytes > ZIP_MAX_BYTES) return reply.status(413).send({ message: 'La descarga supera 500 MB; filtra más o descarga por partes' })
    if (!used.size) return reply.status(502).send({ message: 'No se pudo obtener ningún archivo desde BUK' })

    const out: Buffer = zip.generate({ type: 'nodebuffer', compression: 'STORE' })
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="documentos-gdp.zip"`)
      .header('X-Files-Failed', String(failed))
      .header('Cache-Control', 'private, no-store')
      .send(out)
  })

  // ── Sincronización total ────────────────────────────────────────────────────

  // POST /api/documents/sync — sincroniza todas las fichas BUK en segundo plano
  fastify.post('/sync', async () => {
    if (syncProgress()) return { started: false, syncing: syncProgress() }
    void syncAll(prisma).catch(logErr)
    return { started: true, syncing: syncProgress() }
  })

  // ── Archivo ─────────────────────────────────────────────────────────────────

  // GET /api/documents/file/:legalEntity/:bukEmployeeId/:fileId?download=1 — proxy del archivo
  fastify.get<{
    Params: { legalEntity: string; bukEmployeeId: string; fileId: string }
    Querystring: { download?: string; filename?: string }
  }>('/file/:legalEntity/:bukEmployeeId/:fileId', async (req, reply) => {
    const legalEntity   = req.params.legalEntity as LegalEntity
    const bukEmployeeId = Number(req.params.bukEmployeeId)
    const fileId        = Number(req.params.fileId)
    if (!BUK_ENTITIES.includes(legalEntity) || !Number.isInteger(bukEmployeeId) || !Number.isInteger(fileId)) {
      return reply.status(400).send({ message: 'Parámetros inválidos' })
    }

    let file: Response
    try {
      file = await fetchEmployeeFile(legalEntity, bukEmployeeId, fileId)
    } catch (err) {
      fastify.log.error(err, 'Error descargando documento BUK')
      return reply.status(502).send({ message: 'No se pudo obtener el archivo desde BUK' })
    }

    const filename    = (req.query.filename || `documento-${fileId}`).replace(/["\r\n]/g, '')
    const disposition = req.query.download ? 'attachment' : 'inline'
    reply
      .header('Content-Type', file.headers.get('content-type') ?? 'application/octet-stream')
      .header('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .header('Cache-Control', 'private, no-store')
    const length = file.headers.get('content-length')
    if (length) reply.header('Content-Length', length)
    return reply.send(Readable.fromWeb(file.body as any))
  })
}

export default bukDocumentsRoutes
