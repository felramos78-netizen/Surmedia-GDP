import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

async function connectWithRetry(prisma: PrismaClient, fastify: FastifyInstance, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect()
      fastify.log.info('Conectado a PostgreSQL correctamente')
      return
    } catch (err) {
      const msg = (err as Error).message
      fastify.log.warn(`[DB] Intento ${attempt}/${maxAttempts} fallido: ${msg}`)
      if (attempt === maxAttempts) {
        fastify.log.error('[DB] No se pudo conectar a la base de datos. Verifica DATABASE_URL en Railway.')
        throw err
      }
      const delay = attempt * 2000
      fastify.log.info(`[DB] Reintentando en ${delay / 1000}s...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

export default fp(async (fastify) => {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL no está definida. Configura la variable de entorno en Railway.')
  }

  // Log del host (sin credenciales) para debugging
  try {
    const url = new URL(dbUrl)
    fastify.log.info(`[DB] Conectando a: ${url.hostname}:${url.port}${url.pathname}`)
  } catch {
    fastify.log.warn('[DB] DATABASE_URL tiene formato inválido')
  }

  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

  await connectWithRetry(prisma, fastify)

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
    fastify.log.info('[DB] Conexión a PostgreSQL cerrada')
  })
})
