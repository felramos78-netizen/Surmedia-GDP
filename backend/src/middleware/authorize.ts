import type { FastifyRequest, FastifyReply } from 'fastify'

type Role = 'ADMIN' | 'RRHH_MANAGER' | 'RRHH_ANALYST' | 'MANAGER' | 'EMPLOYEE'

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 5,
  RRHH_MANAGER: 4,
  RRHH_ANALYST: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userRole = req.user?.role as Role | undefined
    if (!userRole || !roles.includes(userRole)) {
      return reply.status(403).send({ message: 'No tienes permisos para realizar esta acción' })
    }
  }
}

export function requireMinRole(minRole: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userRole = req.user?.role as Role | undefined
    const userLevel = userRole ? ROLE_HIERARCHY[userRole] : 0
    const required = ROLE_HIERARCHY[minRole]
    if (userLevel < required) {
      return reply.status(403).send({ message: 'No tienes permisos suficientes' })
    }
  }
}
