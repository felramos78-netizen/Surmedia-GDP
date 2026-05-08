import type { FastifyPluginAsync } from 'fastify'
import { runTaskAutomation } from '../services/automation.service'
import { getFormResponses } from '../services/sheets.service'
import { sendEmail, buildFromDbTemplate } from '../services/email.service'

// ─── Plantilla oficial de hitos (workflow Surmedia) ──────────────────────────
// Cada hito tiene: id estable, período, nombre, herramienta, tipo de automatización,
// config de automatización, y si requiere condición especial.

export const TASK_TEMPLATE = [
  // ── PRE-INGRESO (Día -7 a Día 0) ──────────────────────────────────────────
  {
    id:              'pre_carta_oferta',
    period:          'PRE_INGRESO',
    name:            'Carta oferta recibida y aceptada',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },
    appliesWhen:     null,
    sortOrder:       1,
  },
  {
    id:              'pre_documentos',
    period:          'PRE_INGRESO',
    name:            'Documentos personales validados',
    tool:            'Google Sheets API',
    automationType:  'SHEET_VERIFY',
    automationConfig: { nameColumn: 'Nombre completo', docColumns: ['Cédula de identidad por ambas partes', 'Certificado de afiliación AFP', 'Certificado de afiliación ISAPRE', 'Certificado de título académico', 'Licencia de conducir (si aplica)', 'Carta de renuncia (último trabajo si aplica)'] },
    appliesWhen:     null,
    sortOrder:       2,
  },
  {
    id:              'pre_coordinacion',
    period:          'PRE_INGRESO',
    name:            'Coordinación interna con administración y SSO',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'team', template: 'coordinacion_interna' },
    appliesWhen:     null,
    sortOrder:       3,
  },
  {
    id:              'pre_contratos_buk',
    period:          'PRE_INGRESO',
    name:            'Generación de documentos contractuales en BUK',
    tool:            'BUK API, Correo, Google Calendar',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'contract_signed' },
    appliesWhen:     null,
    sortOrder:       4,
  },
  {
    id:              'pre_correo_empresa',
    period:          'PRE_INGRESO',
    name:            'Correo empresa creado',
    tool:            'Google Workspace API',
    automationType:  'EXTERNAL',
    automationConfig: { system: 'google_workspace', action: 'create_account' },
    appliesWhen:     null,
    sortOrder:       5,
  },
  {
    id:              'pre_buk_asistencia',
    period:          'PRE_INGRESO',
    name:            'Perfil BUK marcaje asistencia creado',
    tool:            'BUK API',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'attendance_profile' },
    appliesWhen:     null,
    sortOrder:       6,
  },
  {
    id:              'pre_buk_perfil',
    period:          'PRE_INGRESO',
    name:            'Perfil BUK creado',
    tool:            'BUK API',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'employee_profile' },
    appliesWhen:     null,
    sortOrder:       7,
  },

  // ── DÍA 1 (Fecha de ingreso) ───────────────────────────────────────────────
  {
    id:              'day1_bienvenida',
    period:          'DIA_1',
    name:            'Correo de bienvenida',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },
    appliesWhen:     null,
    sortOrder:       1,
  },
  {
    id:              'day1_epp',
    period:          'DIA_1',
    name:            'Entrega de EPP y firma',
    tool:            'BUK API',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'epp_delivery' },
    appliesWhen:     'si aplica',
    sortOrder:       2,
  },
  {
    id:              'day1_induccion_jefatura',
    period:          'DIA_1',
    name:            'Inducción de jefatura realizada',
    tool:            'Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Inducción de jefatura — {collaboratorName}', daysFromStart: 0, durationMinutes: 60, attendees: ['supervisor', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       3,
  },
  {
    id:              'day1_enrolamiento',
    period:          'DIA_1',
    name:            'Enrolamiento de ingreso a oficina',
    tool:            'Físico/Manual, Google Calendar',
    automationType:  'MANUAL',
    automationConfig: null,
    appliesWhen:     'si aplica',
    sortOrder:       4,
  },
  {
    id:              'day1_kit',
    period:          'DIA_1',
    name:            'Entrega de kit de bienvenida',
    tool:            'Físico/Manual, Google Calendar',
    automationType:  'MANUAL',
    automationConfig: null,
    appliesWhen:     null,
    sortOrder:       5,
  },
  {
    id:              'day1_adobe',
    period:          'DIA_1',
    name:            'Licencia de Adobe habilitada',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'rrhh', instruction: 'Habilitar licencia Adobe Creative Cloud para el colaborador desde el panel de administración.' },
    appliesWhen:     'solo Diseño',
    sortOrder:       6,
  },
  {
    id:              'day1_induccion_corporativa',
    period:          'DIA_1',
    name:            'Inducción corporativa realizada',
    tool:            'Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Inducción Corporativa — {collaboratorName}', daysFromStart: 0, durationMinutes: 120, attendees: ['rrhh', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       7,
  },
  {
    id:              'day1_firmas',
    period:          'DIA_1',
    name:            'Contrato · RIOHS · IRL firmados',
    tool:            'BUK API',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'document_signing' },
    appliesWhen:     null,
    sortOrder:       8,
  },
  {
    id:              'day1_computador',
    period:          'DIA_1',
    name:            'Entrega de computador y recepción firmada',
    tool:            'Físico/Manual, BUK API, Google Calendar',
    automationType:  'BUK_CHECK',
    automationConfig: { checkType: 'asset_delivery' },
    appliesWhen:     null,
    sortOrder:       9,
  },

  // ── SEMANA 1 (Días 1–7) ───────────────────────────────────────────────────
  {
    id:              'semana_foto',
    period:          'SEMANA_1',
    name:            'Foto individual corporativa',
    tool:            'Físico/Manual, Google Calendar',
    automationType:  'MANUAL',
    automationConfig: null,
    appliesWhen:     null,
    sortOrder:       1,
  },
  {
    id:              'semana_sso',
    period:          'SEMANA_1',
    name:            'Inducción de SSO realizada',
    tool:            'Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Inducción SSO — {collaboratorName}', daysFromStart: 3, durationMinutes: 90, attendees: ['sso', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       2,
  },
  {
    id:              'semana_presentacion',
    period:          'SEMANA_1',
    name:            'Presentación a la empresa y círculo de especialistas',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'team', template: 'presentacion_empresa' },
    appliesWhen:     null,
    sortOrder:       3,
  },
  {
    id:              'semana_seguro',
    period:          'SEMANA_1',
    name:            'Formulario seguro complementario completo y enviado',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'collaborator', template: 'seguro_complementario' },
    appliesWhen:     null,
    sortOrder:       4,
  },
  {
    id:              'semana_pluxee',
    period:          'SEMANA_1',
    name:            'Tarjeta Pluxee entregada',
    tool:            'Físico/Manual, Correo, Google Calendar',
    automationType:  'MANUAL',
    automationConfig: null,
    appliesWhen:     null,
    sortOrder:       5,
  },
  {
    id:              'semana_foto_web',
    period:          'SEMANA_1',
    name:            'Foto individual cargada en web',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'rrhh', template: 'foto_web' },
    appliesWhen:     null,
    sortOrder:       6,
  },

  // ── MES 1 (Días 7–30) ─────────────────────────────────────────────────────
  {
    id:              'mes_cafe',
    period:          'MES_1',
    name:            'Café virtual con directores',
    tool:            'Correo, Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Café con directores — {collaboratorName}', daysFromStart: 14, durationMinutes: 30, attendees: ['directors', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       1,
  },
  {
    id:              'mes_mentor',
    period:          'MES_1',
    name:            'Mentor asignado',
    tool:            'Correo, Google Calendar',
    automationType:  'EMAIL',
    automationConfig: { emailTo: 'collaborator', template: 'mentor_asignado' },
    appliesWhen:     null,
    sortOrder:       2,
  },
  {
    id:              'eval_checkpoint30',
    period:          'MES_1',
    name:            'Checkpoint 1 · Día 30',
    tool:            'Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Checkpoint 30 días — {collaboratorName}', daysFromStart: 30, durationMinutes: 60, attendees: ['supervisor', 'rrhh', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       3,
  },

  // ── EVALUACIÓN (Días 60–90) ───────────────────────────────────────────────
  {
    id:              'eval_checkpoint60',
    period:          'EVALUACION',
    name:            'Checkpoint 2 · Día 60',
    tool:            'Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Checkpoint 60 días — {collaboratorName}', daysFromStart: 60, durationMinutes: 60, attendees: ['supervisor', 'rrhh', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       1,
  },
  {
    id:              'eval_feedback90',
    period:          'EVALUACION',
    name:            'Feedback 3 meses · Día 90',
    tool:            'Correo, Google Calendar',
    automationType:  'CALENDAR',
    automationConfig: { title: 'Evaluación período de prueba — {collaboratorName}', daysFromStart: 90, durationMinutes: 90, attendees: ['supervisor', 'rrhh', 'collaborator'] },
    appliesWhen:     null,
    sortOrder:       2,
  },
] as const

// ─── Rutas ─────────────────────────────────────────────────────────────────────

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  const prisma = fastify.prisma as any

  // ─── TEMPLATE TASKS (DB-backed, editable) ──────────────────────────────────

  // GET /template — backward-compat: devuelve desde DB (auto-seed si vacío), fallback estático
  fastify.get('/template', async (_req, reply) => {
    try {
      let tasks = await prisma.onboardingTemplateTask.findMany({
        where: { isActive: true },
        orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
      })
      if (tasks.length === 0) {
        await prisma.onboardingTemplateTask.createMany({
          data: TASK_TEMPLATE.map(t => ({
            key: t.id, period: t.period, name: t.name, tool: t.tool ?? null,
            automationType: t.automationType, automationConfig: t.automationConfig ?? null,
            appliesWhen: t.appliesWhen ?? null, sortOrder: t.sortOrder,
          })),
          skipDuplicates: true,
        })
        tasks = await prisma.onboardingTemplateTask.findMany({
          where: { isActive: true },
          orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
        })
      }
      return reply.send({ data: tasks.map((t: any) => ({ ...t, id: t.key })) })
    } catch {
      // Tabla aún no creada — devuelve la plantilla estática
      return reply.send({ data: TASK_TEMPLATE.map(t => ({ ...t, key: t.id, isActive: true })) })
    }
  })

  // GET /template-tasks — gestión completa (incluye inactivos)
  fastify.get('/template-tasks', async (_req, reply) => {
    try {
      let tasks = await prisma.onboardingTemplateTask.findMany({
        orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
      })
      if (tasks.length === 0) {
        await prisma.onboardingTemplateTask.createMany({
          data: TASK_TEMPLATE.map(t => ({
            key: t.id, period: t.period, name: t.name, tool: t.tool ?? null,
            automationType: t.automationType, automationConfig: t.automationConfig ?? null,
            appliesWhen: t.appliesWhen ?? null, sortOrder: t.sortOrder,
          })),
          skipDuplicates: true,
        })
        tasks = await prisma.onboardingTemplateTask.findMany({
          orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
        })
      }
      return reply.send({ data: tasks })
    } catch {
      return reply.send({ data: TASK_TEMPLATE.map(t => ({ ...t, key: t.id, isActive: true })) })
    }
  })

  // PATCH /template-tasks/:key — editar hito de plantilla
  fastify.patch<{
    Params: { key: string }
    Body: { name?: string; isActive?: boolean; appliesWhen?: string | null; period?: string }
  }>('/template-tasks/:key', async (req, reply) => {
    const { name, isActive, appliesWhen, period } = req.body
    const data: Record<string, any> = {}
    if (name       !== undefined) data.name       = name.trim()
    if (isActive   !== undefined) data.isActive   = isActive
    if (appliesWhen !== undefined) data.appliesWhen = appliesWhen
    if (period     !== undefined) data.period     = period
    const task = await prisma.onboardingTemplateTask.update({ where: { key: req.params.key }, data })
    return reply.send({ data: task })
  })

  // ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

  // GET /email-templates — listar (auto-seed si vacío)
  fastify.get('/email-templates', async (_req, reply) => {
    let templates = await prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } })
    if (templates.length === 0) {
      // Auto-seed defaults
      const defaults = [
        { key: 'bienvenida',          name: 'Bienvenida al colaborador',    subject: '¡Bienvenido/a a Surmedia, {collaboratorName}!',             bodyHtml: '<p>Hola <strong>{collaboratorName}</strong>,</p><p>Estamos muy emocionados de que te sumes a nuestro equipo. Tu fecha de ingreso es el <strong>{startDate}</strong>.</p><div class="info-card"><div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div><div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div><div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div></div><p>¡Nos vemos pronto!</p><p><strong>Equipo de Personas · Surmedia</strong></p>', variables: [] },
        { key: 'coordinacion_interna',name: 'Coordinación interna',         subject: 'GDP: Nuevo ingreso — {collaboratorName} ({startDate})',      bodyHtml: '<h2>Nuevo colaborador ingresando</h2><div class="info-card"><div class="info-row"><span class="info-label">Nombre:</span><span class="info-value">{collaboratorName}</span></div><div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div><div class="info-row"><span class="info-label">Email:</span><span class="info-value">{collaboratorEmail}</span></div><div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div><div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div></div><p>Por favor coordina los preparativos de recepción.</p>', variables: [] },
        { key: 'seguro_complementario',name: 'Seguro complementario',       subject: 'Surmedia: Completa tu formulario de seguro complementario',  bodyHtml: '<p>Hola <strong>{collaboratorName}</strong>,</p><p>Como parte de los beneficios de Surmedia, tienes acceso a un <strong>seguro complementario de salud</strong>. Nuestro equipo de Personas te enviará el formulario directamente. Por favor complétalo dentro de los primeros 7 días de ingreso.</p><p>Ante cualquier duda, escríbenos a <a href="mailto:rrhh@surmedia.cl">rrhh@surmedia.cl</a>.</p>', variables: [] },
        { key: 'mentor_asignado',     name: 'Mentor asignado',              subject: 'Surmedia: Tu mentor durante el período de inducción',        bodyHtml: '<p>Hola <strong>{collaboratorName}</strong>,</p><p>Hemos asignado a un mentor para acompañarte durante tus primeros meses en Surmedia.</p><p>No dudes en contactar a tu mentor cuando lo necesites. ¡Estamos todos para apoyarte!</p>', variables: [] },
        { key: 'checkpoint',          name: 'Checkpoint de seguimiento',    subject: 'GDP: Checkpoint día {dayNumber} — {collaboratorName}',       bodyHtml: '<h2>Checkpoint de onboarding — Día {dayNumber}</h2><p>El colaborador <strong>{collaboratorName}</strong> cumple <strong>{dayNumber} días</strong> en Surmedia. Es momento de realizar el checkpoint de seguimiento.</p><div class="info-card"><div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div><div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div><div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div></div><p>Por favor agenda una reunión de feedback con el colaborador y su jefatura directa.</p>', variables: [] },
        { key: 'notificacion_interna',name: 'Notificación interna genérica',subject: 'GDP: Acción requerida — {taskName} · {collaboratorName}',    bodyHtml: '<h2>Acción requerida en proceso de onboarding</h2><div class="info-card"><div class="info-row"><span class="info-label">Colaborador:</span><span class="info-value">{collaboratorName}</span></div><div class="info-row"><span class="info-label">Hito:</span><span class="info-value">{taskName}</span></div></div><p>{instruction}</p>', variables: [] },
      ]
      await prisma.emailTemplate.createMany({ data: defaults, skipDuplicates: true })
      templates = await prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } })
    }
    return reply.send({ data: templates })
  })

  // PATCH /email-templates/:key — actualizar subject y/o bodyHtml
  fastify.patch<{
    Params: { key: string }
    Body: { subject?: string; bodyHtml?: string; name?: string }
  }>('/email-templates/:key', async (req, reply) => {
    const data: Record<string, any> = {}
    if (req.body.subject  !== undefined) data.subject  = req.body.subject
    if (req.body.bodyHtml !== undefined) data.bodyHtml = req.body.bodyHtml
    if (req.body.name     !== undefined) data.name     = req.body.name
    const tpl = await prisma.emailTemplate.update({ where: { key: req.params.key }, data })
    return reply.send({ data: tpl })
  })

  // POST /email-templates/:key/preview — renderizar con datos de ejemplo
  fastify.post<{ Params: { key: string } }>('/email-templates/:key/preview', async (req, reply) => {
    const tpl = await prisma.emailTemplate.findUnique({ where: { key: req.params.key } })
    if (!tpl) return reply.status(404).send({ message: 'Template no encontrado' })
    const sampleVars: Record<string, string> = {
      collaboratorName:     'Juan Pérez Ejemplo',
      collaboratorPosition: 'Diseñador Gráfico',
      collaboratorEmail:    'juan.perez@surmedia.cl',
      legalEntity:          'Comunicaciones Surmedia Spa',
      startDate:            '15 de mayo de 2026',
      expectedEndDate:      '13 de agosto de 2026',
      dayNumber:            '30',
      taskName:             'Foto individual corporativa',
      instruction:          'Por favor realiza esta acción antes del viernes.',
    }
    const { subject, html } = buildFromDbTemplate(tpl, sampleVars)
    return reply.send({ data: { subject, html } })
  })

  // POST /email-templates/:key/send-test — enviar email de prueba
  fastify.post<{
    Params: { key: string }
    Body: { to: string }
  }>('/email-templates/:key/send-test', async (req, reply) => {
    const tpl = await prisma.emailTemplate.findUnique({ where: { key: req.params.key } })
    if (!tpl) return reply.status(404).send({ message: 'Template no encontrado' })
    const sampleVars: Record<string, string> = {
      collaboratorName: 'Juan Pérez Ejemplo', collaboratorPosition: 'Diseñador Gráfico',
      collaboratorEmail: req.body.to, legalEntity: 'Comunicaciones Surmedia Spa',
      startDate: '15 de mayo de 2026', expectedEndDate: '13 de agosto de 2026',
      dayNumber: '30', taskName: 'Foto individual corporativa', instruction: 'Acción de prueba.',
    }
    const { subject, html } = buildFromDbTemplate(tpl, sampleVars)
    try {
      await sendEmail({ to: req.body.to, subject: `[PRUEBA] ${subject}`, html })
      return reply.send({ data: { sent: true, to: req.body.to } })
    } catch (err: any) {
      return reply.status(500).send({ message: `Error al enviar: ${err.message}` })
    }
  })

  // ─── EMAIL LOGS ───────────────────────────────────────────────────────────────

  // GET /email-logs — historial de envíos
  fastify.get<{ Querystring: { processId?: string; limit?: string } }>('/email-logs', async (req, reply) => {
    const where: Record<string, any> = {}
    if (req.query.processId) where.processId = req.query.processId
    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: Number(req.query.limit ?? 100),
    })
    return reply.send({ data: logs })
  })

  // ─── FORMS ───────────────────────────────────────────────────────────────────

  // GET /forms/:formId — detalle de formulario (auth)
  fastify.get<{ Params: { formId: string } }>('/forms/:formId', async (req, reply) => {
    const form = await prisma.onboardingForm.findUnique({
      where: { id: req.params.formId },
      include: { process: { select: { collaboratorName: true, id: true } } },
    })
    if (!form) return reply.status(404).send({ message: 'Formulario no encontrado' })
    return reply.send({ data: form })
  })

  // PATCH /forms/:formId — actualizar formulario
  fastify.patch<{
    Params: { formId: string }
    Body: { title?: string; fields?: unknown[]; isActive?: boolean }
  }>('/forms/:formId', async (req, reply) => {
    const data: Record<string, any> = {}
    if (req.body.title    !== undefined) data.title    = req.body.title.trim()
    if (req.body.fields   !== undefined) data.fields   = req.body.fields
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive
    const form = await prisma.onboardingForm.update({ where: { id: req.params.formId }, data })
    return reply.send({ data: form })
  })

  // DELETE /forms/:formId — eliminar formulario
  fastify.delete<{ Params: { formId: string } }>('/forms/:formId', async (req, reply) => {
    await prisma.onboardingForm.delete({ where: { id: req.params.formId } })
    return reply.status(204).send()
  })

  // GET /forms/:formId/responses — respuestas del formulario
  fastify.get<{ Params: { formId: string } }>('/forms/:formId/responses', async (req, reply) => {
    const responses = await prisma.formResponse.findMany({
      where: { formId: req.params.formId },
      orderBy: { submittedAt: 'desc' },
    })
    return reply.send({ data: responses })
  })

  // GET / — lista todos los procesos
  fastify.get('/', async (_req, reply) => {
    const processes = await prisma.onboardingProcess.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        employee: { include: { position: true } },
        tasks:    { select: { id: true, completedAt: true, automationStatus: true } },
      },
    })
    return reply.send({ data: processes })
  })

  // GET /stats
  fastify.get('/stats', async (_req, reply) => {
    const [inProgress, completed, cancelled] = await Promise.all([
      prisma.onboardingProcess.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.onboardingProcess.count({ where: { status: 'COMPLETED' } }),
      prisma.onboardingProcess.count({ where: { status: 'CANCELLED' } }),
    ])
    const soon = await prisma.onboardingProcess.count({
      where: { status: 'IN_PROGRESS', expectedEndDate: { lte: new Date(Date.now() + 15 * 864e5) } },
    })
    return reply.send({ data: { inProgress, completed, cancelled, finalizingSoon: soon } })
  })

  // POST / — crear proceso con hitos seleccionados
  fastify.post<{
    Body: {
      collaboratorName:          string
      collaboratorEmail?:        string
      collaboratorPersonalEmail?: string
      collaboratorPosition?:     string
      collaboratorPhone?:        string
      legalEntity?:              string
      startDate?:                string
      notes?:                    string
      selectedTaskIds:           string[]
    }
  }>('/', async (req, reply) => {
    const { collaboratorName, collaboratorEmail, collaboratorPersonalEmail, collaboratorPosition, collaboratorPhone, legalEntity, startDate, notes, selectedTaskIds } = req.body

    if (!collaboratorName?.trim()) return reply.status(400).send({ message: 'El nombre del colaborador es requerido' })
    if (!selectedTaskIds?.length)  return reply.status(400).send({ message: 'Selecciona al menos un hito' })

    const start = startDate ? new Date(startDate) : new Date()
    const expectedEndDate = new Date(start)
    expectedEndDate.setDate(expectedEndDate.getDate() + 90)

    // Filtrar plantilla a los IDs seleccionados, mantener orden original
    const selectedTasks = TASK_TEMPLATE.filter(t => selectedTaskIds.includes(t.id))

    const process = await prisma.onboardingProcess.create({
      data: {
        collaboratorName:          collaboratorName.trim(),
        collaboratorEmail:         collaboratorEmail?.trim() || null,
        collaboratorPersonalEmail: collaboratorPersonalEmail?.trim() || null,
        collaboratorPosition:      collaboratorPosition?.trim() || null,
        collaboratorPhone:    collaboratorPhone?.trim() || null,
        legalEntity:          legalEntity || null,
        notes:                notes?.trim() || null,
        startDate:            start,
        expectedEndDate,
        tasks: {
          create: selectedTasks.map(t => ({
            templateId:       t.id,
            period:           t.period,
            name:             t.name,
            tool:             t.tool ?? null,
            appliesWhen:      t.appliesWhen ?? null,
            sortOrder:        t.sortOrder,
            automationType:   t.automationType,
            automationConfig: t.automationConfig ?? null,
          })),
        },
      },
      include: {
        tasks: { orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }] },
      },
    })

    return reply.status(201).send({ data: process })
  })

  // GET /sheet/form-responses — respuestas del formulario de ingreso (debe ir antes de /:id)
  fastify.get('/sheet/form-responses', async (_req, reply) => {
    try {
      const rows = await getFormResponses()
      return { data: rows, total: rows.length }
    } catch (err: any) {
      return reply.status(500).send({ message: 'Error al leer el sheet', detail: err.message })
    }
  })

  // GET /:id — detalle completo
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const process = await prisma.onboardingProcess.findFirst({
      where: { id: req.params.id },
      include: {
        employee: { include: { position: true, department: true } },
        tasks: {
          orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
          include: {
            assignments: {
              include: { profile: { select: { id: true, name: true, position: true, email: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })
    if (!process) return reply.status(404).send({ message: 'Proceso no encontrado' })
    return reply.send({ data: process })
  })

  // PATCH /:id/tasks/:taskId — completar / editar tarea
  fastify.patch<{
    Params: { id: string; taskId: string }
    Body: { completed?: boolean; name?: string; tool?: string; completedNote?: string; period?: string; appliesWhen?: string | null }
  }>('/:id/tasks/:taskId', async (req, reply) => {
    const { completed, name, tool, completedNote, period, appliesWhen } = req.body
    const userId = (req.user as any)?.id ?? 'system'

    const updateData: Record<string, any> = {}
    if (name          !== undefined) updateData.name        = name
    if (tool          !== undefined) updateData.tool        = tool
    if (completedNote !== undefined) updateData.completedNote = completedNote
    if (period        !== undefined) updateData.period      = period
    if (appliesWhen   !== undefined) updateData.appliesWhen = appliesWhen
    if (completed   !== undefined) {
      updateData.completedAt = completed ? new Date() : null
      updateData.completedBy = completed ? userId : null
    }

    const task = await prisma.onboardingTask.update({
      where: { id: req.params.taskId },
      data:  updateData,
    })

    // Auto-completar proceso si todas las tareas están listas
    const all = await prisma.onboardingTask.findMany({
      where:  { processId: req.params.id },
      select: { completedAt: true },
    })
    if (all.every((t: any) => t.completedAt !== null)) {
      await prisma.onboardingProcess.update({
        where: { id: req.params.id },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    return reply.send({ data: task })
  })

  // POST /:id/tasks — agregar hito personalizado
  fastify.post<{
    Params: { id: string }
    Body: { period: string; name: string; tool?: string; automationType?: string }
  }>('/:id/tasks', async (req, reply) => {
    const { period, name, tool, automationType } = req.body

    const lastTask = await prisma.onboardingTask.findFirst({
      where:   { processId: req.params.id, period },
      orderBy: { sortOrder: 'desc' },
    })

    const task = await prisma.onboardingTask.create({
      data: {
        processId:     req.params.id,
        period,
        name,
        tool:          tool ?? null,
        automationType: automationType ?? 'MANUAL',
        sortOrder:     (lastTask?.sortOrder ?? 0) + 1,
      },
    })

    return reply.status(201).send({ data: task })
  })

  // POST /:id/tasks/:taskId/assignments — asignar perfil a hito
  fastify.post<{
    Params: { id: string; taskId: string }
    Body: { profileId: string; roleType: string }
  }>('/:id/tasks/:taskId/assignments', async (req, reply) => {
    const { profileId, roleType } = req.body
    try {
      const assignment = await prisma.onboardingTaskAssignment.create({
        data: { taskId: req.params.taskId, profileId, roleType },
        include: { profile: { select: { id: true, name: true, position: true, email: true } } },
      })
      return reply.status(201).send({ data: assignment })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ message: 'Este perfil ya está asignado con ese rol' })
      throw err
    }
  })

  // DELETE /:id/tasks/:taskId/assignments/:assignmentId — quitar perfil de hito
  fastify.delete<{ Params: { id: string; taskId: string; assignmentId: string } }>('/:id/tasks/:taskId/assignments/:assignmentId', async (req, reply) => {
    await prisma.onboardingTaskAssignment.delete({ where: { id: req.params.assignmentId } })
    return reply.status(204).send()
  })

  // DELETE /:id/tasks/:taskId — eliminar hito del proceso
  fastify.delete<{ Params: { id: string; taskId: string } }>('/:id/tasks/:taskId', async (req, reply) => {
    await prisma.onboardingTask.delete({ where: { id: req.params.taskId } })
    return reply.status(204).send()
  })

  // GET /:id/forms — listar formularios del proceso
  fastify.get<{ Params: { id: string } }>('/:id/forms', async (req, reply) => {
    const forms = await prisma.onboardingForm.findMany({
      where: { processId: req.params.id },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: forms })
  })

  // POST /:id/forms — crear formulario para un proceso
  fastify.post<{
    Params: { id: string }
    Body: { title: string; fields?: unknown[] }
  }>('/:id/forms', async (req, reply) => {
    const process = await prisma.onboardingProcess.findUnique({ where: { id: req.params.id } })
    if (!process) return reply.status(404).send({ message: 'Proceso no encontrado' })
    const form = await prisma.onboardingForm.create({
      data: { processId: req.params.id, title: req.body.title.trim(), fields: req.body.fields ?? [] },
    })
    return reply.status(201).send({ data: form })
  })

  // POST /:id/tasks/:taskId/automate — ejecutar automatización de un hito
  fastify.post<{ Params: { id: string; taskId: string } }>('/:id/tasks/:taskId/automate', async (req, reply) => {
    const process = await prisma.onboardingProcess.findFirst({
      where: { id: req.params.id },
    })
    if (!process) return reply.status(404).send({ message: 'Proceso no encontrado' })

    const task = await prisma.onboardingTask.findFirst({
      where: { id: req.params.taskId, processId: req.params.id },
    })
    if (!task) return reply.status(404).send({ message: 'Hito no encontrado' })

    await prisma.onboardingTask.update({ where: { id: task.id }, data: { automationStatus: 'RUNNING' } })

    // Intentar usar template DB para emails
    let result: Awaited<ReturnType<typeof runTaskAutomation>>
    if (task.automationType === 'EMAIL') {
      const templateKey = (task.automationConfig as any)?.template as string | undefined
      const dbTemplate = templateKey
        ? await prisma.emailTemplate.findUnique({ where: { key: templateKey } }).catch(() => null)
        : null

      if (dbTemplate) {
        const vars: Record<string, string> = {
          collaboratorName:     process.collaboratorName,
          collaboratorPosition: process.collaboratorPosition ?? '—',
          collaboratorEmail:    process.collaboratorEmail ?? '—',
          legalEntity:          process.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones Surmedia Spa' : process.legalEntity === 'SURMEDIA_CONSULTORIA' ? 'Surmedia Consultoría Spa' : '—',
          startDate:            new Date(process.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
          expectedEndDate:      '',
          taskName:             task.name,
          instruction:          (task.automationConfig as any)?.instruction ?? '',
        }
        const emailTo = (task.automationConfig as any)?.emailTo as string
        const rrhhFallback = globalThis.process?.env?.SMTP_USER ?? 'rrhh@surmedia.cl'
        const recipient = emailTo === 'collaborator' ? process.collaboratorEmail : rrhhFallback
        if (!recipient) {
          result = { status: 'SKIPPED', message: 'El colaborador no tiene email registrado', detail: {} }
        } else {
          try {
            const { subject, html } = buildFromDbTemplate(dbTemplate, vars)
            const sent = await sendEmail({ to: recipient, subject, html })
            result = { status: 'SUCCESS', message: `Correo enviado a ${recipient}`, detail: { to: recipient, subject, messageId: sent.messageId } }
          } catch (err: any) {
            result = { status: 'FAILED', message: err.message, detail: { error: String(err) } }
          }
        }
      } else {
        result = await runTaskAutomation(task, process)
      }
    } else {
      result = await runTaskAutomation(task, process)
    }

    // Log de email
    if (task.automationType === 'EMAIL') {
      prisma.emailLog.create({
        data: {
          processId:   process.id,
          taskId:      task.id,
          toEmail:     (result.detail as any)?.to ?? '?',
          subject:     (result.detail as any)?.subject ?? task.name,
          status:      result.status === 'SUCCESS' ? 'SENT' : result.status === 'SKIPPED' ? 'SKIPPED' : 'FAILED',
          error:       result.status === 'FAILED' ? result.message : null,
          templateKey: (task.automationConfig as any)?.template ?? null,
        },
      }).catch(() => {})
    }

    const updatedTask = await prisma.onboardingTask.update({
      where: { id: task.id },
      data: {
        automationStatus: result.status,
        automationResult: result,
        automatedAt:      new Date(),
        ...(result.status === 'SUCCESS' && task.automationType === 'EMAIL'
          ? { completedAt: new Date(), completedBy: 'automation' }
          : {}),
      },
    })

    return reply.send({ data: updatedTask, result })
  })

  // PATCH /:id — editar proceso (datos del colaborador y/o estado)
  fastify.patch<{
    Params: { id: string }
    Body: {
      status?:               string
      employeeId?:           string
      collaboratorName?:          string
      collaboratorEmail?:         string | null
      collaboratorPersonalEmail?: string | null
      collaboratorPosition?:      string | null
      collaboratorPhone?:         string | null
      legalEntity?:               string | null
      startDate?:                 string
      notes?:                     string | null
    }
  }>('/:id', async (req, reply) => {
    const updateData: Record<string, any> = {}

    if (req.body.status !== undefined)                    updateData.status                    = req.body.status
    if (req.body.employeeId !== undefined)                updateData.employeeId                = req.body.employeeId
    if (req.body.collaboratorName !== undefined)          updateData.collaboratorName          = req.body.collaboratorName?.trim()
    if (req.body.collaboratorEmail !== undefined)         updateData.collaboratorEmail         = req.body.collaboratorEmail?.trim() || null
    if (req.body.collaboratorPersonalEmail !== undefined) updateData.collaboratorPersonalEmail = req.body.collaboratorPersonalEmail?.trim() || null
    if (req.body.collaboratorPosition !== undefined)      updateData.collaboratorPosition      = req.body.collaboratorPosition?.trim() || null
    if (req.body.collaboratorPhone !== undefined)         updateData.collaboratorPhone         = req.body.collaboratorPhone?.trim() || null
    if (req.body.legalEntity !== undefined)               updateData.legalEntity               = req.body.legalEntity || null
    if (req.body.notes !== undefined)                     updateData.notes                     = req.body.notes?.trim() || null
    if (req.body.startDate !== undefined) {
      const start = new Date(req.body.startDate)
      const expectedEndDate = new Date(start)
      expectedEndDate.setDate(expectedEndDate.getDate() + 90)
      updateData.startDate        = start
      updateData.expectedEndDate  = expectedEndDate
    }
    if (req.body.status === 'COMPLETED') updateData.completedAt = new Date()

    const process = await prisma.onboardingProcess.update({
      where: { id: req.params.id },
      data:  updateData,
    })
    return reply.send({ data: process })
  })

  // DELETE /:id — eliminar proceso y sus hitos (cascade)
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await prisma.onboardingProcess.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

  // POST /:id/delete — workaround para clientes que no soportan DELETE
  fastify.post<{ Params: { id: string } }>('/:id/delete', async (req, reply) => {
    await prisma.onboardingProcess.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

}

export default onboardingRoutes
