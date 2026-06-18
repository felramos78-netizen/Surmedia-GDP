import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalEvent {
  id: string; type: string; title: string
  start: string; end: string; color: string
  meta?: Record<string, any>
}

export interface PositionedEvent {
  event: CalEvent; lane: number
  startCol: number; endCol: number
  isStart: boolean; isEnd: boolean
}

export type ViewType = 'month' | 'week' | 'day'

// ── Filtros ───────────────────────────────────────────────────────────────────

export interface FilterGroup { key: string; label: string; color: string; types: string[] }

export const FILTER_GROUPS: FilterGroup[] = [
  { key: 'vacaciones',  label: 'Vacaciones',        color: '#16a34a', types: ['VACACIONES'] },
  { key: 'licencias',   label: 'Licencias',         color: '#ea580c', types: ['LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD'] },
  { key: 'permisos',    label: 'Permisos / Otros',  color: '#ca8a04', types: ['PERMISO', 'OTRO'] },
  { key: 'ingresos',    label: 'Ingresos',          color: '#2563eb', types: ['INGRESO'] },
  { key: 'salidas',     label: 'Salidas',           color: '#dc2626', types: ['SALIDA'] },
  { key: 'onboarding',  label: 'Onboarding',        color: '#8b5cf6', types: ['ONBOARDING', 'ONBOARDING_TASK'] },
  { key: 'contratos',   label: 'Venc. Contratos',   color: '#d97706', types: ['VENCIMIENTO'] },
  { key: 'relevantes',  label: 'Fechas Relevantes', color: '#0891b2', types: ['FECHA_RELEVANTE'] },
  { key: 'cumpleanos',   label: 'Cumpleaños',        color: '#db2777', types: ['CUMPLEANOS'] },
  { key: 'aniversarios', label: 'Aniversarios',      color: '#7c3aed', types: ['ANIVERSARIO_LABORAL'] },
]

export const TYPE_LABELS: Record<string, string> = {
  VACACIONES: 'Vacaciones', LICENCIA_MEDICA: 'Licencia médica',
  LICENCIA_MATERNIDAD: 'Lic. maternidad', LICENCIA_PATERNIDAD: 'Lic. paternidad',
  PERMISO: 'Permiso', OTRO: 'Otro', INGRESO: 'Ingreso', SALIDA: 'Salida',
  ONBOARDING: 'Hito onboarding', ONBOARDING_TASK: 'Tarea onboarding',
  VENCIMIENTO: 'Venc. contrato', FECHA_RELEVANTE: 'Fecha relevante',
  CUMPLEANOS: 'Cumpleaños', ANIVERSARIO_LABORAL: 'Aniversario laboral',
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

export function utcDaysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}

export function getCalendarWeeks(date: Date): Date[][] {
  const y = date.getFullYear(), m = date.getMonth()
  const first = new Date(y, m, 1)
  const dow = first.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const start = new Date(y, m, 1 + offset)
  const last  = new Date(y, m + 1, 0)
  const weeks: Date[][] = []
  const cur = new Date(start)
  while (cur <= last) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    weeks.push(week)
  }
  return weeks
}

