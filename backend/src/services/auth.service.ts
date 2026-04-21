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

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function handleGoogleCallback(code: string, fastify: FastifyInstance) {
  let tokens
  try {
    const result = await googleClient.getToken(code)
    tokens = result.tokens
  } catch (err) {
    fastify.log.error({ err }, 'Error al obtener token de Google')
    throw new AuthError('No se pudo obtener el token de Google', 'token_exchange_failed')
  }

  googleClient.setCredentials(tokens)

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()!
  } catch (err) {
    fastify.log.error({ err }, 'Error al verificar id_token de Google')
    throw new AuthError('Token de Google inválido', 'token_verify_failed')
  }

  if (!payload.email?.endsWith(`@${process.env.GOOGLE_DOMAIN ?? 'surmedia.cl'}`)) {
    throw new AuthError('Solo usuarios @surmedia.cl pueden acceder', 'wrong_domain')
  }

  let user
  try {
    user = await fastify.prisma.user.findUnique({ where: { email: payload.email } })
  } catch (err) {
    fastify.log.error({ err }, 'Error de base de datos al buscar usuario')
    throw new AuthError('Error de base de datos', 'db_error')
  }

  try {
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
  } catch (err) {
    fastify.log.error({ err }, 'Error de base de datos al crear/actualizar usuario')
    throw new AuthError('Error al guardar usuario', 'db_write_error')
  }

  const token = fastify.jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    { expiresIn: '8h' },
  )

  return { user, token }
}
