import type { FastifyPluginAsync } from 'fastify'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

function resolveSmartDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'reportes', 'Smart'),
    path.join(process.cwd(), 'reportes', 'Smart'),
    path.resolve(__dirname, '../../../reportes/Smart'),
    path.resolve(__dirname, '../../../../reportes/Smart'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
}
const SMART_DIR = resolveSmartDir()

const FOLDERS = [
  { dir: 'Comunicaciones', entity: 'COMUNICACIONES_SURMEDIA' as const },
  { dir: 'Consultoría',    entity: 'SURMEDIA_CONSULTORIA'    as const },
]
type LegalEntityKey = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'
type SmartCat = 'HONORARIO' | 'COMPRA'

// ── Helpers ───────────────────────────────────────────────────────────────────

function latestFile(folder: string, keyword: string): string | null {
  if (!fs.existsSync(folder)) return null
  const f = fs.readdirSync(folder).filter(n => n.includes(keyword)).sort().reverse()[0]
  return f ? path.join(folder, f) : null
}

// Dates come as strings "DD/MM/YYYY" or "DD-MM-YYYY" in Smart exports
function parseDate(val: unknown): Date | null {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
}

function toInt(val: unknown): number {
  return Math.round(Number(String(val ?? '0').replace(/[^0-9.-]/g, '')) || 0)
}

// ── Row type ──────────────────────────────────────────────────────────────────

interface SmartRow {
  smartId:                   string
  category:                  SmartCat
  legalEntity:               LegalEntityKey
  rut:                       string
  razonSocial:               string
  documento:                 string
  codigoTributario:          string
  folio:                     string
  recibido:                  string
  vigente:                   boolean
  fechaEmision:              Date | null
  fechaVencimiento:          Date | null
  fechaPago:                 Date | null
  clasificacion:             string
  montoExento:               number
  montoAfecto:               number
  montoNeto:                 number
  retencion:                 number | null
  iva:                       number | null
  montoBruto:                number
  ivaFueraDePlazo:           number
  montoTotal:                number
  remanente:                 number
  pagado:                    boolean
  folioReferencia:           string
  codigoReferencia:          string
  codigoUnico:               string
  periodoTributario:         string
  periodoTributarioOriginal: string
  glosa:                     string
}

function parseSmartFile(fp: string, entity: LegalEntityKey, category: SmartCat): SmartRow[] {
  const wb   = XLSX.readFile(fp)
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return rows
    .filter(r => String(r['Id'] ?? '').trim())
    .map(r => {
      const isHon  = category === 'HONORARIO'
      const pagStr = String(r['Pagado'] ?? '').trim().toLowerCase()
      return {
        smartId:                   String(r['Id']).trim(),
        category,
        legalEntity:               entity,
        rut:                       String(r['Rut'] ?? '').trim(),
        razonSocial:               String(r['Razón Social'] ?? '').trim(),
        documento:                 String(r['Documento'] ?? '').trim(),
        codigoTributario:          String(r['Código Tributario'] ?? '').trim(),
        folio:                     String(r['Folio'] ?? '').trim(),
        recibido:                  String(r['Recibido'] ?? '').trim(),
        vigente:                   String(r['Vigente'] ?? '').toLowerCase() === 'sí',
        fechaEmision:              parseDate(r['Fecha Emisión']),
        fechaVencimiento:          parseDate(r['Fecha Original de Vencimiento']),
        fechaPago:                 parseDate(r['Fecha de pago']),
        clasificacion:             String(r['Clasificación'] ?? '').trim(),
        montoExento:               toInt(r['Monto Exento']),
        montoAfecto:               toInt(r['Monto Afecto']),
        montoNeto:                 toInt(r['Monto Neto']),
        retencion:                 isHon ? toInt(r['Retención']) : null,
        iva:                       !isHon ? toInt(r['IVA']) : null,
        montoBruto:                toInt(r['Monto Bruto']),
        ivaFueraDePlazo:           toInt(r['IVA Fuera de Plazo']),
        montoTotal:                toInt(r['Monto Total']),
        remanente:                 toInt(r['Remanente']),
        pagado:                    pagStr === 'x' || pagStr === 'true' || pagStr === 'sí',
        folioReferencia:           String(r['Folio de Referencia'] ?? '').trim(),
        codigoReferencia:          String(r['Código de Referencia'] ?? '').trim(),
        codigoUnico:               String(r['Código Único'] ?? '').trim(),
        periodoTributario:         String(r['Periodo Tributario'] ?? '').trim(),
        periodoTributarioOriginal: String(r['Periodo Tributario Original'] ?? '').trim(),
        glosa:                     String(r['Glosa'] ?? '').trim(),
      }
    })
}

