import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { getGoogleAuthUrl, handleGoogleCallback, AuthError } from '../services/auth.service'

const ALLOWED_DOMAIN = process.env.GOOGLE_DOMAIN ?? 'surmedia.cl'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login',
    async (req, reply) => {
      const { email, password } = req.body

      if (!email || !password) {
        return reply.status(400).send({ message: 'Email y contraseña son requeridos' })
      }

      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return reply.status(403).send({ message: `Solo cuentas @${ALLOWED_DOMAIN} pueden acceder` })
      }

      let user = await fastify.prisma.user.findUnique({ where: { email } })

      if (!user) {
        const passwordHash = await bcrypt.hash(password, 10)
        user = await fastify.prisma.user.create({
          data: { email, name: email.split('@')[0], passwordHash, role: 'EMPLOYEE' },
        })
      } else {
        if (!user.passwordHash) {
          return reply.status(403).send({ message: 'Esta cuenta usa Google. Activa una contraseña desde la configuración.' })
        }
        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          return reply.status(401).send({ message: 'Contraseña incorrecta' })
        }
      }

      const token = fastify.jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        { expiresIn: '8h' },
      )

      return reply.send({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
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
    const user = await fastify.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, employeeId: true },
    })
    if (!user) return reply.status(404).send({ message: 'Usuario no encontrado' })
    return reply.send({ data: user })
  })
}

export default authRoutes
