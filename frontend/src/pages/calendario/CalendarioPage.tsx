import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarPlus, Mail } from 'lucide-react'
import api from '@/lib/api'
import EmailRulesDrawer from './EmailRulesDrawer'
import {
  type CalEvent, type ViewType, FILTER_GROUPS,
  getCalendarWeeks, getWeekDays, toDateStr, getHeaderLabel, navigateDate, useCalendarEvents, EMPTY_EVENTS,
} from './calendarUtils'
import { MonthView, WeekView, DayView } from './CalendarViews'
import { EventDetailModal } from './EventDetailModal'
import { ProfileCalendarModal } from './ProfileCalendarModal'
import { FilterPanel, type OnboardingProcessSummary } from './FilterPanel'

// ── Página principal ──────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [view, setView]               = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [activeGroups, setActiveGroups] = useState<Set<string>>(
    () => new Set(FILTER_GROUPS.map(g => g.key)),
  )
  const [selectedEvent, setSelectedEvent]       = useState<CalEvent | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showEmailRules, setShowEmailRules]     = useState(false)
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

  const { data: events = EMPTY_EVENTS, isLoading } = useCalendarEvents(start, end)

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
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        )}

        <button
          onClick={() => setShowEmailRules(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          title="Gestionar correos automáticos de cumpleaños y aniversarios"
        >
          <Mail size={15} />
          <span className="hidden sm:inline">Correos</span>
        </button>

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

      {/* ── Drawer de correos automáticos ── */}
      {showEmailRules && (
        <EmailRulesDrawer onClose={() => setShowEmailRules(false)} />
      )}
    </div>
  )
}
