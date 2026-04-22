import type { FastifyPluginAsync } from 'fastify'

interface LeaveBody {
  employeeId: string
  type: 'VACACIONES' | 'PERMISO' | 'LICENCIA_MEDICA' | 'LICENCIA_MATERNIDAD' | 'LICENCIA_PATERNIDAD' | 'OTRO'
  startDate: string
  endDate: string
  days: number
  reason?: string
}

const leaveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (req: any, reply) => {
    const { employeeId, status } = req.query ?? {}

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const leaves = await fastify.prisma.leave.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ data: leaves })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const leave = await fastify.prisma.leave.findUnique({
      where: { id: req.params.id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, rut: true },
        },
      },
    })
    if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })
    return reply.send({ data: leave })
  })

  fastify.post<{ Body: LeaveBody }>('/', async (req, reply) => {
    const { startDate, endDate, ...rest } = req.body

    const leave = await fastify.prisma.leave.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'PENDING',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return reply.status(201).send({ data: leave })
  })

  fastify.put<{ Params: { id: string }; Body: { status: 'APPROVED' | 'REJECTED' | 'CANCELLED'; reason?: string } }>(
    '/:id/status',
    async (req, reply) => {
      const { status } = req.body
      const userId = req.user.userId

      const leave = await fastify.prisma.leave.findUnique({ where: { id: req.params.id } })
      if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })
      if (leave.status !== 'PENDING' && status !== 'CANCELLED') {
        return reply.status(409).send({ message: 'Solo se pueden aprobar/rechazar solicitudes pendientes' })
      }

      const updated = await fastify.prisma.leave.update({
        where: { id: req.params.id },
        data: {
          status,
          ...(status === 'APPROVED' || status === 'REJECTED'
            ? { approvedBy: userId, approvedAt: new Date() }
            : {}),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      return reply.send({ data: updated })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const leave = await fastify.prisma.leave.findUnique({ where: { id: req.params.id } })
    if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })
    if (leave.status === 'APPROVED') {
      return reply.status(409).send({ message: 'No se puede eliminar una solicitud aprobada' })
    }

    await fastify.prisma.leave.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })
}

export default leaveRoutes
