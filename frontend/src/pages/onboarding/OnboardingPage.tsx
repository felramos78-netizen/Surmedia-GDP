import React, { useState, useMemo, useEffect } from 'react'
import {
  Plus, Rocket, CheckCircle2, AlertTriangle, X, ChevronRight, ChevronLeft,
  Mail, Calendar, RefreshCw, Wrench, Globe, Search, UserCheck,
} from 'lucide-react'
import {
  useOnboardingProcesses, useOnboardingStats,
  useCreateOnboarding, useTemplateTasks,
} from '@/hooks/useOnboarding'
import { useJobTitles, useEmployees } from '@/hooks/useDotacion'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import { useProfiles } from '@/hooks/useProfiles'
import type { OnboardingProcess, OnboardingDbTemplateTask, OnboardingPeriod, TaskAutomationType, Profile } from '@/types'
import OnboardingDrawer from './OnboardingDrawer'
import HitosTab from './tabs/HitosTab'
import AutomatizacionTab from './tabs/AutomatizacionTab'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysIn(startDate: string) {
  return Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
}

function calcProgress(process: OnboardingProcess) {
  const total = process.tasks.length
  if (total === 0) return 0
  return Math.round((process.tasks.filter(t => t.completedAt).length / total) * 100)
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
}

const STATUS_BADGE: Record<string, JSX.Element> = {
  IN_PROGRESS: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En proceso</span>,
  COMPLETED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span>,
  CANCELLED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Cancelado</span>,
}

const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_LABELS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'Pre Ingreso',
  DIA_1:       'Día 1',
  SEMANA_1:    'Semana 1',
  MES_1:       'Mes 1',
  EVALUACION:  'Evaluación',
}

const PERIOD_COLORS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'bg-violet-100 text-violet-700',
  DIA_1:       'bg-blue-100 text-blue-700',
  SEMANA_1:    'bg-cyan-100 text-cyan-700',
  MES_1:       'bg-emerald-100 text-emerald-700',
  EVALUACION:  'bg-amber-100 text-amber-700',
}

const AUTO_CONFIG: Record<TaskAutomationType, { icon: React.ReactNode; label: string; cls: string }> = {
  EMAIL:        { icon: <Mail size={10} />,       label: 'Email',    cls: 'bg-blue-100 text-blue-700' },
  CALENDAR:     { icon: <Calendar size={10} />,   label: 'Calendar', cls: 'bg-purple-100 text-purple-700' },
  BUK_CHECK:    { icon: <RefreshCw size={10} />,  label: 'BUK',      cls: 'bg-orange-100 text-orange-700' },
  EXTERNAL:     { icon: <Globe size={10} />,      label: 'Externo',  cls: 'bg-cyan-100 text-cyan-700' },
  MANUAL:       { icon: <Wrench size={10} />,     label: 'Manual',   cls: 'bg-gray-100 text-gray-500' },
  SHEET_VERIFY: { icon: <Globe size={10} />,      label: 'Sheets',   cls: 'bg-green-100 text-green-700' },
}

function AutoBadge({ type }: { type: TaskAutomationType }) {
  const c = AUTO_CONFIG[type] ?? { icon: null, label: type, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Modal: Nuevo proceso (página única) ─────────────────────────────────────

// ─── ICS helpers ─────────────────────────────────────────────────────────────

interface CalItem {
  id: string
  name: string
  parentName?: string | null
  dayOffset: number
  start: Date
  durationMinutes: number
  attendeeEmails: string[]
  attendeeProfileIds: string[]
}

function icsDateFmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

function icsDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`
}

function generateICS(items: CalItem[], collaboratorName: string, processId: string): string {
  const now = icsDateFmt(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Surmedia GDP//Onboarding//ES',
    'CALSCALE:GREGORIAN',
  ]
  items.forEach((item, i) => {
    const allDay = item.durationMinutes === 0
    lines.push(
      'BEGIN:VEVENT',
      `UID:onboarding-${processId}-${i}@surmedia.gdp`,
      `DTSTAMP:${now}`,
    )
    if (allDay) {
      const nextDay = new Date(item.start.getTime() + 86_400_000)
      lines.push(
        `DTSTART;VALUE=DATE:${icsDateOnly(item.start)}`,
        `DTEND;VALUE=DATE:${icsDateOnly(nextDay)}`,
      )
    } else {
      const end = new Date(item.start.getTime() + item.durationMinutes * 60_000)
      lines.push(
        `DTSTART:${icsDateFmt(item.start)}`,
        `DTEND:${icsDateFmt(end)}`,
      )
    }
    lines.push(
      `SUMMARY:${item.name}`,
      `DESCRIPTION:Onboarding ${collaboratorName}`,
    )
    item.attendeeEmails.forEach(email => lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`))
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── Mini calendar preview ────────────────────────────────────────────────────

