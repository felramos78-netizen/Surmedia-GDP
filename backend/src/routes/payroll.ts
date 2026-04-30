import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import { LegalEntity } from '@prisma/client'

interface PayrollQuery {
  year?: string
  month?: string
  legalEntity?: string
}

interface ImportPayrollItem {
  name: string
  amount: number
  taxable: boolean
  type?: string
}

interface ImportPayrollRow {
  rut: string
  year: number
  month: number
  grossSalary: number
  liquidSalary: number
  items: ImportPayrollItem[]
}

function normalizeRutImport(raw: string): string {
  // Mismo formato que buk.mapper.ts: "17.018.131-k" → "17.018.131-K"
  const clean = raw.replace(/\./g, '').trim()
  const [body, dv] = clean.split('-')
  if (!body || !dv) return raw
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv.toUpperCase()}`
}

const payrollRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/payroll?year=2025&month=3&legalEntity=COMUNICACIONES_SURMEDIA
  // Devuelve entradas de remuneraciones con nombre del colaborador
  fastify.get<{ Querystring: PayrollQuery }>('/', async (req, reply) => {
    const { year, month, legalEntity } = req.query

    const where: Prisma.PayrollEntryWhereInput = {}
    if (year)        where.year        = Number(year)
    if (month)       where.month       = Number(month)
    if (legalEntity) {
      const entities = legalEntity.split(',').filter(Boolean)
      where.legalEntity = entities.length === 1 ? entities[0] as any : { in: entities as any }
    }

    const entries = await fastify.prisma.payrollEntry.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, rut: true, status: true, jobTitle: true, costCenter: true, endDate: true,
            workCenters: {
              select: { legalEntity: true, workCenter: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { employee: { lastName: 'asc' } },
      ],
    })

    return reply.send({ data: entries })
  })

  // POST /api/payroll/import — importa liquidaciones desde Excel parseado en el frontend
  fastify.post<{ Body: { legalEntity: string; rows: ImportPayrollRow[] } }>('/import', {
    config: { bodyLimit: 10_000_000 },
  }, async (req, reply) => {
    try {
      const { legalEntity, rows } = req.body
      if (!legalEntity || !Array.isArray(rows) || rows.length === 0) {
        return reply.status(400).send({ message: 'legalEntity y rows son requeridos' })
      }

      const ruts = [...new Set(rows.map(r => normalizeRutImport(r.rut)))]
      const employees = await fastify.prisma.employee.findMany({
        where: { rut: { in: ruts } },
        select: { id: true, rut: true },
      })
      const rutToId = new Map(employees.map(e => [e.rut, e.id]))

      let upserted = 0
      const skippedRuts = new Set<string>()
      const errors: string[] = []

      for (const row of rows) {
        const rut = normalizeRutImport(row.rut)
        const employeeId = rutToId.get(rut)
        if (!employeeId) { skippedRuts.add(rut); continue }

        const entity       = legalEntity as LegalEntity
        const year         = Number(row.year)
        const month        = Number(row.month)
        const grossSalary  = Math.round(Number(row.grossSalary)  || 0)
        const liquidSalary = Math.round(Number(row.liquidSalary) || 0)
        const items        = row.items ?? []

        try {
          await fastify.prisma.payrollEntry.upsert({
            where: {
              employeeId_legalEntity_year_month: { employeeId, legalEntity: entity, year, month },
            },
            create: { employeeId, legalEntity: entity, year, month, grossSalary, liquidSalary, items },
            update: { grossSalary, liquidSalary, items },
          })
          upserted++
        } catch (rowErr: any) {
          errors.push(`${rut} (${year}/${month}): ${rowErr.message?.slice(0, 120)}`)
          if (errors.length >= 5) break
        }
      }

      return reply.send({
        ok: true,
        upserted,
        skipped: skippedRuts.size,
        skippedSample: [...skippedRuts].slice(0, 10),
        errors: errors.slice(0, 5),
      })
    } catch (err: any) {
      fastify.log.error({ err }, 'Error importando planilla')
      return reply.status(500).send({ message: err.message ?? 'Error interno' })
    }
  })

  // GET /api/payroll/years — años disponibles con datos
  fastify.get('/years', async (_req, reply) => {
    const rows = await fastify.prisma.payrollEntry.findMany({
      select:  { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    })
    return reply.send({ data: rows.map(r => r.year) })
  })
}

export default payrollRoutes
