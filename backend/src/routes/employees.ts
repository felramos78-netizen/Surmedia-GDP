import type { FastifyPluginAsync } from 'fastify'

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
        contracts: { where: { isActive: true } },
        leaves: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: true,
      },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    return reply.send({ data: employee })
  })
}

export default employeeRoutes
