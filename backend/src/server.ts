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

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error('⛔ Variables de entorno faltantes:')
    missing.forEach((k) => console.error(`   - ${k}`))
    console.error('Configura estas variables en Railway → Variables antes de continuar.')
    // No hacemos exit para no crashear antes de que el health check responda
  }
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

async function bootstrap() {
  checkEnv()

  const allowedOrigins = [
    process.env.APP_URL ?? 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:5173',
  ]

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true)
      } else {
        cb(null, false)
      }
    },
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

  app.get('/api/health', async () => ({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }))

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`GDP API corriendo en puerto ${port}`)
}

bootstrap().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err.message)
  process.exit(1)
})
