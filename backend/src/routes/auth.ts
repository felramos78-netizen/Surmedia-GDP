import type { FastifyPluginAsync } from 'fastify'
import { getGoogleAuthUrl, handleGoogleCallback, AuthError } from '../services/auth.service'

const TEMP_USER = {
  id: 'temp-framos',
  email: 'framos@surmedia.cl',
  name: 'Felipe Ramos',
  role: 'ADMIN' as const,
  avatarUrl: null,
  password: '1234',
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (req, reply) => {
      const { email, password } = req.body ?? {}

      if (email !== TEMP_USER.email || password !== TEMP_USER.password) {
        return reply.status(401).send({ message: 'Credenciales incorrectas' })
      }

      const token = fastify.jwt.sign(
        { userId: TEMP_USER.id, email: TEMP_USER.email, role: TEMP_USER.role },
        { expiresIn: '8h' },
      )

      return reply.send({
        token,
        user: { id: TEMP_USER.id, email: TEMP_USER.email, name: TEMP_USER.name, role: TEMP_USER.role, avatarUrl: TEMP_USER.avatarUrl },
      })
    },
  )

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
        const errorCode = err instanceof AuthError ? err.code : 'auth_failed'
        reply.redirect(`${process.env.APP_URL}/login?error=${errorCode}`)
      }
    },
  )

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    if (req.user.userId === TEMP_USER.id) {
      return reply.send({ data: { id: TEMP_USER.id, email: TEMP_USER.email, name: TEMP_USER.name, role: TEMP_USER.role, avatarUrl: TEMP_USER.avatarUrl, employeeId: null } })
    }
    const user = await fastify.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, employeeId: true },
    })
    if (!user) return reply.status(404).send({ message: 'Usuario no encontrado' })
    return reply.send({ data: user })
  })
}

export default authRoutes
