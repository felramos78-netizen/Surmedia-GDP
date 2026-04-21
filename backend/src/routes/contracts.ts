import type { FastifyPluginAsync } from 'fastify'

interface ContractBody {
  employeeId: string
  type: 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
  startDate: string
  endDate?: string
  salary: number
  fileUrl?: string
}

const contractRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (req, reply) => {
    const { employeeId } = req.query as { employeeId?: string }
    const contracts = await fastify.prisma.contract.findMany({
      where: {
        deletedAt: null,
        ...(employeeId && { employeeId }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
      orderBy: { startDate: 'desc' },
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
    const { employeeId, type, startDate, endDate, salary, fileUrl } = req.body

    await fastify.prisma.contract.updateMany({
      where: { employeeId, isActive: true, deletedAt: null },
      data: { isActive: false },
    })

    const contract = await fastify.prisma.contract.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        salary,
        fileUrl,
        isActive: true,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
      },
    })

    await fastify.prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'CREATE',
        entity: 'Contract',
        entityId: contract.id,
        newValues: contract as object,
      },
    })

    return reply.status(201).send({ data: contract })
  })

  fastify.put<{ Params: { id: string }; Body: Partial<ContractBody> & { isActive?: boolean } }>(
    '/:id',
    async (req, reply) => {
      const { id } = req.params
      const current = await fastify.prisma.contract.findFirst({
        where: { id, deletedAt: null },
      })
      if (!current) return reply.status(404).send({ message: 'Contrato no encontrado' })

      const updated = await fastify.prisma.contract.update({
        where: { id },
        data: {
          ...(req.body.type && { type: req.body.type }),
          ...(req.body.startDate && { startDate: new Date(req.body.startDate) }),
          ...(req.body.endDate !== undefined && {
            endDate: req.body.endDate ? new Date(req.body.endDate) : null,
          }),
          ...(req.body.salary !== undefined && { salary: req.body.salary }),
          ...(req.body.fileUrl !== undefined && { fileUrl: req.body.fileUrl }),
          ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        },
      })
      return reply.send({ data: updated })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const contract = await fastify.prisma.contract.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })
    if (!contract) return reply.status(404).send({ message: 'Contrato no encontrado' })

    await fastify.prisma.contract.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return reply.send({ message: 'Contrato eliminado correctamente' })
  })
}

export default contractRoutes
