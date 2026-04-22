import { execSync } from 'child_process'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import prismaPlugin from './plugins/prisma'
import authenticatePlugin from './middleware/authenticate'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import syncRoutes from './routes/sync'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

async function bootstrap() {
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
  } catch (e) {
    app.log.warn('prisma db push failed, continuing with existing schema')
  }

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  await app.register(prismaPlugin)
  await app.register(authenticatePlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(employeeRoutes, { prefix: '/api/employees' })
  await app.register(syncRoutes, { prefix: '/api/sync' })

  app.get('/api/health', async () => ({ status: 'ok', env: process.env.NODE_ENV }))

  app.get('/api/debug/employees', async (_req, reply) => {
    try {
      const count = await app.prisma.employee.count()
      return reply.send({ ok: true, count })
    } catch (e: any) {
      return reply.status(500).send({ ok: false, error: e.message, code: e.code })
    }
  })

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`GDP API corriendo en http://localhost:${port}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