interface CalItemWithTime extends CalItem { resolvedStart: Date }

function CalendarPreview({ items, eventTimes }: { items: CalItemWithTime[]; eventTimes: Record<string, string> }) {
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
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={13} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700 capitalize">{monthLabel}</p>
          {!hasEvents && <p className="text-[9px] text-gray-300">Sin eventos</p>}
        </div>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
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
                    isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'
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

// ─── Modal: Nuevo proceso ─────────────────────────────────────────────────────

function NewProcessModal({ onClose, onCreated, processes }: {
  onClose:   () => void
  onCreated: (id: string) => void
  processes: OnboardingProcess[]
}) {
  const [form, setForm] = useState({
    // Campos obligatorios
    collaboratorRut: '', collaboratorName: '', collaboratorEmail: '', collaboratorPersonalEmail: '',
    collaboratorPosition: '', collaboratorPhone: '', legalEntity: '', costCenter: '', startDate: '', notes: '',
    // Datos personales adicionales
    segundoApellido: '', city: '', commune: '', address: '',
    birthDate: '', gender: '', nationality: '',
    // Datos laborales adicionales
    jobFamily: '', contractType: '', companyStartDate: '', contractEndDate: '',
    workSchedule: '', distribucionJornada: '', supervisorName: '', supervisorTitle: '',
    // Vínculo laboral
    vinculo: '', reemplazaA: '',
    // Previsión social
    afp: '', isapre: '',
    // Datos bancarios
    banco: '', tipoCuenta: '', numeroCuenta: '',
  })
  const [rutSearch,          setRutSearch]          = useState('')
  const [matchedEmployee,    setMatchedEmployee]    = useState<{ id: string; name: string; position?: string | null; rut: string } | null>(null)
  const [duplicateProcessId, setDuplicateProcessId] = useState<string | null>(null)
  const [positionMode,       setPositionMode]       = useState<'select' | 'custom'>('select')
  const [selected,           setSelected]           = useState<Set<string>>(new Set())
  const [showCalendar,         setShowCalendar]         = useState(false)
  const [eventExtraProfileIds, setEventExtraProfileIds] = useState<Record<string, string[]>>({})
  const [eventTimes,           setEventTimes]           = useState<Record<string, string>>({})
  const [expandedEventId,      setExpandedEventId]      = useState<string | null>(null)

  const { data: rawTemplate = [], isLoading: templateLoading, isError: templateError, refetch: refetchTemplate } = useTemplateTasks()
  const template = rawTemplate.filter(t => t.isActive)
  const { data: jobTitles   = [] } = useJobTitles()
  const { data: workCenters = [] } = useWorkCenters()
  const { data: profiles    = [] } = useProfiles()
  const { data: empData, isFetching: searchFetching } = useEmployees(
    rutSearch.length >= 2 ? { search: rutSearch, status: ['ACTIVE', 'INACTIVE'] } : {}
  )
  const createOnboarding = useCreateOnboarding()

  const employeeResults = rutSearch.length >= 2 ? (empData?.data ?? []).slice(0, 6) : []

  const selectEmployee = (emp: any) => {
    const active = processes.find(p => p.collaboratorRut === emp.rut && p.status === 'IN_PROGRESS')
    if (active) { setDuplicateProcessId(active.id); setRutSearch(''); return }
    setDuplicateProcessId(null)
    const fullName = `${emp.firstName} ${emp.lastName}`
    setMatchedEmployee({ id: emp.id, name: fullName, position: emp.jobTitle, rut: emp.rut })
    const contract = emp.contracts?.find((c: any) => c.isActive)
    setForm(f => ({
      ...f,
      collaboratorRut:           emp.rut,
      collaboratorName:          fullName,
      collaboratorPosition:      emp.jobTitle ?? f.collaboratorPosition,
      collaboratorEmail:         (!emp.email || emp.email.includes('@buk.import')) ? f.collaboratorEmail : emp.email,
      collaboratorPhone:         emp.phone ?? f.collaboratorPhone,
      collaboratorPersonalEmail: emp.personalEmail ?? f.collaboratorPersonalEmail,
      legalEntity:               f.legalEntity || (contract?.legalEntity ?? ''),
      // Personales
      segundoApellido:  emp.segundoApellido ?? '',
      city:             emp.city ?? '',
      commune:          emp.commune ?? '',
      address:          emp.address ?? '',
      birthDate:        emp.birthDate ? emp.birthDate.split('T')[0] : '',
      gender:           emp.gender ?? '',
      nationality:      emp.nationality ?? '',
      // Laborales
      jobFamily:          emp.jobFamily ?? '',
      contractType:       contract?.type ?? '',
      companyStartDate:   emp.startDate ? emp.startDate.split('T')[0] : '',
      contractEndDate:    emp.endDate ? emp.endDate.split('T')[0] : (contract?.endDate ? contract.endDate.split('T')[0] : ''),
      workSchedule:       emp.workSchedule ?? '',
      distribucionJornada: emp.distribucionJornada ?? '',
      supervisorName:     emp.supervisorName ?? '',
      supervisorTitle:    emp.supervisorTitle ?? '',
      vinculo:            emp.vinculo ?? '',
      reemplazaA:         emp.reemplazaA ?? '',
      // Previsión
      afp:    emp.afp ?? '',
      isapre: emp.isapre ?? '',
      // Bancarios
      banco:        emp.banco ?? '',
      tipoCuenta:   emp.tipoCuenta ?? '',
      numeroCuenta: emp.numeroCuenta ?? '',
    }))
    setRutSearch('')
  }

  const clearEmployee = () => {
    setMatchedEmployee(null)
    setDuplicateProcessId(null)
    setForm(f => ({
      ...f,
      collaboratorRut: '', collaboratorName: '', collaboratorPosition: '',
      collaboratorEmail: '', collaboratorPhone: '', collaboratorPersonalEmail: '',
      segundoApellido: '', city: '', commune: '', address: '',
      birthDate: '', gender: '', nationality: '',
      jobFamily: '', contractType: '', companyStartDate: '', contractEndDate: '',
      workSchedule: '', distribucionJornada: '', supervisorName: '', supervisorTitle: '',
      vinculo: '', reemplazaA: '',
      afp: '', isapre: '', banco: '', tipoCuenta: '', numeroCuenta: '',
    }))
  }

  useEffect(() => {
    if (template.length > 0 && selected.size === 0)
      setSelected(new Set(template.map(t => t.key)))
  }, [template.length])

  const field = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const toggle = (key: string) => setSelected(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  const togglePeriod = (period: OnboardingPeriod) => {
    const keys = template.filter(t => t.period === period).map(t => t.key)
    const allOn = keys.every(k => selected.has(k))
    setSelected(prev => {
      const next = new Set(prev); keys.forEach(k => allOn ? next.delete(k) : next.add(k)); return next
    })
  }

  const handleSubmit = async () => {
    const collaboratorData: Record<string, unknown> = {}
    const snap: [string, string][] = [
      ['segundoApellido', form.segundoApellido], ['city', form.city], ['commune', form.commune],
      ['address', form.address], ['birthDate', form.birthDate], ['gender', form.gender],
      ['nationality', form.nationality], ['jobFamily', form.jobFamily], ['contractType', form.contractType],
      ['companyStartDate', form.companyStartDate], ['contractEndDate', form.contractEndDate],
      ['workSchedule', form.workSchedule], ['distribucionJornada', form.distribucionJornada],
      ['supervisorName', form.supervisorName], ['supervisorTitle', form.supervisorTitle],
      ['vinculo', form.vinculo], ['reemplazaA', form.reemplazaA],
      ['afp', form.afp], ['isapre', form.isapre],
      ['banco', form.banco], ['tipoCuenta', form.tipoCuenta], ['numeroCuenta', form.numeroCuenta],
    ]
    snap.forEach(([k, v]) => { if (v) collaboratorData[k] = v })

    try {
      const process = await createOnboarding.mutateAsync({
        collaboratorRut:           form.collaboratorRut.trim() || undefined,
        collaboratorName:          form.collaboratorName.trim(),
        collaboratorEmail:         form.collaboratorEmail.trim() || undefined,
        collaboratorPersonalEmail: form.collaboratorPersonalEmail.trim() || undefined,
        collaboratorPosition: form.collaboratorPosition.trim() || undefined,
        collaboratorPhone:    form.collaboratorPhone.trim() || undefined,
        legalEntity:          form.legalEntity || undefined,
        costCenter:           form.costCenter.trim() || undefined,
        startDate:            form.startDate || undefined,
        notes:                form.notes.trim() || undefined,
        selectedTaskIds:      Array.from(selected),
        collaboratorData:     Object.keys(collaboratorData).length ? collaboratorData : undefined,
      })
      onCreated(process.id)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al crear el proceso'
      alert(msg)
    }
  }

  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingDbTemplateTask[]>()
    PERIOD_ORDER.forEach(p => map.set(p, []))
    template.forEach(t => map.get(t.period as OnboardingPeriod)?.push(t))
    return map
  }, [template])

  const calItems: CalItem[] = useMemo(() => {
    if (!form.startDate) return []
    const startDate = new Date(form.startDate + 'T12:00:00Z')
    const periodStarts: Record<string, number> = {
      PRE_INGRESO: -7, DIA_1: 0, SEMANA_1: 1, MES_1: 8, EVALUACION: 60,
    }
    const resolveEmailsLocal = (profileIds: string[], itemId: string): string[] => {
      // If user has customized this event's invitees, use their full selection; otherwise use template defaults
      const overrideIds = eventExtraProfileIds[itemId]
      const allIds = overrideIds !== undefined ? overrideIds : (profileIds ?? [])
      const emails: string[] = allIds
        .map((id: string) => (profiles as Profile[]).find(p => p.id === id)?.email)
        .filter((e): e is string => !!e)
      const colEmail = form.collaboratorEmail.trim()
      if (colEmail && !emails.includes(colEmail)) emails.push(colEmail)
      return emails
    }
    const items: CalItem[] = []
    template.filter(t => selected.has(t.key)).forEach(t => {
      if (t.automationType === 'CALENDAR') {
        const cfg = (t.automationConfig ?? {}) as Record<string, any>
        const rawOffset = typeof cfg.daysFromStart === 'number'
          ? (t.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart)
          : (periodStarts[t.period] ?? 0)
        const s = new Date(startDate); s.setDate(s.getDate() + rawOffset); s.setHours(9, 0, 0, 0)
        items.push({ id: t.id, name: t.name, parentName: null, dayOffset: rawOffset, start: s, durationMinutes: cfg.durationMinutes ?? 60, attendeeEmails: resolveEmailsLocal(cfg.attendeeProfileIds ?? [], t.id), attendeeProfileIds: cfg.attendeeProfileIds ?? [] })
      }
      t.subTasks.forEach((st, si) => {
        if (st.tool === 'CALENDAR' && st.plantilla) {
          try {
            const cfg = JSON.parse(st.plantilla) as Record<string, any>
            const rawOffset = typeof cfg.daysFromStart === 'number'
              ? (t.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart)
              : (periodStarts[t.period] ?? 0)
            const s = new Date(startDate); s.setDate(s.getDate() + rawOffset); s.setHours(9, 0, 0, 0)
            const id = `${t.id}-st-${si}`
            items.push({ id, name: st.name, parentName: t.name, dayOffset: rawOffset, start: s, durationMinutes: cfg.durationMinutes ?? 60, attendeeEmails: resolveEmailsLocal(cfg.attendeeProfileIds ?? [], id), attendeeProfileIds: cfg.attendeeProfileIds ?? [] })
          } catch {}
        }
      })
    })
    return items.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [template, selected, form.startDate, form.collaboratorEmail, profiles, eventExtraProfileIds])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Nuevo proceso de onboarding</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selected.size} de {template.length} hitos seleccionados</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* ── Paso 2: Vista de calendario y confirmación ── */}
        {showCalendar && (() => {
          const resolveStart = (item: CalItem): Date => {
            if (item.durationMinutes === 0) return item.start
            const time = eventTimes[item.id]
            if (!time) return item.start
            const [h, m] = time.split(':').map(Number)
            const d = new Date(item.start); d.setHours(h, m, 0, 0); return d
          }

          const finalItems: CalItemWithTime[] = calItems.map(item => ({
            ...item, resolvedStart: resolveStart(item),
          }))

          const p = (n: number) => String(n).padStart(2, '0')
          const gcalFmt = (d: Date) => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
          const dateOnly = (d: Date) => `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`

          const makeUrl = (item: CalItem): string => {
            const allDay = item.durationMinutes === 0
            const s = resolveStart(item)
            let dates: string
            if (allDay) {
              const next = new Date(s.getTime() + 86_400_000)
              dates = `${dateOnly(s)}/${dateOnly(next)}`
            } else {
              const end = new Date(s.getTime() + item.durationMinutes * 60_000)
              dates = `${gcalFmt(s)}/${gcalFmt(end)}`
            }
            const q = new URLSearchParams({ text: item.name, dates, details: `Onboarding ${form.collaboratorName} — ${item.name}` })
            if (item.attendeeEmails.length > 0) q.set('add', item.attendeeEmails.join(','))
            return `https://calendar.google.com/calendar/r/eventedit?${q}`
          }

          const timedMissingTime = calItems.some(item => item.durationMinutes !== 0 && !eventTimes[item.id])

          return (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {calItems.length > 0 ? (
                  <>
                    <p className="text-xs text-gray-500">
                      Se detectaron <span className="font-semibold text-purple-700">{calItems.length} evento{calItems.length !== 1 ? 's' : ''}</span> de calendario para este proceso.
                      {timedMissingTime && <span className="ml-1 text-amber-600 font-medium">Eventos con duración requieren horario obligatorio.</span>}
                    </p>

                    <CalendarPreview items={finalItems} eventTimes={eventTimes} />

                    <div className="space-y-2">
                      {calItems.map(item => {
                        const allDay = item.durationMinutes === 0
                        const label  = item.start.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
                        const isOpen = expandedEventId === item.id
                        const missingTime = !allDay && !eventTimes[item.id]
                        return (
                          <div key={item.id} className={`border rounded-xl overflow-hidden ${missingTime ? 'border-amber-300' : 'border-purple-100'}`}>
                            <div className={`flex items-center gap-2 px-3 py-2.5 ${missingTime ? 'bg-amber-50' : 'bg-purple-50/60'}`}>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${missingTime ? 'text-amber-900' : 'text-purple-900'}`}>
                                  {item.parentName ?? item.name}
                                </p>
                                {item.parentName && (
                                  <p className="text-[10px] text-gray-400 truncate">({item.name})</p>
                                )}
                                <p className={`text-[10px] mt-0.5 ${missingTime ? 'text-amber-500' : 'text-purple-400'}`}>
                                  {label}
                                  <span className="ml-1 font-semibold">{item.dayOffset < 0 ? `Día ${item.dayOffset}` : item.dayOffset === 0 ? 'Día 0' : `Día +${item.dayOffset}`}</span>
                                  {' · '}{allDay ? 'Día completo' : `${item.durationMinutes} min`}
                                  {item.attendeeEmails.length > 0 && ` · ${item.attendeeEmails.length} invitado${item.attendeeEmails.length !== 1 ? 's' : ''}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setExpandedEventId(isOpen ? null : item.id)}
                                  className="text-[10px] text-purple-500 hover:text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 hover:border-purple-300 transition-colors"
                                >
                                  {isOpen ? 'Cerrar' : 'Editar'}
                                </button>
                                <a href={makeUrl(item)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-purple-600 hover:underline">
                                  <Calendar size={10} /> Abrir
                                </a>
                              </div>
                            </div>

                            {/* Hora obligatoria para eventos con duración */}
                            {!allDay && (
                              <div className={`px-3 py-2 border-t flex items-center gap-2 ${missingTime ? 'border-amber-200 bg-amber-50/60' : 'border-purple-50 bg-white'}`}>
                                <span className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${missingTime ? 'text-amber-600' : 'text-gray-500'}`}>
                                  Hora{missingTime ? ' *' : ''}
                                </span>
                                <input
                                  type="time"
                                  value={eventTimes[item.id] ?? ''}
                                  onChange={e => setEventTimes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className={`px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 ${missingTime ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-purple-400'}`}
                                />
                              </div>
                            )}

                            {isOpen && (() => {
                              const checkedIds = eventExtraProfileIds[item.id] ?? item.attendeeProfileIds
                              return (
                                <div className="px-3 py-3 border-t border-purple-100 bg-white">
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Invitados
                                    <span className="ml-1 normal-case font-normal text-purple-500">({checkedIds.length} seleccionados)</span>
                                  </p>
                                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 py-0.5 px-1">
                                    {(profiles as Profile[]).map(pr => {
                                      const checked = checkedIds.includes(pr.id)
                                      return (
                                        <label key={pr.id} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-purple-50 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={e => {
                                              const newIds = e.target.checked
                                                ? [...checkedIds, pr.id]
                                                : checkedIds.filter(id => id !== pr.id)
                                              setEventExtraProfileIds(prev => ({ ...prev, [item.id]: newIds }))
                                            }}
                                            className="w-3 h-3 rounded accent-purple-600 flex-shrink-0"
                                          />
                                          <span className="text-[10px] text-gray-700 flex-1">{pr.name}</span>
                                          <span className="text-[10px] text-gray-400 truncate max-w-[160px]">{pr.email}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400">
                    Este proceso no tiene eventos de calendario.
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <button onClick={() => setShowCalendar(false)} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  <ChevronLeft size={14} /> Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={timedMissingTime || createOnboarding.isPending}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {createOnboarding.isPending
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando...</>
                    : <><Rocket size={14} /> Crear proceso</>
                  }
                </button>
              </div>
            </div>
          )
        })()}

        {/* Body — paso 1 */}
        {!showCalendar && <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── Alerta: proceso activo duplicado ── */}
          {duplicateProcessId && !matchedEmployee && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Este colaborador ya tiene un proceso activo</p>
                <p className="text-xs text-amber-600 mt-0.5">No se puede crear un nuevo proceso mientras el anterior esté en curso.</p>
                <button onClick={() => { onCreated(duplicateProcessId); onClose() }}
                  className="mt-1.5 text-xs font-medium text-blue-600 hover:underline">Ver proceso activo →</button>
              </div>
            </div>
          )}

          {/* ── Sección: Identidad (obligatoria) ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Identidad</p>
            <div className="grid grid-cols-2 gap-4">
              {/* RUT con búsqueda — sin campo manual */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  RUT <span className="text-red-400">*</span>
                  <span className="ml-2 font-normal text-gray-400">(busca el colaborador en el sistema)</span>
                </label>
                {matchedEmployee ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <UserCheck size={14} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{matchedEmployee.name}</p>
                      <p className="text-[10px] text-green-600">{matchedEmployee.rut} · {matchedEmployee.position ?? '—'}</p>
                    </div>
                    <button onClick={clearEmployee} className="p-1 text-green-500 hover:text-green-800"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input autoFocus type="text" placeholder="Buscar por RUT o nombre (mín. 2 caracteres)..."
                      value={rutSearch} onChange={e => { setRutSearch(e.target.value); setDuplicateProcessId(null) }}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {searchFetching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                    {/* Resultados */}
                    {rutSearch.length >= 2 && !searchFetching && employeeResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {employeeResults.map((emp: any) => (
                          <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 uppercase">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-gray-400">{emp.rut} · {emp.jobTitle ?? '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Sin resultados */}
                    {rutSearch.length >= 2 && !searchFetching && employeeResults.length === 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-amber-200 rounded-lg shadow-lg overflow-hidden">
                        <div className="flex items-start gap-2.5 px-4 py-3">
                          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Colaborador no encontrado</p>
                            <p className="text-xs text-amber-600 mt-0.5">Debe crear la ficha en Colaboradores primero.</p>
                            <a href="/colaboradores" target="_blank" rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                              Ir a Colaboradores <ChevronRight size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre completo <span className="text-red-400">*</span></label>
                <input type="text" placeholder="Ej: Juan Pérez Soto" value={form.collaboratorName}
                  onChange={e => field('collaboratorName', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo <span className="text-red-400">*</span></label>
                <input type="email" placeholder="juan.perez@surmedia.cl" value={form.collaboratorEmail}
                  onChange={e => field('collaboratorEmail', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!form.collaboratorEmail ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email personal</label>
                <input type="email" placeholder="juan.perez@gmail.com" value={form.collaboratorPersonalEmail}
                  onChange={e => field('collaboratorPersonalEmail', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
                <input type="text" placeholder="+56 9 XXXX XXXX" value={form.collaboratorPhone}
                  onChange={e => field('collaboratorPhone', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo <span className="text-red-400">*</span></label>
                {positionMode === 'select' ? (
                  <select value={form.collaboratorPosition}
                    onChange={e => { if (e.target.value === '__otro__') { setPositionMode('custom'); field('collaboratorPosition', '') } else { field('collaboratorPosition', e.target.value) } }}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!form.collaboratorPosition ? 'border-gray-300' : 'border-gray-200'}`}>
                    <option value="">Seleccionar cargo...</option>
                    {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__otro__">Otro (ingresar manualmente)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus type="text" placeholder="Ej: Diseñador Gráfico" value={form.collaboratorPosition}
                      onChange={e => field('collaboratorPosition', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={() => { setPositionMode('select'); field('collaboratorPosition', '') }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg">Lista</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa <span className="text-red-400">*</span></label>
                <select value={form.legalEntity} onChange={e => field('legalEntity', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!form.legalEntity ? 'border-gray-300' : 'border-gray-200'}`}>
                  <option value="">Seleccionar empresa...</option>
                  <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
                  <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso <span className="text-red-400">*</span></label>
                <input type="date" value={form.startDate} onChange={e => field('startDate', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!form.startDate ? 'border-gray-300' : 'border-gray-200'}`} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Centro de Trabajo <span className="text-red-400">*</span></label>
                <select value={form.costCenter} onChange={e => field('costCenter', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${!form.costCenter ? 'border-gray-300' : 'border-gray-200'}`}>
                  <option value="">Seleccionar centro...</option>
                  {workCenters.map(wc => <option key={wc.id} value={wc.name}>{wc.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Sección: Datos personales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos personales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Segundo apellido</label>
                <input type="text" placeholder="Segundo apellido" value={form.segundoApellido}
                  onChange={e => field('segundoApellido', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de nacimiento</label>
                <input type="date" value={form.birthDate} onChange={e => field('birthDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sexo</label>
                <select value={form.gender} onChange={e => field('gender', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nacionalidad</label>
                <input type="text" placeholder="Chilena" value={form.nationality}
                  onChange={e => field('nationality', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Ciudad</label>
                <input type="text" placeholder="Santiago" value={form.city}
                  onChange={e => field('city', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Comuna</label>
                <input type="text" placeholder="Providencia" value={form.commune}
                  onChange={e => field('commune', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Dirección</label>
                <input type="text" placeholder="Av. Providencia 1234, depto 501" value={form.address}
                  onChange={e => field('address', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* ── Sección: Datos laborales adicionales ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos laborales</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Familia de cargo</label>
                <input type="text" placeholder="Ej: Tecnología" value={form.jobFamily}
                  onChange={e => field('jobFamily', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de contrato</label>
                <select value={form.contractType} onChange={e => field('contractType', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="INDEFINIDO">Indefinido</option>
                  <option value="PLAZO_FIJO">Plazo fijo</option>
                  <option value="HONORARIOS">Honorarios</option>
                  <option value="PRACTICA">Práctica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha ingreso empresa</label>
                <input type="date" value={form.companyStartDate} onChange={e => field('companyStartDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha vencimiento contrato</label>
                <input type="date" value={form.contractEndDate} onChange={e => field('contractEndDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Jornada laboral</label>
                <input type="text" placeholder="Mensual 40 hrs. (L, M, M, J, V)" value={form.workSchedule}
                  onChange={e => field('workSchedule', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Distribución de jornada</label>
                <input type="text" placeholder="Lunes a Viernes" value={form.distribucionJornada}
                  onChange={e => field('distribucionJornada', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre supervisor</label>
                <input type="text" placeholder="Nombre del supervisor" value={form.supervisorName}
                  onChange={e => field('supervisorName', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo supervisor</label>
                <input type="text" placeholder="Cargo del supervisor" value={form.supervisorTitle}
                  onChange={e => field('supervisorTitle', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Vínculo</label>
                <select value={form.vinculo} onChange={e => field('vinculo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="Planta">Planta</option>
                  <option value="Reemplazo">Reemplazo</option>
                </select>
              </div>
              {form.vinculo === 'Reemplazo' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Reemplaza a <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Nombre de quien o quienes reemplaza" value={form.reemplazaA}
                    onChange={e => field('reemplazaA', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
          </div>

          {/* ── Sección: Previsión social ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Previsión social</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">AFP</label>
                <input type="text" placeholder="Ej: Modelo, Habitat" value={form.afp}
                  onChange={e => field('afp', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fonasa / Isapre</label>
                <input type="text" placeholder="Ej: Fonasa, Banmédica" value={form.isapre}
                  onChange={e => field('isapre', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* ── Sección: Datos bancarios ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Datos bancarios</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Banco</label>
                <input type="text" placeholder="Ej: Banco Estado" value={form.banco}
                  onChange={e => field('banco', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de cuenta</label>
                <select value={form.tipoCuenta} onChange={e => field('tipoCuenta', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="Cuenta Vista">Cuenta Vista</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                  <option value="Cuenta RUT">Cuenta RUT</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Número de cuenta</label>
                <input type="text" placeholder="Ej: 00012345678" value={form.numeroCuenta}
                  onChange={e => field('numeroCuenta', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* ── Notas internas ── */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
            <textarea rows={2} placeholder="Información relevante para el proceso..." value={form.notes}
              onChange={e => field('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Hitos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hitos del proceso</p>
            {templateLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Cargando hitos…
              </div>
            ) : templateError ? (
              <div className="py-4 text-sm text-red-500 flex items-center gap-2">
                Error cargando hitos.
                <button onClick={() => refetchTemplate()} className="underline text-blue-600">Reintentar</button>
              </div>
            ) : (
              <div className="space-y-4">
                {PERIOD_ORDER.map(period => {
                  const tasks = byPeriod.get(period) ?? []
                  if (tasks.length === 0) return null
                  const allOn = tasks.every(t => selected.has(t.key))
                  return (
                    <div key={period}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PERIOD_COLORS[period]}`}>{PERIOD_LABELS[period]}</span>
                        <button onClick={() => togglePeriod(period)} className="text-xs text-blue-600 hover:text-blue-800">
                          {allOn ? 'Quitar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {tasks.map(task => (
                          <label key={task.key} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                            selected.has(task.key) ? 'bg-blue-50 border-blue-100' : 'border-transparent hover:bg-gray-50'
                          }`}>
                            <input type="checkbox" checked={selected.has(task.key)} onChange={() => toggle(task.key)}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${selected.has(task.key) ? 'text-gray-900' : 'text-gray-500'}`}>{task.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <AutoBadge type={task.automationType as TaskAutomationType} />
                                {task.taskType === 'FECHA_ESPECIFICA' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Fecha específica</span>
                                )}
                                {task.appliesWhen && <span className="text-[10px] text-gray-400 italic">{task.appliesWhen}</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>}

        {/* Footer paso 1 */}
        {!showCalendar && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={() => setShowCalendar(true)}
            disabled={
              !matchedEmployee ||
              !form.collaboratorName.trim() || !form.legalEntity ||
              !form.collaboratorEmail.trim() || !form.collaboratorPosition.trim() ||
              !form.costCenter || !form.startDate ||
              selected.size === 0
            }
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronRight size={14} /> Continuar
          </button>
        </div>}
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [tab, setTab]                         = useState<'procesos' | 'hitos' | 'automatizacion'>('procesos')
  const [drawerProcessId, setDrawerProcessId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal]       = useState(false)
  const [filterStatus, setFilterStatus]       = useState<string>('IN_PROGRESS')

  const { data: processes, isLoading, isError } = useOnboardingProcesses()
  const { data: stats } = useOnboardingStats()

  const filtered = (processes ?? []).filter(p =>
    filterStatus === 'ALL' ? true : p.status === filterStatus
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de ingreso — primeros 90 días</p>
        </div>
        {tab === 'procesos' && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nuevo proceso
          </button>
        )}
      </div>

      {/* Tabs principales */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          ['procesos',      'Procesos'],
          ['hitos',         'Hitos'],
          ['automatizacion','Automatización'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Hitos ── */}
      {tab === 'hitos' && <HitosTab />}

      {/* ── Tab: Automatización ── */}
      {tab === 'automatizacion' && <AutomatizacionTab />}

      {/* ── Tab: Procesos ── */}
      {tab === 'procesos' && <>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'En proceso',    value: stats?.inProgress    ?? '—', icon: <Rocket size={18} />,        color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Completados',   value: stats?.completed     ?? '—', icon: <CheckCircle2 size={18} />,  color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Por finalizar', value: stats?.finalizingSoon ?? '—', icon: <AlertTriangle size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cancelados',    value: stats?.cancelled     ?? '—', icon: <X size={18} />,             color: 'text-gray-500',  bg: 'bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { value: 'IN_PROGRESS', label: 'En proceso' },
          { value: 'COMPLETED',   label: 'Completados' },
          { value: 'CANCELLED',   label: 'Cancelados' },
          { value: 'ALL',         label: 'Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterStatus === f.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <AlertTriangle size={32} />
            <p className="text-sm">Error cargando datos. Intenta nuevamente.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Rocket size={40} className="opacity-30" />
            <p className="text-sm font-medium">
              No hay procesos {filterStatus === 'IN_PROGRESS' ? 'activos' : 'en esta categoría'}
            </p>
            {filterStatus === 'IN_PROGRESS' && (
              <button onClick={() => setShowNewModal(true)} className="text-sm text-blue-600 hover:underline">
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Ingreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Día</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Progreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(process => {
                const progress   = calcProgress(process)
                const days       = daysIn(process.startDate)
                const shortName  = ENTITY_LABEL[process.legalEntity ?? ''] ?? '—'
                const avatarText = initials(process.collaboratorName)

                return (
                  <tr
                    key={process.id}
                    onClick={() => setDrawerProcessId(process.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0 uppercase">
                          {avatarText}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{process.collaboratorName}</p>
                          <p className="text-xs text-gray-400">{process.collaboratorPosition ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{shortName}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell whitespace-nowrap">
                      {fmt(process.startDate)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${days > 90 ? 'text-amber-600' : 'text-gray-600'}`}>
                        Día {days}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#3b82f6' }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{STATUS_BADGE[process.status]}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerProcessId && (
        <OnboardingDrawer processId={drawerProcessId} onClose={() => setDrawerProcessId(null)} />
      )}
      {showNewModal && (
        <NewProcessModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setDrawerProcessId(id); setShowNewModal(false) }}
          processes={processes ?? []}
        />
      )}
      </>}
    </div>
  )
}
