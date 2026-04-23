import type { FastifyPluginAsync } from 'fastify'

interface LeaveListQuery {
  employeeId?: string
  status?: string
  type?: string
  page?: string
  limit?: string
}

const leavesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get<{ Querystring: LeaveListQuery }>('/', async (req, reply) => {
    const { employeeId, status, type, page = '1', limit = '50' } = req.query

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (type) where.type = type

    const skip = (Number(page) - 1) * Number(limit)

    const [leaves, total] = await Promise.all([
      fastify.prisma.leave.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, rut: true, position: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      fastify.prisma.leave.count({ where }),
    ])

    return reply.send({ data: leaves, total, page: Number(page), limit: Number(limit) })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const leave = await fastify.prisma.leave.findUnique({
      where: { id: req.params.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })
    if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })
    return reply.send({ data: leave })
  })

  fastify.post<{ Body: any }>('/', async (req, reply) => {
    const { employeeId, type, startDate, endDate, days, reason } = req.body as any

    if (!employeeId || !type || !startDate || !endDate || !days) {
      return reply.status(400).send({ message: 'Faltan campos: employeeId, type, startDate, endDate, days' })
    }

    const employee = await fastify.prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const leave = await fastify.prisma.leave.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days: Number(days),
        reason: reason ?? null,
        status: 'PENDING',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })

    return reply.status(201).send({ data: leave })
  })

  fastify.put<{ Params: { id: string }; Body: any }>('/:id', async (req, reply) => {
    const { id } = req.params
    const { status, reason, startDate, endDate, days, type } = req.body as any

    const existing = await fastify.prisma.leave.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ message: 'Solicitud no encontrada' })

    const userId = (req as any).user?.id ?? 'system'

    const leave = await fastify.prisma.leave.update({
      where: { id },
      data: {
        ...(status    !== undefined && { status }),
        ...(reason    !== undefined && { reason }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate   !== undefined && { endDate: new Date(endDate) }),
        ...(days      !== undefined && { days: Number(days) }),
        ...(type      !== undefined && { type }),
        ...(status === 'APPROVED' && { approvedBy: userId, approvedAt: new Date() }),
        ...(status === 'REJECTED' && { approvedBy: userId, approvedAt: new Date() }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })

    return reply.send({ data: leave })
  })

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await fastify.prisma.leave.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.status(404).send({ message: 'Solicitud no encontrada' })
    if (existing.status !== 'PENDING') {
      return reply.status(409).send({ message: 'Solo se pueden eliminar solicitudes en estado PENDING' })
    }

    await fastify.prisma.leave.delete({ where: { id: req.params.id } })
    return reply.send({ message: 'Solicitud eliminada' })
  })
}

export default leavesRoutes
