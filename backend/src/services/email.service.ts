import nodemailer from 'nodemailer'

// ─── Transporter (singleton) ──────────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (_transporter) return _transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    throw new Error('SMTP no configurado. Configura SMTP_HOST, SMTP_USER y SMTP_PASSWORD en las variables de entorno.')
  }

  _transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  return _transporter
}

export interface EmailPayload {
  to:      string
  subject: string
  html:    string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ messageId: string }> {
  const transporter = getTransporter()
  const from = process.env.EMAIL_FROM ?? `"RRHH Surmedia" <${process.env.SMTP_USER}>`

  const info = await transporter.sendMail({ from, ...payload })
  return { messageId: info.messageId }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface TemplateVars {
  collaboratorName:     string
  collaboratorPosition: string
  collaboratorEmail:    string
  startDate:            string
  legalEntity:          string
  expectedEndDate:      string
  [key: string]: string
}

function baseLayout(content: string, vars: TemplateVars) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
  .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
  .body { padding: 32px; }
  .body p { color: #374151; line-height: 1.7; font-size: 15px; margin: 0 0 16px; }
  .chip { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 13px; font-weight: 500; }
  .chip-blue { background: #dbeafe; color: #1d4ed8; }
  .chip-green { background: #dcfce7; color: #166534; }
  .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .info-row { display: flex; gap: 8px; margin-bottom: 8px; font-size: 14px; }
  .info-label { color: #64748b; min-width: 120px; }
  .info-value { color: #1e293b; font-weight: 500; }
  .cta { display: block; text-align: center; margin: 28px 0 0; }
  .cta a { background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; }
  .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
  .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  h2 { font-size: 18px; color: #1e293b; margin: 0 0 16px; }
  ul { padding-left: 20px; color: #374151; line-height: 1.8; font-size: 15px; }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Surmedia</h1>
      <p>Gestión de Personas — DPDO</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Este correo fue enviado automáticamente por el sistema GDP de Surmedia.<br>Ante consultas, escribe a rrhh@surmedia.cl</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Template: Bienvenida al colaborador ─────────────────────────────────────

export function templateBienvenida(vars: TemplateVars): { subject: string; html: string } {
  return {
    subject: `¡Bienvenido/a a Surmedia, ${vars.collaboratorName}!`,
    html: baseLayout(`
      <p>Hola <strong>${vars.collaboratorName}</strong>,</p>
      <p>Estamos muy emocionados de que te sumes a nuestro equipo. Tu fecha de ingreso es el <strong>${vars.startDate}</strong> y ya tenemos todo preparado para recibirte.</p>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">${vars.collaboratorPosition}</span></div>
        <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${vars.legalEntity}</span></div>
        <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">${vars.startDate}</span></div>
      </div>
      <p>Durante tus primeros 90 días acompañaremos tu integración con checkpoints, inducciones y todo el apoyo del equipo de Personas.</p>
      <p>Si tienes dudas antes de tu primer día, no dudes en escribirnos a <a href="mailto:rrhh@surmedia.cl">rrhh@surmedia.cl</a>.</p>
      <p>¡Nos vemos pronto!</p>
      <p><strong>Equipo de Personas · Surmedia</strong></p>
    `, vars),
  }
}

// ─── Template: Coordinación interna (para equipo RRHH/Adm) ───────────────────

export function templateCoordinacionInterna(vars: TemplateVars): { subject: string; html: string } {
  return {
    subject: `GDP: Nuevo ingreso — ${vars.collaboratorName} (${vars.startDate})`,
    html: baseLayout(`
      <h2>Nuevo colaborador ingresando</h2>
      <p>Se ha iniciado un proceso de onboarding para el siguiente colaborador:</p>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Nombre:</span><span class="info-value">${vars.collaboratorName}</span></div>
        <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">${vars.collaboratorPosition}</span></div>
        <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${vars.collaboratorEmail}</span></div>
        <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${vars.legalEntity}</span></div>
        <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">${vars.startDate}</span></div>
      </div>
      <p>Por favor coordina los preparativos de recepción (acceso a oficina, equipo, kit de bienvenida, etc.).</p>
    `, vars),
  }
}

// ─── Template: Checkpoint ─────────────────────────────────────────────────────

export function templateCheckpoint(vars: TemplateVars & { dayNumber: number }): { subject: string; html: string } {
  return {
    subject: `GDP: Checkpoint día ${vars.dayNumber} — ${vars.collaboratorName}`,
    html: baseLayout(`
      <h2>Checkpoint de onboarding — Día ${vars.dayNumber}</h2>
      <p>El colaborador <strong>${vars.collaboratorName}</strong> cumple <strong>${vars.dayNumber} días</strong> en Surmedia. Es momento de realizar el checkpoint de seguimiento.</p>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">${vars.collaboratorPosition}</span></div>
        <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${vars.legalEntity}</span></div>
        <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">${vars.startDate}</span></div>
      </div>
      <p>Por favor agenda una reunión de feedback con el colaborador y su jefatura directa. Al completar el checkpoint, márcalo en el sistema GDP.</p>
    `, vars),
  }
}

// ─── Template: Seguro complementario ─────────────────────────────────────────

export function templateSeguroComplementario(vars: TemplateVars): { subject: string; html: string } {
  return {
    subject: `Surmedia: Completa tu formulario de seguro complementario`,
    html: baseLayout(`
      <p>Hola <strong>${vars.collaboratorName}</strong>,</p>
      <p>Como parte de los beneficios de Surmedia, tienes acceso a un <strong>seguro complementario de salud</strong>. Para activarlo, necesitamos que completes el formulario de inscripción.</p>
      <p>Nuestro equipo de Personas te enviará el formulario directamente a este correo en las próximas horas. Por favor complétalo dentro de los primeros 7 días de ingreso.</p>
      <p>Ante cualquier duda, escríbenos a <a href="mailto:rrhh@surmedia.cl">rrhh@surmedia.cl</a>.</p>
    `, vars),
  }
}

// ─── Template: Mentor asignado ────────────────────────────────────────────────

export function templateMentorAsignado(vars: TemplateVars & { mentorName?: string }): { subject: string; html: string } {
  return {
    subject: `Surmedia: Tu mentor durante el período de inducción`,
    html: baseLayout(`
      <p>Hola <strong>${vars.collaboratorName}</strong>,</p>
      <p>Hemos asignado a un mentor para acompañarte durante tus primeros meses en Surmedia. Tu mentor es tu punto de contacto para resolver dudas del día a día y conocer mejor la cultura del equipo.</p>
      ${vars.mentorName ? `<div class="info-card"><div class="info-row"><span class="info-label">Tu mentor:</span><span class="info-value">${vars.mentorName}</span></div></div>` : ''}
      <p>No dudes en contactar a tu mentor cuando lo necesites. ¡El equipo estamos todos para apoyarte!</p>
    `, vars),
  }
}

// ─── Template: Notificación interna genérica ─────────────────────────────────

export function templateNotificacionInterna(vars: TemplateVars & { taskName: string; instruction: string }): { subject: string; html: string } {
  return {
    subject: `GDP: Acción requerida — ${vars.taskName} · ${vars.collaboratorName}`,
    html: baseLayout(`
      <h2>Acción requerida en proceso de onboarding</h2>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Colaborador:</span><span class="info-value">${vars.collaboratorName}</span></div>
        <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">${vars.collaboratorPosition}</span></div>
        <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">${vars.startDate}</span></div>
        <div class="info-row"><span class="info-label">Hito:</span><span class="info-value">${vars.taskName}</span></div>
      </div>
      <p>${vars.instruction}</p>
    `, vars),
  }
}
