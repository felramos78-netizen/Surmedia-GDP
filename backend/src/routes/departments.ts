import type { FastifyPluginAsync } from 'fastify'

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const departments = await fastify.prisma.department.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    })
    return reply.send({ data: departments })
  })

  fastify.post<{ Body: { name: string; code: string; parentId?: string } }>(
    '/',
    async (req, reply) => {
      const { name, code, parentId } = req.body
      const existing = await fastify.prisma.department.findUnique({ where: { code } })
      if (existing) return reply.status(409).send({ message: 'Código de departamento ya existe' })

      const dept = await fastify.prisma.department.create({
        data: { name, code, parentId },
      })
      return reply.status(201).send({ data: dept })
    },
  )

  fastify.put<{ Params: { id: string }; Body: { name?: string; code?: string; parentId?: string } }>(
    '/:id',
    async (req, reply) => {
      const dept = await fastify.prisma.department.update({
        where: { id: req.params.id },
        data: req.body,
      })
      return reply.send({ data: dept })
    },
  )
}

export default departmentRoutes
