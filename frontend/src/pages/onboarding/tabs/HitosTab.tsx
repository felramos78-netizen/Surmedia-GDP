import React, { useState, useMemo } from 'react'
import { CheckCircle2, Circle, Eye, EyeOff, Edit2, Check, X } from 'lucide-react'
import { useTemplateTasks, useUpdateTemplateTask, useOnboardingProcesses } from '@/hooks/useOnboarding'
import type { OnboardingDbTemplateTask, OnboardingPeriod, TaskAutomationType } from '@/types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_LABELS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'Pre Ingreso', DIA_1: 'Día 1', SEMANA_1: 'Semana 1', MES_1: 'Mes 1', EVALUACION: 'Evaluación',
}

const PERIOD_COLORS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'bg-violet-100 text-violet-700',
  DIA_1:       'bg-blue-100 text-blue-700',
  SEMANA_1:    'bg-cyan-100 text-cyan-700',
  MES_1:       'bg-emerald-100 text-emerald-700',
  EVALUACION:  'bg-amber-100 text-amber-700',
}

const AUTO_COLORS: Record<TaskAutomationType, string> = {
  EMAIL:       'bg-blue-50 text-blue-700',
  CALENDAR:    'bg-purple-50 text-purple-700',
  BUK_CHECK:   'bg-orange-50 text-orange-700',
  EXTERNAL:    'bg-cyan-50 text-cyan-700',
  MANUAL:      'bg-gray-100 text-gray-500',
  SHEET_VERIFY:'bg-green-50 text-green-700',
}

// ─── Sub-tab: Plantilla ───────────────────────────────────────────────────────

function PlantillaTab() {
  const { data: tasks = [], isLoading } = useTemplateTasks()
  const updateTask = useUpdateTemplateTask()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')

  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingDbTemplateTask[]>()
    PERIOD_ORDER.forEach(p => map.set(p, []))
    tasks.forEach(t => map.get(t.period as OnboardingPeriod)?.push(t))
    return map
  }, [tasks])

  const startEdit = (t: OnboardingDbTemplateTask) => { setEditingId(t.id); setEditName(t.name) }
  const cancelEdit = () => { setEditingId(null); setEditName('') }

  const saveEdit = async (t: OnboardingDbTemplateTask) => {
    if (editName.trim() && editName !== t.name) {
      await updateTask.mutateAsync({ key: t.key, name: editName.trim() })
    }
    cancelEdit()
  }

  const toggleActive = (t: OnboardingDbTemplateTask) => {
    updateTask.mutate({ key: t.key, isActive: !t.isActive })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600">Plantilla global con <strong>{tasks.filter(t => t.isActive).length}</strong> hitos activos. Los cambios aplican a procesos futuros.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Activo
          <span className="w-2 h-2 rounded-full bg-gray-200 inline-block ml-2" /> Inactivo
        </div>
      </div>

      {PERIOD_ORDER.map(period => {
        const periodTasks = byPeriod.get(period) ?? []
        if (periodTasks.length === 0) return null
        return (
          <div key={period} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-gray-100`}>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${PERIOD_COLORS[period]}`}>
                {PERIOD_LABELS[period]}
              </span>
              <span className="text-xs text-gray-400">{periodTasks.filter(t => t.isActive).length} / {periodTasks.length} activos</span>
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-gray-50">
                {periodTasks.map(task => (
                  <tr key={task.id} className={`transition-colors ${task.isActive ? '' : 'opacity-40'}`}>
                    <td className="px-4 py-2.5 w-8">
                      <button
                        onClick={() => toggleActive(task)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                        title={task.isActive ? 'Desactivar hito' : 'Activar hito'}
                      >
                        {task.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 flex-1">
                      {editingId === task.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(task); if (e.key === 'Escape') cancelEdit() }}
                            className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => saveEdit(task)} className="p-1 text-green-600 hover:text-green-800">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span className="text-sm text-gray-800">{task.name}</span>
                          {task.appliesWhen && (
                            <span className="text-[10px] text-gray-400 italic">{task.appliesWhen}</span>
                          )}
                          <button
                            onClick={() => startEdit(task)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-700 transition-opacity"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell whitespace-nowrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${AUTO_COLORS[task.automationType as TaskAutomationType] ?? 'bg-gray-100 text-gray-500'}`}>
                        {task.automationType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="text-[10px] text-gray-400">{task.tool ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[10px] text-gray-300">#{task.sortOrder}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sub-tab: Vista Cruzada ───────────────────────────────────────────────────

function VistaCruzadaTab() {
  const { data: tasks = [], isLoading: loadingTasks } = useTemplateTasks()
  const { data: processes = [], isLoading: loadingProcs } = useOnboardingProcesses()

  const activeTasks    = useMemo(() => tasks.filter(t => t.isActive), [tasks])
  const activeProcs    = useMemo(() => processes.filter(p => p.status === 'IN_PROGRESS'), [processes])
  const isLoading      = loadingTasks || loadingProcs

  // Map templateId → process task completion
  const completionMap = useMemo(() => {
    const map = new Map<string, Map<string, boolean>>()
    activeProcs.forEach(proc => {
      const procMap = new Map<string, boolean>()
      proc.tasks.forEach((t: any) => {
        if (t.templateId) procMap.set(t.templateId, !!t.completedAt)
      })
      map.set(proc.id, procMap)
    })
    return map
  }, [activeProcs])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (activeProcs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
        <p className="text-sm">No hay procesos activos para mostrar.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-400 mb-3">{activeTasks.length} hitos × {activeProcs.length} procesos activos</div>
      <table className="border-collapse text-xs min-w-full">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white border border-gray-100 px-3 py-2 text-left font-medium text-gray-500 min-w-[260px]">Hito</th>
            {activeProcs.map(proc => (
              <th key={proc.id} className="border border-gray-100 px-2 py-2 font-medium text-gray-600 min-w-[120px] text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="truncate max-w-[110px]" title={proc.collaboratorName}>{proc.collaboratorName.split(' ')[0]}</span>
                  <span className="text-[10px] text-gray-400 font-normal truncate max-w-[110px]">{proc.collaboratorPosition ?? '—'}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIOD_ORDER.map(period => {
            const periodTasks = activeTasks.filter(t => t.period === period)
            if (periodTasks.length === 0) return null
            return (
              <React.Fragment key={period}>
                <tr>
                  <td
                    colSpan={activeProcs.length + 1}
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border border-gray-100 ${PERIOD_COLORS[period]} bg-opacity-30`}
                  >
                    {PERIOD_LABELS[period]}
                  </td>
                </tr>
                {periodTasks.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white border border-gray-100 px-3 py-2 text-gray-700">
                      {task.name}
                      {task.appliesWhen && <span className="ml-1 text-[10px] text-gray-400 italic">{task.appliesWhen}</span>}
                    </td>
                    {activeProcs.map(proc => {
                      const done = completionMap.get(proc.id)?.get(task.key)
                      return (
                        <td key={proc.id} className="border border-gray-100 px-2 py-2 text-center">
                          {done === undefined ? (
                            <span className="text-gray-200">—</span>
                          ) : done ? (
                            <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                          ) : (
                            <Circle size={14} className="text-gray-300 mx-auto" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function HitosTab() {
  const [sub, setSub] = useState<'plantilla' | 'cruzada'>('plantilla')

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {([['plantilla', 'Plantilla global'], ['cruzada', 'Vista cruzada']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sub === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>
      {sub === 'plantilla' ? <PlantillaTab /> : <VistaCruzadaTab />}
    </div>
  )
}
