import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, X, CalendarPlus, ExternalLink, Check, ArrowRight } from 'lucide-react'
import api from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string; type: string; title: string
  start: string; end: string; color: string
  meta?: Record<string, any>
}

interface PositionedEvent {
  event: CalEvent; lane: number
  startCol: number; endCol: number
  isStart: boolean; isEnd: boolean
}

type ViewType = 'month' | 'week' | 'day'

// ── Filtros ───────────────────────────────────────────────────────────────────

interface FilterGroup { key: string; label: string; color: string; types: string[] }

const FILTER_GROUPS: FilterGroup[] = [
  { key: 'vacaciones',  label: 'Vacaciones',        color: '#16a34a', types: ['VACACIONES'] },
  { key: 'licencias',   label: 'Licencias',         color: '#ea580c', types: ['LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD'] },
  { key: 'permisos',    label: 'Permisos / Otros',  color: '#ca8a04', types: ['PERMISO', 'OTRO'] },
  { key: 'ingresos',    label: 'Ingresos',          color: '#2563eb', types: ['INGRESO'] },
  { key: 'salidas',     label: 'Salidas',           color: '#dc2626', types: ['SALIDA'] },
  { key: 'onboarding',  label: 'Onboarding',        color: '#8b5cf6', types: ['ONBOARDING', 'ONBOARDING_TASK'] },
  { key: 'contratos',   label: 'Venc. Contratos',   color: '#d97706', types: ['VENCIMIENTO'] },
  { key: 'relevantes',  label: 'Fechas Relevantes', color: '#0891b2', types: ['FECHA_RELEVANTE'] },
  { key: 'cumpleanos',  label: 'Cumpleaños',        color: '#db2777', types: ['CUMPLEANOS'] },
]

const TYPE_LABELS: Record<string, string> = {
  VACACIONES: 'Vacaciones', LICENCIA_MEDICA: 'Licencia médica',
  LICENCIA_MATERNIDAD: 'Lic. maternidad', LICENCIA_PATERNIDAD: 'Lic. paternidad',
  PERMISO: 'Permiso', OTRO: 'Otro', INGRESO: 'Ingreso', SALIDA: 'Salida',
  ONBOARDING: 'Hito onboarding', ONBOARDING_TASK: 'Tarea onboarding',
  VENCIMIENTO: 'Venc. contrato', FECHA_RELEVANTE: 'Fecha relevante',
  CUMPLEANOS: 'Cumpleaños',
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function utcDaysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}

