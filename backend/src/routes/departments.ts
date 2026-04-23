import type { FastifyPluginAsync } from 'fastify'

const departmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const departments = await fastify.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        positions: { select: { id: true, title: true, level: true } },
        _count: { select: { employees: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
    })
    return reply.send({ data: departments })
  })

  fastify.get<{ Params: { id: string } }>('/:id/positions', async (req, reply) => {
    const positions = await fastify.prisma.position.findMany({
      where: { departmentId: req.params.id },
      orderBy: { title: 'asc' },
    })
    return reply.send({ data: positions })
  })
}

export default departmentsRoutes
