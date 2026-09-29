import type { FastifyInstance } from 'fastify'
import { createReadStream, existsSync } from 'fs'
import { extname } from 'path'
import { Prisma, type RecruitmentStage, type CandidateSource, type JobOpeningStatus } from '@prisma/client'
import { requireRole } from '../middleware/requireRole'
import { fold } from '../utils/text'
import { normalizeRut } from '../utils/rut'
import {
  buildDrivePreview, applyDriveImport, absolutePath, candidateSearchText,
  type ImportPreview, type ApplyRow,
} from '../services/recruitmentDriveImport.service'
import { startAiJob, aiJobStatus } from '../services/cvAi.service'

// Reclutamiento: base de CVs. Datos personales de postulantes → solo equipo RRHH.

const STAGES: RecruitmentStage[] = ['RECIBIDO', 'EN_REVISION', 'PRESELECCIONADO', 'ENTREVISTA', 'OFERTA', 'CONTRATADO', 'DESCARTADO']
const SOURCES: CandidateSource[] = ['PORTAL', 'DRIVE', 'GMAIL', 'REFERIDO', 'HUNTING', 'MANUAL']
const IMPORT_ACTION = 'RECRUITMENT_DRIVE_IMPORT'

// Campos de perfil editables (texto) + años de experiencia (número)
const PROFILE_TEXT = ['professionalTitle', 'institution', 'city', 'lastEmployer', 'lastPosition', 'sector', 'skills', 'tools', 'certifications', 'availability'] as const
const PROFILE_SELECT = Object.fromEntries([...PROFILE_TEXT, 'yearsExperience'].map(k => [k, true])) as Record<(typeof PROFILE_TEXT)[number] | 'yearsExperience', true>
const OPERATORS = ['CONTAINS', 'NOT_CONTAINS', 'EQUALS', 'GTE', 'LTE', 'NOT_EMPTY']

const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
}

// La lectura de Drive toma ~20 s: /preview la guarda y /apply la reutiliza
let cachedPreview: { at: number; data: ImportPreview } | null = null
const CACHE_MS = 15 * 60 * 1000

