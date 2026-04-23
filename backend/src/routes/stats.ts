import type { FastifyPluginAsync } from 'fastify'

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [
      activeCount,
      expiringContracts,
      pendingLeaves,
      upcomingBirthdays,
      recentSyncs,
      byDepartment,
      byContract,
    ] = await Promise.all([
      fastify.prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } }),

      fastify.prisma.contract.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          endDate: { gte: now, lte: in30Days },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, rut: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 10,
      }),

      fastify.prisma.leave.count({ where: { status: 'PENDING' } }),

      fastify.prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          birthDate: {
            not: null,
          },
        },
        select: { id: true, firstName: true, lastName: true, birthDate: true, position: { select: { title: true } } },
      }),

      fastify.prisma.syncLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),

      fastify.prisma.department.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { employees: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      }),

      fastify.prisma.contract.groupBy({
        by: ['type'],
        where: { isActive: true, deletedAt: null },
        _count: { type: true },
      }),
    ])

    // Filtrar cumpleaños del mes actual (comparando mes y día)
    const birthdaysThisMonth = upcomingBirthdays
      .filter((e) => {
        if (!e.birthDate) return false
        const bd = new Date(e.birthDate)
        return bd.getMonth() === now.getMonth()
      })
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        position: e.position?.title ?? null,
        birthDate: e.birthDate,
        day: new Date(e.birthDate!).getDate(),
      }))
      .sort((a, b) => a.day - b.day)

    return reply.send({
      data: {
        activeEmployees: activeCount,
        pendingLeaves,
        expiringContracts: expiringContracts.map((c) => ({
          id: c.id,
          type: c.type,
          endDate: c.endDate,
          employee: c.employee,
        })),
        birthdaysThisMonth,
        recentSyncs,
        byDepartment: byDepartment.map((d) => ({
          id: d.id,
          name: d.name,
          count: d._count.employees,
        })),
        byContractType: byContract.map((c) => ({
          type: c.type,
          count: c._count.type,
        })),
      },
    })
  })
}

export default statsRoutes
