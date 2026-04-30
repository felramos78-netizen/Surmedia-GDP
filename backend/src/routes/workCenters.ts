import type { FastifyPluginAsync } from 'fastify'

interface WorkCenterBody {
  name: string
  costType: 'DIRECTO' | 'INDIRECTO'
  presupuesto?: number | null
  ingresosMensuales?: number | null
  ubicacion?: string | null
}

const workCenterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const centers = await fastify.prisma.workCenter.findMany({
      include: {
        assignments: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, jobTitle: true },
            },
          },
        },
      },
      orderBy: [{ costType: 'asc' }, { name: 'asc' }],
    })

    const data = centers.map(wc => {
      const totalPersonnel = new Set(wc.assignments.map(a => a.employeeId)).size
      const positionCounts = new Map<string, number>()
      for (const a of wc.assignments) {
        const title = a.employee.jobTitle ?? 'Sin cargo'
        positionCounts.set(title, (positionCounts.get(title) ?? 0) + 1)
      }
      const positions = Array.from(positionCounts.entries()).map(([title, count]) => ({ title, count }))
      return {
        id: wc.id,
        name: wc.name,
        costType: wc.costType,
        presupuesto: wc.presupuesto ?? null,
        ingresosMensuales: wc.ingresosMensuales ?? null,
        ubicacion: wc.ubicacion ?? null,
        totalPersonnel,
        positions,
        createdAt: wc.createdAt,
        updatedAt: wc.updatedAt,
      }
    })

    return reply.send({ data })
  })

  fastify.post<{ Body: WorkCenterBody }>('/', async (req, reply) => {
    const { name, costType, presupuesto, ingresosMensuales } = req.body
    const wc = await fastify.prisma.workCenter.create({
      data: {
        name, costType,
        ...(presupuesto != null ? { presupuesto } : {}),
        ...(ingresosMensuales != null ? { ingresosMensuales } : {}),
        ...(ubicacion != null ? { ubicacion } : {}),
      },
    })
    return reply.status(201).send({ data: wc })
  })

  fastify.patch<{ Params: { id: string }; Body: Partial<WorkCenterBody> }>('/:id', async (req, reply) => {
    const { name, costType, presupuesto, ingresosMensuales, ubicacion } = req.body
    const wc = await fastify.prisma.workCenter.update({
      where: { id: req.params.id },
      data: {
        ...(name      ? { name }      : {}),
        ...(costType  ? { costType }  : {}),
        ...('presupuesto'       in req.body ? { presupuesto:       presupuesto       ?? null } : {}),
        ...('ingresosMensuales' in req.body ? { ingresosMensuales: ingresosMensuales ?? null } : {}),
        ...('ubicacion'         in req.body ? { ubicacion:         ubicacion         ?? null } : {}),
      },
    })
    return reply.send({ data: wc })
  })

  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await fastify.prisma.workCenter.delete({ where: { id: req.params.id } })
    return reply.send({ ok: true })
  })

  fastify.post<{ Params: { id: string }; Body: { employeeId: string; legalEntity: string } }>(
    '/:id/assign',
    async (req, reply) => {
      const { employeeId, legalEntity } = req.body
      const assignment = await fastify.prisma.employeeWorkCenter.upsert({
        where: {
          employeeId_workCenterId_legalEntity: {
            employeeId,
            workCenterId: req.params.id,
            legalEntity: legalEntity as any,
          },
        },
        update: {},
        create: { employeeId, workCenterId: req.params.id, legalEntity: legalEntity as any },
      })
      return reply.status(201).send({ data: assignment })
    },
  )

  fastify.delete<{ Params: { id: string }; Body: { employeeId: string; legalEntity: string } }>(
    '/:id/assign',
    async (req, reply) => {
      const { employeeId, legalEntity } = req.body
      await fastify.prisma.employeeWorkCenter.deleteMany({
        where: { workCenterId: req.params.id, employeeId, legalEntity: legalEntity as any },
      })
      return reply.send({ ok: true })
    },
  )
}

export default workCenterRoutes
