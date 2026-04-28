import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'

interface PayrollQuery {
  year?: string
  month?: string
  legalEntity?: string
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
    if (legalEntity) where.legalEntity = legalEntity as Prisma.EnumLegalEntityFilter

    const entries = await fastify.prisma.payrollEntry.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, rut: true, status: true },
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
