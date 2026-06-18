// Constantes, helpers puros y componentes hoja compartidos del módulo Onboarding.
// Extraído de OnboardingDrawer.tsx para dividir el componente gigante.
import React, { useState, useRef } from 'react'
import { Wrench, Mail, Calendar, RefreshCw, Globe, FileText, ChevronDown } from 'lucide-react'
import type { OnboardingPeriod, OnboardingTask, TaskAutomationType, OnboardingProcess, SubTaskInstance } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

export const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

export const PERIOD_META: Record<OnboardingPeriod, { label: string; range: string; colorClass: string; bgClass: string }> = {
  PRE_INGRESO: { label: 'Pre-ingreso',     range: 'Día -7 a 0',   colorClass: 'text-purple-700', bgClass: 'bg-purple-50 border-purple-200' },
  DIA_1:       { label: 'Día 1 — Ingreso', range: 'Fecha ingreso', colorClass: 'text-brand-700',   bgClass: 'bg-brand-50 border-brand-200' },
  SEMANA_1:    { label: 'Primera semana',  range: 'Días 1–7',      colorClass: 'text-cyan-700',   bgClass: 'bg-cyan-50 border-cyan-200' },
  MES_1:       { label: 'Primer mes',      range: 'Días 7–30',     colorClass: 'text-green-700',  bgClass: 'bg-green-50 border-green-200' },
  EVALUACION:  { label: 'Evaluación',      range: 'Días 60–90',    colorClass: 'text-amber-700',  bgClass: 'bg-amber-50 border-amber-200' },
}

export const AUTO_META: Record<TaskAutomationType, { label: string; icon: React.ReactNode; color: string }> = {
  MANUAL:       { label: 'Manual',    icon: <Wrench size={11} />,     color: 'bg-gray-100 text-gray-500' },
  EMAIL:        { label: 'Correo',    icon: <Mail size={11} />,       color: 'bg-brand-100 text-brand-600' },
  CALENDAR:     { label: 'Calendar',  icon: <Calendar size={11} />,   color: 'bg-purple-100 text-purple-600' },
  BUK_CHECK:    { label: 'BUK',       icon: <RefreshCw size={11} />,  color: 'bg-orange-100 text-orange-600' },
  EXTERNAL:     { label: 'Externo',   icon: <Globe size={11} />,      color: 'bg-teal-100 text-teal-600' },
  SHEET_VERIFY: { label: 'Formulario',icon: <FileText size={11} />,   color: 'bg-green-100 text-green-600' },
}

export const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE_HITO:   'Responsable',
  COPIA_CORREOS:      'Copia',
  ENVIA_CORREOS:      'Envía',
  RECIBE_CORREOS:     'Recibe',
  PREPARA_ADM_FISICA: 'Adm. física',
}

export const ROLE_COLORS: Record<string, string> = {
  RESPONSABLE_HITO:   'bg-brand-100 text-brand-700',
  COPIA_CORREOS:      'bg-gray-100 text-gray-600',
  ENVIA_CORREOS:      'bg-green-100 text-green-700',
  RECIBE_CORREOS:     'bg-amber-100 text-amber-700',
  PREPARA_ADM_FISICA: 'bg-purple-100 text-purple-700',
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Ejecutado',   color: 'text-green-600' },
  FAILED:  { label: 'Error',       color: 'text-red-500' },
  SKIPPED: { label: 'Omitido',     color: 'text-gray-400' },
  RUNNING: { label: 'Ejecutando…', color: 'text-brand-500' },
  PENDING: { label: 'Pendiente',   color: 'text-gray-400' },
}

// ─── Offsets de período (días relativos a startDate) ─────────────────────────

export const PERIOD_OFFSETS: Record<OnboardingPeriod, { start: number; end: number }> = {
  PRE_INGRESO: { start: -7, end: -1 },
  DIA_1:       { start: 0,  end: 0  },
  SEMANA_1:    { start: 1,  end: 7  },
  MES_1:       { start: 8,  end: 30 },
  EVALUACION:  { start: 60, end: 90 },
}

export function gcalFmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

export function makeGCalUrl(title: string, start: Date, durMin: number, desc: string, guests: string[]): string {
  const end = new Date(start.getTime() + durMin * 60_000)
  const q = new URLSearchParams({ text: title, dates: `${gcalFmt(start)}/${gcalFmt(end)}`, details: desc })
  if (guests.length) q.set('add', guests.join(','))
  return `https://calendar.google.com/calendar/r/eventedit?${q}`
}