export function getWeekDays(date: Date): Date[] {
  const dow = date.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(date)
  monday.setDate(date.getDate() + offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function getHeaderLabel(view: ViewType, date: Date): string {
  if (view === 'month') {
    return capitalize(date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
  }
  if (view === 'week') {
    const days = getWeekDays(date)
    const s = days[0], e = days[6]
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} de ${capitalize(s.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))}`
    }
    return `${s.getDate()} ${s.toLocaleDateString('es-CL', { month: 'short' })} – ${e.getDate()} ${e.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}`
  }
  return capitalize(date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

export function navigateDate(dir: -1 | 1, view: ViewType, date: Date): Date {
  const d = new Date(date)
  if (view === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir) }
  else if (view === 'week') { d.setDate(d.getDate() + dir * 7) }
  else { d.setDate(d.getDate() + dir) }
  return d
}

// ── Lane assignment ───────────────────────────────────────────────────────────

export function assignLanes(events: CalEvent[], weekDays: Date[]): PositionedEvent[] {
  const ws = weekDays[0], we = weekDays[6]

  const candidates: PositionedEvent[] = events
    .filter(ev => {
      const s = parseDate(ev.start), e = parseDate(ev.end)
      return e >= ws && s <= we
    })
    .map(ev => {
      const s = parseDate(ev.start), e = parseDate(ev.end)
      return {
        event: ev, lane: -1,
        startCol: Math.max(0, utcDaysBetween(ws, s)),
        endCol:   Math.min(6, utcDaysBetween(ws, e)),
        isStart:  s >= ws,
        isEnd:    e <= we,
      }
    })
    .sort((a, b) => {
      const da = a.endCol - a.startCol, db = b.endCol - b.startCol
      return db !== da ? db - da : a.startCol - b.startCol
    })

  const occ: boolean[][] = []
  for (const item of candidates) {
    let lane = 0
    while (true) {
      if (!occ[lane]) occ[lane] = Array(7).fill(false)
      const free = !Array.from(
        { length: item.endCol - item.startCol + 1 },
        (_, i) => item.startCol + i,
      ).some(c => occ[lane][c])
      if (free) {
        for (let c = item.startCol; c <= item.endCol; c++) occ[lane][c] = true
        item.lane = lane; break
      }
      lane++
    }
  }
  return candidates
}

// ── API hook ──────────────────────────────────────────────────────────────────

// Referencia estable para usar como default de `data` mientras la query carga,
// evitando que un array literal `[]` nuevo en cada render dispare loops en efectos
// que dependen de la identidad de `events`.
export const EMPTY_EVENTS: CalEvent[] = []

export function useCalendarEvents(start: string, end: string) {
  return useQuery<CalEvent[]>({
    queryKey: ['calendar', start, end],
    queryFn: () => api.get(`/calendar?start=${start}&end=${end}`).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
}

// ── Perfiles ──────────────────────────────────────────────────────────────────

export interface Profile { id: string; name: string; email: string; position: string }

export const EMPTY_PROFILES: Profile[] = []

export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Google Calendar URL builder (all-day) ─────────────────────────────────────

export function buildGCalUrl(opts: {
  title: string; start: string; end: string
  description?: string; attendee?: string
}): string {
  const fmt = (s: string) => s.replace(/-/g, '')
  const endExclusive = toDateStr(addDays(parseDate(opts.end), 1))
  const params = new URLSearchParams({
    text:  opts.title,
    dates: `${fmt(opts.start)}/${fmt(endExclusive)}`,
  })
  if (opts.description) params.set('details', opts.description)
  if (opts.attendee)    params.set('add', opts.attendee)
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`
}

export function gcalTitle(ev: CalEvent): string {
  const typeLabel = TYPE_LABELS[ev.type] ?? ev.type
  return `${typeLabel} — ${ev.title}`
}

export function gcalDescription(ev: CalEvent): string {
  const s = parseDate(ev.start)
  const e = parseDate(ev.end)
  const sameDay = ev.start === ev.end
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const lines: string[] = [
    `Tipo: ${TYPE_LABELS[ev.type] ?? ev.type}`,
    sameDay
      ? `Fecha: ${s.toLocaleDateString('es-CL', opts)}`
      : `Período: ${s.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} → ${e.toLocaleDateString('es-CL', opts)}`,
  ]
  if (ev.meta?.days)          lines.push(`Días: ${ev.meta.days}`)
  if (ev.meta?.status)        lines.push(`Estado: ${ev.meta.status === 'APPROVED' ? 'Aprobado' : 'Pendiente'}`)
  if (ev.meta?.jobTitle)      lines.push(`Cargo: ${ev.meta.jobTitle}`)
  if (ev.meta?.contractType)  lines.push(`Tipo contrato: ${ev.meta.contractType}`)
  if (ev.meta?.period)        lines.push(`Etapa onboarding: ${String(ev.meta.period).replace(/_/g, ' ')}`)
  lines.push('', 'Generado por GDP Surmedia')
  return lines.join('\n')
}

export type RangeOption = 'desde-hoy' | 'este-mes' | 'proximo-mes' | 'personalizado'

export const RANGE_OPTIONS: { key: RangeOption; label: string }[] = [
  { key: 'desde-hoy',     label: 'Desde hoy'    },
  { key: 'este-mes',      label: 'Este mes'      },
  { key: 'proximo-mes',   label: 'Próximo mes'   },
  { key: 'personalizado', label: 'Personalizado' },
]

export function getPresetRange(option: RangeOption): { start: string; end: string } {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth()
  if (option === 'desde-hoy')   return { start: toDateStr(today), end: toDateStr(addDays(today, 90)) }
  if (option === 'este-mes')    return { start: toDateStr(new Date(y, m, 1)),     end: toDateStr(new Date(y, m + 1, 0)) }
  if (option === 'proximo-mes') return { start: toDateStr(new Date(y, m + 1, 1)), end: toDateStr(new Date(y, m + 2, 0)) }
  return { start: toDateStr(today), end: toDateStr(addDays(today, 30)) }
}

// localStorage helpers — persiste qué eventos ya se exportaron para cada email
export function lsKey(email: string) { return `gdp_gcal::${email}` }

export function loadExportedIds(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKey(email))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

export function saveExportedIds(email: string, ids: string[]): void {
  try {
    const existing = loadExportedIds(email)
    ids.forEach(id => existing.add(id))
    localStorage.setItem(lsKey(email), JSON.stringify([...existing]))
  } catch {}
}

// Genera y descarga un archivo .ics con todos los eventos seleccionados
export function downloadICS(events: CalEvent[], attendeeEmail?: string, filename = 'gdp-eventos.ics'): void {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GDP Surmedia//GDP//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const ev of events) {
    const startStr = ev.start.replace(/-/g, '')
    const endStr   = toDateStr(addDays(parseDate(ev.end), 1)).replace(/-/g, '')
    const desc     = gcalDescription(ev).replace(/\n/g, '\\n').replace(/,/g, '\\,')
    const summary  = gcalTitle(ev).replace(/,/g, '\\,')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@gdp.surmedia.cl`,
      `DTSTART;VALUE=DATE:${startStr}`,
      `DTEND;VALUE=DATE:${endStr}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
    )
    if (attendeeEmail) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${attendeeEmail}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
