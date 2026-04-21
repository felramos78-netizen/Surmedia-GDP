import type { FastifyPluginAsync } from 'fastify'
import { validateRut, formatRut } from '../utils/rut'
import { requireMinRole } from '../middleware/authorize'

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
  startDate: string
  endDate?: string
  afp?: string
  isapre?: string
  previredCode?: string
  managerId?: string
}

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (req, reply) => {
    const employees = await fastify.prisma.employee.findMany({
      where: { deletedAt: null },
      include: {
        position: true,
        department: true,
      },
      orderBy: { lastName: 'asc' },
    })
    return reply.send({ data: employees })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const employee = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        position: true,
        department: true,
        contracts: { where: { isActive: true, deletedAt: null } },
        leaves: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: true,
      },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    return reply.send({ data: employee })
  })

  fastify.post<{ Body: CreateEmployeeBody }>('/', { preHandler: [requireMinRole('RRHH_ANALYST')] }, async (req, reply) => {
    const body = req.body

    if (!validateRut(body.rut)) {
      return reply.status(400).send({ message: 'RUT inválido' })
    }
    const rutFormatted = formatRut(body.rut)

    const existing = await fastify.prisma.employee.findFirst({
      where: { rut: rutFormatted, deletedAt: null },
    })
    if (existing) {
      return reply.status(409).send({ message: 'Ya existe un colaborador con ese RUT' })
    }

    const employee = await fastify.prisma.employee.create({
      data: {
        rut: rutFormatted,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
        address: body.address,
        nationality: body.nationality ?? 'Chilena',
        gender: body.gender,
        positionId: body.positionId,
        departmentId: body.departmentId,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        afp: body.afp,
        isapre: body.isapre,
        previredCode: body.previredCode,
        managerId: body.managerId,
      },
      include: { position: true, department: true },
    })

    await fastify.prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'CREATE',
        entity: 'Employee',
        entityId: employee.id,
        newValues: employee as object,
      },
    })

    return reply.status(201).send({ data: employee })
  })

  fastify.put<{ Params: { id: string }; Body: Partial<CreateEmployeeBody> }>(
    '/:id',
    { preHandler: [requireMinRole('RRHH_ANALYST')] },
    async (req, reply) => {
      const { id } = req.params
      const body = req.body

      const current = await fastify.prisma.employee.findFirst({
        where: { id, deletedAt: null },
      })
      if (!current) return reply.status(404).send({ message: 'Colaborador no encontrado' })

      if (body.rut && body.rut !== current.rut) {
        if (!validateRut(body.rut)) {
          return reply.status(400).send({ message: 'RUT inválido' })
        }
        body.rut = formatRut(body.rut)
        const dup = await fastify.prisma.employee.findFirst({
          where: { rut: body.rut, deletedAt: null, NOT: { id } },
        })
        if (dup) return reply.status(409).send({ message: 'RUT ya registrado en otro colaborador' })
      }

      const updated = await fastify.prisma.employee.update({
        where: { id },
        data: {
          ...(body.rut && { rut: body.rut }),
          ...(body.firstName && { firstName: body.firstName }),
          ...(body.lastName && { lastName: body.lastName }),
          ...(body.email && { email: body.email }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.birthDate !== undefined && { birthDate: body.birthDate ? new Date(body.birthDate) : null }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.nationality && { nationality: body.nationality }),
          ...(body.gender !== undefined && { gender: body.gender }),
          ...(body.positionId !== undefined && { positionId: body.positionId }),
          ...(body.departmentId !== undefined && { departmentId: body.departmentId }),
          ...(body.startDate && { startDate: new Date(body.startDate) }),
          ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
          ...(body.afp !== undefined && { afp: body.afp }),
          ...(body.isapre !== undefined && { isapre: body.isapre }),
          ...(body.previredCode !== undefined && { previredCode: body.previredCode }),
          ...(body.managerId !== undefined && { managerId: body.managerId }),
        },
        include: { position: true, department: true },
      })

      await fastify.prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'UPDATE',
          entity: 'Employee',
          entityId: id,
          oldValues: current as object,
          newValues: updated as object,
        },
      })

      return reply.send({ data: updated })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [requireMinRole('RRHH_MANAGER')] }, async (req, reply) => {
    const { id } = req.params

    const employee = await fastify.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    await fastify.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    })

    await fastify.prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'DELETE',
        entity: 'Employee',
        entityId: id,
        oldValues: employee as object,
      },
    })

    return reply.send({ message: 'Colaborador eliminado correctamente' })
  })
}

export default employeeRoutes
