import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'

interface EmployeeListQuery {
  search?: string
  status?: string
  legalEntity?: string
  contractType?: string
  departmentId?: string
  activeYear?: string
  activeMonth?: string
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

  // GET /api/employees/movements?year=2026&month=4&legalEntity=
  fastify.get<{ Querystring: { year: string; month?: string; legalEntity?: string } }>('/movements', async (req, reply) => {
    const { year, month, legalEntity } = req.query
    if (!year) return reply.status(400).send({ message: 'year es requerido' })

    const y = Number(year)
    const m = month ? Number(month) : null
    const startOfPeriod = m ? new Date(y, m - 1, 1)              : new Date(y, 0, 1)
    const endOfPeriod   = m ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999)

    const entityContractFilter = legalEntity
      ? { contracts: { some: { legalEntity: legalEntity as any, deletedAt: null } } }
      : {}

    const empSelect = {
      id: true, firstName: true, lastName: true, rut: true, startDate: true, endDate: true, status: true,
      contracts: { where: { deletedAt: null, isActive: true }, select: { legalEntity: true } },
      workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
    } as const

    const [ingresos, salidas, vacaciones] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { deletedAt: null, startDate: { gte: startOfPeriod, lte: endOfPeriod }, ...entityContractFilter },
        select: empSelect,
        orderBy: { startDate: 'asc' },
      }),
      fastify.prisma.employee.findMany({
        where: { deletedAt: null, endDate: { gte: startOfPeriod, lte: endOfPeriod }, ...entityContractFilter },
        select: empSelect,
        orderBy: { endDate: 'asc' },
      }),
      fastify.prisma.leave.findMany({
        where: {
          startDate: { lte: endOfPeriod },
          endDate:   { gte: startOfPeriod },
          status:    { in: ['APPROVED', 'PENDING'] },
        },
        select: {
          id: true, type: true, startDate: true, endDate: true, days: true, reason: true, status: true,
          employee: { select: { id: true, firstName: true, lastName: true, rut: true,
            contracts: { where: { deletedAt: null, isActive: true }, select: { legalEntity: true } },
            workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
          }},
        },
        orderBy: { startDate: 'asc' },
      }),
    ])

    return reply.send({ data: { ingresos, salidas, vacaciones } })
  })

  fastify.get<{ Querystring: EmployeeListQuery }>('/', async (req, reply) => {
    const { search, status, legalEntity, contractType, departmentId, activeYear, activeMonth, page = '1', limit = '100' } = req.query

    const where: Prisma.EmployeeWhereInput = { deletedAt: null }

    if (status) {
      const statuses = status.split(',').filter(Boolean)
      if (statuses.length === 1) where.status = statuses[0] as any
      else if (statuses.length > 1) where.status = { in: statuses as any }
    }

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
    if (legalEntity) {
      const entities = legalEntity.split(',').filter(Boolean)
      contractWhere.legalEntity = entities.length === 1 ? entities[0] as any : { in: entities as any }
    }
    if (contractType) {
      const types = contractType.split(',').filter(Boolean)
      contractWhere.type = types.length === 1 ? types[0] as any : { in: types as any }
    }

    if (legalEntity || contractType) {
      where.contracts = { some: contractWhere }
    }

    // Filtro de período activo: muestra empleados que estaban activos durante el año/mes indicado
    if (activeYear) {
      const y = Number(activeYear)
      const m = activeMonth ? Number(activeMonth) : null
      const periodStart = m ? new Date(y, m - 1, 1)              : new Date(y, 0, 1)
      const periodEnd   = m ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999)
      where.AND = [
        { startDate: { lte: periodEnd } },
        { OR: [{ endDate: null }, { endDate: { gte: periodStart } }] },
      ]
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
          workCenters: {
            include: { workCenter: { select: { id: true, name: true, costType: true } } },
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
