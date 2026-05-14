import type { FastifyPluginAsync } from 'fastify'
import { runTaskAutomation } from '../services/automation.service'
import { getFormResponses, getSheetRowsByUrl, findRowByRut, mapRowToEmployee } from '../services/sheets.service'
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

  const TASK_TYPE_MAP: Record<string, string> = {
    pre_carta_oferta: 'FECHA_ESPECIFICA',
    day1_bienvenida: 'FECHA_ESPECIFICA', day1_epp: 'FECHA_ESPECIFICA', day1_induccion_jefatura: 'FECHA_ESPECIFICA',
    day1_enrolamiento: 'FECHA_ESPECIFICA', day1_kit: 'FECHA_ESPECIFICA', day1_adobe: 'FECHA_ESPECIFICA',
    day1_induccion_corporativa: 'FECHA_ESPECIFICA', day1_firmas: 'FECHA_ESPECIFICA', day1_computador: 'FECHA_ESPECIFICA',
    eval_checkpoint30: 'FECHA_ESPECIFICA', eval_checkpoint60: 'FECHA_ESPECIFICA', eval_feedback90: 'FECHA_ESPECIFICA',
  }

  // GET /template-tasks — gestión completa (incluye inactivos)
  fastify.get('/template-tasks', async (_req, reply) => {
    try {
      let tasks = await prisma.onboardingTemplateTask.findMany({
        orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
        include: {
          subTasks:   { orderBy: { sortOrder: 'asc' }, include: { responsable: { select: { id: true, name: true } } } },
          responsable: { select: { id: true, name: true, position: true } },
        },
      })
      if (tasks.length === 0) {
        await prisma.onboardingTemplateTask.createMany({
          data: TASK_TEMPLATE.map(t => ({
            key: t.id, period: t.period, name: t.name, tool: t.tool ?? null,
            automationType: t.automationType, automationConfig: t.automationConfig ?? null,
            appliesWhen: t.appliesWhen ?? null, sortOrder: t.sortOrder,
            taskType: TASK_TYPE_MAP[t.id] ?? 'PLAZO',
          })),
          skipDuplicates: true,
        })
        tasks = await prisma.onboardingTemplateTask.findMany({
          orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }],
          include: {
            subTasks:    { orderBy: { sortOrder: 'asc' }, include: { responsable: { select: { id: true, name: true } } } },
            responsable: { select: { id: true, name: true, position: true } },
          },
        })
      }
      return reply.send({ data: tasks })
    } catch {
      return reply.send({ data: TASK_TEMPLATE.map(t => ({ ...t, key: t.id, isActive: true, taskType: TASK_TYPE_MAP[t.id] ?? 'PLAZO', appliesTo: [], subTasks: [] })) })
    }
  })

  // POST /template-tasks — crear nuevo hito de plantilla
  fastify.post<{
    Body: {
      name: string; period: string; taskType?: string; tool?: string; automationType?: string
      automationConfig?: Record<string, any> | null
      responsableProfileId?: string | null; appliesTo?: string[]; appliesWhen?: string | null
      subTasks?: Array<{ name: string; responsableProfileId?: string | null; tool?: string | null; plantilla?: string | null; sortOrder?: number }>
    }
  }>('/template-tasks', async (req, reply) => {
    const { name, period, taskType = 'PLAZO', tool, automationType, automationConfig, responsableProfileId, appliesTo = [], appliesWhen, subTasks = [] } = req.body
    if (!name?.trim()) return reply.status(400).send({ message: 'El nombre es requerido' })

    // Generar key único
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)
    const key  = `custom_${slug}_${Date.now().toString(36)}`

    const last = await prisma.onboardingTemplateTask.findFirst({
      where: { period }, orderBy: { sortOrder: 'desc' },
    })

    const task = await prisma.onboardingTemplateTask.create({
      data: {
        key,
        name:                name.trim(),
        period:              period as any,
        taskType,
        tool:                tool?.trim() || null,
        automationType:      automationType as any ?? 'MANUAL',
        automationConfig:    automationConfig ?? null,
        responsableProfileId: responsableProfileId || null,
        appliesTo:           appliesTo,
        appliesWhen:         appliesWhen || null,
        sortOrder:           (last?.sortOrder ?? 0) + 1,
        subTasks: {
          create: subTasks.map((st, i) => ({
            name: st.name.trim(), tool: st.tool || null, plantilla: st.plantilla || null,
            responsableProfileId: st.responsableProfileId || null,
            sortOrder: st.sortOrder ?? i,
          })),
        },
      },
      include: {
        subTasks:    { orderBy: { sortOrder: 'asc' }, include: { responsable: { select: { id: true, name: true } } } },
        responsable: { select: { id: true, name: true, position: true } },
      },
    })
    return reply.status(201).send({ data: task })
  })

  // PATCH /template-tasks/:key — editar hito de plantilla
  fastify.patch<{
    Params: { key: string }
    Body: {
      name?: string; isActive?: boolean; appliesWhen?: string | null; period?: string
      taskType?: string; responsableProfileId?: string | null; appliesTo?: string[]
      tool?: string | null; automationType?: string; automationConfig?: Record<string, any> | null
      subTasks?: Array<{ id?: string; name: string; responsableProfileId?: string | null; tool?: string | null; plantilla?: string | null; sortOrder?: number }>
    }
  }>('/template-tasks/:key', async (req, reply) => {
    const { name, isActive, appliesWhen, period, taskType, responsableProfileId, appliesTo, tool, automationType, automationConfig, subTasks } = req.body
    const data: Record<string, any> = {}
    if (name                !== undefined) data.name                = name.trim()
    if (isActive            !== undefined) data.isActive            = isActive
    if (appliesWhen         !== undefined) data.appliesWhen         = appliesWhen
    if (period              !== undefined) data.period              = period
    if (taskType            !== undefined) data.taskType            = taskType
    if (responsableProfileId !== undefined) data.responsableProfileId = responsableProfileId || null
    if (appliesTo           !== undefined) data.appliesTo           = appliesTo
    if (tool                !== undefined) data.tool                = tool || null
    if (automationType      !== undefined) data.automationType      = automationType
    if (automationConfig    !== undefined) data.automationConfig    = automationConfig

    const task = await prisma.onboardingTemplateTask.findUnique({ where: { key: req.params.key }, select: { id: true } })
    if (!task) return reply.status(404).send({ message: 'Hito no encontrado' })

    if (subTasks !== undefined) {
      // Replace all subtasks
      await prisma.onboardingTemplateSubTask.deleteMany({ where: { templateTaskId: task.id } })
      if (subTasks.length > 0) {
        await prisma.onboardingTemplateSubTask.createMany({
          data: subTasks.map((st, i) => ({
            templateTaskId:      task.id,
            name:                st.name.trim(),
            tool:                st.tool || null,
            plantilla:           st.plantilla || null,
            responsableProfileId: st.responsableProfileId || null,
            sortOrder:           st.sortOrder ?? i,
          })),
        })
      }
    }

    const updated = await prisma.onboardingTemplateTask.update({
      where: { key: req.params.key },
      data,
      include: {
        subTasks:    { orderBy: { sortOrder: 'asc' }, include: { responsable: { select: { id: true, name: true } } } },
        responsable: { select: { id: true, name: true, position: true } },
      },
    })
    return reply.send({ data: updated })
  })

  // DELETE /template-tasks/:key — eliminar hito de plantilla
  fastify.delete<{ Params: { key: string } }>('/template-tasks/:key', async (req, reply) => {
    try {
      await prisma.onboardingTemplateTask.delete({ where: { key: req.params.key } })
    } catch {
      return reply.status(404).send({ message: 'Hito no encontrado' })
    }
    return reply.status(204).send()
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

  // POST /email-templates — crear nueva plantilla
  fastify.post<{
    Body: { key: string; name: string; subject?: string; bodyHtml?: string }
  }>('/email-templates', async (req, reply) => {
    const { key, name, subject = '', bodyHtml = '' } = req.body
    if (!key?.trim() || !name?.trim()) return reply.status(400).send({ message: 'key y name son requeridos' })
    try {
      const tpl = await prisma.emailTemplate.create({
        data: { key: key.trim(), name: name.trim(), subject: subject.trim(), bodyHtml: bodyHtml.trim(), variables: [] },
      })
      return reply.status(201).send({ data: tpl })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ message: 'Ya existe una plantilla con ese key' })
      throw err
    }
  })

  // PATCH /email-templates/:key — actualizar campos
  fastify.patch<{
    Params: { key: string }
    Body: { subject?: string; bodyHtml?: string; name?: string; fromEmail?: string | null; toEmails?: string[]; ccEmails?: string[] }
  }>('/email-templates/:key', async (req, reply) => {
    const data: Record<string, any> = {}
    if (req.body.subject   !== undefined) data.subject   = req.body.subject
    if (req.body.bodyHtml  !== undefined) data.bodyHtml  = req.body.bodyHtml
    if (req.body.name      !== undefined) data.name      = req.body.name
    if (req.body.fromEmail !== undefined) data.fromEmail = req.body.fromEmail
    if (req.body.toEmails  !== undefined) data.toEmails  = req.body.toEmails
    if (req.body.ccEmails  !== undefined) data.ccEmails  = req.body.ccEmails
    try {
      const tpl = await prisma.emailTemplate.update({ where: { key: req.params.key }, data })
      return reply.send({ data: tpl })
    } catch {
      return reply.status(404).send({ message: 'Plantilla no encontrada' })
    }
  })

  // DELETE /email-templates/:key
  fastify.delete<{ Params: { key: string } }>('/email-templates/:key', async (req, reply) => {
    try {
      await prisma.emailTemplate.delete({ where: { key: req.params.key } })
    } catch {
      return reply.status(404).send({ message: 'Plantilla no encontrada' })
    }
    return reply.status(204).send()
  })

  // Sample vars helper — incluye todos los campos del sistema
  function makeSampleVars(overrides: Record<string, string> = {}): Record<string, string> {
    const now = new Date()
    const fmt = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    const hour = now.getHours()
    return {
      // Legacy camelCase (backward compat)
      collaboratorName:     'Juan Pérez Ejemplo',
      collaboratorPosition: 'Diseñador Gráfico',
      collaboratorEmail:    'juan.perez@surmedia.cl',
      legalEntity:          'Comunicaciones Surmedia Spa',
      startDate:            '15 de mayo de 2026',
      expectedEndDate:      '13 de agosto de 2026',
      dayNumber:            '30',
      taskName:             'Foto individual corporativa',
      instruction:          'Por favor realiza esta acción antes del viernes.',
      // Nueva sintaxis "varName"
      nombre:               'Juan Pérez Ejemplo',
      primerNombre:         'Juan',
      apellido:             'Pérez Ejemplo',
      rut:                  '12.345.678-9',
      cargo:                'Diseñador Gráfico',
      empresa:              'Comunicaciones Surmedia Spa',
      email:                'juan.perez@surmedia.cl',
      emailPersonal:        'juanperez@gmail.com',
      telefono:             '+56 9 8765 4321',
      jornada:              'Mensual 40.0 hrs. (L, M, M, J, V)',
      supervisor:           'María López González',
      afp:                  'Habitat',
      isapre:               'Banmédica',
      ciudad:               'Santiago',
      comuna:               'Las Condes',
      centroTrabajo:        'Digital Surmedia',
      tipoCentro:           'Directo',
      fechaIngreso:         '15 de mayo de 2026',
      fechaIngresoCorta:    '15/05/2026',
      fechaActual:          fmt(now),
      año:                  now.getFullYear().toString(),
      saludoHorario:        hour < 13 ? 'buenos días' : hour < 20 ? 'buenas tardes' : 'buenas noches',
      diaNumero:            '30',
      nombreHito:           'Foto individual corporativa',
      instruccion:          'Por favor realiza esta acción antes del viernes.',
      ...overrides,
    }
  }

  // POST /email-templates/:key/preview — renderizar con datos de ejemplo
  fastify.post<{ Params: { key: string } }>('/email-templates/:key/preview', async (req, reply) => {
    const tpl = await prisma.emailTemplate.findUnique({ where: { key: req.params.key } })
    if (!tpl) return reply.status(404).send({ message: 'Template no encontrado' })
    const { subject, html } = buildFromDbTemplate(tpl, makeSampleVars())
    return reply.send({ data: { subject, html } })
  })

  // POST /email-templates/:key/send-test — enviar email de prueba
  fastify.post<{
    Params: { key: string }
    Body: { to: string }
  }>('/email-templates/:key/send-test', async (req, reply) => {
    const tpl = await prisma.emailTemplate.findUnique({ where: { key: req.params.key } })
    if (!tpl) return reply.status(404).send({ message: 'Template no encontrado' })
    const { subject, html } = buildFromDbTemplate(tpl, makeSampleVars({ collaboratorEmail: req.body.to, email: req.body.to }))
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

  // ─── SHEET TEMPLATES ────────────────────────────────────────────────────────

  // Default column mappings for the two known Surmedia sheets
  const DEFAULT_MAPPINGS: Record<string, Record<string, string>> = {
    'ficha-personal': {
      'Nombres':                         'firstName',
      'Apellido paterno':                '_apellidoPaterno',
      'Apellido materno':                '_apellidoMaterno',
      'Sexo':                            'gender',
      'Fecha de Nacimiento':             'birthDate',
      'Nacionalidad':                    'nationality',
      'Email Personal':                  'personalEmail',
      'Celular':                         'phone',
      'Dirección calle':                 '_direccionCalle',
      'Dirección numero':                '_direccionNumero',
      'Dirección departamento':          '_direccionDepto',
      'Dirección comuna':                'commune',
      'Dirección ciudad':                'city',
      'Información Previsional (AFP)':   'afp',
      'Sistema de salud (Isapre o Fonasa)': 'isapre',
    },
    'datos-contractuales': {
      'Correo del empleado Empresa': 'email',
      'Cargo':                       'jobTitle',
      'Jornada':                     'workSchedule',
      'Jefe':                        'supervisorName',
    },
  }

  // GET /sheet-templates
  fastify.get('/sheet-templates', async (_req, reply) => {
    try {
      let sheets = await prisma.onboardingSheetTemplate.findMany({ orderBy: { createdAt: 'asc' } })
      // Auto-seed the two known sheets if empty
      if (sheets.length === 0) {
        await prisma.onboardingSheetTemplate.createMany({
          data: [
            {
              key:          'ficha-personal',
              name:         'Ficha Personal del Ingresante',
              url:          'https://docs.google.com/spreadsheets/d/1Y08GbGyu5B0incj7MaX9-Rd047tAxvkq5phAm6euvvI/edit?usp=sharing',
              rutColumn:    'RUT',
              columnMappings: DEFAULT_MAPPINGS['ficha-personal'],
              description:  'Formulario con datos personales: dirección, previsión, banco, documentos.',
            },
            {
              key:          'datos-contractuales',
              name:         'Datos Contractuales',
              url:          'https://docs.google.com/spreadsheets/d/1sFjwX1aUNgrgszItuXGw7_mIcejQh7JgjiGWQZxLA_8/edit?usp=sharing',
              rutColumn:    'RUT del empleado',
              columnMappings: DEFAULT_MAPPINGS['datos-contractuales'],
              description:  'Formulario con cargo, jornada, jefe, sueldo y datos contractuales.',
            },
          ],
          skipDuplicates: true,
        })
        sheets = await prisma.onboardingSheetTemplate.findMany({ orderBy: { createdAt: 'asc' } })
      }
      return reply.send({ data: sheets })
    } catch {
      return reply.send({ data: [] })
    }
  })

  // POST /sheet-templates
  fastify.post<{
    Body: { key: string; name: string; url: string; rutColumn?: string; description?: string; sheetName?: string }
  }>('/sheet-templates', async (req, reply) => {
    const { key, name, url, rutColumn = 'RUT', description, sheetName } = req.body
    if (!key?.trim() || !name?.trim() || !url?.trim()) return reply.status(400).send({ message: 'key, name y url son requeridos' })
    try {
      const sheet = await prisma.onboardingSheetTemplate.create({
        data: { key: key.trim(), name: name.trim(), url: url.trim(), rutColumn, description: description?.trim() || null, sheetName: sheetName?.trim() || null },
      })
      return reply.status(201).send({ data: sheet })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ message: 'Ya existe un sheet con ese key' })
      throw err
    }
  })

  // PATCH /sheet-templates/:key
  fastify.patch<{
    Params: { key: string }
    Body: { name?: string; url?: string; rutColumn?: string; description?: string; sheetName?: string; isActive?: boolean }
  }>('/sheet-templates/:key', async (req, reply) => {
    const data: Record<string, any> = {}
    if (req.body.name        !== undefined) data.name        = req.body.name.trim()
    if (req.body.url         !== undefined) data.url         = req.body.url.trim()
    if (req.body.rutColumn   !== undefined) data.rutColumn   = req.body.rutColumn
    if (req.body.description !== undefined) data.description = req.body.description?.trim() || null
    if (req.body.sheetName   !== undefined) data.sheetName   = req.body.sheetName?.trim() || null
    if (req.body.isActive    !== undefined) data.isActive    = req.body.isActive
    try {
      const sheet = await prisma.onboardingSheetTemplate.update({ where: { key: req.params.key }, data })
      return reply.send({ data: sheet })
    } catch {
      return reply.status(404).send({ message: 'Sheet no encontrado' })
    }
  })

  // DELETE /sheet-templates/:key
  fastify.delete<{ Params: { key: string } }>('/sheet-templates/:key', async (req, reply) => {
    try {
      await prisma.onboardingSheetTemplate.delete({ where: { key: req.params.key } })
    } catch {
      return reply.status(404).send({ message: 'Sheet no encontrado' })
    }
    return reply.status(204).send()
  })

  // POST /sheet-templates/:key/verify — buscar fila por RUT y retornar preview de actualización
  fastify.post<{
    Params: { key: string }
    Body: { rut: string }
  }>('/sheet-templates/:key/verify', async (req, reply) => {
    const { rut } = req.body
    if (!rut?.trim()) return reply.status(400).send({ message: 'El RUT es requerido' })

    const sheet = await prisma.onboardingSheetTemplate.findUnique({ where: { key: req.params.key } }).catch(() => null)
    if (!sheet) return reply.status(404).send({ message: 'Sheet no encontrado' })

    let rows: Record<string, string>[]
    try {
      rows = await getSheetRowsByUrl(sheet.url, sheet.sheetName ?? undefined)
    } catch (err: any) {
      return reply.status(500).send({ message: `Error al leer el sheet: ${err.message}` })
    }

    const row = findRowByRut(rows, sheet.rutColumn, rut)
    if (!row) return reply.send({ data: { found: false, rowData: null, updates: null, employeeId: null } })

    const mappings = (sheet.columnMappings ?? {}) as Record<string, string>
    const updates  = mapRowToEmployee(row, mappings)

    // Buscar empleado por RUT en la DB
    const rutDigits = rut.replace(/[\s.]/g, '').split('-')[0]
    const employee  = await prisma.employee.findFirst({
      where: { rut: { contains: rutDigits } },
      select: { id: true, firstName: true, lastName: true },
    }).catch(() => null)

    return reply.send({ data: { found: true, rowData: row, updates, employeeId: employee?.id ?? null, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : null } })
  })

  // POST /sheet-templates/:key/apply — aplicar actualizaciones al empleado
  fastify.post<{
    Params: { key: string }
    Body: { rut: string; updates: Record<string, any> }
  }>('/sheet-templates/:key/apply', async (req, reply) => {
    const { rut, updates } = req.body
    if (!rut?.trim() || !updates) return reply.status(400).send({ message: 'rut y updates son requeridos' })

    const rutDigits = rut.replace(/[\s.]/g, '').split('-')[0]
    const employee  = await prisma.employee.findFirst({
      where: { rut: { contains: rutDigits } },
      select: { id: true },
    }).catch(() => null)
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado en la base de datos' })

    // Whitelist of updatable fields from sheets
    const ALLOWED = new Set(['firstName', 'lastName', 'gender', 'birthDate', 'nationality', 'personalEmail', 'phone', 'address', 'commune', 'city', 'afp', 'isapre', 'email', 'jobTitle', 'workSchedule', 'supervisorName'])
    const safe: Record<string, any> = {}
    for (const [k, v] of Object.entries(updates)) {
      if (ALLOWED.has(k) && v !== undefined && v !== '') safe[k] = v
    }
    if (Object.keys(safe).length === 0) return reply.status(400).send({ message: 'No hay campos válidos para actualizar' })

    // Parse birthDate to DateTime if present
    if (safe.birthDate) {
      const parts = safe.birthDate.split('/')
      if (parts.length === 3) {
        const [d, m, y] = parts
        safe.birthDate = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00.000Z`)
      } else {
        delete safe.birthDate
      }
    }

    // Normalize gender
    if (safe.gender) {
      const g = safe.gender.toLowerCase()
      safe.gender = g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : safe.gender
    }

    const updated = await prisma.employee.update({ where: { id: employee.id }, data: safe, select: { id: true, firstName: true, lastName: true } })
    return reply.send({ data: { applied: Object.keys(safe), employee: updated } })
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
      collaboratorRut?:          string
      collaboratorName:          string
      collaboratorEmail?:        string
      collaboratorPersonalEmail?: string
      collaboratorPosition?:     string
      collaboratorPhone?:        string
      legalEntity?:              string
      costCenter?:               string
      startDate?:                string
      notes?:                    string
      selectedTaskIds:           string[]
    }
  }>('/', async (req, reply) => {
    const { collaboratorRut, collaboratorName, collaboratorEmail, collaboratorPersonalEmail, collaboratorPosition, collaboratorPhone, legalEntity, costCenter, startDate, notes, selectedTaskIds } = req.body

    if (!collaboratorName?.trim()) return reply.status(400).send({ message: 'El nombre del colaborador es requerido' })
    if (!selectedTaskIds?.length)  return reply.status(400).send({ message: 'Selecciona al menos un hito' })

    // Usar mediodía UTC para evitar desfase de zona horaria al mostrar en frontend (Chile UTC-3/UTC-4)
    const start = startDate ? new Date(startDate + 'T12:00:00.000Z') : new Date()
    const expectedEndDate = new Date(start)
    expectedEndDate.setDate(expectedEndDate.getDate() + 90)

    // Auto-link employee by RUT if provided
    let employeeId: string | null = null
    if (collaboratorRut?.trim()) {
      const emp = await prisma.employee.findFirst({
        where: { rut: { contains: collaboratorRut.replace(/[\s.]/g, '').split('-')[0] } },
        select: { id: true },
      }).catch(() => null)
      employeeId = emp?.id ?? null
    }

    // Cargar tareas desde la plantilla DB (fuente primaria)
    const dbTasks: any[] = await prisma.onboardingTemplateTask.findMany({
      where: { key: { in: selectedTaskIds } },
      include: { subTasks: { orderBy: { sortOrder: 'asc' } } },
    }).catch(() => [])

    const dbTaskKeys = new Set(dbTasks.map((t: any) => t.key))

    // Fallback a plantilla hardcodeada para cualquier ID no encontrado en DB
    const hardcodedFallback = TASK_TEMPLATE.filter(t => selectedTaskIds.includes(t.id) && !dbTaskKeys.has(t.id))

    const tasksToCreate = [
      ...dbTasks.map((t: any) => ({
        templateId:       t.key,
        period:           t.period,
        name:             t.name,
        tool:             t.tool ?? null,
        appliesWhen:      t.appliesWhen ?? null,
        sortOrder:        t.sortOrder,
        automationType:   t.automationType,
        automationConfig: t.automationConfig ?? null,
        subTasks:         (t.subTasks ?? []).map((st: any) => ({
          id:                   st.id,
          name:                 st.name,
          responsableProfileId: st.responsableProfileId,
          tool:                 st.tool,
          plantilla:            st.plantilla,
          sortOrder:            st.sortOrder,
          completedAt:          null,
        })),
      })),
      ...hardcodedFallback.map(t => ({
        templateId:       t.id,
        period:           t.period,
        name:             t.name,
        tool:             t.tool ?? null,
        appliesWhen:      t.appliesWhen ?? null,
        sortOrder:        t.sortOrder,
        automationType:   t.automationType,
        automationConfig: t.automationConfig ?? null,
        subTasks:         [],
      })),
    ]

    const process = await prisma.onboardingProcess.create({
      data: {
        collaboratorRut:           collaboratorRut?.trim() || null,
        collaboratorName:          collaboratorName.trim(),
        collaboratorEmail:         collaboratorEmail?.trim() || null,
        collaboratorPersonalEmail: collaboratorPersonalEmail?.trim() || null,
        collaboratorPosition:      collaboratorPosition?.trim() || null,
        collaboratorPhone:    collaboratorPhone?.trim() || null,
        legalEntity:          legalEntity || null,
        costCenter:           costCenter?.trim() || null,
        notes:                notes?.trim() || null,
        employeeId:           employeeId,
        startDate:            start,
        expectedEndDate,
        tasks: { create: tasksToCreate },
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
    Body: { completed?: boolean; name?: string; tool?: string; completedNote?: string; period?: string; appliesWhen?: string | null; subTasks?: any[] }
  }>('/:id/tasks/:taskId', async (req, reply) => {
    const { completed, name, tool, completedNote, period, appliesWhen, subTasks } = req.body
    const userId = (req.user as any)?.id ?? 'system'

    // Fetch current subTasks if needed
    const needCurrentTask = (subTasks !== undefined || completed !== undefined)
    const currentTask = needCurrentTask
      ? await prisma.onboardingTask.findUnique({ where: { id: req.params.taskId }, select: { subTasks: true } })
      : null

    const updateData: Record<string, any> = {}
    if (name          !== undefined) updateData.name          = name
    if (tool          !== undefined) updateData.tool          = tool
    if (completedNote !== undefined) updateData.completedNote = completedNote
    if (period        !== undefined) updateData.period        = period
    if (appliesWhen   !== undefined) updateData.appliesWhen   = appliesWhen

    const now    = new Date()
    const nowISO = now.toISOString()

    if (subTasks !== undefined) {
      updateData.subTasks = subTasks
      // Auto-complete parent if all subtasks are now done
      if (completed === undefined && subTasks.length > 0 && subTasks.every((st: any) => !!st.completedAt)) {
        updateData.completedAt = now
        updateData.completedBy = userId
      }
    }

    if (completed !== undefined) {
      updateData.completedAt = completed ? now : null
      updateData.completedBy = completed ? userId : null
      // Cascade completion to all subtasks
      const existingSubs = Array.isArray((currentTask as any)?.subTasks) ? (currentTask as any).subTasks as any[] : []
      if (existingSubs.length > 0) {
        updateData.subTasks = existingSubs.map((st: any) => ({
          ...st,
          completedAt: completed ? (st.completedAt ?? nowISO) : null,
        }))
      }
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