export function computeTaskDate(task: OnboardingTask, base: Date): Date {
  const cfg = task.automationConfig as Record<string, any> | null
  let offset: number
  if (typeof cfg?.daysFromStart === 'number') {
    offset = task.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart
  } else {
    offset = PERIOD_OFFSETS[task.period].start
  }
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  d.setHours(9, 0, 0, 0)
  return d
}

// ─── Herramientas disponibles ─────────────────────────────────────────────────

export const TOOLS = [
  'Correo',
  'Google Calendar',
  'BUK API',
  'Google Sheets API',
  'Google Workspace API',
  'Físico/Manual',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parsea solo la parte de fecha (YYYY-MM-DD) sin conversión de timezone
export function parseDateLocal(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
// Variable {{tipocontrato}}: "a plazo fijo", "indefinido", etc.
export function tipoContratoLabel(type: string | null | undefined): string {
  switch (type) {
    case 'PLAZO_FIJO': return 'a plazo fijo'
    case 'INDEFINIDO': return 'indefinido'
    case 'HONORARIOS': return 'a honorarios'
    case 'PRACTICA':   return 'de práctica'
    default:           return ''
  }
}

// Variable {{plazocontrato}}: duración entre ingreso y término del contrato
// en meses y/o días (ej: "3 meses", "15 días", "2 meses y 10 días").
export function plazoContratoLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return ''
  const s = start.slice(0, 10).split('-').map(Number)
  const e = end.slice(0, 10).split('-').map(Number)
  if (s.length !== 3 || e.length !== 3 || s.some(isNaN) || e.some(isNaN)) return ''
  if (e[0] * 372 + e[1] * 31 + e[2] <= s[0] * 372 + s[1] * 31 + s[2]) return ''
  let months = (e[0] - s[0]) * 12 + (e[1] - s[1])
  let days   = e[2] - s[2]
  if (days < 0) { months -= 1; days += new Date(e[0], e[1] - 1, 0).getDate() }
  const parts: string[] = []
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`)
  if (days > 0)   parts.push(`${days} ${days === 1 ? 'día' : 'días'}`)
  return parts.length ? `de ${parts.join(' y ')}` : ''
}

export function fmt(d: string) { return parseDateLocal(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) }
export function fmtShort(d: string) { return parseDateLocal(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) }
export function daysIn(s: string) {
  const start = parseDateLocal(s); start.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 864e5)
}

// ─── ICS helpers ──────────────────────────────────────────────────────────────

export function icsDateFmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}
export function icsDateOnly(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`
}

export function buildProcessICS(process: OnboardingProcess): string {
  const base = parseDateLocal(process.startDate); base.setHours(12, 0, 0, 0)
  const now = icsDateFmt(new Date())
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Surmedia GDP//Onboarding//ES', 'CALSCALE:GREGORIAN']
  let idx = 0

  const addEvent = (name: string, start: Date, durationMinutes: number) => {
    const allDay = durationMinutes === 0
    lines.push('BEGIN:VEVENT', `UID:onboarding-${process.id}-${idx++}@surmedia.gdp`, `DTSTAMP:${now}`)
    if (allDay) {
      const next = new Date(start.getTime() + 86_400_000)
      lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(start)}`, `DTEND;VALUE=DATE:${icsDateOnly(next)}`)
    } else {
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      lines.push(`DTSTART:${icsDateFmt(start)}`, `DTEND:${icsDateFmt(end)}`)
    }
    lines.push(`SUMMARY:${name}`, `DESCRIPTION:Onboarding ${process.collaboratorName}`, 'END:VEVENT')
  }

  for (const task of (process.tasks ?? [])) {
    if (task.automationType === 'CALENDAR') {
      const date = computeTaskDate(task, base)
      const cfg = task.automationConfig as Record<string, any> | null
      addEvent(task.name, date, cfg?.durationMinutes ?? 0)
    }
    for (const st of (task.subTasks ?? []) as SubTaskInstance[]) {
      if (st.tool === 'CALENDAR' && st.plantilla) {
        try {
          const cfg = JSON.parse(st.plantilla) as Record<string, any>
          const rawOffset = typeof cfg.daysFromStart === 'number'
            ? (task.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart)
            : PERIOD_OFFSETS[task.period].start
          const d = new Date(base); d.setDate(d.getDate() + rawOffset); d.setHours(9, 0, 0, 0)
          addEvent(st.name, d, cfg.durationMinutes ?? 0)
        } catch {}
      }
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── Multi-select de herramientas ────────────────────────────────────────────

export function ToolsSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value ? value.split(',').map(t => t.trim()).filter(Boolean) : []

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (tool: string) => {
    const next = selected.includes(tool)
      ? selected.filter(t => t !== tool)
      : [...selected, tool]
    onChange(next.join(', '))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-left flex items-center justify-between gap-2 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[34px]"
      >
        <span className="flex flex-wrap gap-1 flex-1">
          {selected.length === 0
            ? <span className="text-gray-400">Seleccionar herramientas…</span>
            : selected.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-50 text-brand-700 border border-brand-100 rounded text-[10px]">
                  {t}
                </span>
              ))
          }
        </span>
        <ChevronDown size={12} className="flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1 max-h-48 overflow-y-auto">
          {TOOLS.map(tool => (
            <label key={tool} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(tool)}
                onChange={() => toggle(tool)}
                className="w-3.5 h-3.5 accent-brand-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-700">{tool}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Badge de tipo de automatización ─────────────────────────────────────────

export function AutoBadge({ type }: { type: TaskAutomationType }) {
  const m = AUTO_META[type] ?? { label: type, icon: null, color: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${m.color}`}>
      {m.icon}{m.label}
    </span>
  )
}

