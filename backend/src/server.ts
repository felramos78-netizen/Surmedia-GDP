import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import prismaPlugin from './plugins/prisma'
import authenticatePlugin from './middleware/authenticate'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import departmentRoutes from './routes/departments'
import positionRoutes from './routes/positions'
import contractRoutes from './routes/contracts'
import leaveRoutes from './routes/leaves'
import dashboardRoutes from './routes/dashboard'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

async function bootstrap() {
  await app.register(cors, {
    origin: process.env.APP_URL ?? 'http://localhost:3000',
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
  await app.register(departmentRoutes, { prefix: '/api/departments' })
  await app.register(positionRoutes, { prefix: '/api/positions' })
  await app.register(contractRoutes, { prefix: '/api/contracts' })
  await app.register(leaveRoutes, { prefix: '/api/leaves' })
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' })

  app.get('/api/health', async () => ({ status: 'ok', env: process.env.NODE_ENV }))

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`GDP API corriendo en http://localhost:${port}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
