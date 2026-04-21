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

  fastify.get('/', async (req, reply) => {
    const { employeeId, status } = req.query as { employeeId?: string; status?: string }
    const leaves = await fastify.prisma.leave.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(status && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: leaves })
  })

  fastify.post<{ Body: LeaveBody }>('/', async (req, reply) => {
    const { employeeId, type, startDate, endDate, days, reason } = req.body

    const employee = await fastify.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const leave = await fastify.prisma.leave.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days,
        reason,
        status: 'PENDING',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })
    return reply.status(201).send({ data: leave })
  })

  fastify.put<{ Params: { id: string }; Body: { status: 'APPROVED' | 'REJECTED' | 'CANCELLED'; reason?: string } }>(
    '/:id/status',
    async (req, reply) => {
      const { id } = req.params
      const { status } = req.body

      const leave = await fastify.prisma.leave.findUnique({ where: { id } })
      if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })

      const updated = await fastify.prisma.leave.update({
        where: { id },
        data: {
          status,
          ...(status === 'APPROVED' && {
            approvedBy: req.user.userId,
            approvedAt: new Date(),
          }),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await fastify.prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: `LEAVE_${status}`,
          entity: 'Leave',
          entityId: id,
          newValues: { status } as object,
        },
      })

      return reply.send({ data: updated })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const leave = await fastify.prisma.leave.findUnique({ where: { id: req.params.id } })
    if (!leave) return reply.status(404).send({ message: 'Solicitud no encontrada' })
    if (leave.status === 'APPROVED') {
      return reply.status(400).send({ message: 'No se puede eliminar una solicitud ya aprobada' })
    }
    await fastify.prisma.leave.delete({ where: { id: req.params.id } })
    return reply.send({ message: 'Solicitud eliminada' })
  })
}

export default leaveRoutes
