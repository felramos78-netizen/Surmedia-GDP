import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'

interface EmployeeListQuery {
  search?: string
  status?: string
  legalEntity?: string
  contractType?: string
  departmentId?: string
  page?: string
  limit?: string
}

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/stats', async (_req, reply) => {
    const now = new Date()
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [total, active, inactive, duplicate, expiring, inBoth,
           activeComunicaciones, inactiveComunicaciones,
           activeConsultoria, inactiveConsultoria] = await Promise.all([
      fastify.prisma.employee.count({ where: { deletedAt: null } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE' } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'DUPLICATE' } }),
      fastify.prisma.contract.count({
        where: { deletedAt: null, isActive: true, endDate: { gte: now, lte: thirtyDays } },
      }),
      fastify.prisma.employee.count({
        where: {
          deletedAt: null,
          AND: [
            { contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } },
            { contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA', deletedAt: null } } },
          ],
        },
      }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE',   contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE', contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE',   contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA',    deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE', contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA',    deletedAt: null } } } }),
    ])

    return reply.send({ data: {
      total, active, inactive, duplicate, expiring, inBoth,
      activeComunicaciones, inactiveComunicaciones,
      activeConsultoria, inactiveConsultoria,
    } })
  })

  fastify.get<{ Querystring: EmployeeListQuery }>('/', async (req, reply) => {
    const { search, status, legalEntity, contractType, departmentId, page = '1', limit = '100' } = req.query

    const where: Prisma.EmployeeWhereInput = { deletedAt: null }

    if (status) where.status = status as Prisma.EnumEmployeeStatusFilter

    if (departmentId) where.departmentId = departmentId

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { rut:       { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { position:  { title: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filtros que aplican sobre contratos
    const contractWhere: Prisma.ContractWhereInput = { deletedAt: null }
    if (legalEntity) contractWhere.legalEntity = legalEntity as Prisma.EnumLegalEntityNullableFilter
    if (contractType) contractWhere.type = contractType as Prisma.EnumContractTypeFilter

    if (legalEntity || contractType) {
      where.contracts = { some: contractWhere }
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [employees, total] = await Promise.all([
      fastify.prisma.employee.findMany({
        where,
        include: {
          position:   true,
          department: true,
          contracts: {
            where:   { deletedAt: null, isActive: true },
            orderBy: { startDate: 'desc' },
            take:    5,
          },
        },
        orderBy: { lastName: 'asc' },
        skip,
        take: Number(limit),
      }),
      fastify.prisma.employee.count({ where }),
    ])

    return reply.send({ data: employees, total, page: Number(page), limit: Number(limit) })
  })

  fastify.get<{ Params: { id: string } }>('/:id/payroll', async (req, reply) => {
    const entries = await fastify.prisma.$queryRaw<Array<{
      id: string; year: number; month: number; legalEntity: string;
      grossSalary: number; liquidSalary: number; items: unknown
    }>>`
      SELECT id, year, month, "legalEntity", "grossSalary", "liquidSalary", items
      FROM payroll_entries
      WHERE "employeeId" = ${req.params.id}::uuid
      ORDER BY year DESC, month DESC
    `
    return reply.send({ data: entries })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const employee = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        position:   true,
        department: true,
        contracts: {
          where:   { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
        leaves: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        documents: true,
      },
    })

    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    return reply.send({ data: employee })
  })
}

export default employeeRoutes