function getCalendarWeeks(date: Date): Date[][] {
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

function getWeekDays(date: Date): Date[] {
  const dow = date.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(date)
  monday.setDate(date.getDate() + offset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getHeaderLabel(view: ViewType, date: Date): string {
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

function navigateDate(dir: -1 | 1, view: ViewType, date: Date): Date {
  const d = new Date(date)
  if (view === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir) }
  else if (view === 'week') { d.setDate(d.getDate() + dir * 7) }
  else { d.setDate(d.getDate() + dir) }
  return d
}

// ── Lane assignment ───────────────────────────────────────────────────────────

function assignLanes(events: CalEvent[], weekDays: Date[]): PositionedEvent[] {
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

function useCalendarEvents(start: string, end: string) {
  return useQuery<CalEvent[]>({
    queryKey: ['calendar', start, end],
    queryFn: () => api.get(`/calendar?start=${start}&end=${end}`).then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
}

// ── Perfiles ──────────────────────────────────────────────────────────────────

interface Profile { id: string; name: string; email: string; position: string }

function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Google Calendar URL builder (all-day) ─────────────────────────────────────

function buildGCalUrl(opts: {
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

function gcalTitle(ev: CalEvent): string {
  const typeLabel = TYPE_LABELS[ev.type] ?? ev.type
  return `${typeLabel} — ${ev.title}`
}

function gcalDescription(ev: CalEvent): string {
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

// ── ProfileCalendarModal ──────────────────────────────────────────────────────

type RangeOption = 'desde-hoy' | 'este-mes' | 'proximo-mes' | 'personalizado'

const RANGE_OPTIONS: { key: RangeOption; label: string }[] = [
  { key: 'desde-hoy',     label: 'Desde hoy'    },
  { key: 'este-mes',      label: 'Este mes'      },
  { key: 'proximo-mes',   label: 'Próximo mes'   },
  { key: 'personalizado', label: 'Personalizado' },
]

function getPresetRange(option: RangeOption): { start: string; end: string } {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth()
  if (option === 'desde-hoy')   return { start: toDateStr(today), end: toDateStr(addDays(today, 90)) }
  if (option === 'este-mes')    return { start: toDateStr(new Date(y, m, 1)),     end: toDateStr(new Date(y, m + 1, 0)) }
  if (option === 'proximo-mes') return { start: toDateStr(new Date(y, m + 1, 1)), end: toDateStr(new Date(y, m + 2, 0)) }
  return { start: toDateStr(today), end: toDateStr(addDays(today, 30)) }
}

// localStorage helpers — persiste qué eventos ya se exportaron para cada email
function lsKey(email: string) { return `gdp_gcal::${email}` }

function loadExportedIds(email: string): Set<string> {
  try {
    const raw = localStorage.getItem(lsKey(email))
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

function saveExportedIds(email: string, ids: string[]): void {
  try {
    const existing = loadExportedIds(email)
    ids.forEach(id => existing.add(id))
    localStorage.setItem(lsKey(email), JSON.stringify([...existing]))
  } catch {}
}

// Genera y descarga un archivo .ics con todos los eventos seleccionados
function downloadICS(events: CalEvent[], attendeeEmail?: string, filename = 'gdp-eventos.ics'): void {
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

function ProfileCalendarModal({ activeTypes, onClose }: {
  activeTypes: Set<string>
  onClose: () => void
}) {
  const today = new Date()

  const [rangeOption, setRangeOption]   = useState<RangeOption>('desde-hoy')
  const [customStart, setCustomStart]   = useState(toDateStr(today))
  const [customEnd, setCustomEnd]       = useState(toDateStr(addDays(today, 30)))
  const [profileId, setProfileId]       = useState('')
  const [checked, setChecked]           = useState<Set<string>>(new Set())
  const [exportedIds, setExportedIds]   = useState<Set<string>>(new Set())
  const [justDownloaded, setJustDownloaded] = useState(false)

  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles()

  const queryRange = useMemo(() => {
    if (rangeOption === 'personalizado') {
      return { start: customStart || toDateStr(today), end: customEnd || toDateStr(addDays(today, 30)) }
    }
    return getPresetRange(rangeOption)
  }, [rangeOption, customStart, customEnd])

  const { data: rawEvents = [], isFetching } = useCalendarEvents(queryRange.start, queryRange.end)

  const events = useMemo(
    () => rawEvents.filter(ev => activeTypes.has(ev.type)),
    [rawEvents, activeTypes],
  )

  const profile = profiles.find(p => p.id === profileId)

  // Cuando cambia el perfil: cargar IDs ya exportados y desmarcarlos por defecto
  useEffect(() => {
    const exported = profile ? loadExportedIds(profile.email) : new Set<string>()
    setExportedIds(exported)
    setChecked(new Set(events.filter(e => !exported.has(e.id)).map(e => e.id)))
    setJustDownloaded(false)
  }, [profileId])

  // Cuando cambian los eventos (rango): resetear selección respetando exportados
  useEffect(() => {
    setChecked(new Set(events.filter(e => !exportedIds.has(e.id)).map(e => e.id)))
    setJustDownloaded(false)
  }, [events])

  const selected = events.filter(ev => checked.has(ev.id))

  const toggle = (id: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleDownload = () => {
    if (!profile || selected.length === 0) return
    const date = toDateStr(today)
    downloadICS(selected, profile.email, `gdp-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${date}.ics`)
    saveExportedIds(profile.email, selected.map(e => e.id))
    setExportedIds(prev => { const n = new Set(prev); selected.forEach(e => n.add(e.id)); return n })
    setJustDownloaded(true)
  }

  const fmtShort = (s: string) =>
    parseDate(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Exportar a Google Calendar</h3>
            <p className="text-xs text-gray-400 mt-0.5">Descarga el .ics e impórtalo en Google Calendar de una vez.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Selector de rango */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="text-xs font-medium text-gray-600 mb-2">Rango de fechas</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setRangeOption(opt.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  rangeOption === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rangeOption === 'personalizado' ? (
            <div className="flex items-center gap-2">
              <input
                type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs flex-shrink-0">→</span>
              <input
                type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              {fmtShort(queryRange.start)} → {fmtShort(queryRange.end)}
            </p>
          )}
        </div>

        {/* Selector de perfil */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil destinatario</label>
          {loadingProfiles ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Seleccionar perfil...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.email}</option>
              ))}
            </select>
          )}
          {profile && (
            <p className="mt-1 text-xs text-gray-400">
              {profile.position} · se incluirá <span className="font-medium text-gray-600">{profile.email}</span> como invitado
            </p>
          )}
        </div>

        {/* Lista de eventos */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isFetching ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Cargando eventos…
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-1">
              <CalendarDays size={28} className="opacity-30" />
              <p className="text-sm">Sin eventos para este rango y filtros activos.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">{selected.length}</span> de {events.length} seleccionados
                  {exportedIds.size > 0 && (
                    <span className="ml-1.5 text-emerald-600 font-medium">· {exportedIds.size} ya exportados</span>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setChecked(new Set(events.map(e => e.id)))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Todo
                  </button>
                  <button
                    onClick={() => setChecked(new Set())}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="space-y-0.5">
                {events.map(ev => {
                  const s            = parseDate(ev.start)
                  const e            = parseDate(ev.end)
                  const sameDay      = ev.start === ev.end
                  const wasExported  = exportedIds.has(ev.id)
                  return (
                    <label
                      key={ev.id}
                      className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(ev.id)}
                        onChange={() => toggle(ev.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600 flex-shrink-0"
                      />
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{ev.title}</p>
                          {wasExported && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-600 flex-shrink-0 border border-emerald-100">
                              <Check size={8} strokeWidth={2.5} />
                              Exportado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                          {!sameDay && ` → ${e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`}
                          {' · '}{TYPE_LABELS[ev.type] ?? ev.type}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Instrucción de importación */}
        {justDownloaded && (
          <div className="mx-5 mb-2 flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex-shrink-0">
            <Check size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 leading-relaxed">
              <span className="font-semibold">Archivo descargado.</span> En Google Calendar: Configuración → Importar → selecciona el archivo .ics descargado.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-400">
            {!profile
              ? 'Selecciona un perfil para continuar'
              : `${selected.length} evento${selected.length !== 1 ? 's' : ''} en el archivo`}
          </p>
          <button
            onClick={handleDownload}
            disabled={!profile || selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CalendarPlus size={14} />
            Descargar .ics
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const LANE_H = 22
const HDR_H  = 30

// ── WeekRow ───────────────────────────────────────────────────────────────────

function WeekRow({
  weekDays, events, currentMonth, maxLanes, onEventClick, onDayClick,
}: {
  weekDays: Date[]
  events: CalEvent[]
  currentMonth: number
  maxLanes: number | null
  onEventClick: (ev: CalEvent) => void
  onDayClick: (day: Date) => void
}) {
  const today      = new Date()
  const positioned = useMemo(() => assignLanes(events, weekDays), [events, weekDays])
  const limit      = maxLanes ?? Infinity

  const visible    = positioned.filter(ev => ev.lane < limit)
  const maxUsed    = positioned.length === 0 ? 0 : Math.max(...positioned.map(ev => ev.lane)) + 1
  const rowLanes   = maxLanes !== null ? maxLanes : Math.max(maxUsed, 3)

  const overflowByCol = useMemo(() => {
    const counts = Array(7).fill(0)
    if (maxLanes === null) return counts
    for (const ev of positioned) {
      if (ev.lane >= maxLanes) {
        for (let c = ev.startCol; c <= ev.endCol; c++) counts[c]++
      }
    }
    return counts
  }, [positioned, maxLanes])

  const rowH = Math.max(HDR_H + rowLanes * LANE_H + 16, 80)

  return (
    <div className="relative border-b border-gray-100" style={{ height: rowH }}>
      {/* Backgrounds (click + hover) */}
      <div className="absolute inset-0 grid grid-cols-7">
        {weekDays.map((day, col) => (
          <div
            key={col}
            className={`border-r border-gray-100 cursor-pointer hover:bg-blue-50/30 transition-colors ${
              day.getMonth() === currentMonth ? 'bg-white' : 'bg-gray-50/60'
            }`}
            onClick={() => onDayClick(day)}
          />
        ))}
      </div>

      {/* Date numbers */}
      <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
        {weekDays.map((day, col) => {
          const isToday    = isSameDay(day, today)
          const isCurMonth = day.getMonth() === currentMonth
          return (
            <div key={col} className="flex items-start p-1">
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                isToday ? 'bg-blue-600 text-white' :
                isCurMonth ? 'text-gray-700' : 'text-gray-400'
              }`}>
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Overflow "+X más" */}
      {maxLanes !== null && (
        <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
          {overflowByCol.map((count, col) =>
            count > 0 ? (
              <div key={col} className="flex items-end pb-1 pl-1.5">
                <span className="text-[10px] text-gray-400 font-medium">+{count} más</span>
              </div>
            ) : <div key={col} />
          )}
        </div>
      )}

      {/* Event bars */}
      {visible.map((ev, i) => {
        const pct = 100 / 7
        const br  = ev.isStart && ev.isEnd ? '3px' :
                    ev.isStart ? '3px 0 0 3px' :
                    ev.isEnd   ? '0 3px 3px 0' : '0'
        return (
          <div
            key={i}
            className="absolute flex items-center px-1.5 text-white text-[11px] font-medium truncate cursor-pointer hover:brightness-110 transition-all select-none"
            style={{
              top: HDR_H + ev.lane * LANE_H,
              left:  `calc(${ev.startCol * pct}% + 2px)`,
              width: `calc(${(ev.endCol - ev.startCol + 1) * pct}% - 4px)`,
              height: LANE_H - 2,
              backgroundColor: ev.event.color,
              borderRadius: br,
            }}
            onClick={e2 => { e2.stopPropagation(); onEventClick(ev.event) }}
            title={ev.event.title}
          >
            {ev.isStart && ev.event.title}
          </div>
        )
      })}
    </div>
  )
}

// ── MonthView ─────────────────────────────────────────────────────────────────

function MonthView({ events, currentDate, onEventClick, onDayClick }: {
  events: CalEvent[]; currentDate: Date
  onEventClick: (ev: CalEvent) => void; onDayClick: (day: Date) => void
}) {
  const weeks = useMemo(() => getCalendarWeeks(currentDate), [currentDate])
  const month = currentDate.getMonth()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto">
        {weeks.map((week, i) => (
          <WeekRow
            key={i} weekDays={week} events={events}
            currentMonth={month} maxLanes={4}
            onEventClick={onEventClick} onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}

// ── WeekView ──────────────────────────────────────────────────────────────────

function WeekView({ events, currentDate, onEventClick, onDayClick }: {
  events: CalEvent[]; currentDate: Date
  onEventClick: (ev: CalEvent) => void; onDayClick: (day: Date) => void
}) {
  const today    = new Date()
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const month    = currentDate.getMonth()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div
              key={i}
              className="py-2 text-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => onDayClick(day)}
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{DAY_NAMES[i]}</p>
              <span className={`inline-flex items-center justify-center w-8 h-8 mt-0.5 rounded-full text-sm font-semibold ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
              }`}>
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto">
        <WeekRow
          weekDays={weekDays} events={events}
          currentMonth={month} maxLanes={null}
          onEventClick={onEventClick} onDayClick={onDayClick}
        />
      </div>
    </div>
  )
}

// ── DayView ───────────────────────────────────────────────────────────────────

function DayView({ events, currentDate, onEventClick }: {
  events: CalEvent[]; currentDate: Date
  onEventClick: (ev: CalEvent) => void
}) {
  const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const dayEnd   = new Date(dayStart)

  const dayEvents = useMemo(() =>
    events
      .filter(ev => {
        const s = parseDate(ev.start)
        const e = parseDate(ev.end)
        return s <= dayStart && dayEnd <= e || isSameDay(s, dayStart) || isSameDay(e, dayStart)
      })
      .sort((a, b) => a.type.localeCompare(b.type)),
    [events, currentDate],
  )

  if (dayEvents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
        <CalendarDays size={36} className="opacity-20" />
        <p className="text-sm">Sin eventos para este día.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-2">
        {dayEvents.map(ev => {
          const sameDay = ev.start === ev.end
          const s = parseDate(ev.start), e = parseDate(ev.end)
          return (
            <div
              key={ev.id}
              className="flex items-start gap-3 p-3.5 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-gray-200 hover:shadow-sm transition-all"
              onClick={() => onEventClick(ev)}
            >
              <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ev.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                    style={{ backgroundColor: ev.color }}
                  >
                    {TYPE_LABELS[ev.type] ?? ev.type}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                {!sameDay && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} →{' '}
                    {e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    {ev.meta?.days ? ` · ${ev.meta.days} días` : ''}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── EventDetailModal ──────────────────────────────────────────────────────────

function EventDetailModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const s       = parseDate(event.start)
  const e       = parseDate(event.end)
  const sameDay = event.start === event.end

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-xs p-4"
        onClick={ev => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              {TYPE_LABELS[event.type] ?? event.type}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={14} />
          </button>
        </div>

        <p className="text-sm font-semibold text-gray-800 mb-3">{event.title}</p>

        <div className="text-xs text-gray-500 space-y-1.5">
          {sameDay ? (
            <p>{s.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          ) : (
            <p>
              {s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} →{' '}
              {e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
              {event.meta?.days ? ` (${event.meta.days} días)` : ''}
            </p>
          )}
          {event.meta?.status      && <p>Estado: {event.meta.status === 'APPROVED' ? 'Aprobado' : 'Pendiente'}</p>}
          {event.meta?.jobTitle    && <p>Cargo: {event.meta.jobTitle}</p>}
          {event.meta?.contractType && <p>Contrato: {event.meta.contractType}</p>}
          {event.meta?.name        && <p>Colaborador: {event.meta.name}</p>}
          {event.meta?.period      && <p>Período: {String(event.meta.period).replace('_', ' ')}</p>}
        </div>
      </div>
    </div>
  )
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

interface OnboardingProcessSummary { id: string; collaboratorName: string }

function FilterPanel({
  active, onToggle,
  onboardingProcesses, hiddenProcessIds, onToggleProcess,
}: {
  active: Set<string>
  onToggle: (k: string) => void
  onboardingProcesses: OnboardingProcessSummary[]
  hiddenProcessIds: Set<string>
  onToggleProcess: (id: string) => void
}) {
  return (
    <aside className="w-52 flex-shrink-0 border-l border-gray-100 bg-white p-4 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtros</p>
      <div className="space-y-0.5">
        {FILTER_GROUPS.map(g => (
          <div key={g.key}>
            <button
              onClick={() => onToggle(g.key)}
              className="w-full flex items-center gap-2.5 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div
                className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: active.has(g.key) ? g.color : 'white',
                  borderColor:     active.has(g.key) ? g.color : '#d1d5db',
                }}
              >
                {active.has(g.key) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-700">{g.label}</span>
            </button>

            {/* Sub-checks por proceso de onboarding */}
            {g.key === 'onboarding' && active.has('onboarding') && onboardingProcesses.length > 0 && (
              <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
                {onboardingProcesses.map(proc => {
                  const visible = !hiddenProcessIds.has(proc.id)
                  return (
                    <button
                      key={proc.id}
                      onClick={() => onToggleProcess(proc.id)}
                      className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-md px-1.5 py-0.5 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          backgroundColor: visible ? g.color : 'white',
                          borderColor:     visible ? g.color : '#d1d5db',
                        }}
                      >
                        {visible && (
                          <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                            <polyline points="0.5,2.5 2,4 5.5,0.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 truncate leading-tight">{proc.collaboratorName}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Referencia</p>
        <div className="space-y-1.5">
          {FILTER_GROUPS.filter(g => active.has(g.key)).map(g => (
            <div key={g.key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="text-[11px] text-gray-500">{g.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [view, setView]               = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeGroups, setActiveGroups] = useState<Set<string>>(
    () => new Set(FILTER_GROUPS.map(g => g.key)),
  )
  const [selectedEvent, setSelectedEvent]     = useState<CalEvent | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [hiddenProcessIds, setHiddenProcessIds] = useState<Set<string>>(new Set())

  // Rango de consulta según la vista
  const { start, end } = useMemo(() => {
    if (view === 'month') {
      const weeks = getCalendarWeeks(currentDate)
      return { start: toDateStr(weeks[0][0]), end: toDateStr(weeks[weeks.length - 1][6]) }
    }
    if (view === 'week') {
      const days = getWeekDays(currentDate)
      return { start: toDateStr(days[0]), end: toDateStr(days[6]) }
    }
    const d = toDateStr(currentDate)
    return { start: d, end: d }
  }, [view, currentDate])

  const { data: events = [], isLoading } = useCalendarEvents(start, end)

  // Procesos de onboarding activos para subchecks
  const { data: activeProcesses = [] } = useQuery<OnboardingProcessSummary[]>({
    queryKey: ['onboarding-active-summary'],
    queryFn: () =>
      api.get('/onboarding').then(r =>
        (r.data.data as any[])
          .filter((p: any) => p.status === 'IN_PROGRESS')
          .map((p: any) => ({ id: p.id, collaboratorName: p.collaboratorName })),
      ),
    staleTime: 5 * 60 * 1000,
  })

  // Filtrado por grupos activos
  const activeTypes = useMemo(() => {
    const types = new Set<string>()
    FILTER_GROUPS.forEach(g => { if (activeGroups.has(g.key)) g.types.forEach(t => types.add(t)) })
    return types
  }, [activeGroups])

  // Set de IDs visibles para filtro rápido O(1)
  const subListIds = useMemo(
    () => new Set(activeProcesses.map(p => p.id)),
    [activeProcesses],
  )

  const filteredEvents = useMemo(
    () => events.filter(ev => {
      if (!activeTypes.has(ev.type)) return false
      if (ev.type === 'ONBOARDING' || ev.type === 'ONBOARDING_TASK') {
        // Si la sub-lista aún no cargó, mostrar todo
        if (subListIds.size === 0) return true
        const pid = ev.meta?.processId as string | undefined
        // Procesos no listados (ej: COMPLETED) no tienen sub-checkbox → siempre ocultos
        if (!pid || !subListIds.has(pid)) return false
        // Procesos listados: ocultos sólo si su sub-checkbox está desmarcado
        return !hiddenProcessIds.has(pid)
      }
      return true
    }),
    [events, activeTypes, subListIds, hiddenProcessIds],
  )

  const toggleGroup = (key: string) =>
    setActiveGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleProcess = (id: string) =>
    setHiddenProcessIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleDayClick = (day: Date) => { setCurrentDate(day); setView('day') }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0 bg-white">
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          Hoy
        </button>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCurrentDate(d => navigateDate(-1, view, d))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(d => navigateDate(1, view, d))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <h2 className="text-base font-semibold text-gray-800 flex-1 select-none">
          {getHeaderLabel(view, currentDate)}
        </h2>

        {isLoading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}

        <button
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          title="Cargar eventos filtrados a Google Calendar de un perfil"
        >
          <CalendarPlus size={15} />
          <span className="hidden sm:inline">Cargar a Calendar</span>
        </button>

        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['month', 'week', 'day'] as ViewType[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === 'month' && (
            <MonthView
              events={filteredEvents} currentDate={currentDate}
              onEventClick={setSelectedEvent} onDayClick={handleDayClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              events={filteredEvents} currentDate={currentDate}
              onEventClick={setSelectedEvent} onDayClick={handleDayClick}
            />
          )}
          {view === 'day' && (
            <DayView
              events={filteredEvents} currentDate={currentDate}
              onEventClick={setSelectedEvent}
            />
          )}
        </div>

        <FilterPanel
          active={activeGroups}
          onToggle={toggleGroup}
          onboardingProcesses={activeProcesses}
          hiddenProcessIds={hiddenProcessIds}
          onToggleProcess={toggleProcess}
        />
      </div>

      {/* ── Modal de detalle ── */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* ── Modal de carga a Calendar de perfil ── */}
      {showProfileModal && (
        <ProfileCalendarModal
          activeTypes={activeTypes}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  )
}
