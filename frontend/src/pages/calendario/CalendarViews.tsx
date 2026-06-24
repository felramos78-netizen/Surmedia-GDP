import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  type CalEvent, TYPE_LABELS,
  parseDate, isSameDay, getCalendarWeeks, getWeekDays, assignLanes,
} from './calendarUtils'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const LANE_H = 21   // alto de cada carril (barra + separación)
const BAR_H  = 18   // alto visible de la barra/pill dentro del carril
const HDR_H  = 28   // espacio reservado arriba para el número de día

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
            className={`border-r border-gray-100 cursor-pointer hover:bg-brand-50/30 transition-colors ${
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
                isToday ? 'bg-brand-600 text-white' :
                isCurMonth ? 'text-gray-700' : 'text-gray-400'
              }`}>
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Overflow "+X más" — clickable, navega al día */}
      {maxLanes !== null && (
        <div className="absolute inset-0 grid grid-cols-7">
          {overflowByCol.map((count, col) =>
            count > 0 ? (
              <div key={col} className="flex items-end pb-1 px-1">
                <button
                  onClick={e => { e.stopPropagation(); onDayClick(weekDays[col]) }}
                  className="text-[10px] text-gray-500 font-semibold px-1.5 py-0.5 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  +{count} más
                </button>
              </div>
            ) : <div key={col} className="pointer-events-none" />
          )}
        </div>
      )}

      {/* Event bars — barras sólidas de color estilo BUK */}
      {visible.map((ev, i) => {
        const pct   = 100 / 7
        const top   = HDR_H + ev.lane * LANE_H
        const left  = `calc(${ev.startCol * pct}% + 3px)`
        const width = `calc(${(ev.endCol - ev.startCol + 1) * pct}% - 6px)`
        const br    = ev.isStart && ev.isEnd ? '5px' :
                      ev.isStart ? '5px 0 0 5px' :
                      ev.isEnd   ? '0 5px 5px 0' : '0'
        return (
          <div
            key={i}
            className="absolute flex items-center px-1.5 text-white text-[11px] font-medium leading-none truncate cursor-pointer hover:brightness-105 transition-all select-none"
            style={{ top, left, width, height: BAR_H, backgroundColor: ev.event.color, borderRadius: br }}
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

export function MonthView({ events, currentDate, onEventClick, onDayClick }: {
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
            currentMonth={month} maxLanes={null}
            onEventClick={onEventClick} onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}

// ── WeekView ──────────────────────────────────────────────────────────────────

export function WeekView({ events, currentDate, onEventClick, onDayClick }: {
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
                isToday ? 'bg-brand-600 text-white' : 'text-gray-700'
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

export function DayView({ events, currentDate, onEventClick }: {
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
