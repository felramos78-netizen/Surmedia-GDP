import { createHmac, timingSafeEqual } from 'crypto'
import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { syncBukAll, syncBukCompany, previewBukAll, syncPayrollAll } from '../integrations/buk/buk.sync'
import type { BukLegalEntity } from '../integrations/buk/buk.types'

const VALID_ENTITIES: BukLegalEntity[] = ['COMUNICACIONES_SURMEDIA', 'SURMEDIA_CONSULTORIA']

const syncRoutes: FastifyPluginAsync = async (fastify) => {

  // ─── POST /api/sync/buk/preview — vista previa sin guardar ──────────────────
  fastify.post('/buk/preview', {
    preHandler: fastify.authenticate,
    config: { timeout: 120_000 },
  }, async (_req, reply) => {
    fastify.log.info('Preview BUK iniciado')
    try {
      const results = await previewBukAll(fastify.prisma)
      return reply.send({ ok: true, results })
    } catch (err: any) {
      fastify.log.error({ err }, 'Preview BUK falló')
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })

  // ─── POST /api/sync/buk — dispara sync completo (ambas empresas) ─────────────
  fastify.post('/buk', {
    preHandler: fastify.authenticate,
    config: { timeout: 120_000 },
  }, async (req, reply) => {
    fastify.log.info('Sync BUK iniciado manualmente')
    try {
      const results = await syncBukAll(fastify.prisma)
      fastify.log.info({ results }, 'Sync BUK completado')
      return reply.send({ ok: true, results })
    } catch (err: any) {
      fastify.log.error({ err }, 'Sync BUK falló')
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })

  // ─── POST /api/sync/buk/:entity — sync de una sola empresa ──────────────────
  fastify.post<{ Params: { entity: string } }>('/buk/:entity', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const entity = req.params.entity.toUpperCase() as BukLegalEntity
    if (!VALID_ENTITIES.includes(entity)) {
      return reply.status(400).send({
        message: `Entidad inválida. Opciones: ${VALID_ENTITIES.join(', ')}`,
      })
    }

    fastify.log.info({ entity }, 'Sync BUK por empresa iniciado')
    syncBukCompany(fastify.prisma, entity).then(result => {
      fastify.log.info({ result }, 'Sync por empresa completado')
    }).catch(err => {
      fastify.log.error({ err, entity }, 'Sync por empresa falló')
    })

    return reply.status(202).send({ message: `Sincronización de ${entity} iniciada` })
  })

  // ─── POST /api/sync/buk/payroll — sync de remuneraciones mensuales ───────────
  fastify.post<{ Body: { startDate?: string; endDate?: string } }>('/buk/payroll', {
    preHandler: fastify.authenticate,
    config: { timeout: 300_000 },
  }, async (req, reply) => {
    const now = new Date()
    const defaultEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const defaultStart = `${now.getFullYear() - 1}-01-01`
    const startDate = req.body?.startDate ?? defaultStart
    const endDate   = req.body?.endDate   ?? defaultEnd

    fastify.log.info({ startDate, endDate }, 'Sync payroll BUK iniciado')
    try {
      const results = await syncPayrollAll(fastify.prisma, startDate, endDate)
      return reply.send({ ok: true, results })
    } catch (err: any) {
      fastify.log.error({ err }, 'Sync payroll BUK falló')
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })

  // ─── GET /api/sync/logs — historial de sincronizaciones ─────────────────────
  fastify.get('/logs', {
    preHandler: fastify.authenticate,
  }, async (_req, reply) => {
    const logs = await fastify.prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: logs })
  })

  // ─── GET /api/sync/buk/debug-payroll — prueba endpoints de nómina de BUK ──────
  fastify.get('/buk/debug-payroll', async (_req, reply) => {
    const { BukClient } = await import('../integrations/buk/buk.client')
    const [clientCom, clientCon] = BukClient.fromEnv()

    const BASE_PATH = '/api/v1/chile'
    const PERIOD_COM = 1351
    const PERIOD_CON = 1413

    const SUB_PATHS = (id: number) => [
      `process_periods/${id}/employee_payroll_processes`,
      `process_periods/${id}/payroll_settlements`,
      `process_periods/${id}/payrolls`,
      `process_periods/${id}/settlements`,
      `process_periods/${id}/liquidations`,
      `process_periods/${id}/employees`,
      `process_periods/${id}/employee_payrolls`,
      `process_periods/${id}/payroll_details`,
      `employee_payroll_processes?process_period_id=${id}`,
      `payroll_settlements?process_period_id=${id}`,
      `payrolls?process_period_id=${id}`,
      `settlements?process_period_id=${id}`,
    ]

    async function probe(baseUrl: string, key: string, path: string) {
      const url = path.includes('?')
        ? `${baseUrl}${BASE_PATH}/${path}&page_size=1&page=1`
        : `${baseUrl}${BASE_PATH}/${path}?page_size=1&page=1`
      try {
        const res = await fetch(url, { headers: { auth_token: key, Accept: 'application/json' } })
        if (!res.ok) return res.status
        const body = await res.json() as any
        return { status: res.status, hasData: Array.isArray(body.data), count: body.data?.length, sample: body.data?.[0] }
      } catch { return 0 }
    }

    async function probeCompany(client: typeof clientCom, periodId: number, firstBukEmployeeId: number | null) {
      const cfg  = (client as any).config
      const keys = { api: cfg.apiKey, editor: cfg.editorKey, asistencia: cfg.asistenciaKey }
      const results: Record<string, any> = {}

      // Paths a probar
      const paths = [
        ...SUB_PATHS(periodId),
        // Con fecha del período como slug
        `process_periods/2026-03-01/employee_payroll_processes`,
        // Top-level sin período
        `employee_payroll_processes?page_size=1`,
        `payroll_settlements?page_size=1`,
        `liquidations?page_size=1`,
        `remuneraciones?page_size=1`,
        // Por empleado (si tenemos un bukId)
        ...(firstBukEmployeeId ? [
          `employees/${firstBukEmployeeId}/payroll_settlements`,
          `employees/${firstBukEmployeeId}/payroll_processes`,
          `employees/${firstBukEmployeeId}/payrolls`,
          `employees/${firstBukEmployeeId}/liquidations`,
        ] : []),
      ]

      for (const path of paths) {
        const best: Record<string, any> = {}
        for (const [keyName, key] of Object.entries(keys)) {
          if (!key) continue
          const r = await probe(cfg.baseUrl, key, path)
          if (typeof r === 'object') { best[keyName] = r; break }
          if (r === 200) { best[keyName] = r; break }
          best[keyName] = r
        }
        results[path] = best
      }
      return results
    }

    // Primero obtener todos los períodos para encontrar uno cerrado
    async function getClosedPeriod(client: typeof clientCom): Promise<{ id: number; month: string; status: string } | null> {
      const cfg  = (client as any).config
      const hdrs = { auth_token: cfg.apiKey, Accept: 'application/json' }
      let page = 1, totalPages = 1
      do {
        const res  = await fetch(`${cfg.baseUrl}${BASE_PATH}/process_periods?page_size=50&page=${page}`, { headers: hdrs })
        if (!res.ok) return null
        const body = await res.json() as any
        const closed = (body.data ?? []).find((p: any) => p.status === 'cerrado')
        if (closed) return closed
        totalPages = body.pagination?.total_pages ?? 1
        page++
      } while (page <= totalPages)
      return null
    }

    const [closedCom, closedCon] = await Promise.all([
      getClosedPeriod(clientCom),
      getClosedPeriod(clientCon),
    ])

    // Obtener un bukEmployeeId real para probar endpoints por empleado
    async function getFirstBukEmployeeId(client: typeof clientCom): Promise<number | null> {
      const cfg = (client as any).config
      try {
        const res  = await fetch(`${cfg.baseUrl}${BASE_PATH}/employees?page_size=1&page=1`, { headers: { auth_token: cfg.apiKey, Accept: 'application/json' } })
        if (!res.ok) return null
        const body = await res.json() as any
        return body.data?.[0]?.id ?? null
      } catch { return null }
    }

    const [firstEmpCom, firstEmpCon] = await Promise.all([
      getFirstBukEmployeeId(clientCom),
      getFirstBukEmployeeId(clientCon),
    ])

    const [com, con] = await Promise.all([
      probeCompany(clientCom, closedCom?.id ?? PERIOD_COM, firstEmpCom),
      probeCompany(clientCon, closedCon?.id ?? PERIOD_CON, firstEmpCon),
    ])
    return reply.send({
      closedPeriods: { comunicaciones: closedCom, consultoria: closedCon },
      firstEmployees: { comunicaciones: firstEmpCom, consultoria: firstEmpCon },
      comunicaciones: com,
      consultoria: con,
    })
  })

  // ─── GET /api/sync/buk/debug-status — status BUK de todos los empleados ───────
  fastify.get('/buk/debug-status', async (_req, reply) => {
    const { BukClient } = await import('../integrations/buk/buk.client')
    const { normalizeRut } = await import('../integrations/buk/buk.mapper')
    const [clientCom, clientCon] = BukClient.fromEnv()

    const [resCom, resCon] = await Promise.allSettled([
      clientCom.fetchAllEmployees(),
      clientCon.fetchAllEmployees(),
    ])

    const toSummary = (emps: any[]) => emps.map(e => ({
      rut:        normalizeRut(e.rut),
      name:       `${e.first_name} ${e.surname}`,
      status:     e.status,
      end_date:   e.end_date,
    }))

    return reply.send({
      comunicaciones: resCom.status === 'fulfilled' ? toSummary(resCom.value) : { error: String(resCom.reason) },
      consultoria:    resCon.status === 'fulfilled' ? toSummary(resCon.value) : { error: String(resCon.reason) },
    })
  })

  // ─── POST /api/webhooks/buk — receptor de webhooks de BUK ───────────────────
  // BUK notifica cambios en tiempo real (bajas, cambios de cargo, etc.)
  fastify.post('/webhook/buk', async (req, reply) => {
    const signature = req.headers['x-buk-signature'] as string | undefined

    // rawBody requiere addContentTypeParser en Fastify; usar body serializado como fallback
    const rawBody = JSON.stringify(req.body)
    if (!verifyBukSignature(rawBody, signature)) {
      return reply.status(401).send({ message: 'Firma inválida' })
    }

    const payload = req.body as BukWebhookPayload
    fastify.log.info({ event: payload.event }, 'Webhook BUK recibido')

    // Procesar de forma asíncrona
    handleBukWebhook(fastify.prisma, payload).catch(err => {
      fastify.log.error({ err, payload }, 'Error procesando webhook BUK')
    })

    return reply.status(200).send({ received: true })
  })
}

// ─── Validación de firma HMAC del webhook ─────────────────────────────────────

function verifyBukSignature(rawBody: string | undefined, signature: string | undefined): boolean {
  const secret = process.env.BUK_WEBHOOK_SECRET
  if (!secret || !signature || !rawBody) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const sigBuffer = Buffer.from(signature)
  const expBuffer = Buffer.from(expected)

  if (sigBuffer.length !== expBuffer.length) return false
  return timingSafeEqual(sigBuffer, expBuffer)
}

// ─── Procesamiento de eventos webhook ────────────────────────────────────────

interface BukWebhookPayload {
  event: string
  company_id: number
  employee_id?: number
  data?: Record<string, unknown>
}

async function handleBukWebhook(
  prisma: Parameters<typeof syncBukAll>[0],
  payload: BukWebhookPayload
): Promise<void> {
  // Por ahora registrar el evento; en siguientes iteraciones procesar cada tipo
  await prisma.auditLog.create({
    data: {
      userId:   'buk-webhook',
      action:   `webhook:${payload.event}`,
      entity:   'buk',
      entityId: String(payload.employee_id ?? payload.company_id),
      newValues: (payload.data as object | undefined) ?? Prisma.JsonNull,
    },
  })
}

export default syncRoutes
