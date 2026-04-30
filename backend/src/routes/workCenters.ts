import type { FastifyPluginAsync } from 'fastify'

interface WorkCenterBody {
  name: string
  costType: 'DIRECTO' | 'INDIRECTO'
  presupuesto?: number | null
  ubicacion?: string | null
}

interface IngresoBody {
  name: string
  amount: number
}

const workCenterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // ── GET /work-centers ────────────────────────────────────────────────────────
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
        ingresos: { orderBy: { createdAt: 'asc' } },
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
      const totalIngresos = wc.ingresos.reduce((s, i) => s + i.amount, 0)
      const employeeIds = [...new Set(wc.assignments.map(a => a.employeeId))]
      return {
        id: wc.id,
        name: wc.name,
        costType: wc.costType,
        presupuesto: wc.presupuesto ?? null,
        ubicacion: wc.ubicacion ?? null,
        totalPersonnel,
        positions,
        employeeIds,
        ingresos: wc.ingresos.map(i => ({ id: i.id, name: i.name, amount: i.amount, createdAt: i.createdAt })),
        totalIngresos,
        createdAt: wc.createdAt,
        updatedAt: wc.updatedAt,
      }
    })

    return reply.send({ data })
  })

  // ── POST /work-centers ───────────────────────────────────────────────────────
  fastify.post<{ Body: WorkCenterBody }>('/', async (req, reply) => {
    const { name, costType, presupuesto, ubicacion } = req.body
    const wc = await fastify.prisma.workCenter.create({
      data: {
        name, costType,
        ...(presupuesto != null ? { presupuesto } : {}),
        ...(ubicacion   != null ? { ubicacion }   : {}),
      },
    })
    return reply.status(201).send({ data: { ...wc, ingresos: [], totalIngresos: 0 } })
  })

  // ── PATCH /work-centers/:id ──────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string }; Body: Partial<WorkCenterBody> }>('/:id', async (req, reply) => {
    const { name, costType, presupuesto, ubicacion } = req.body
    const wc = await fastify.prisma.workCenter.update({
      where: { id: req.params.id },
      data: {
        ...(name     ? { name }     : {}),
        ...(costType ? { costType } : {}),
        ...('presupuesto' in req.body ? { presupuesto: presupuesto ?? null } : {}),
        ...('ubicacion'   in req.body ? { ubicacion:   ubicacion   ?? null } : {}),
      },
    })
    return reply.send({ data: wc })
  })

  // ── DELETE /work-centers/:id ─────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await fastify.prisma.workCenter.delete({ where: { id: req.params.id } })
    return reply.send({ ok: true })
  })

  // ── POST /work-centers/:id/ingresos ─────────────────────────────────────────
  fastify.post<{ Params: { id: string }; Body: IngresoBody }>('/:id/ingresos', async (req, reply) => {
    const { name, amount } = req.body
    const ingreso = await fastify.prisma.workCenterIngreso.create({
      data: { workCenterId: req.params.id, name, amount },
    })
    return reply.status(201).send({ data: ingreso })
  })

  // ── PATCH /work-centers/:id/ingresos/:ingresoId ──────────────────────────────
  fastify.patch<{ Params: { id: string; ingresoId: string }; Body: Partial<IngresoBody> }>(
    '/:id/ingresos/:ingresoId',
    async (req, reply) => {
      const { name, amount } = req.body
      const ingreso = await fastify.prisma.workCenterIngreso.update({
        where: { id: req.params.ingresoId },
        data: {
          ...(name   !== undefined ? { name }   : {}),
          ...(amount !== undefined ? { amount } : {}),
        },
      })
      return reply.send({ data: ingreso })
    },
  )

  // ── DELETE /work-centers/:id/ingresos/:ingresoId ─────────────────────────────
  fastify.delete<{ Params: { id: string; ingresoId: string } }>(
    '/:id/ingresos/:ingresoId',
    async (req, reply) => {
      await fastify.prisma.workCenterIngreso.delete({ where: { id: req.params.ingresoId } })
      return reply.send({ ok: true })
    },
  )

  // ── POST /work-centers/:id/assign ───────────────────────────────────────────
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

  // ── DELETE /work-centers/:id/assign ─────────────────────────────────────────
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
