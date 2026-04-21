import type { FastifyPluginAsync } from 'fastify'

interface BirthdayEmployee {
  id: string
  firstName: string
  lastName: string
  birthDate: Date | null
  position: { title: string } | null
}

interface BirthdayEntry extends BirthdayEmployee {
  daysUntil: number
  nextBirthday: string
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/stats', async (_req, reply) => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [activeCount, expiringContracts, pendingLeaves, upcomingBirthdays] = await Promise.all([
      fastify.prisma.employee.count({ where: { status: 'ACTIVE', deletedAt: null } }),

      fastify.prisma.contract.count({
        where: {
          isActive: true,
          deletedAt: null,
          endDate: { gte: now, lte: in30Days },
        },
      }),

      fastify.prisma.leave.count({
        where: { status: 'PENDING' },
      }),

      fastify.prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          birthDate: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          position: { select: { title: true } },
        },
      }) as Promise<BirthdayEmployee[]>,
    ])

    const today = new Date()
    const nextBirthdays: BirthdayEntry[] = (upcomingBirthdays as BirthdayEmployee[])
      .map((e): BirthdayEntry | null => {
        if (!e.birthDate) return null
        const bd = new Date(e.birthDate)
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        const nextBd = thisYear < today
          ? new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
          : thisYear
        const daysUntil = Math.ceil((nextBd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { ...e, daysUntil, nextBirthday: nextBd.toISOString() }
      })
      .filter((e): e is BirthdayEntry => e !== null)
      .sort((a: BirthdayEntry, b: BirthdayEntry) => a.daysUntil - b.daysUntil)
      .slice(0, 5)

    return reply.send({
      data: {
        activeEmployees: activeCount,
        expiringContracts,
        pendingLeaves,
        upcomingBirthdays: nextBirthdays,
      },
    })
  })
}

export default dashboardRoutes
