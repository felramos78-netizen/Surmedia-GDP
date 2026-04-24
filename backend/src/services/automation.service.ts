import { sendEmail, templateBienvenida, templateCoordinacionInterna, templateCheckpoint, templateSeguroComplementario, templateMentorAsignado, templateNotificacionInterna } from './email.service'

// ─── Tipos de automatización ──────────────────────────────────────────────────

export interface AutomationTask {
  id:              string
  templateId:      string | null
  name:            string
  automationType:  string
  automationConfig: Record<string, any> | null
}

export interface AutomationProcess {
  collaboratorName:     string
  collaboratorEmail:    string | null
  collaboratorPosition: string | null
  legalEntity:          string | null
  startDate:            Date
}

export interface AutomationResult {
  status:  'SUCCESS' | 'FAILED' | 'SKIPPED'
  message: string
  detail:  Record<string, any>
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────

export async function runTaskAutomation(
  task:    AutomationTask,
  process: AutomationProcess
): Promise<AutomationResult> {
  const type = task.automationType

  try {
    if (type === 'EMAIL')     return await runEmailAutomation(task, process)
    if (type === 'CALENDAR')  return runCalendarAutomation(task, process)
    if (type === 'BUK_CHECK') return runBukCheckAutomation(task, process)
    if (type === 'EXTERNAL')  return runExternalAutomation(task, process)

    return { status: 'SKIPPED', message: 'Hito de tipo MANUAL — no requiere automatización', detail: {} }
  } catch (err: any) {
    return { status: 'FAILED', message: err.message ?? 'Error desconocido', detail: { error: String(err) } }
  }
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────

async function runEmailAutomation(task: AutomationTask, proc: AutomationProcess): Promise<AutomationResult> {
  const cfg    = task.automationConfig ?? {}
  const emailTo = cfg.emailTo as string

  const vars = {
    collaboratorName:     proc.collaboratorName,
    collaboratorPosition: proc.collaboratorPosition ?? '—',
    collaboratorEmail:    proc.collaboratorEmail ?? '—',
    startDate:            proc.startDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    legalEntity:          proc.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones Surmedia Spa' : proc.legalEntity === 'SURMEDIA_CONSULTORIA' ? 'Surmedia Consultoría Spa' : '—',
    expectedEndDate:      '',
  }

  const rrhhEmail = process.env.SMTP_USER ?? 'rrhh@surmedia.cl'

  let recipient: string
  let subject:   string
  let html:      string

  // Seleccionar template según el templateId del hito
  const tid = task.templateId ?? ''

  if (emailTo === 'collaborator' || tid.startsWith('pre_carta') || tid === 'day1_bienvenida') {
    if (!proc.collaboratorEmail) {
      return { status: 'SKIPPED', message: 'El colaborador no tiene email registrado', detail: {} }
    }
    recipient = proc.collaboratorEmail
    const tpl = templateBienvenida(vars)
    subject   = tpl.subject
    html      = tpl.html

  } else if (tid === 'semana_seguro') {
    if (!proc.collaboratorEmail) {
      return { status: 'SKIPPED', message: 'El colaborador no tiene email registrado', detail: {} }
    }
    recipient = proc.collaboratorEmail
    const tpl = templateSeguroComplementario(vars)
    subject   = tpl.subject
    html      = tpl.html

  } else if (tid === 'mes_mentor') {
    if (!proc.collaboratorEmail) {
      return { status: 'SKIPPED', message: 'El colaborador no tiene email registrado', detail: {} }
    }
    recipient = proc.collaboratorEmail
    const tpl = templateMentorAsignado(vars)
    subject   = tpl.subject
    html      = tpl.html

  } else if (tid === 'pre_coordinacion' || emailTo === 'team') {
    recipient = rrhhEmail
    const tpl = templateCoordinacionInterna(vars)
    subject   = tpl.subject
    html      = tpl.html

  } else if (tid === 'eval_checkpoint30' || tid === 'eval_checkpoint60' || tid === 'eval_feedback90') {
    const dayMap: Record<string, number> = { eval_checkpoint30: 30, eval_checkpoint60: 60, eval_feedback90: 90 }
    recipient = rrhhEmail
    const tpl = templateCheckpoint({ ...vars, dayNumber: dayMap[tid] ?? 90 })
    subject   = tpl.subject
    html      = tpl.html

  } else {
    // Fallback genérico para cualquier hito de email interno
    recipient = rrhhEmail
    const tpl = templateNotificacionInterna({
      ...vars,
      taskName:    task.name,
      instruction: cfg.instruction ?? `Realizar la siguiente acción para ${proc.collaboratorName}: ${task.name}.`,
    })
    subject = tpl.subject
    html    = tpl.html
  }

  const result = await sendEmail({ to: recipient, subject, html })
  return {
    status:  'SUCCESS',
    message: `Correo enviado a ${recipient}`,
    detail:  { to: recipient, subject, messageId: result.messageId },
  }
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
// Requiere configuración de Google Calendar API con OAuth o Service Account.
// Se ejecuta cuando GOOGLE_CALENDAR_ENABLED=true y las credenciales están configuradas.

function runCalendarAutomation(task: AutomationTask, proc: AutomationProcess): AutomationResult {
  const cfg = task.automationConfig ?? {}
  const enabled = process.env.GOOGLE_CALENDAR_ENABLED === 'true'

  if (!enabled) {
    return {
      status:  'SKIPPED',
      message: 'Google Calendar no está habilitado. Configura GOOGLE_CALENDAR_ENABLED=true y las credenciales OAuth.',
      detail:  {
        wouldCreate: {
          title:            (cfg.title as string ?? task.name).replace('{collaboratorName}', proc.collaboratorName),
          daysFromStart:    cfg.daysFromStart ?? 0,
          durationMinutes:  cfg.durationMinutes ?? 60,
          eventDate:        new Date(proc.startDate.getTime() + (cfg.daysFromStart ?? 0) * 86_400_000).toISOString(),
          attendees:        cfg.attendees ?? [],
        },
      },
    }
  }

  // TODO: implementar con googleapis cuando GOOGLE_CALENDAR_ENABLED=true
  // Ver: backend/src/services/calendar.service.ts (pendiente)
  return {
    status:  'FAILED',
    message: 'Integración Google Calendar pendiente de implementar.',
    detail:  {},
  }
}

// ─── BUK_CHECK ────────────────────────────────────────────────────────────────
// Verifica en BUK si el colaborador ya existe y si firmó los documentos.
// Requiere que el proceso esté vinculado a un Employee con bukEmployeeId.

function runBukCheckAutomation(task: AutomationTask, proc: AutomationProcess): AutomationResult {
  const cfg = task.automationConfig ?? {}
  return {
    status:  'SKIPPED',
    message: 'Verificación BUK disponible una vez que el colaborador esté creado en BUK y vinculado al proceso.',
    detail:  {
      checkType:   cfg.checkType ?? 'unknown',
      instruction: getBukInstruction(cfg.checkType as string),
    },
  }
}

function getBukInstruction(checkType: string): string {
  const map: Record<string, string> = {
    employee_profile:   'Verificar en BUK → Colaboradores que el perfil del colaborador existe y tiene RUT correcto.',
    attendance_profile: 'Verificar en BUK Asistencia que el perfil de marcaje del colaborador está activo.',
    contract_signed:    'Verificar en BUK → Documentos que el contrato está firmado electrónicamente.',
    document_signing:   'Verificar en BUK → Documentos que Contrato, RIOHS e IRL están firmados por el colaborador.',
    asset_delivery:     'Verificar en BUK que la entrega de activos (computador, tarjeta, etc.) está registrada.',
  }
  return map[checkType] ?? 'Revisar manualmente en BUK.'
}

// ─── EXTERNAL ─────────────────────────────────────────────────────────────────

function runExternalAutomation(task: AutomationTask, proc: AutomationProcess): AutomationResult {
  const cfg    = task.automationConfig ?? {}
  const system = cfg.system as string

  const instructions: Record<string, string> = {
    google_workspace: `Crear cuenta Google Workspace para ${proc.collaboratorName} en el dominio @surmedia.cl desde Google Admin Console.`,
    wordpress:        `Subir foto corporativa de ${proc.collaboratorName} al sitio web de Surmedia en WordPress → Equipo.`,
    whatsapp:         `Presentar a ${proc.collaboratorName} en los grupos de WhatsApp corporativos correspondientes a su área.`,
  }

  return {
    status:  'SKIPPED',
    message: `Sistema externo (${system}) requiere acción manual.`,
    detail:  { system, instruction: instructions[system] ?? `Realizar acción en ${system} para ${proc.collaboratorName}.` },
  }
}
