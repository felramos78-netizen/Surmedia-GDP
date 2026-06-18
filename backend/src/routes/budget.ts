import { FastifyInstance } from 'fastify'

export default async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (_req, reply) => {
    const categories = await app.prisma.budgetCategory.findMany({
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    return reply.send({ data: categories })
  })

  app.patch('/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as {
      name?: string
      annualAmount?: number
      spentAmount?: number
      notes?: string
    }
    const item = await app.prisma.budgetItem.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.annualAmount !== undefined && { annualAmount: body.annualAmount }),
        ...(body.spentAmount !== undefined && { spentAmount: body.spentAmount }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    })
    return reply.send({ data: item })
  })
}
