// Drawer del proceso de onboarding. Las constantes, helpers, modales y filas de
// hito viven en archivos sibling: onboardingShared, onboardingModals,
// OnboardingTaskRow y EditProcessModal.
import { useState } from 'react'
import { X, Clock, Building2, CalendarDays, AlertTriangle, Mail, Plus, Trash2, Pencil, ListChecks, Download } from 'lucide-react'
import { useOnboardingProcess, useUpdateOnboardingStatus, useDeleteOnboarding } from '@/hooks/useOnboarding'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { OnboardingPeriod, OnboardingTask } from '@/types'
import { PERIOD_ORDER, PERIOD_META, daysIn, fmt, buildProcessICS, downloadICS } from './onboardingShared'
import { TaskRow, AddTaskForm } from './OnboardingTaskRow'
import { EditProcessModal } from './EditProcessModal'

interface Props {
  processId: string
  onClose: () => void
}

export default function OnboardingDrawer({ processId, onClose }: Props) {
  useEscapeKey(onClose)
  const { data: process, isLoading } = useOnboardingProcess(processId)
  const updateStatus  = useUpdateOnboardingStatus()
  const deleteProcess = useDeleteOnboarding()
  const [activeTab,    setActiveTab]    = useState<'progreso'>('progreso')
  const [addingPeriod, setAddingPeriod] = useState<OnboardingPeriod | null>(null)
  const [showEdit,     setShowEdit]     = useState(false)

  if (isLoading || !process) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative z-50 w-full max-w-xl bg-white shadow-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const tasks = [...process.tasks].sort((a, b) => {
    const pi = PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
    return pi !== 0 ? pi : a.sortOrder - b.sortOrder
  })

  const total     = tasks.length
  const completed = tasks.filter(t => t.completedAt).length
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0
  const days      = daysIn(process.startDate)
  const canEdit   = process.status === 'IN_PROGRESS'

  const tasksByPeriod = PERIOD_ORDER.reduce<Record<OnboardingPeriod, OnboardingTask[]>>(
    (acc, p) => { acc[p] = tasks.filter(t => t.period === p); return acc },
    {} as any
  )

  const legalEntityLabel = process.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones'
    : process.legalEntity === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : null

  return (
    <>
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
              {(process.collaboratorName ?? '?').split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('')}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{process.collaboratorName}</p>
              <p className="text-xs text-gray-400">{process.collaboratorPosition ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const ics = buildProcessICS(process)
                downloadICS(ics, `onboarding-${(process.collaboratorName ?? 'proceso').replace(/\s+/g, '-')}.ics`)
              }}
              title="Descargar ICS"
              aria-label="Descargar ICS"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Download size={15} />
            </button>
            <button
              onClick={() => setShowEdit(true)}
              title="Editar proceso"
              aria-label="Editar proceso"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Pencil size={15} />
            </button>
            <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
          {legalEntityLabel && <span className="flex items-center gap-1"><Building2 size={11} />{legalEntityLabel}</span>}
          {process.collaboratorEmail && <span className="flex items-center gap-1"><Mail size={11} />{process.collaboratorEmail}</span>}
          <span className="flex items-center gap-1"><CalendarDays size={11} />Ingreso {fmt(process.startDate)}</span>
          <span className="flex items-center gap-1"><Clock size={11} />Día {days} de 90</span>
          {{
            IN_PROGRESS: <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">En proceso</span>,
            COMPLETED:   <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Completado</span>,
            CANCELLED:   <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Cancelado</span>,
          }[process.status]}
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progreso general</span>
            <span className="font-semibold text-gray-800">{completed}/{total} hitos · {progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#3b82f6' }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4">
          <button
            onClick={() => setActiveTab('progreso')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 border-brand-600 text-brand-700"
          >
            <ListChecks size={13} /> Progreso
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'progreso' && (
            <div className="space-y-5">
              {PERIOD_ORDER.map(period => {
                const periodTasks = tasksByPeriod[period]
                const meta   = PERIOD_META[period]
                const done   = periodTasks.filter(t => t.completedAt).length
                const automated = periodTasks.filter(t => t.automationStatus === 'SUCCESS').length

                return (
                  <div key={period}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.bgClass} ${meta.colorClass}`}>
                        {meta.label}
                        <span className="font-normal opacity-60">{meta.range}</span>
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {automated > 0 && <span>{automated} auto</span>}
                        <span>{done}/{periodTasks.length}</span>
                      </div>
                    </div>

                    {periodTasks.map(task => (
                      <TaskRow key={task.id} task={task} processId={process.id} process={process} canEdit={canEdit} />
                    ))}

                    {canEdit && (
                      addingPeriod === period ? (
                        <AddTaskForm
                          processId={process.id}
                          period={period}
                          existingTemplateIds={tasks.map(t => t.templateId).filter((k): k is string => !!k)}
                          onDone={() => setAddingPeriod(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingPeriod(period)}
                          className="flex items-center gap-1 text-xs text-gray-300 hover:text-brand-400 mt-1 px-2 py-1 transition-colors"
                        >
                          <Plus size={11} /> Agregar hito
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
          {process.status === 'IN_PROGRESS' && days > 95 && (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle size={12} />Proceso extendido ({days} días)
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            {process.status === 'IN_PROGRESS' && (
              <button
                onClick={() => { if (confirm('¿Cancelar este proceso de onboarding?')) { updateStatus.mutate({ id: process.id, status: 'CANCELLED' }); onClose() } }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Cancelar proceso
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`¿Eliminar permanentemente el proceso de ${process.collaboratorName ?? 'este colaborador'}? Esta acción no se puede deshacer.`)) {
                  deleteProcess.mutate(process.id, { onSuccess: onClose })
                }
              }}
              disabled={deleteProcess.isPending}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <Trash2 size={12} />
              {deleteProcess.isPending ? 'Eliminando…' : 'Eliminar proceso'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de edición */}
    {showEdit && (
      <EditProcessModal process={process} onClose={() => setShowEdit(false)} />
    )}
    </>
  )
}
