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

  fastify.post<{ Body: any }>('/', async (req, reply) => {
    const {
      rut, firstName, lastName, email, phone, birthDate, address,
      nationality, gender, positionId, departmentId, managerId,
      status, startDate, endDate, afp, isapre, previredCode,
    } = req.body as any

    if (!rut || !firstName || !lastName || !email || !startDate) {
      return reply.status(400).send({ message: 'Faltan campos obligatorios: rut, firstName, lastName, email, startDate' })
    }

    const exists = await fastify.prisma.employee.findFirst({ where: { rut, deletedAt: null } })
    if (exists) return reply.status(409).send({ message: `Ya existe un colaborador con RUT ${rut}` })

    const employee = await fastify.prisma.employee.create({
      data: {
        rut, firstName, lastName, email,
        phone: phone ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
        address: address ?? null,
        nationality: nationality ?? 'Chilena',
        gender: gender ?? null,
        positionId: positionId ?? null,
        departmentId: departmentId ?? null,
        managerId: managerId ?? null,
        status: status ?? 'ACTIVE',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        afp: afp ?? null,
        isapre: isapre ?? null,
        previredCode: previredCode ?? null,
      },
      include: { position: true, department: true, contracts: true },
    })

    return reply.status(201).send({ data: employee })
  })

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', async (req, reply) => {
    const { id } = req.params
    const existing = await fastify.prisma.employee.findFirst({ where: { id, deletedAt: null } })
    if (!existing) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const {
      firstName, lastName, email, phone, birthDate, address,
      nationality, gender, positionId, departmentId, managerId,
      status, startDate, endDate, afp, isapre, previredCode,
    } = req.body as any

    const updated = await fastify.prisma.employee.update({
      where: { id },
      data: {
        ...(firstName   !== undefined && { firstName }),
        ...(lastName    !== undefined && { lastName }),
        ...(email       !== undefined && { email }),
        ...(phone       !== undefined && { phone }),
        ...(birthDate   !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(address     !== undefined && { address }),
        ...(nationality !== undefined && { nationality }),
        ...(gender      !== undefined && { gender }),
        ...(positionId  !== undefined && { positionId }),
        ...(departmentId !== undefined && { departmentId }),
        ...(managerId   !== undefined && { managerId }),
        ...(status      !== undefined && { status }),
        ...(startDate   !== undefined && { startDate: new Date(startDate) }),
        ...(endDate     !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(afp         !== undefined && { afp }),
        ...(isapre      !== undefined && { isapre }),
        ...(previredCode !== undefined && { previredCode }),
      },
      include: { position: true, department: true, contracts: { where: { deletedAt: null }, orderBy: { startDate: 'desc' } } },
    })

    return reply.send({ data: updated })
  })

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params
    const existing = await fastify.prisma.employee.findFirst({ where: { id, deletedAt: null } })
    if (!existing) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    await fastify.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    })

    return reply.send({ message: 'Colaborador eliminado correctamente' })
  })
}

export default employeeRoutes
