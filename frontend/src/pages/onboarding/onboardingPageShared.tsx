// Helpers, constantes, tipos y componentes compartidos de la página de Onboarding.
// Extraído de OnboardingPage.tsx.
import React, { useState, useMemo } from 'react'
import { Mail, Calendar, RefreshCw, Wrench, Globe, ChevronLeft, ChevronRight } from 'lucide-react'
import type { OnboardingProcess, OnboardingPeriod, TaskAutomationType } from '@/types'

// ─── Helpers de jornada ─────────────────────────────────────────────────────────

// Días de la semana (orden lunes→domingo) usados para la jornada y el teletrabajo.
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const

// Convierte un set de días en texto: rango contiguo ("lunes a viernes"),
// lista ("lunes, martes y jueves") o un único día ("lunes").
export function formatDays(dias: string[]): string {
  const ordered = WEEKDAYS.filter(d => dias.includes(d))
  if (ordered.length === 0) return ''
  if (ordered.length === 1) return ordered[0]
  const idxs = ordered.map(d => WEEKDAYS.indexOf(d))
  const contiguous = idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1)
  if (contiguous && ordered.length >= 3) return `${ordered[0]} a ${ordered[ordered.length - 1]}`
  return ordered.slice(0, -1).join(', ') + ' y ' + ordered[ordered.length - 1]
}

// Arma el valor de la variable {{jornada}} combinando los días de jornada y,
// si hay teletrabajo, el detalle: "lunes a viernes. Teletrabajo (lunes y miércoles)".
export function buildJornada(dias: string[], teleDias: string[]): string {
  const base = formatDays(dias)
  const tele = teleDias.length ? `Teletrabajo (${formatDays(teleDias)})` : ''
  return [base, tele].filter(Boolean).join('. ')
}

// Intenta deducir los días desde un texto libre (para precargar al elegir un colaborador).
export function parseDays(str: string): string[] {
  if (!str) return []
  const strip = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const dayRe = (d: string) => strip(d)
  const norm = strip(str)
  const range = norm.match(/(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+a\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/)
  if (range) {
    const a = WEEKDAYS.findIndex(d => dayRe(d) === range[1])
    const b = WEEKDAYS.findIndex(d => dayRe(d) === range[2])
    if (a >= 0 && b >= a) return [...WEEKDAYS.slice(a, b + 1)]
  }
  return WEEKDAYS.filter(d => norm.includes(dayRe(d)))
}

// ─── Helpers de fecha y proceso ─────────────────────────────────────────────────

export function parseDateLocal(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmt(dateStr: string) {
  return parseDateLocal(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysIn(startDate: string) {
  const start = parseDateLocal(startDate); start.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000)
}

export function calcProgress(process: OnboardingProcess) {
  const total = process.tasks.length
  if (total === 0) return 0
  return Math.round((process.tasks.filter(t => t.completedAt).length / total) * 100)
}

export function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
}

// ─── Constantes de presentación ──────────────────────────────────────────────────

export const STATUS_BADGE: Record<string, JSX.Element> = {
  IN_PROGRESS: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">En proceso</span>,
  COMPLETED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span>,
  CANCELLED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Cancelado</span>,
}

export const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

export const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

export const PERIOD_LABELS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'Pre Ingreso',
  DIA_1:       'Día 1',
  SEMANA_1:    'Semana 1',
  MES_1:       'Mes 1',
  EVALUACION:  'Evaluación',
}

export const PERIOD_COLORS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'bg-violet-100 text-violet-700',
  DIA_1:       'bg-brand-100 text-brand-700',
  SEMANA_1:    'bg-cyan-100 text-cyan-700',
  MES_1:       'bg-emerald-100 text-emerald-700',
  EVALUACION:  'bg-amber-100 text-amber-700',
}