// ─── Plantillas de correo ─────────────────────────────────────────────────────

export function buildProcessVars(proc: OnboardingProcess, task?: OnboardingTask): Record<string, string> {
  const cd    = (proc.collaboratorData as Record<string, any>) ?? {}
  const name  = proc.collaboratorName ?? ''
  const parts = name.split(' ')
  const start = proc.startDate
    ? parseDateLocal(proc.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  const startCorta = proc.startDate
    ? parseDateLocal(proc.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
  const hour = new Date().getHours()
  const now  = new Date()
  const empresa = proc.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones Surmedia Spa' : 'Surmedia Consultoría Spa'
  const fechaActualLarga = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  const tipoJornadaTipo  = cd.tipoJornadaTipo ?? ''
  const tipoJornadaHoras = cd.tipoJornadaHoras ?? ''
  const tipoJornada = tipoJornadaTipo && tipoJornadaHoras
    ? `jornada ${tipoJornadaTipo} de ${tipoJornadaHoras} horas semanales`
    : tipoJornadaTipo

  const sueldoNum = parseInt(cd.sueldoLiquido ?? '0', 10)
  const sueldoLiquidolargo = sueldoNum > 0
    ? `$${sueldoNum.toLocaleString('es-CL')} líquidos mensuales`
    : ''

  const beneficiosArr = Array.isArray(cd.beneficios) ? cd.beneficios as string[] : []
  const lcFirst = (s: string) => s ? s[0].toLowerCase() + s.slice(1) : s

  return {
    nombre:            name,
    primerNombre:      cd.primerNombre    ?? parts[0] ?? '',
    segundoNombre:     cd.segundoNombre   ?? '',
    primerApellido:    cd.primerApellido  ?? '',
    segundoApellido:   cd.segundoApellido ?? '',
    apellido:          cd.primerApellido
      ? [cd.primerApellido, cd.segundoApellido].filter(Boolean).join(' ')
      : parts.slice(1).join(' '),
    rut:               proc.collaboratorRut ?? '',
    cargo:             proc.collaboratorPosition ?? '',
    empresa,
    'razónsocial':     empresa,
    razonSocial:       empresa,
    email:             proc.collaboratorEmail ?? '',
    emailPersonal:     proc.collaboratorPersonalEmail ?? '',
    telefono:          proc.collaboratorPhone ?? '',
    jornada:           (cd.distribucionJornada ?? cd.workSchedule ?? '').toLowerCase(),
    afp:               cd.afp ?? '',
    isapre:            cd.isapre ?? '',
    ciudad:            cd.city ?? '',
    comuna:            cd.commune ?? '',
    direccion:         cd.address ?? '',
    direccionCalle:    cd.direccionCalle ?? '',
    direccionNumero:   cd.direccionNumero ?? '',
    direccionDepto:    cd.direccionDepto ?? '',
    vinculo:           cd.vinculo ?? '',
    supervisor:        cd.supervisorName ?? '',
    nombreSupervisor:  cd.supervisorFirstName ?? (cd.supervisorName as string ?? '').split(' ')[0] ?? '',
    apellidoSupervisor: cd.supervisorLastName ?? (cd.supervisorName as string ?? '').split(' ')[1] ?? '',
    emailJefatura:     cd.supervisorEmail ?? '',
    mentorAsignado:    cd.mentorAsignado ?? '',
    estimado:          (['F', 'female'].includes(cd.gender ?? '')) ? 'Estimada' : 'Estimado',
    centroTrabajo:     proc.costCenter ?? '',
    tipoCentro:        '',
    fechaIngreso:      start,
    fechaIngresoCorta: startCorta,
    fechaTerminoContrato: cd.contractEndDate
      ? parseDateLocal(cd.contractEndDate as string).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      : '',
    fechaActual:       fechaActualLarga,
    fechaActuallarga:  fechaActualLarga,
    año:               now.getFullYear().toString(),
    saludoHorario:     hour < 13 ? 'buenos días' : hour < 20 ? 'buenas tardes' : 'buenas noches',
    fechaNacimiento:   cd.birthDate ? parseDateLocal(cd.birthDate as string).toLocaleDateString('es-CL') : '',
    tipocontrato:      tipoContratoLabel(cd.contractType),
    plazocontrato:     plazoContratoLabel(proc.startDate, cd.contractEndDate as string),
    tipoJornada,
    horario:              lcFirst((cd.horario ?? '').replace(/\.+\s*$/, '')),
    modalidad:            (cd.modalidad ?? '').replace(/\.+\s*$/, ''),
    sueldoLiquidolargo,
    'sueldoLíquidolargo': sueldoLiquidolargo,
    beneficios:           beneficiosArr.join(', '),
    oficina: (cd.city ?? '').toLowerCase().includes('antofagasta')
      ? 'Av. José Toribio Medina 94, piso 6'
      : 'Av. Las Condes 7700, oficina 403B',
    diaNumero:   task && proc.startDate ? String(Math.max(0, Math.floor((Date.now() - parseDateLocal(proc.startDate).getTime()) / 86_400_000))) : '',
    nombreHito:  task?.name ?? '',
    instruccion: (task?.automationConfig as any)?.instruction ?? '',
    // Legacy compat
    collaboratorName:     name,
    collaboratorPosition: proc.collaboratorPosition ?? '',
    collaboratorEmail:    proc.collaboratorEmail ?? '',
    startDate:            start,
    legalEntity:          empresa,
  }
}

export function applyVars(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{\{([\wáéíóúÁÉÍÓÚñÑ]+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
    .replace(/\{([a-zA-ZáéíóúÁÉÍÓÚñÑ][a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]*)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    // Preservar enlaces: <a href="url">texto</a> → "texto\nurl"
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
      const cleanText = text.replace(/<[^>]+>/g, '').trim()
      if (!cleanText || cleanText === url) return url
      return `${cleanText}\n${url}`
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Etiquetas de campos del colaborador (tabla de diferencias del formulario) ─

export const EMPLOYEE_FIELD_LABELS: Record<string, string> = {
  firstName:     'Nombre',
  lastName:      'Apellido',
  segundoApellido: 'Segundo apellido',
  email:         'Email corporativo',
  personalEmail: 'Email personal',
  phone:         'Teléfono',
  birthDate:     'Fecha de nacimiento',
  gender:        'Género',
  nationality:   'Nacionalidad',
  estadoCivil:   'Estado civil',
  nivelEducacional: 'Nivel educacional',
  profesion:     'Profesión',
  contactoEmergencia: 'Contacto de emergencia',
  address:       'Dirección',
  commune:       'Comuna',
  city:          'Ciudad',
  afp:           'AFP',
  isapre:        'Isapre',
  montoIsapre:   'Monto pactado Isapre (UF)',
  esPensionado:  '¿Es pensionado?',
  previredCode:  'Código Previred',
  apv:           'APV',
  apvMonto:      'APV — monto',
  apvMoneda:     'APV — moneda',
  apvInstitucion: 'APV — institución',
  apvTipo:       'APV — tipo',
  tieneFun:      'FUN adjunto',
  banco:         'Banco',
  tipoCuenta:    'Tipo de cuenta',
  numeroCuenta:  'Número de cuenta',
  usoLentes:     'Uso de lentes ópticas',
  tallaPolera:   'Talla polera',
  tallaPantalon: 'Talla pantalón',
  tallaCalzado:  'Talla calzado',
  jobTitle:      'Cargo',
  jobFamily:     'Familia de cargo',
  workSchedule:  'Jornada',
  distribucionJornada: 'Distribución jornada',
  costCenter:    'Centro de costos',
  supervisorName: 'Supervisor',
  supervisorTitle: 'Cargo del supervisor',
  vinculo:       'Vínculo',
  reemplazaA:    'Reemplaza a',
  exclusive:     'Exclusividad',
  docCedula:     'Doc: Cédula de identidad',
  docCertAfp:    'Doc: Certificado AFP',
  docCertIsapre: 'Doc: Certificado Isapre',
  docCertTitulo: 'Doc: Certificado de título',
  docLicenciaConducir: 'Doc: Licencia de conducir',
  docCartaRenuncia: 'Doc: Carta de renuncia',
}

// Muestra booleanos como Sí/No en la tabla de diferencias
export function humanizeFieldValue(v: any): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return String(v ?? '')
}
