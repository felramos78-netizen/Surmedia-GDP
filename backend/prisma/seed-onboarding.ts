import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Plantilla de hitos (sincronizada con TASK_TEMPLATE en onboarding.ts)
const TEMPLATE_TASKS = [
  { key: 'pre_carta_oferta',          period: 'PRE_INGRESO', name: 'Carta oferta recibida y aceptada',                         tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },                                                sortOrder: 1, appliesWhen: null },
  { key: 'pre_documentos',            period: 'PRE_INGRESO', name: 'Documentos personales validados',                          tool: 'Google Sheets API',                      automationType: 'SHEET_VERIFY', automationConfig: { nameColumn: 'Nombre completo', docColumns: ['Cédula de identidad por ambas partes', 'Certificado de afiliación AFP', 'Certificado de afiliación ISAPRE', 'Certificado de título académico', 'Licencia de conducir (si aplica)', 'Carta de renuncia (último trabajo si aplica)'] }, sortOrder: 2, appliesWhen: null },
  { key: 'pre_coordinacion',          period: 'PRE_INGRESO', name: 'Coordinación interna con administración y SSO',            tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'team', template: 'coordinacion_interna' },                                                sortOrder: 3, appliesWhen: null },
  { key: 'pre_contratos_buk',         period: 'PRE_INGRESO', name: 'Generación de documentos contractuales en BUK',            tool: 'BUK API, Correo, Google Calendar',        automationType: 'BUK_CHECK',    automationConfig: { checkType: 'contract_signed' },                                                                     sortOrder: 4, appliesWhen: null },
  { key: 'pre_correo_empresa',        period: 'PRE_INGRESO', name: 'Correo empresa creado',                                    tool: 'Google Workspace API',                   automationType: 'EXTERNAL',     automationConfig: { system: 'google_workspace', action: 'create_account' },                                            sortOrder: 5, appliesWhen: null },
  { key: 'pre_buk_asistencia',        period: 'PRE_INGRESO', name: 'Perfil BUK marcaje asistencia creado',                     tool: 'BUK API',                                automationType: 'BUK_CHECK',    automationConfig: { checkType: 'attendance_profile' },                                                                  sortOrder: 6, appliesWhen: null },
  { key: 'pre_buk_perfil',            period: 'PRE_INGRESO', name: 'Perfil BUK creado',                                        tool: 'BUK API',                                automationType: 'BUK_CHECK',    automationConfig: { checkType: 'employee_profile' },                                                                    sortOrder: 7, appliesWhen: null },
  { key: 'day1_bienvenida',           period: 'DIA_1',       name: 'Correo de bienvenida',                                     tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },                                                sortOrder: 1, appliesWhen: null },
  { key: 'day1_epp',                  period: 'DIA_1',       name: 'Entrega de EPP y firma',                                   tool: 'BUK API',                                automationType: 'BUK_CHECK',    automationConfig: { checkType: 'epp_delivery' },                                                                        sortOrder: 2, appliesWhen: 'si aplica' },
  { key: 'day1_induccion_jefatura',   period: 'DIA_1',       name: 'Inducción de jefatura realizada',                          tool: 'Google Calendar',                        automationType: 'CALENDAR',     automationConfig: { title: 'Inducción de jefatura — {collaboratorName}', daysFromStart: 0, durationMinutes: 60, attendees: ['supervisor', 'collaborator'] },  sortOrder: 3, appliesWhen: null },
  { key: 'day1_enrolamiento',         period: 'DIA_1',       name: 'Enrolamiento de ingreso a oficina',                        tool: 'Físico/Manual, Google Calendar',          automationType: 'MANUAL',       automationConfig: null,                                                                                                 sortOrder: 4, appliesWhen: 'si aplica' },
  { key: 'day1_kit',                  period: 'DIA_1',       name: 'Entrega de kit de bienvenida',                             tool: 'Físico/Manual, Google Calendar',          automationType: 'MANUAL',       automationConfig: null,                                                                                                 sortOrder: 5, appliesWhen: null },
  { key: 'day1_adobe',                period: 'DIA_1',       name: 'Licencia de Adobe habilitada',                             tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'rrhh', instruction: 'Habilitar licencia Adobe Creative Cloud para el colaborador desde el panel de administración.' },           sortOrder: 6, appliesWhen: 'solo Diseño' },
  { key: 'day1_induccion_corporativa',period: 'DIA_1',       name: 'Inducción corporativa realizada',                          tool: 'Google Calendar',                        automationType: 'CALENDAR',     automationConfig: { title: 'Inducción Corporativa — {collaboratorName}', daysFromStart: 0, durationMinutes: 120, attendees: ['rrhh', 'collaborator'] },       sortOrder: 7, appliesWhen: null },
  { key: 'day1_firmas',               period: 'DIA_1',       name: 'Contrato · RIOHS · IRL firmados',                          tool: 'BUK API',                                automationType: 'BUK_CHECK',    automationConfig: { checkType: 'document_signing' },                                                                    sortOrder: 8, appliesWhen: null },
  { key: 'day1_computador',           period: 'DIA_1',       name: 'Entrega de computador y recepción firmada',                tool: 'Físico/Manual, BUK API, Google Calendar', automationType: 'BUK_CHECK',    automationConfig: { checkType: 'asset_delivery' },                                                                      sortOrder: 9, appliesWhen: null },
  { key: 'semana_foto',               period: 'SEMANA_1',    name: 'Foto individual corporativa',                              tool: 'Físico/Manual, Google Calendar',          automationType: 'MANUAL',       automationConfig: null,                                                                                                 sortOrder: 1, appliesWhen: null },
  { key: 'semana_sso',                period: 'SEMANA_1',    name: 'Inducción de SSO realizada',                               tool: 'Google Calendar',                        automationType: 'CALENDAR',     automationConfig: { title: 'Inducción SSO — {collaboratorName}', daysFromStart: 3, durationMinutes: 90, attendees: ['sso', 'collaborator'] },               sortOrder: 2, appliesWhen: null },
  { key: 'semana_presentacion',       period: 'SEMANA_1',    name: 'Presentación a la empresa y círculo de especialistas',     tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'team', template: 'presentacion_empresa' },                                               sortOrder: 3, appliesWhen: null },
  { key: 'semana_seguro',             period: 'SEMANA_1',    name: 'Formulario seguro complementario completo y enviado',      tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'collaborator', template: 'seguro_complementario' },                                      sortOrder: 4, appliesWhen: null },
  { key: 'semana_pluxee',             period: 'SEMANA_1',    name: 'Tarjeta Pluxee entregada',                                 tool: 'Físico/Manual, Correo, Google Calendar', automationType: 'MANUAL',       automationConfig: null,                                                                                                 sortOrder: 5, appliesWhen: null },
  { key: 'semana_foto_web',           period: 'SEMANA_1',    name: 'Foto individual cargada en web',                           tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'rrhh', template: 'foto_web' },                                                           sortOrder: 6, appliesWhen: null },
  { key: 'mes_cafe',                  period: 'MES_1',       name: 'Café virtual con directores',                              tool: 'Correo, Google Calendar',                automationType: 'CALENDAR',     automationConfig: { title: 'Café con directores — {collaboratorName}', daysFromStart: 14, durationMinutes: 30, attendees: ['directors', 'collaborator'] },  sortOrder: 1, appliesWhen: null },
  { key: 'mes_mentor',                period: 'MES_1',       name: 'Mentor asignado',                                          tool: 'Correo, Google Calendar',                automationType: 'EMAIL',        automationConfig: { emailTo: 'collaborator', template: 'mentor_asignado' },                                           sortOrder: 2, appliesWhen: null },
  { key: 'eval_checkpoint30',         period: 'MES_1',       name: 'Checkpoint 1 · Día 30',                                    tool: 'Google Calendar',                        automationType: 'CALENDAR',     automationConfig: { title: 'Checkpoint 30 días — {collaboratorName}', daysFromStart: 30, durationMinutes: 60, attendees: ['supervisor', 'rrhh', 'collaborator'] }, sortOrder: 3, appliesWhen: null },
  { key: 'eval_checkpoint60',         period: 'EVALUACION',  name: 'Checkpoint 2 · Día 60',                                    tool: 'Google Calendar',                        automationType: 'CALENDAR',     automationConfig: { title: 'Checkpoint 60 días — {collaboratorName}', daysFromStart: 60, durationMinutes: 60, attendees: ['supervisor', 'rrhh', 'collaborator'] }, sortOrder: 1, appliesWhen: null },
  { key: 'eval_feedback90',           period: 'EVALUACION',  name: 'Feedback 3 meses · Día 90',                                tool: 'Correo, Google Calendar',                automationType: 'CALENDAR',     automationConfig: { title: 'Evaluación período de prueba — {collaboratorName}', daysFromStart: 90, durationMinutes: 90, attendees: ['supervisor', 'rrhh', 'collaborator'] }, sortOrder: 2, appliesWhen: null },
] as const