export const AUTO_CONFIG: Record<TaskAutomationType, { icon: React.ReactNode; label: string; cls: string }> = {
  EMAIL:        { icon: <Mail size={10} />,       label: 'Email',    cls: 'bg-brand-100 text-brand-700' },
  CALENDAR:     { icon: <Calendar size={10} />,   label: 'Calendar', cls: 'bg-purple-100 text-purple-700' },
  BUK_CHECK:    { icon: <RefreshCw size={10} />,  label: 'BUK',      cls: 'bg-orange-100 text-orange-700' },
  EXTERNAL:     { icon: <Globe size={10} />,      label: 'Externo',  cls: 'bg-cyan-100 text-cyan-700' },
  MANUAL:       { icon: <Wrench size={10} />,     label: 'Manual',   cls: 'bg-gray-100 text-gray-500' },
  SHEET_VERIFY: { icon: <Globe size={10} />,      label: 'Sheets',   cls: 'bg-green-100 text-green-700' },
}

export function AutoBadge({ type }: { type: TaskAutomationType }) {
  const c = AUTO_CONFIG[type] ?? { icon: null, label: type, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Tipos y mini-calendario de la vista previa ───────────────────────────────────

export interface CalItem {
  id: string
  name: string
  parentName?: string | null
  dayOffset: number
  start: Date
  durationMinutes: number
  attendeeEmails: string[]
  attendeeProfileIds: string[]
}

export interface CalItemWithTime extends CalItem { resolvedStart: Date }

export function CalendarPreview({ items, eventTimes }: { items: CalItemWithTime[]; eventTimes: Record<string, string> }) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.resolvedStart.getTime() - b.resolvedStart.getTime()), [items])
  const firstEvt = sorted[0]?.resolvedStart ?? new Date()

  const [viewYear,  setViewYear]  = useState(firstEvt.getFullYear())
  const [viewMonth, setViewMonth] = useState(firstEvt.getMonth())

  const byDate = useMemo(() => {
    const m = new Map<string, CalItemWithTime[]>()
    items.forEach(item => {
      const d = item.resolvedStart
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const arr = m.get(key) ?? []; arr.push(item); m.set(key, arr)
    })
    return m
  }, [items])

  if (items.length === 0) return null

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7

  const cells: Date[] = []
  for (let i = startOffset - 1; i >= 0; i--) cells.push(new Date(viewYear, viewMonth, -i))
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d))
  const tail = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7)
  for (let d = 1; d <= tail; d++) cells.push(new Date(viewYear, viewMonth + 1, d))
  const weeks: Date[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthLabel = firstDay.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  const hasEvents = [...byDate.keys()].some(k => {
    const [y, mo] = k.split('-').map(Number)
    return y === viewYear && mo - 1 === viewMonth
  })

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <button onClick={prevMonth} aria-label="Mes anterior" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={13} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700 capitalize">{monthLabel}</p>
          {!hasEvents && <p className="text-[9px] text-gray-300">Sin eventos</p>}
        </div>
        <button onClick={nextMonth} aria-label="Mes siguiente" className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 bg-gray-50/70 border-b border-gray-100">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="py-1 text-center text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      {/* Semanas */}
      <div className="divide-y divide-gray-50">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50">
            {week.map((date, di) => {
              const inMonth = date.getMonth() === viewMonth
              const isToday = date.getTime() === today.getTime()
              const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
              const evs = inMonth ? (byDate.get(key) ?? []) : []
              return (
                <div key={di} className={`min-h-[54px] p-1 ${!inMonth ? 'bg-gray-50/30' : ''}`}>
                  <div className={`text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 mx-auto ${
                    isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {date.getDate()}
                  </div>
                  {evs.slice(0, 2).map(ev => {
                    const displayName = ev.parentName ?? ev.name
                    const pill = ev.durationMinutes === 0 ? displayName : `${eventTimes[ev.id] ?? '09:00'} ${displayName}`
                    return (
                      <div key={ev.id} title={ev.parentName ? `${ev.parentName} (${ev.name})` : ev.name}
                        className="text-[8px] leading-tight text-purple-800 bg-purple-100 rounded px-0.5 py-px truncate mb-px">
                        {pill}
                      </div>
                    )
                  })}
                  {evs.length > 2 && <div className="text-[8px] text-gray-400">+{evs.length-2}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
