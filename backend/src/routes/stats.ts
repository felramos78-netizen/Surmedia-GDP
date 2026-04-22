import type { FastifyPluginAsync } from 'fastify'

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/', async (_req, reply) => {
    const today = new Date()
    const in30Days = new Date(today)
    in30Days.setDate(in30Days.getDate() + 30)

    const [
      activeEmployees,
      expiringContracts,
      pendingLeaves,
      recentEmployees,
      upcomingBirthdays,
    ] = await Promise.all([
      fastify.prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } }),

      fastify.prisma.contract.count({
        where: {
          isActive: true,
          deletedAt: null,
          endDate: { gte: today, lte: in30Days },
        },
      }),

      fastify.prisma.leave.count({
        where: { status: 'PENDING' },
      }),

      fastify.prisma.employee.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, firstName: true, lastName: true,
          department: { select: { name: true } },
          createdAt: true,
        },
      }),

      fastify.prisma.employee.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          birthDate: { not: null },
        },
        select: {
          id: true, firstName: true, lastName: true, birthDate: true,
        },
      }),
    ])

    const currentMonth = today.getMonth()
    const nextMonth = (currentMonth + 1) % 12

    const birthdays = upcomingBirthdays
      .filter((e) => {
        if (!e.birthDate) return false
        const month = new Date(e.birthDate).getMonth()
        return month === currentMonth || month === nextMonth
      })
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        birthDate: e.birthDate,
      }))
      .slice(0, 5)

    return reply.send({
      data: {
        activeEmployees,
        expiringContracts,
        pendingLeaves,
        recentActivity: recentEmployees,
        upcomingBirthdays: birthdays,
      },
    })
  })
}

export default statsRoutes