export default async function recruitmentRoutes(fastify: FastifyInstance) {
  const { prisma } = fastify
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', requireRole('ADMIN', 'RRHH_MANAGER', 'RRHH_ANALYST'))

  // ── Vacantes ────────────────────────────────────────────────────────────────

  fastify.get('/openings', async () => {
    const [openings, groups] = await Promise.all([
      prisma.jobOpening.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] }),
      prisma.candidateApplication.groupBy({ by: ['jobOpeningId', 'stage', 'isArchived'], _count: true }),
    ])
    return openings.map(o => {
      const mine = groups.filter(g => g.jobOpeningId === o.id)
      const byStage = Object.fromEntries(STAGES.map(s => [s, mine.filter(g => g.stage === s && !g.isArchived).reduce((n, g) => n + g._count, 0)]))
      return {
        ...o,
        byStage,
        active:   mine.filter(g => !g.isArchived).reduce((n, g) => n + g._count, 0),
        archived: mine.filter(g => g.isArchived).reduce((n, g) => n + g._count, 0),
      }
    })
  })

  fastify.patch<{ Params: { id: string }; Body: { name?: string; city?: string | null; status?: JobOpeningStatus; notes?: string | null } }>(
    '/openings/:id', async (req, reply) => {
      const { name, city, status, notes } = req.body
      const data: Prisma.JobOpeningUpdateInput = {}
      if (name !== undefined) data.name = name.trim()
      if (city !== undefined) data.city = city?.trim() || null
      if (status !== undefined) data.status = status
      if (notes !== undefined) data.notes = notes?.trim() || null
      return reply.send(await prisma.jobOpening.update({ where: { id: req.params.id }, data }))
    },
  )

  // ── Preselección: postulantes de una vacante con perfil y puntajes ──────────

  fastify.get<{ Params: { id: string } }>('/openings/:id/preselection', async (req, reply) => {
    const opening = await prisma.jobOpening.findUnique({
      where: { id: req.params.id },
      include: { criteria: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    })
    if (!opening) return reply.status(404).send({ message: 'Vacante no encontrada' })
    const applications = await prisma.candidateApplication.findMany({
      where: { jobOpeningId: opening.id },
      include: {
        candidate: {
          select: {
            id: true, fullName: true, email: true, phone: true, linkedinUrl: true, source: true, ...PROFILE_SELECT,
            files: { where: { removedAt: null, jobOpeningId: opening.id }, select: { id: true, fileName: true, drivePath: true, sizeBytes: true, modifiedAt: true, removedAt: true, jobOpeningId: true } },
          },
        },
      },
    })
    return { opening, applications }
  })

  // ── Criterios de puntaje ────────────────────────────────────────────────────

  type CriterionBody = { name?: string; type?: 'MANUAL' | 'RULE'; field?: string | null; operator?: string | null; value?: string | null; pointsIfTrue?: number; pointsIfFalse?: number; sortOrder?: number }
  const criterionData = (b: CriterionBody) => {
    const d: Record<string, any> = {}
    if (b.name !== undefined) d.name = b.name.trim()
    if (b.type !== undefined) d.type = b.type === 'RULE' ? 'RULE' : 'MANUAL'
    if (b.field !== undefined) d.field = b.field || null
    if (b.operator !== undefined) d.operator = b.operator && OPERATORS.includes(b.operator) ? b.operator : null
    if (b.value !== undefined) d.value = b.value?.trim() || null
    if (b.pointsIfTrue !== undefined) d.pointsIfTrue = Number(b.pointsIfTrue) || 0
    if (b.pointsIfFalse !== undefined) d.pointsIfFalse = Number(b.pointsIfFalse) || 0
    if (b.sortOrder !== undefined) d.sortOrder = b.sortOrder
    return d
  }

  fastify.post<{ Params: { id: string }; Body: CriterionBody }>('/openings/:id/criteria', async (req, reply) => {
    const d = criterionData(req.body)
    if (!d.name) return reply.status(400).send({ message: 'El criterio necesita un nombre' })
    const count = await prisma.scoringCriterion.count({ where: { jobOpeningId: req.params.id } })
    return reply.status(201).send(await prisma.scoringCriterion.create({ data: { sortOrder: count, ...d, name: d.name, jobOpeningId: req.params.id } }))
  })

  fastify.patch<{ Params: { id: string }; Body: CriterionBody }>('/criteria/:id', async (req, reply) => {
    return reply.send(await prisma.scoringCriterion.update({ where: { id: req.params.id }, data: criterionData(req.body) }))
  })

  fastify.delete<{ Params: { id: string } }>('/criteria/:id', async (req, reply) => {
    await prisma.scoringCriterion.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

  // ── Candidatos ──────────────────────────────────────────────────────────────

  fastify.get<{ Querystring: { q?: string; openingId?: string; stage?: string; source?: string; archived?: 'current' | 'only' } }>(
    '/candidates', async req => {
      const { q, openingId, stage, source, archived } = req.query
      const appWhere: Prisma.CandidateApplicationWhereInput = {}
      if (openingId) appWhere.jobOpeningId = openingId
      if (stage && STAGES.includes(stage as RecruitmentStage)) appWhere.stage = stage as RecruitmentStage
      // Por defecto todas las postulaciones (la base es un repositorio de CVs)
      if (archived === 'only') appWhere.isArchived = true
      else if (archived === 'current') appWhere.isArchived = false

      const where: Prisma.CandidateWhereInput = { applications: { some: appWhere } }
      if (source && SOURCES.includes(source as CandidateSource)) where.source = source as CandidateSource
      const terms = fold(q).split(' ').filter(Boolean)
      if (terms.length) where.AND = terms.map(t => ({ searchText: { contains: t } }))

      return prisma.candidate.findMany({
        where,
        orderBy: { fullName: 'asc' },
        take: 1000,
        select: {
          id: true, fullName: true, email: true, phone: true, linkedinUrl: true, source: true, createdAt: true, ...PROFILE_SELECT,
          aiSuggestedAt: true,
          applications: {
            select: { id: true, stage: true, isArchived: true, jobOpening: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { files: { where: { removedAt: null } } } },
        },
      })
    },
  )

  fastify.get<{ Params: { id: string } }>('/candidates/:id', async (req, reply) => {
    const c = await prisma.candidate.findUnique({
      where: { id: req.params.id },
      include: {
        applications: { include: { jobOpening: { select: { id: true, name: true, city: true } } }, orderBy: { createdAt: 'desc' } },
        files: { orderBy: [{ removedAt: 'asc' }, { modifiedAt: 'desc' }] },
      },
    })
    if (!c) return reply.status(404).send({ message: 'Candidato no encontrado' })
    return c
  })

  fastify.patch<{ Params: { id: string }; Body: Record<string, string | number | null> }>('/candidates/:id', async (req, reply) => {
    const data = candidateUpdateData(req.body)
    if (typeof data === 'string') return reply.status(400).send({ message: data })

    const current = await prisma.candidate.findUnique({ where: { id: req.params.id } })
    if (!current) return reply.status(404).send({ message: 'Candidato no encontrado' })
    data.searchText = candidateSearchText({ ...current, ...data })
    try {
      return await prisma.candidate.update({ where: { id: req.params.id }, data })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ message: 'Otro candidato ya tiene ese email o RUT' })
      throw err
    }
  })

  // ── Perfil con IA (Gemini, plan gratuito; solo a pedido) ─────────────────────

  fastify.get('/ai/status', async () => ({ configured: !!process.env.GEMINI_API_KEY, job: aiJobStatus() }))

  fastify.post<{ Body: { candidateIds: string[] } }>('/ai/start', async (req, reply) => {
    const ids = [...new Set(req.body.candidateIds ?? [])].slice(0, 500)
    if (!ids.length) return reply.status(400).send({ message: 'No hay candidatos para procesar' })
    try { return startAiJob(prisma, ids) }
    catch (err: any) { return reply.status(409).send({ message: err.message }) }
  })

  fastify.get('/ai/suggestions', async () => {
    return prisma.candidate.findMany({
      where: { aiSuggestion: { not: Prisma.DbNull } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true, phone: true, linkedinUrl: true, ...PROFILE_SELECT, aiSuggestion: true, aiSuggestedAt: true },
    })
  })

  // Aplica los campos elegidos de cada sugerencia y la da por revisada
  fastify.post<{ Body: { items: { candidateId: string; fields: Record<string, string | number | null> }[] } }>('/ai/apply', async (req) => {
    const results = { applied: 0, skipped: [] as string[] }
    for (const { candidateId, fields } of req.body.items ?? []) {
      const current = await prisma.candidate.findUnique({ where: { id: candidateId } })
      if (!current) continue
      const data = candidateUpdateData(fields)
      if (typeof data === 'string') { results.skipped.push(`${current.fullName}: ${data}`); continue }
      // Email ya usado por otro candidato: se omite ese campo
      if (data.email && await prisma.candidate.findFirst({ where: { email: data.email, id: { not: candidateId } } })) {
        delete data.email
        results.skipped.push(`${current.fullName}: el email ya pertenece a otro candidato`)
      }
      data.searchText = candidateSearchText({ ...current, ...data })
      await prisma.candidate.update({ where: { id: candidateId }, data: { ...data, aiSuggestion: Prisma.DbNull } })
      results.applied++
    }
    return results
  })

  fastify.post<{ Body: { candidateIds: string[] } }>('/ai/discard', async (req) => {
    const r = await prisma.candidate.updateMany({ where: { id: { in: req.body.candidateIds ?? [] } }, data: { aiSuggestion: Prisma.DbNull } })
    return { discarded: r.count }
  })

  /** Valida y normaliza los campos editables del candidato. Devuelve un mensaje si hay un error. */
  function candidateUpdateData(b: Record<string, string | number | null | undefined>): Record<string, any> | string {
    const data: Record<string, any> = {}
    const text = (v: string | number | null | undefined) => String(v ?? '').trim() || null
    if (b.fullName !== undefined) {
      if (!text(b.fullName)) return 'El nombre es obligatorio'
      data.fullName = text(b.fullName)
    }
    if (b.email !== undefined) data.email = text(b.email)?.toLowerCase() ?? null
    if (b.phone !== undefined) data.phone = text(b.phone)
    if (b.rut !== undefined) data.rut = text(b.rut) ? normalizeRut(text(b.rut)) : null
    if (b.linkedinUrl !== undefined) {
      const li = text(b.linkedinUrl)
      data.linkedinUrl = li && !/^https?:\/\//i.test(li) ? `https://${li}` : li
    }
    if (b.referredBy !== undefined) data.referredBy = text(b.referredBy)
    if (b.notes !== undefined) data.notes = text(b.notes)
    if (b.source !== undefined && SOURCES.includes(b.source as CandidateSource)) data.source = b.source
    for (const k of PROFILE_TEXT) if (b[k] !== undefined) data[k] = text(b[k])
    if (b.yearsExperience !== undefined) {
      const n = b.yearsExperience === null || b.yearsExperience === '' ? null : Number(String(b.yearsExperience).replace(',', '.'))
      if (n !== null && (isNaN(n) || n < 0)) return 'Años de experiencia inválidos'
      data.yearsExperience = n
    }
    return data
  }

  fastify.patch<{ Params: { id: string }; Body: { stage?: RecruitmentStage; isArchived?: boolean; notes?: string | null; scores?: Record<string, number | null> } }>(
    '/applications/:id', async (req, reply) => {
      const { stage, isArchived, notes, scores } = req.body
      const data: Prisma.CandidateApplicationUpdateInput = {}
      if (stage !== undefined) {
        if (!STAGES.includes(stage)) return reply.status(400).send({ message: 'Etapa inválida' })
        data.stage = stage
      }
      if (isArchived !== undefined) data.isArchived = !!isArchived
      if (notes !== undefined) data.notes = notes?.trim() || null
      if (scores) {
        // Se mezclan con los puntajes existentes; null borra el puntaje de ese criterio
        const app = await prisma.candidateApplication.findUnique({ where: { id: req.params.id }, select: { manualScores: true } })
        if (!app) return reply.status(404).send({ message: 'Postulación no encontrada' })
        const merged = { ...(app.manualScores as Record<string, number>) }
        for (const [k, v] of Object.entries(scores)) {
          if (v === null) delete merged[k]
          else if (typeof v === 'number' && isFinite(v)) merged[k] = v
        }
        data.manualScores = merged
      }
      return reply.send(await prisma.candidateApplication.update({ where: { id: req.params.id }, data }))
    },
  )

  // ── Archivos (se leen desde la carpeta de Drive sincronizada) ───────────────

  fastify.get<{ Params: { id: string }; Querystring: { download?: string } }>('/files/:id', async (req, reply) => {
    const file = await prisma.candidateFile.findUnique({ where: { id: req.params.id } })
    if (!file) return reply.status(404).send({ message: 'Archivo no encontrado' })
    const abs = absolutePath(file.drivePath)
    if (!existsSync(abs)) return reply.status(404).send({ message: 'El archivo ya no está en Drive (¿se movió o borró?). Vuelve a importar desde Drive.' })
    const ext = extname(file.fileName).toLowerCase()
    reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream')
    reply.header('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
    return reply.send(createReadStream(abs))
  })

  // ── Importación desde Drive ─────────────────────────────────────────────────

  fastify.get<{ Querystring: { refresh?: string } }>('/import/drive/preview', async (req, reply) => {
    try {
      if (!req.query.refresh && cachedPreview && Date.now() - cachedPreview.at < CACHE_MS) return cachedPreview.data
      const data = await buildDrivePreview(prisma)
      cachedPreview = { at: Date.now(), data }
      return data
    } catch (err: any) {
      return reply.status(400).send({ message: err.message })
    }
  })

  fastify.post<{ Body: { rows: ApplyRow[]; removedIds?: string[] } }>('/import/drive/apply', async (req, reply) => {
    const rows = (req.body.rows ?? []).filter(r => STAGES.includes(r.stage))
    try {
      const fresh = cachedPreview && Date.now() - cachedPreview.at < CACHE_MS ? cachedPreview.data : undefined
      const stats = await applyDriveImport(prisma, rows, req.body.removedIds ?? [], fresh)
      cachedPreview = null
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId, action: IMPORT_ACTION, entity: 'recruitment', entityId: 'drive',
          newValues: { ...stats, email: req.user.email },
        },
      })
      return reply.send({ ok: true, stats })
    } catch (err: any) {
      fastify.log.error({ err }, 'Error al importar CVs desde Drive')
      return reply.status(400).send({ message: err.message })
    }
  })

  fastify.get('/import/drive/last', async () => {
    const last = await prisma.auditLog.findFirst({ where: { action: IMPORT_ACTION }, orderBy: { createdAt: 'desc' } })
    return last ? { at: last.createdAt, stats: last.newValues } : null
  })
}