function parseAllSmart(): { honorarios: SmartRow[]; compras: SmartRow[] } {
  const honorarios: SmartRow[] = []
  const compras:    SmartRow[] = []
  for (const { dir, entity } of FOLDERS) {
    const folder = path.join(SMART_DIR, dir)
    const hFile  = latestFile(folder, 'Honorarios')
    const cFile  = latestFile(folder, 'Libro_Compras')
    if (hFile) honorarios.push(...parseSmartFile(hFile, entity, 'HONORARIO'))
    if (cFile) compras.push(...parseSmartFile(cFile, entity, 'COMPRA'))
  }
  return { honorarios, compras }
}

// ── Routes ────────────────────────────────────────────────────────────────────

const smartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/smart/preview — lee Excel y devuelve diff vs DB
  fastify.get('/preview', async (_req, reply) => {
    const { honorarios, compras } = parseAllSmart()
    const allRows = [...honorarios, ...compras]
    const allIds  = allRows.map(r => r.smartId)

    const existing = await fastify.prisma.smartDocument.findMany({
      where: { smartId: { in: allIds } },
      select: { smartId: true, montoTotal: true, clasificacion: true, pagado: true },
    })
    const existingMap = new Map(existing.map(e => [e.smartId, e]))

    function diff(rows: SmartRow[]) {
      const nuevos:        SmartRow[] = []
      const cambios:       SmartRow[] = []
      const sincronizados: SmartRow[] = []

      for (const r of rows) {
        const ex = existingMap.get(r.smartId)
        if (!ex) {
          nuevos.push(r)
        } else if (ex.montoTotal !== r.montoTotal || ex.pagado !== r.pagado) {
          cambios.push(r)
        } else {
          sincronizados.push(r)
        }
      }
      return { nuevos, cambios, sincronizados }
    }

    return reply.send({
      honorarios: diff(honorarios),
      compras:    diff(compras),
    })
  })

  // POST /api/smart/apply — upsert documentos seleccionados
  fastify.post<{
    Body: {
      honorariosKeys?: string[]
      comprasKeys?:    string[]
    }
  }>('/apply', { bodyLimit: 10_000_000 }, async (req, reply) => {
    const { honorariosKeys = [], comprasKeys = [] } = req.body
    const selectedIds = new Set([...honorariosKeys, ...comprasKeys])
    if (selectedIds.size === 0) return reply.send({ applied: 0 })

    const { honorarios, compras } = parseAllSmart()
    const rows = [...honorarios, ...compras].filter(r => selectedIds.has(r.smartId))

    // 1. Upsert todos los proveedores primero (fuera de transacción, son pocos)
    const rutMap = new Map<string, string>()
    const uniqueProvs = [...new Map(rows.map(r => [r.rut, r])).values()]
    for (const r of uniqueProvs) {
      const prov = await fastify.prisma.smartProveedor.upsert({
        where:  { rut: r.rut },
        create: { rut: r.rut, razonSocial: r.razonSocial },
        update: { razonSocial: r.razonSocial },
        select: { id: true, rut: true },
      })
      rutMap.set(r.rut, prov.id)
    }

    // 2. Upsert documentos en chunks para evitar timeout
    const CHUNK = 50
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      await fastify.prisma.$transaction(async (tx) => {
        for (const r of chunk) {
          const proveedorId = rutMap.get(r.rut)!
          const data = {
            smartId: r.smartId, category: r.category, proveedorId, legalEntity: r.legalEntity,
            documento: r.documento, codigoTributario: r.codigoTributario, folio: r.folio,
            recibido: r.recibido, vigente: r.vigente,
            fechaEmision: r.fechaEmision ?? undefined, fechaVencimiento: r.fechaVencimiento ?? undefined, fechaPago: r.fechaPago ?? undefined,
            clasificacion: r.clasificacion, montoExento: r.montoExento, montoAfecto: r.montoAfecto,
            montoNeto: r.montoNeto, retencion: r.retencion, iva: r.iva, montoBruto: r.montoBruto,
            ivaFueraDePlazo: r.ivaFueraDePlazo, montoTotal: r.montoTotal, remanente: r.remanente,
            pagado: r.pagado, folioReferencia: r.folioReferencia, codigoReferencia: r.codigoReferencia,
            codigoUnico: r.codigoUnico, periodoTributario: r.periodoTributario,
            periodoTributarioOriginal: r.periodoTributarioOriginal, glosa: r.glosa,
          }
          await tx.smartDocument.upsert({
            where:  { smartId: r.smartId },
            create: data,
            update: {
              proveedorId, legalEntity: r.legalEntity, documento: r.documento,
              recibido: r.recibido, vigente: r.vigente,
              fechaEmision: r.fechaEmision ?? undefined, fechaVencimiento: r.fechaVencimiento ?? undefined, fechaPago: r.fechaPago ?? undefined,
              clasificacion: r.clasificacion, montoExento: r.montoExento, montoAfecto: r.montoAfecto,
              montoNeto: r.montoNeto, retencion: r.retencion, iva: r.iva, montoBruto: r.montoBruto,
              ivaFueraDePlazo: r.ivaFueraDePlazo, montoTotal: r.montoTotal, remanente: r.remanente,
              pagado: r.pagado, glosa: r.glosa,
            },
          })
        }
      }, { timeout: 30_000 })
    }

    return reply.send({ applied: rows.length })
  })

  // ── Shared proveedor select ───────────────────────────────────────────────────
  const PROV_SELECT = {
    id: true, rut: true, razonSocial: true, clasificacion: true,
    area: true, categoria: true,
  }

  const DOC_WC_INCLUDE = {
    proveedor:  { select: PROV_SELECT },
    workCenter: { select: { id: true, name: true } },
  }

  // ── Shared doc filter builder ─────────────────────────────────────────────────
  function docWhere(category: 'HONORARIO' | 'COMPRA', q: {
    legalEntity?: string; periodo?: string; clasificacion?: string; search?: string; pagado?: string
    area?: string; categoria?: string
  }) {
    return {
      category,
      ...(q.legalEntity  ? { legalEntity:       q.legalEntity as any } : {}),
      ...(q.periodo       ? { periodoTributario: q.periodo }            : {}),
      ...(q.clasificacion ? { clasificacion:     q.clasificacion }      : {}),
      ...(q.pagado !== undefined ? { pagado: q.pagado === 'true' }      : {}),
      ...(q.area      ? { proveedor: { area:      { contains: q.area,      mode: 'insensitive' as const } } } : {}),
      ...(q.categoria ? { proveedor: { categoria: { contains: q.categoria, mode: 'insensitive' as const } } } : {}),
      ...(q.search ? {
        OR: [
          { proveedor: { razonSocial: { contains: q.search, mode: 'insensitive' as const } } },
          { proveedor: { rut:         { contains: q.search, mode: 'insensitive' as const } } },
          { glosa:                    { contains: q.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }
  }

  type DocQuerystring = { legalEntity?: string; periodo?: string; clasificacion?: string; search?: string; pagado?: string; area?: string; categoria?: string }

  // GET /api/smart/honorarios
  fastify.get<{ Querystring: DocQuerystring }>('/honorarios', async (req, reply) => {
    const docs = await fastify.prisma.smartDocument.findMany({
      where:   docWhere('HONORARIO', req.query),
      include: DOC_WC_INCLUDE,
      orderBy: [{ periodoTributario: 'desc' }, { fechaEmision: 'desc' }],
    })
    return reply.send(docs)
  })

  // GET /api/smart/compras
  fastify.get<{ Querystring: DocQuerystring }>('/compras', async (req, reply) => {
    const docs = await fastify.prisma.smartDocument.findMany({
      where:   docWhere('COMPRA', req.query),
      include: DOC_WC_INCLUDE,
      orderBy: [{ periodoTributario: 'desc' }, { fechaEmision: 'desc' }],
    })
    return reply.send(docs)
  })

  // GET /api/smart/periodos
  fastify.get('/periodos', async (_req, reply) => {
    const docs = await fastify.prisma.smartDocument.findMany({
      select:   { periodoTributario: true },
      distinct: ['periodoTributario'],
      orderBy:  { periodoTributario: 'desc' },
    })
    return reply.send(docs.map(d => d.periodoTributario).filter(Boolean))
  })

  // GET /api/smart/proveedores — listado con stats
  fastify.get<{
    Querystring: { search?: string; area?: string; categoria?: string }
  }>('/proveedores', async (req, reply) => {
    const { search, area, categoria } = req.query
    const provs = await fastify.prisma.smartProveedor.findMany({
      where: {
        ...(area      ? { area:      { contains: area,      mode: 'insensitive' } } : {}),
        ...(categoria ? { categoria: { contains: categoria, mode: 'insensitive' } } : {}),
        ...(search ? {
          OR: [
            { razonSocial: { contains: search, mode: 'insensitive' } },
            { rut:         { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        workCenter: { select: { id: true, name: true } },
        documents: {
          select: { id: true, category: true, montoTotal: true, legalEntity: true, periodoTributario: true },
        },
      },
      orderBy: { razonSocial: 'asc' },
    })
    return reply.send(provs)
  })

  // GET /api/smart/proveedores/:id — ficha completa
  fastify.get<{ Params: { id: string } }>('/proveedores/:id', async (req, reply) => {
    const prov = await fastify.prisma.smartProveedor.findUnique({
      where:   { id: req.params.id },
      include: {
        workCenter: { select: { id: true, name: true } },
        documents:  {
          include: { proveedor: { select: PROV_SELECT } },
          orderBy: [{ periodoTributario: 'desc' }, { fechaEmision: 'desc' }],
        },
      },
    })
    if (!prov) return reply.status(404).send({ message: 'Proveedor no encontrado' })
    return reply.send(prov)
  })

  // PATCH /api/smart/documents/:id — actualiza workCenterId por documento
  fastify.patch<{
    Params: { id: string }
    Body:   { workCenterId?: string | null }
  }>('/documents/:id', async (req, reply) => {
    const { workCenterId } = req.body
    const doc = await fastify.prisma.smartDocument.update({
      where:   { id: req.params.id },
      data:    { workCenterId: workCenterId ?? null },
      include: DOC_WC_INCLUDE,
    })
    return reply.send(doc)
  })

  // PATCH /api/smart/proveedores/:id — actualiza area, categoria, notes
  fastify.patch<{
    Params: { id: string }
    Body:   { area?: string | null; categoria?: string | null; notes?: string | null; clasificacion?: string | null }
  }>('/proveedores/:id', async (req, reply) => {
    const { area, categoria, notes, clasificacion } = req.body
    const prov = await fastify.prisma.smartProveedor.update({
      where:  { id: req.params.id },
      data:   {
        ...(area          !== undefined ? { area }          : {}),
        ...(categoria     !== undefined ? { categoria }     : {}),
        ...(notes         !== undefined ? { notes }         : {}),
        ...(clasificacion !== undefined ? { clasificacion } : {}),
      },
    })
    return reply.send(prov)
  })

  // POST /api/smart/bulk-classify — asignación masiva de área/categoría por RUT+folio
  fastify.post<{
    Body: { items: { rut: string; folio: string; area: string; categoria: string }[] }
  }>('/bulk-classify', { bodyLimit: 2_000_000 }, async (req, reply) => {
    const { items } = req.body
    if (!items?.length) return reply.send({ updated: 0, notFound: 0, total: 0 })

    // Query all matching documents in one go
    const folios = items.map(i => i.folio)
    const ruts   = [...new Set(items.map(i => i.rut))]

    const docs = await fastify.prisma.smartDocument.findMany({
      where: {
        folio:     { in: folios },
        proveedor: { rut: { in: ruts } },
      },
      select: { folio: true, proveedor: { select: { id: true, rut: true } } },
    })

    // Map "rut|folio" → proveedorId
    const matchMap = new Map<string, string>()
    for (const doc of docs) {
      matchMap.set(`${doc.proveedor.rut}|${doc.folio}`, doc.proveedor.id)
    }

    // Collect one update per proveedor (last write wins for same proveedorId)
    const provUpdates = new Map<string, { area: string; categoria: string }>()
    let notFound = 0
    for (const item of items) {
      const provId = matchMap.get(`${item.rut}|${item.folio}`)
      if (provId) {
        provUpdates.set(provId, { area: item.area, categoria: item.categoria })
      } else {
        notFound++
      }
    }

    // Apply updates
    let updated = 0
    for (const [id, { area, categoria }] of provUpdates) {
      await fastify.prisma.smartProveedor.update({
        where: { id },
        data:  { area, categoria },
      })
      updated++
    }

    return reply.send({ updated, notFound, total: items.length })
  })
}

export default smartRoutes
