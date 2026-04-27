import type { FastifyPluginAsync } from 'fastify'
import { runTaskAutomation } from '../services/automation.service'
import { getFormResponses } from '../services/sheets.service'

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

  // GET /template — devuelve los hitos disponibles para el checklist de creación
  fastify.get('/template', async (_req, reply) => {
    return reply.send({ data: TASK_TEMPLATE })
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

    // Actualizar estado a RUNNING
    await prisma.onboardingTask.update({
      where: { id: task.id },
      data:  { automationStatus: 'RUNNING' },
    })

    const result = await runTaskAutomation(task, process)

    // Guardar resultado
    const updatedTask = await prisma.onboardingTask.update({
      where: { id: task.id },
      data:  {
        automationStatus: result.status,
        automationResult: result,
        automatedAt:      new Date(),
        // Si la automatización fue exitosa y es del tipo adecuado, marcar como completado
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