const EMAIL_TEMPLATES = [
  {
    key: 'bienvenida',
    name: 'Bienvenida al colaborador',
    subject: '¡Bienvenido/a a Surmedia, {collaboratorName}!',
    bodyHtml: `<p>Hola <strong>{collaboratorName}</strong>,</p>
<p>Estamos muy emocionados de que te sumes a nuestro equipo. Tu fecha de ingreso es el <strong>{startDate}</strong> y ya tenemos todo preparado para recibirte.</p>
<div class="info-card">
  <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div>
  <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div>
  <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div>
</div>
<p>Durante tus primeros 90 días acompañaremos tu integración con checkpoints, inducciones y todo el apoyo del equipo de Personas.</p>
<p>Si tienes dudas antes de tu primer día, no dudes en escribirnos a <a href="mailto:rrhh@surmedia.cl">rrhh@surmedia.cl</a>.</p>
<p>¡Nos vemos pronto!</p>
<p><strong>Equipo de Personas · Surmedia</strong></p>`,
    variables: JSON.stringify([
      { name: 'collaboratorName',     example: 'Juan Pérez' },
      { name: 'collaboratorPosition', example: 'Diseñador Gráfico' },
      { name: 'legalEntity',          example: 'Comunicaciones Surmedia Spa' },
      { name: 'startDate',            example: '15 de mayo de 2026' },
    ]),
  },
  {
    key: 'coordinacion_interna',
    name: 'Coordinación interna',
    subject: 'GDP: Nuevo ingreso — {collaboratorName} ({startDate})',
    bodyHtml: `<h2>Nuevo colaborador ingresando</h2>
<p>Se ha iniciado un proceso de onboarding para el siguiente colaborador:</p>
<div class="info-card">
  <div class="info-row"><span class="info-label">Nombre:</span><span class="info-value">{collaboratorName}</span></div>
  <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div>
  <div class="info-row"><span class="info-label">Email:</span><span class="info-value">{collaboratorEmail}</span></div>
  <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div>
  <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div>
</div>
<p>Por favor coordina los preparativos de recepción (acceso a oficina, equipo, kit de bienvenida, etc.).</p>`,
    variables: JSON.stringify([
      { name: 'collaboratorName',     example: 'Juan Pérez' },
      { name: 'collaboratorPosition', example: 'Diseñador Gráfico' },
      { name: 'collaboratorEmail',    example: 'juan.perez@surmedia.cl' },
      { name: 'legalEntity',          example: 'Comunicaciones Surmedia Spa' },
      { name: 'startDate',            example: '15 de mayo de 2026' },
    ]),
  },
  {
    key: 'seguro_complementario',
    name: 'Seguro complementario',
    subject: 'Surmedia: Completa tu formulario de seguro complementario',
    bodyHtml: `<p>Hola <strong>{collaboratorName}</strong>,</p>
<p>Como parte de los beneficios de Surmedia, tienes acceso a un <strong>seguro complementario de salud</strong>. Para activarlo, necesitamos que completes el formulario de inscripción.</p>
<p>Nuestro equipo de Personas te enviará el formulario directamente a este correo en las próximas horas. Por favor complétalo dentro de los primeros 7 días de ingreso.</p>
<p>Ante cualquier duda, escríbenos a <a href="mailto:rrhh@surmedia.cl">rrhh@surmedia.cl</a>.</p>`,
    variables: JSON.stringify([{ name: 'collaboratorName', example: 'Juan Pérez' }]),
  },
  {
    key: 'mentor_asignado',
    name: 'Mentor asignado',
    subject: 'Surmedia: Tu mentor durante el período de inducción',
    bodyHtml: `<p>Hola <strong>{collaboratorName}</strong>,</p>
<p>Hemos asignado a un mentor para acompañarte durante tus primeros meses en Surmedia. Tu mentor es tu punto de contacto para resolver dudas del día a día y conocer mejor la cultura del equipo.</p>
<p>No dudes en contactar a tu mentor cuando lo necesites. ¡El equipo estamos todos para apoyarte!</p>`,
    variables: JSON.stringify([{ name: 'collaboratorName', example: 'Juan Pérez' }]),
  },
  {
    key: 'checkpoint',
    name: 'Checkpoint de seguimiento',
    subject: 'GDP: Checkpoint día {dayNumber} — {collaboratorName}',
    bodyHtml: `<h2>Checkpoint de onboarding — Día {dayNumber}</h2>
<p>El colaborador <strong>{collaboratorName}</strong> cumple <strong>{dayNumber} días</strong> en Surmedia. Es momento de realizar el checkpoint de seguimiento.</p>
<div class="info-card">
  <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div>
  <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">{legalEntity}</span></div>
  <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div>
</div>
<p>Por favor agenda una reunión de feedback con el colaborador y su jefatura directa. Al completar el checkpoint, márcalo en el sistema GDP.</p>`,
    variables: JSON.stringify([
      { name: 'collaboratorName',     example: 'Juan Pérez' },
      { name: 'collaboratorPosition', example: 'Diseñador Gráfico' },
      { name: 'legalEntity',          example: 'Comunicaciones Surmedia Spa' },
      { name: 'startDate',            example: '15 de mayo de 2026' },
      { name: 'dayNumber',            example: '30' },
    ]),
  },
  {
    key: 'notificacion_interna',
    name: 'Notificación interna genérica',
    subject: 'GDP: Acción requerida — {taskName} · {collaboratorName}',
    bodyHtml: `<h2>Acción requerida en proceso de onboarding</h2>
<div class="info-card">
  <div class="info-row"><span class="info-label">Colaborador:</span><span class="info-value">{collaboratorName}</span></div>
  <div class="info-row"><span class="info-label">Cargo:</span><span class="info-value">{collaboratorPosition}</span></div>
  <div class="info-row"><span class="info-label">Ingreso:</span><span class="info-value">{startDate}</span></div>
  <div class="info-row"><span class="info-label">Hito:</span><span class="info-value">{taskName}</span></div>
</div>
<p>{instruction}</p>`,
    variables: JSON.stringify([
      { name: 'collaboratorName',     example: 'Juan Pérez' },
      { name: 'collaboratorPosition', example: 'Diseñador Gráfico' },
      { name: 'startDate',            example: '15 de mayo de 2026' },
      { name: 'taskName',             example: 'Foto individual corporativa' },
      { name: 'instruction',          example: 'Por favor realiza esta acción antes del viernes.' },
    ]),
  },
]

async function main() {
  console.log('Sembrando plantilla de hitos...')
  const tasksResult = await (prisma as any).onboardingTemplateTask.createMany({
    data: TEMPLATE_TASKS.map(t => ({
      key:             t.key,
      period:          t.period,
      name:            t.name,
      tool:            t.tool ?? null,
      automationType:  t.automationType,
      automationConfig: t.automationConfig ?? null,
      appliesWhen:     t.appliesWhen,
      sortOrder:       t.sortOrder,
    })),
    skipDuplicates: true,
  })
  console.log(`  → ${tasksResult.count} hitos creados (duplicados omitidos)`)

  console.log('Sembrando templates de email...')
  const templatesResult = await (prisma as any).emailTemplate.createMany({
    data: EMAIL_TEMPLATES.map(t => ({
      key:      t.key,
      name:     t.name,
      subject:  t.subject,
      bodyHtml: t.bodyHtml,
      variables: JSON.parse(t.variables),
    })),
    skipDuplicates: true,
  })
  console.log(`  → ${templatesResult.count} templates creados (duplicados omitidos)`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => (prisma as any).$disconnect())
