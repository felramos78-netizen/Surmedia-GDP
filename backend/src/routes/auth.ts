import type { FastifyPluginAsync } from 'fastify'
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/auth.service'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/google', async (_req, reply) => {
    reply.redirect(getGoogleAuthUrl())
  })

  fastify.get<{ Querystring: { code?: string; error?: string } }>(
    '/google/callback',
    async (req, reply) => {
      const { code, error } = req.query

      if (error || !code) {
        return reply.redirect(`${process.env.APP_URL}/login?error=oauth_denied`)
      }

      try {
        const { user, token } = await handleGoogleCallback(code, fastify)
        const userEncoded = Buffer.from(JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        })).toString('base64')
        reply.redirect(`${process.env.APP_URL}/auth/callback?token=${token}&user=${userEncoded}`)
      } catch (err) {
        fastify.log.error(err)
        reply.redirect(`${process.env.APP_URL}/login?error=auth_failed`)
      }
    },
  )

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, employeeId: true },
    })
    if (!user) return reply.status(404).send({ message: 'Usuario no encontrado' })
    return reply.send({ data: user })
  })
}

export default authRoutes
