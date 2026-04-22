import type { FastifyPluginAsync } from 'fastify'

interface ContractBody {
  employeeId: string
  type: 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
  startDate: string
  endDate?: string
  salary: number
  currency?: string
  fileUrl?: string
}

const contractRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (req: any, reply) => {
    const { employeeId, expiringSoon } = req.query ?? {}
    const today = new Date()
    const in30Days = new Date(today)
    in30Days.setDate(in30Days.getDate() + 30)

    const where: any = { deletedAt: null }
    if (employeeId) where.employeeId = employeeId
    if (expiringSoon === 'true') {
      where.endDate = { gte: today, lte: in30Days }
      where.isActive = true
    }

    const contracts = await fastify.prisma.contract.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, rut: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ data: contracts })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const contract = await fastify.prisma.contract.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })
    if (!contract) return reply.status(404).send({ message: 'Contrato no encontrado' })
    return reply.send({ data: contract })
  })

  fastify.post<{ Body: ContractBody }>('/', async (req, reply) => {
    const { startDate, endDate, ...rest } = req.body

    // Desactivar contrato activo anterior del empleado si existe
    await fastify.prisma.contract.updateMany({
      where: { employeeId: rest.employeeId, isActive: true },
      data: { isActive: false },
    })

    const contract = await fastify.prisma.contract.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })

    return reply.status(201).send({ data: contract })
  })

  fastify.put<{ Params: { id: string }; Body: Partial<ContractBody> }>(
    '/:id',
    async (req, reply) => {
      const { startDate, endDate, ...rest } = req.body

      const existing = await fastify.prisma.contract.findFirst({
        where: { id: req.params.id, deletedAt: null },
      })
      if (!existing) return reply.status(404).send({ message: 'Contrato no encontrado' })

      const updated = await fastify.prisma.contract.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
        },
      })
      return reply.send({ data: updated })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await fastify.prisma.contract.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })
    if (!existing) return reply.status(404).send({ message: 'Contrato no encontrado' })

    await fastify.prisma.contract.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return reply.status(204).send()
  })
}

export default contractRoutes
