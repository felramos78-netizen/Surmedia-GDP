import type { FastifyReply, FastifyRequest } from 'fastify'
import type { UserRole } from '../types'

export function requireRole(...roles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(req.user.role)) {
      reply.status(403).send({ message: 'No tienes permisos para realizar esta acción' })
    }
  }
}
