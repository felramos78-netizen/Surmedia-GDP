import { createHmac, timingSafeEqual } from 'crypto'
import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { syncBukAll, syncBukCompany } from '../integrations/buk/buk.sync'
import type { BukLegalEntity } from '../integrations/buk/buk.types'

const VALID_ENTITIES: BukLegalEntity[] = ['COMUNICACIONES_SURMEDIA', 'SURMEDIA_CONSULTORIA']

const syncRoutes: FastifyPluginAsync = async (fastify) => {

  // ─── POST /api/sync/buk — dispara sync completo (ambas empresas) ─────────────
  fastify.post('/buk', {
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    fastify.log.info('Sync BUK iniciado manualmente')
    // Ejecutar en background para no bloquear la respuesta
    syncBukAll(fastify.prisma).then(results => {
      fastify.log.info({ results }, 'Sync BUK completado')
    }).catch(err => {
      fastify.log.error({ err }, 'Sync BUK falló')
    })

    return reply.status(202).send({ message: 'Sincronización iniciada' })
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
