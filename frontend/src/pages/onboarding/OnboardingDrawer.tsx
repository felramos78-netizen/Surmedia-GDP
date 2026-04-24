import { X, CheckCircle2, Circle, Clock, Building2, Briefcase, CalendarDays, AlertTriangle } from 'lucide-react'
import { useOnboardingProcess, useToggleTask, useUpdateOnboardingStatus } from '@/hooks/useOnboarding'
import type { OnboardingPeriod, OnboardingTask } from '@/types'

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_META: Record<OnboardingPeriod, { label: string; range: string; color: string; bg: string; dot: string }> = {
  PRE_INGRESO: { label: 'Pre-ingreso',    range: 'Día -7 a Día 0',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200',  dot: 'bg-purple-400' },
  DIA_1:       { label: 'Día 1 — Ingreso', range: 'Fecha de ingreso', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',      dot: 'bg-blue-400' },
  SEMANA_1:    { label: 'Primera semana', range: 'Días 1 – 7',       color: 'text-cyan-700',   bg: 'bg-cyan-50 border-cyan-200',      dot: 'bg-cyan-400' },
  MES_1:       { label: 'Primer mes',     range: 'Días 7 – 30',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200',    dot: 'bg-green-400' },
  EVALUACION:  { label: 'Evaluación',     range: 'Días 60 – 90',     color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-400' },
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysIn(startDate: string) {
  return Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
}

interface Props {
  processId: string
  onClose: () => void
}

export default function OnboardingDrawer({ processId, onClose }: Props) {
  const { data: process, isLoading } = useOnboardingProcess(processId)
  const toggleTask = useToggleTask()
  const updateStatus = useUpdateOnboardingStatus()

  if (isLoading || !process) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative z-50 w-full max-w-xl bg-white shadow-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const emp = process.employee!
  const tasks = [...process.tasks].sort((a, b) => {
    const pi = PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
    return pi !== 0 ? pi : a.sortOrder - b.sortOrder
  })

  const totalTasks     = tasks.length
  const completedTasks = tasks.filter(t => t.completedAt).length
  const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const days           = daysIn(process.startDate)

  const tasksByPeriod = PERIOD_ORDER.reduce<Record<OnboardingPeriod, OnboardingTask[]>>(
    (acc, p) => { acc[p] = tasks.filter(t => t.period === p); return acc },
    {} as any
  )

  const handleToggle = (task: OnboardingTask) => {
    toggleTask.mutate({ processId: process.id, taskId: task.id, completed: !task.completedAt })
  }

  const handleCancel = () => {
    if (confirm('¿Cancelar este proceso de onboarding?')) {
      updateStatus.mutate({ id: process.id, status: 'CANCELLED' })
      onClose()
    }
  }

  const statusBadge = {
    IN_PROGRESS: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En proceso</span>,
    COMPLETED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span>,
    CANCELLED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Cancelado</span>,
  }[process.status]

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
              {emp.firstName[0]}{emp.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
              <p className="text-xs text-gray-500">{emp.position?.title ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Meta row */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Building2 size={12} /> {(emp as any).contracts?.[0]?.legalEntity?.replace(/_/g, ' ') ?? '—'}</span>
          <span className="flex items-center gap-1"><CalendarDays size={12} /> Ingreso {fmt(process.startDate)}</span>
          <span className="flex items-center gap-1"><Clock size={12} /> Día {days} de 90</span>
          <span className="flex items-center gap-1"><Briefcase size={12} /> Fin esperado {fmt(process.expectedEndDate)}</span>
          {statusBadge}
        </div>

        {/* Progress bar */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progreso general</span>
            <span className="text-sm font-semibold text-gray-900">{completedTasks}/{totalTasks} hitos</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? '#16a34a' : '#3b82f6',
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress}% completado</p>
        </div>

        {/* Checklist */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {PERIOD_ORDER.map(period => {
            const periodTasks = tasksByPeriod[period]
            if (!periodTasks.length) return null

            const meta    = PERIOD_META[period]
            const done    = periodTasks.filter(t => t.completedAt).length
            const pct     = Math.round((done / periodTasks.length) * 100)

            return (
              <div key={period}>
                {/* Period header */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${meta.bg} ${meta.color}`}>
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                    <span className="font-normal opacity-70">{meta.range}</span>
                  </div>
                  <span className="text-xs text-gray-400">{done}/{periodTasks.length}</span>
                </div>

                {/* Period progress bar */}
                <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-current rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {periodTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleToggle(task)}
                      disabled={process.status !== 'IN_PROGRESS' || toggleTask.isPending}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group disabled:cursor-default"
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${task.completedAt ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
                        {task.completedAt ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${task.completedAt ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.tool && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{task.tool}</span>
                          )}
                          {task.appliesWhen && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{task.appliesWhen}</span>
                          )}
                          {task.completedAt && (
                            <span className="text-xs text-gray-400">
                              {new Date(task.completedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer actions */}
        {process.status === 'IN_PROGRESS' && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            {days > 95 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle size={13} />
                Proceso extendido ({days} días)
              </div>
            )}
            <div className="ml-auto">
              <button
                onClick={handleCancel}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Cancelar proceso
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
