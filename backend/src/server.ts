import { execSync } from 'child_process'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import prismaPlugin from './plugins/prisma'
import authenticatePlugin from './middleware/authenticate'
import authRoutes from './routes/auth'
import employeeRoutes from './routes/employees'
import onboardingRoutes from './routes/onboarding'
import publicFormsRoutes from './routes/publicForms'
import profileRoutes from './routes/profiles'
import payrollRoutes from './routes/payroll'
import workCenterRoutes from './routes/workCenters'
import bukRoutes from './routes/buk'
import calendarRoutes from './routes/calendar'
import calendarEmailRoutes from './routes/calendarEmail'
import { startCalendarEmailScheduler } from './services/calendarEmailScheduler'
import smartRoutes from './routes/smart'
import budgetRoutes from './routes/budget'
import documentsRoutes from './routes/documents'
import reportsRoutes from './routes/reports'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido. Revisa backend/.env')
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

async function bootstrap() {

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(cookie)

  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  })

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  await app.register(prismaPlugin)
  await app.register(authenticatePlugin)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(employeeRoutes, { prefix: '/api/employees' })
  await app.register(onboardingRoutes, { prefix: '/api/onboarding' })
  await app.register(publicFormsRoutes, { prefix: '/api/forms' })
  await app.register(profileRoutes,    { prefix: '/api/profiles' })
  await app.register(payrollRoutes,    { prefix: '/api/payroll' })
  await app.register(workCenterRoutes, { prefix: '/api/work-centers' })
  await app.register(bukRoutes,        { prefix: '/api/buk' })
  await app.register(calendarRoutes,      { prefix: '/api/calendar' })
  await app.register(calendarEmailRoutes, { prefix: '/api/calendar/email-rules' })
  await app.register(smartRoutes,     { prefix: '/api/smart' })
  await app.register(budgetRoutes,    { prefix: '/api/budget' })
  await app.register(documentsRoutes, { prefix: '/api/onboarding' })
  await app.register(reportsRoutes,   { prefix: '/api/reports' })

  app.get('/api/health', async () => ({ status: 'ok', env: process.env.NODE_ENV }))

  startCalendarEmailScheduler(app.prisma)

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`GDP API corriendo en http://localhost:${port}`)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
