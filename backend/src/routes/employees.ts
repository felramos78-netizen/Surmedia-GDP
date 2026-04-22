import type { FastifyPluginAsync } from 'fastify'
import { validateRut, formatRut } from '../utils/rut'

interface CreateEmployeeBody {
  rut: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  birthDate?: string
  address?: string
  nationality?: string
  gender?: string
  positionId?: string
  departmentId?: string
  managerId?: string
  startDate: string
  endDate?: string
  afp?: string
  isapre?: string
  previredCode?: string
}

interface UpdateEmployeeBody extends Partial<CreateEmployeeBody> {
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
}

interface EmployeeQuerystring {
  search?: string
  departmentId?: string
  status?: string
  page?: string
  limit?: string
}

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get<{ Querystring: EmployeeQuerystring }>('/', async (req, reply) => {
    const { search, departmentId, status, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where: any = { deletedAt: null }

    if (status) where.status = status
    if (departmentId) where.departmentId = departmentId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { rut: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [employees, total] = await Promise.all([
      fastify.prisma.employee.findMany({
        where,
        include: { position: true, department: true },
        orderBy: { lastName: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      fastify.prisma.employee.count({ where }),
    ])

    return reply.send({ data: employees, total, page: parseInt(page), limit: parseInt(limit) })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const employee = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        position: true,
        department: true,
        contracts: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        leaves: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: true,
      },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    return reply.send({ data: employee })
  })

  fastify.post<{ Body: CreateEmployeeBody }>('/', async (req, reply) => {
    const { rut, startDate, birthDate, endDate, ...rest } = req.body

    if (!validateRut(rut)) {
      return reply.status(400).send({ message: 'RUT inválido' })
    }

    const formattedRut = formatRut(rut)

    const existing = await fastify.prisma.employee.findFirst({
      where: { rut: formattedRut, deletedAt: null },
    })
    if (existing) {
      return reply.status(409).send({ message: 'Ya existe un colaborador con ese RUT' })
    }

    const employee = await fastify.prisma.employee.create({
      data: {
        ...rest,
        rut: formattedRut,
        startDate: new Date(startDate),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
      },
      include: { position: true, department: true },
    })

    return reply.status(201).send({ data: employee })
  })

  fastify.put<{ Params: { id: string }; Body: UpdateEmployeeBody }>('/:id', async (req, reply) => {
    const existing = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })
    if (!existing) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const { startDate, endDate, birthDate, rut, ...rest } = req.body

    const updated = await fastify.prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
      },
      include: { position: true, department: true },
    })

    return reply.send({ data: updated })
  })

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })
    if (!existing) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    await fastify.prisma.employee.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    })

    return reply.status(204).send()
  })
}

export default employeeRoutes
