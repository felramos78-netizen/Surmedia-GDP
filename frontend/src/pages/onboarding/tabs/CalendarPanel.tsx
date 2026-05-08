import React, { useMemo, useState } from 'react'
import { Calendar, ExternalLink, Plus } from 'lucide-react'
import type { OnboardingProcess } from '@/types'

// ─── Helpers Google Calendar ──────────────────────────────────────────────────

function gcalDate(date: Date): string {
  // Formato YYYYMMDDTHHmmss (hora local)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  )
}

function buildGCalUrl(opts: {
  title:       string
  startDate:   Date
  durationMin: number
  description: string
  attendees:   string[]
}) {
  const end = new Date(opts.startDate.getTime() + opts.durationMin * 60_000)
  const params = new URLSearchParams({
    text:    opts.title,
    dates:   `${gcalDate(opts.startDate)}/${gcalDate(end)}`,
    details: opts.description,
  })
  if (opts.attendees.length > 0) params.set('add', opts.attendees.join(','))
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`
}

// ─── Eventos programados desde procesos activos ───────────────────────────────

interface CalEvent {
  processId:   string
  procName:    string
  procEmail:   string | null
  taskName:    string
  taskTitle:   string
  eventDate:   Date
  duration:    number
  attendees:   string[]
  completed:   boolean
}

function extractCalendarEvents(processes: OnboardingProcess[]): CalEvent[] {
  const events: CalEvent[] = []
  processes
    .filter(p => p.status === 'IN_PROGRESS')
    .forEach(proc => {
      const start = new Date(proc.startDate)
      proc.tasks
        .filter((t: any) => t.automationType === 'CALENDAR' && t.automationConfig)
        .forEach((t: any) => {
          const cfg = t.automationConfig as {
            title: string; daysFromStart: number; durationMinutes: number; attendees?: string[]
          }
          const eventDate = new Date(start)
          eventDate.setDate(eventDate.getDate() + (cfg.daysFromStart ?? 0))
          eventDate.setHours(9, 0, 0, 0)

          const title = cfg.title.replace('{collaboratorName}', proc.collaboratorName)
          events.push({
            processId: proc.id,
            procName:  proc.collaboratorName,
            procEmail: proc.collaboratorEmail ?? null,
            taskName:  t.name,
            taskTitle: title,
            eventDate,
            duration:  cfg.durationMinutes ?? 60,
            attendees: proc.collaboratorEmail ? [proc.collaboratorEmail] : [],
            completed: !!t.completedAt,
          })
        })
    })
  events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
  return events
}

// ─── Creador de evento ad-hoc ─────────────────────────────────────────────────

function AdHocEventCreator() {
  const [form, setForm] = useState({
    title: '', date: '', time: '09:00', durationMin: 60, description: '', attendees: '',
  })

  const f = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }))

  const gcalUrl = useMemo(() => {
    if (!form.title || !form.date) return null
    const [y, mo, d] = form.date.split('-').map(Number)
    const [h, mi]    = form.time.split(':').map(Number)
    const startDate  = new Date(y, mo - 1, d, h, mi)
    return buildGCalUrl({
      title:       form.title,
      startDate,
      durationMin: Number(form.durationMin),
      description: form.description,
      attendees:   form.attendees.split(',').map(s => s.trim()).filter(Boolean),
    })
  }, [form])

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Crear evento ad-hoc</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">Título</label>
          <input
            value={form.title}
            onChange={e => f('title', e.target.value)}
            placeholder="Ej: Reunión de bienvenida"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Fecha</label>
          <input type="date" value={form.date} onChange={e => f('date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Hora de inicio</label>
          <input type="time" value={form.time} onChange={e => f('time', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Duración (min)</label>
          <input type="number" value={form.durationMin} onChange={e => f('durationMin', Number(e.target.value))} min={15} step={15}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Asistentes (emails, separados por coma)</label>
          <input value={form.attendees} onChange={e => f('attendees', e.target.value)}
            placeholder="juan@surmedia.cl, rrhh@surmedia.cl"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-500 block mb-1">Descripción</label>
          <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>
      <div className="mt-4">
        <a
          href={gcalUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            gcalUrl
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
          }`}
        >
          <ExternalLink size={14} />
          Abrir en Google Calendar
        </a>
        {!gcalUrl && <p className="text-xs text-gray-400 mt-1.5">Completa título y fecha para generar el enlace.</p>}
      </div>
    </div>
  )
}

// ─── Panel principal Calendar ─────────────────────────────────────────────────

interface Props {
  processes: OnboardingProcess[]
}

export default function CalendarPanel({ processes }: Props) {
  const events = useMemo(() => extractCalendarEvents(processes), [processes])
  const now    = new Date()

  const upcoming = events.filter(e => e.eventDate >= now && !e.completed)
  const past     = events.filter(e => e.eventDate < now  || e.completed)

  const fmtDate = (d: Date) => d.toLocaleDateString('es-CL', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Próximos eventos', value: upcoming.length,  color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Completados',      value: events.filter(e => e.completed).length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Procesos activos', value: processes.filter(p => p.status === 'IN_PROGRESS').length, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.bg} ${s.color} flex items-center justify-center`}>
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso SMTP */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-lg flex items-start gap-2">
        <Calendar size={14} className="mt-0.5 flex-shrink-0" />
        <p>La integración con Google Calendar no está configurada. Los enlaces generados abren Google Calendar con los datos pre-rellenados para que los agregues manualmente.</p>
      </div>

      {/* Tabla de eventos programados */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Eventos programados</h3>
            <p className="text-xs text-gray-400 mt-0.5">Basados en procesos activos y sus hitos de tipo Calendar</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
            <Calendar size={28} className="opacity-30" />
            <p className="text-sm">Sin eventos programados. Crea procesos con hitos de tipo Calendar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Evento</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Colaborador</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Duración</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...upcoming, ...past].map((ev, i) => (
                <tr key={i} className={`hover:bg-gray-50 transition-colors ${ev.completed ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium text-gray-800">{ev.taskTitle}</p>
                    <p className="text-xs text-gray-400">{ev.taskName}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-gray-700">{ev.procName}</p>
                    {ev.procEmail && <p className="text-xs text-gray-400">{ev.procEmail}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-gray-700">{fmtDate(ev.eventDate)}</p>
                    <p className={`text-xs ${ev.eventDate < now ? 'text-gray-400' : 'text-blue-600'}`}>
                      {ev.eventDate < now ? 'Pasado' : `En ${Math.ceil((ev.eventDate.getTime() - now.getTime()) / 86_400_000)} días`}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{ev.duration} min</td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={buildGCalUrl({
                        title:       ev.taskTitle,
                        startDate:   ev.eventDate,
                        durationMin: ev.duration,
                        description: `Onboarding de ${ev.procName} — ${ev.taskName}`,
                        attendees:   ev.attendees,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                      <ExternalLink size={11} /> Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Creador ad-hoc */}
      <AdHocEventCreator />
    </div>
  )
}
