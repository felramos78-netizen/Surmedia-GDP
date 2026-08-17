import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { LegalEntity } from '@prisma/client'
import { normalizeRut } from '../utils/rut'

// ── Constantes del estándar de reportes ───────────────────────────────────────

const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

// Alias históricos de la columna "Contrato" de los reportes manuales de honorarios
// hacia el nombre real del centro de trabajo en GDP. Se usan para resolver un
// centro cuando el texto no coincide exacto con el catálogo.
export const CENTRO_ALIASES: Record<string, string> = {
  'NCEN':      'AMSA (NCEN)',
  'SPN':       'SALAR',
  'BHP':       'BHP ESCONDIDA',
  'DIRECCIÓN': 'COSTOS DE DIRECCIÓN',
  // Nomenclaturas antiguas que quedaron en reportes previos. Los centros de
  // destino son los vigentes en GDP; los de origen ya no existen como centro.
  'COSTOS ADMINISTRATIVOS':                'ADMINISTRACIÓN',
  'KINROSS (COMUNICACIONES Y LOBO MARTE)': 'KINROSS COMUNICACIONES Y LOBO MARTE',
  'CODELCO CORP':                          'CODELCO GCOM',
}

export function resolveCentro(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toUpperCase()
  return CENTRO_ALIASES[key] ?? raw.trim()
}

function boolLabel(v: boolean): string {
  return v ? 'Sí' : 'No'
}

// Rango [inicio, fin) del mes en UTC
function monthRange(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt:  new Date(Date.UTC(year, month, 1)),
  }
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

interface HonorariosQuery {
  year?:        string
  month?:       string
  legalEntity?: string
}

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/reports/honorarios?year=2026&month=7&legalEntity=COMUNICACIONES_SURMEDIA
  //
  // Estándar del reporte mensual de honorarios:
  //   · el mes lo define la FECHA DE EMISIÓN (no el día de pago)
  //   · solo boletas vigentes (las anuladas quedan fuera)
  //   · una fila por boleta, RUT normalizado a XX.XXX.XXX-X
  fastify.get<{ Querystring: HonorariosQuery }>('/honorarios', async (req, reply) => {
    const year  = Number(req.query.year)
    const month = Number(req.query.month)
    if (!year || !month || month < 1 || month > 12) {
      return reply.status(400).send({ message: 'year y month son requeridos (month entre 1 y 12)' })
    }

    const where: Prisma.SmartDocumentWhereInput = {
      category:     'HONORARIO',
      vigente:      true,
      fechaEmision: monthRange(year, month),
    }
    if (req.query.legalEntity) {
      where.legalEntity = req.query.legalEntity as LegalEntity
    }

    const docs = await fastify.prisma.smartDocument.findMany({
      where,
      include: {
        proveedor:  { select: { rut: true, razonSocial: true } },
        workCenter: { select: { name: true } },
      },
      orderBy: [{ fechaEmision: 'asc' }, { folio: 'asc' }],
    })

    const rows = docs.map(d => ({
      diaPago:              d.fechaPago?.toISOString()    ?? null,
      reembolsable:         d.tipo ?? '',
      contrato:             d.workCenter?.name ?? '',
      clasificacionInterna: d.categoria ?? '',
      razonSocialInterna:   ENTITY_LABEL[d.legalEntity],
      fechaEmision:         d.fechaEmision?.toISOString() ?? null,
      razonSocial:          d.proveedor.razonSocial.trim(),
      rut:                  normalizeRut(d.proveedor.rut),
      folio:                String(d.folio ?? ''),
      montoTotal:           d.montoTotal,
      pagado:               boolLabel(d.pagado),
      glosa:                (d.glosa ?? '').trim(),
    }))

    // Celdas sin completar: el reporte igual se emite, RRHH las llena a mano.
    const pendientes = {
      sinContrato:      rows.filter(r => !r.contrato).length,
      sinClasificacion: rows.filter(r => !r.clasificacionInterna).length,
      sinReembolsable:  rows.filter(r => !r.reembolsable).length,
    }

    return reply.send({
      data: rows,
      meta: {
        year, month,
        total:      rows.length,
        montoTotal: rows.reduce((s, r) => s + r.montoTotal, 0),
        pendientes,
      },
    })
  })

  // GET /api/reports/honorarios/periodos — meses con boletas vigentes emitidas
  fastify.get('/honorarios/periodos', async (_req, reply) => {
    const rows = await fastify.prisma.$queryRaw<{ year: number; month: number; n: bigint }[]>`
      SELECT EXTRACT(YEAR  FROM "fechaEmision")::int AS year,
             EXTRACT(MONTH FROM "fechaEmision")::int AS month,
             COUNT(*) AS n
      FROM smart_documents
      WHERE category = 'HONORARIO' AND vigente = true AND "fechaEmision" IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2 DESC
    `
    return reply.send({
      data: rows.map(r => ({ year: r.year, month: r.month, count: Number(r.n) })),
    })
  })
}

export default reportsRoutes
