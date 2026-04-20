import { OAuth2Client } from 'google-auth-library'
import type { FastifyInstance } from 'fastify'

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

export function getGoogleAuthUrl(): string {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    hd: process.env.GOOGLE_DOMAIN ?? 'surmedia.cl',
  })
}

export async function handleGoogleCallback(code: string, fastify: FastifyInstance) {
  const { tokens } = await googleClient.getToken(code)
  googleClient.setCredentials(tokens)

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()!

  if (!payload.email?.endsWith(`@${process.env.GOOGLE_DOMAIN ?? 'surmedia.cl'}`)) {
    throw new Error('Solo usuarios @surmedia.cl pueden acceder')
  }

  let user = await fastify.prisma.user.findUnique({ where: { email: payload.email } })

  if (!user) {
    user = await fastify.prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name ?? payload.email,
        googleId: payload.sub,
        avatarUrl: payload.picture,
        role: 'EMPLOYEE',
      },
    })
  } else if (!user.googleId) {
    user = await fastify.prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub, avatarUrl: payload.picture },
    })
  }

  const token = fastify.jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    { expiresIn: '8h' },
  )

  return { user, token }
}
