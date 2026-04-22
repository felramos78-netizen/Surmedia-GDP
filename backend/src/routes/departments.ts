import type { FastifyPluginAsync } from 'fastify'

interface DepartmentBody {
  name: string
  code: string
  parentId?: string
}

interface PositionBody {
  title: string
  level?: string
  departmentId: string
}

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // ─── Departments ────────────────────────────────────────────

  fastify.get('/departments', async (_req, reply) => {
    const departments = await fastify.prisma.department.findMany({
      include: {
        children: true,
        positions: { select: { id: true, title: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    })
    return reply.send({ data: departments })
  })

  fastify.post<{ Body: DepartmentBody }>('/departments', async (req, reply) => {
    const existing = await fastify.prisma.department.findUnique({
      where: { code: req.body.code },
    })
    if (existing) {
      return reply.status(409).send({ message: 'Ya existe un departamento con ese código' })
    }

    const department = await fastify.prisma.department.create({ data: req.body })
    return reply.status(201).send({ data: department })
  })

  fastify.put<{ Params: { id: string }; Body: Partial<DepartmentBody> }>(
    '/departments/:id',
    async (req, reply) => {
      const department = await fastify.prisma.department.update({
        where: { id: req.params.id },
        data: req.body,
      })
      return reply.send({ data: department })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/departments/:id', async (req, reply) => {
    const employeeCount = await fastify.prisma.employee.count({
      where: { departmentId: req.params.id, deletedAt: null },
    })
    if (employeeCount > 0) {
      return reply.status(409).send({
        message: `No se puede eliminar: el departamento tiene ${employeeCount} colaborador(es) asignado(s)`,
      })
    }
    await fastify.prisma.department.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

  // ─── Positions ───────────────────────────────────────────────

  fastify.get('/positions', async (req: any, reply) => {
    const { departmentId } = req.query ?? {}
    const positions = await fastify.prisma.position.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: { select: { name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { title: 'asc' },
    })
    return reply.send({ data: positions })
  })

  fastify.post<{ Body: PositionBody }>('/positions', async (req, reply) => {
    const position = await fastify.prisma.position.create({
      data: req.body,
      include: { department: { select: { name: true } } },
    })
    return reply.status(201).send({ data: position })
  })

  fastify.put<{ Params: { id: string }; Body: Partial<PositionBody> }>(
    '/positions/:id',
    async (req, reply) => {
      const position = await fastify.prisma.position.update({
        where: { id: req.params.id },
        data: req.body,
        include: { department: { select: { name: true } } },
      })
      return reply.send({ data: position })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/positions/:id', async (req, reply) => {
    await fastify.prisma.position.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })
}

export default departmentRoutes
