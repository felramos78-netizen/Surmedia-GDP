import type { FastifyPluginAsync } from 'fastify'

const positionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const positions = await fastify.prisma.position.findMany({
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { title: 'asc' },
    })
    return reply.send({ data: positions })
  })

  fastify.post<{ Body: { title: string; departmentId: string; level?: string } }>(
    '/',
    async (req, reply) => {
      const position = await fastify.prisma.position.create({
        data: req.body,
        include: { department: { select: { id: true, name: true } } },
      })
      return reply.status(201).send({ data: position })
    },
  )

  fastify.put<{ Params: { id: string }; Body: { title?: string; departmentId?: string; level?: string } }>(
    '/:id',
    async (req, reply) => {
      const position = await fastify.prisma.position.update({
        where: { id: req.params.id },
        data: req.body,
        include: { department: { select: { id: true, name: true } } },
      })
      return reply.send({ data: position })
    },
  )
}

export default positionRoutes
