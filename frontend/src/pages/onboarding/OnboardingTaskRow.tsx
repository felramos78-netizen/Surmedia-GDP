// Fila de tarea (pestaña Progreso) y formulario para agregar hitos.
// Extraído de OnboardingDrawer.tsx.
import React, { useState, useRef, useMemo } from 'react'
import { CheckCircle2, Circle, ChevronUp, ChevronDown, Pencil, Check, X, Trash2, Loader2, Users, Play, Plus } from 'lucide-react'
import { useUpdateTask, useDeleteTask, useRunAutomation, useAddTask, useTemplateTasks } from '@/hooks/useOnboarding'
import type { OnboardingPeriod, OnboardingTask, AutomationStatus, OnboardingProcess, SubTaskInstance } from '@/types'
import { parseDateLocal, computeTaskDate, PERIOD_OFFSETS, AutoBadge, STATUS_META, AUTO_META, fmtShort } from './onboardingShared'
import { EmailPreviewModal, SheetVerifyModal, CalendarEventModal } from './onboardingModals'

// ─── Fila de tarea (pestaña Progreso) ─────────────────────────────────────────

export function TaskRow({
  task,
  processId,
  process,
  canEdit,
}: { task: OnboardingTask; processId: string; process: OnboardingProcess; canEdit: boolean }) {
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState(task.name)
  const [showResult, setShowResult]   = useState(false)
  const [emailModal,    setEmailModal]    = useState(false)
  const [sheetModal,    setSheetModal]    = useState(false)
  const [calendarModal, setCalendarModal] = useState(false)
  const [subAction, setSubAction]         = useState<{ idx: number; tool: string; cfg: Record<string, any> } | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const updateTask  = useUpdateTask()
  const deleteTask  = useDeleteTask()
  const runAuto     = useRunAutomation()

  const isRunning  = runAuto.isPending
  const autoStatus = task.automationStatus as AutomationStatus | null
  const result     = task.automationResult as Record<string, any> | null

  const base = useMemo(() => {
    const d = parseDateLocal(process.startDate); d.setHours(12, 0, 0, 0); return d
  }, [process.startDate])
  const taskDate = computeTaskDate(task, base)
  const todayMid = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()
  const isOverdue = !task.completedAt && taskDate < todayMid
  const fmtDate = (d: Date) => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  const dayOffset = Math.round((taskDate.getTime() - base.getTime()) / 86400000)
  const dayLabel = dayOffset < 0 ? `Día ${dayOffset}` : dayOffset === 0 ? 'Día 0' : `Día +${dayOffset}`

  const handleToggle = () => {
    updateTask.mutate({ processId, taskId: task.id, completed: !task.completedAt })
  }

  const handleSaveName = () => {
    if (editName.trim() && editName !== task.name) {
      updateTask.mutate({ processId, taskId: task.id, name: editName.trim() })
    }
    setEditing(false)
  }

  const handleAutomate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.automationType === 'EMAIL') { setEmailModal(true); return }
    if (task.automationType === 'SHEET_VERIFY') { setSheetModal(true); return }
    if (task.automationType === 'CALENDAR') { setCalendarModal(true); return }
    runAuto.mutate({ processId, taskId: task.id })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('¿Eliminar este hito del proceso?')) {
      deleteTask.mutate({ processId, taskId: task.id })
    }
  }

  return (
    <div className={`rounded-lg border transition-colors mb-1 ${
      task.completedAt ? 'border-green-100 bg-green-50/30' :
      isOverdue ? 'border-amber-200 bg-amber-50/40' :
      'border-gray-100 bg-white'
    }`}>
      <div className="flex items-start gap-2.5 p-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={updateTask.isPending}
          className={`mt-0.5 flex-shrink-0 transition-colors ${task.completedAt ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'} disabled:cursor-default`}
        >
          {task.completedAt ? <CheckCircle2 size={17} /> : <Circle size={17} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false) }}
                onBlur={handleSaveName}
                className="flex-1 text-sm border border-brand-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button onClick={handleSaveName} className="text-green-600"><Check size={14} /></button>
              <button onClick={() => setEditing(false)} className="text-gray-400"><X size={14} /></button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${task.completedAt ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {task.name}
                </p>
                <span className={`text-[10px] font-medium ${
                  isOverdue ? 'text-amber-600' : task.completedAt ? 'text-gray-400' : 'text-gray-400'
                }`}>
                  {fmtDate(taskDate)} · <span className="font-semibold">{dayLabel}</span>{isOverdue && ' · Vencido'}
                </span>
              </div>
              {canEdit && (
                <button onClick={() => setEditing(true)} aria-label="Editar nombre" className="flex-shrink-0 text-gray-300 hover:text-gray-500 mt-0.5">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <AutoBadge type={task.automationType} />
            {task.tool && task.tool.split(',').map(t => t.trim()).filter(Boolean).map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-100">{t}</span>
            ))}
            {task.appliesWhen && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-100">{task.appliesWhen}</span>}
            {task.completedAt && <span className="text-xs text-gray-400">{fmtShort(task.completedAt)}</span>}
            {autoStatus && autoStatus !== 'PENDING' && (
              <button
                onClick={() => setShowResult(v => !v)}
                className={`text-xs font-medium flex items-center gap-0.5 ${STATUS_META[autoStatus]?.color ?? 'text-gray-400'}`}
              >
                {STATUS_META[autoStatus]?.label}
                {showResult ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
            {/* Profile assignments pill */}
            {!!task.assignments?.length && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                <Users size={10} />{task.assignments.length}
              </span>
            )}
          </div>

          {/* Automation result */}
          {showResult && result && (
            <div className="mt-2 p-2 rounded bg-gray-50 border border-gray-100 text-xs text-gray-600">
              <p className="font-medium mb-0.5">{result.message}</p>
              {result.detail && Object.entries(result.detail).map(([k, v]) => (
                <p key={k} className="text-gray-400"><span className="text-gray-500">{k}:</span> {String(v)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && task.automationType !== 'MANUAL' && (
            <button
              onClick={handleAutomate}
              disabled={isRunning}
              title={`Ejecutar: ${AUTO_META[task.automationType]?.label ?? task.automationType}`}
              className={`p-1.5 rounded text-xs font-medium transition-colors ${
                autoStatus === 'SUCCESS'
                  ? 'text-green-500 hover:bg-green-50'
                  : 'text-brand-500 hover:bg-brand-50'
              } disabled:opacity-40`}
            >
              {isRunning ? <Loader2 size={13} className="animate-spin" /> : AUTO_META[task.automationType]?.icon}
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
      {/* Subtasks checklist */}
      {(task.subTasks ?? []).length > 0 && (
        <div className="mx-3 mb-2 border-t border-gray-50 pt-2 space-y-1">
          {(task.subTasks as SubTaskInstance[]).map((st, idx) => {
            const isDone = !!st.completedAt
            // Compute subtask date: CALENDAR uses daysFromStart from plantilla; others inherit task date
            const stDate = (() => {
              if (st.tool === 'CALENDAR' && st.plantilla) {
                try {
                  const cfg = JSON.parse(st.plantilla)
                  if (typeof cfg.daysFromStart === 'number') {
                    const rawOffset = task.period === 'PRE_INGRESO' ? -cfg.daysFromStart : cfg.daysFromStart
                    const d = new Date(base); d.setDate(d.getDate() + rawOffset); d.setHours(9,0,0,0); return d
                  }
                } catch {}
              }
              return taskDate
            })()
            const stOverdue = !isDone && stDate < todayMid
            const handleToggleSub = () => {
              const nowISO = new Date().toISOString()
              const updated = (task.subTasks as SubTaskInstance[]).map((s, i) =>
                i === idx ? { ...s, completedAt: isDone ? null : nowISO } : s
              )
              updateTask.mutate({ processId, taskId: task.id, subTasks: updated })
            }
            return (
              <div key={st.id ?? idx} className={`flex items-center gap-2 rounded px-1 -mx-1 py-0.5 ${stOverdue ? 'bg-amber-50/60' : ''}`}>
                <button
                  onClick={handleToggleSub}
                  disabled={updateTask.isPending}
                  className={`flex-shrink-0 transition-colors ${isDone ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'} disabled:cursor-default`}
                >
                  {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                </button>
                <span className={`text-xs flex-1 ${isDone ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                  {st.name}
                </span>
                <span className={`text-[10px] flex-shrink-0 ${stOverdue ? 'text-amber-500' : 'text-gray-300'}`}>
                  {fmtDate(stDate)} · <span className="font-semibold">{(() => { const d = Math.round((stDate.getTime() - base.getTime()) / 86400000); return d < 0 ? `Día ${d}` : d === 0 ? 'Día 0' : `Día +${d}` })()}</span>
                </span>
                {st.tool && (
                  <span className={`text-[10px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                    st.tool === 'EMAIL' ? 'bg-brand-50 text-brand-600' :
                    st.tool === 'CALENDAR' ? 'bg-purple-50 text-purple-600' :
                    st.tool === 'SHEET_VERIFY' ? 'bg-green-50 text-green-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {st.tool === 'EMAIL' ? 'Email' : st.tool === 'CALENDAR' ? 'Calendar' : st.tool === 'SHEET_VERIFY' ? 'Sheet' : 'Manual'}
                  </span>
                )}
                {st.tool && ['EMAIL', 'CALENDAR', 'SHEET_VERIFY'].includes(st.tool) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const cfg = (() => {
                        if (!st.plantilla) return {}
                        try { return JSON.parse(st.plantilla) } catch {
                          // EMAIL/SHEET_VERIFY store the key as plain string, not JSON
                          if (st.tool === 'SHEET_VERIFY') return { templateKey: st.plantilla }
                          if (st.tool === 'EMAIL') return { template: st.plantilla }
                          return {}
                        }
                      })()
                      setSubAction({ idx, tool: st.tool!, cfg })
                    }}
                    title={`Activar: ${st.tool}`}
                    className="flex-shrink-0 p-0.5 rounded text-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                  >
                    <Play size={9} fill="currentColor" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {emailModal && (
        <EmailPreviewModal
          task={task}
          process={process}
          onClose={() => setEmailModal(false)}
          onSent={() => setEmailModal(false)}
        />
      )}
      {sheetModal && (
        <SheetVerifyModal
          task={task}
          process={process}
          onClose={() => setSheetModal(false)}
        />
      )}
      {calendarModal && (
        <CalendarEventModal
          title={task.name}
          date={taskDate}
          durationMinutes={(task.automationConfig as Record<string, any>)?.durationMinutes ?? 0}
          defaultAttendeeIds={(task.assignments ?? []).map(a => a.profileId)}
          process={process}
          onClose={() => setCalendarModal(false)}
        />
      )}
      {subAction !== null && subAction.tool === 'CALENDAR' && (() => {
        const st = (task.subTasks as SubTaskInstance[])[subAction.idx]
        const rawOffset = typeof subAction.cfg.daysFromStart === 'number'
          ? (task.period === 'PRE_INGRESO' ? -subAction.cfg.daysFromStart : subAction.cfg.daysFromStart)
          : PERIOD_OFFSETS[task.period].start
        const d = new Date(base); d.setDate(d.getDate() + rawOffset); d.setHours(9, 0, 0, 0)
        return (
          <CalendarEventModal
            title={st.name}
            parentName={task.name}
            date={d}
            durationMinutes={subAction.cfg.durationMinutes ?? 0}
            defaultAttendeeIds={(task.assignments ?? []).map(a => a.profileId)}
            process={process}
            onClose={() => setSubAction(null)}
          />
        )
      })()}
      {subAction !== null && subAction.tool === 'EMAIL' && (() => {
        const st = (task.subTasks as SubTaskInstance[])[subAction.idx]
        const syntheticTask = { ...task, name: st.name, automationConfig: subAction.cfg } as OnboardingTask
        return (
          <EmailPreviewModal
            task={syntheticTask}
            process={process}
            onClose={() => setSubAction(null)}
            onSent={() => setSubAction(null)}
          />
        )
      })()}
      {subAction !== null && subAction.tool === 'SHEET_VERIFY' && (() => {
        const st = (task.subTasks as SubTaskInstance[])[subAction.idx]
        const syntheticTask = { ...task, name: st.name, automationConfig: subAction.cfg } as OnboardingTask
        return (
          <SheetVerifyModal
            task={syntheticTask}
            process={process}
            onClose={() => setSubAction(null)}
          />
        )
      })()}
    </div>
  )
}

// ─── Formulario: Agregar hito (desde el repositorio o personalizado) ────────

export function AddTaskForm({
  processId, period, existingTemplateIds, onDone,
}: { processId: string; period: OnboardingPeriod; existingTemplateIds: string[]; onDone: () => void }) {
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const addTask = useAddTask()
  const { data: catalog = [], isLoading } = useTemplateTasks()

  const available = (catalog as any[]).filter(t =>
    t.period === period && t.isActive !== false && !existingTemplateIds.includes(t.key)
  )

  const handleAddFromCatalog = (templateKey: string) => {
    setError('')
    addTask.mutate({ processId, period, templateKey }, {
      onSuccess: onDone,
      onError: (err: any) => setError(err?.response?.data?.message ?? 'No se pudo agregar el hito'),
    })
  }

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    addTask.mutate({ processId, period, name: name.trim() }, {
      onSuccess: onDone,
      onError: (err: any) => setError(err?.response?.data?.message ?? 'No se pudo agregar el hito'),
    })
  }

  return (
    <div className="mt-1 p-2.5 rounded-lg border border-dashed border-brand-200 bg-brand-50/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs">
          <button type="button" onClick={() => setMode('catalog')}
            className={`px-2 py-0.5 rounded-full transition-colors ${mode === 'catalog' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            Del repositorio
          </button>
          <button type="button" onClick={() => setMode('custom')}
            className={`px-2 py-0.5 rounded-full transition-colors ${mode === 'custom' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
            Personalizado
          </button>
        </div>
        <button type="button" onClick={onDone} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
      )}

      {mode === 'catalog' ? (
        isLoading ? (
          <p className="text-xs text-gray-400 py-1">Cargando hitos del repositorio…</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No hay más hitos disponibles en este período.</p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {available.map(t => (
              <button
                key={t.key}
                type="button"
                disabled={addTask.isPending}
                onClick={() => handleAddFromCatalog(t.key)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white border border-gray-100 hover:border-brand-300 hover:bg-brand-50/50 transition-colors text-left disabled:opacity-50"
              >
                <span className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700 truncate block">{t.name}</span>
                  {t.appliesWhen && <span className="text-[10px] text-gray-400 italic">{t.appliesWhen}</span>}
                </span>
                <AutoBadge type={t.automationType} />
              </button>
            ))}
          </div>
        )
      ) : (
        <form onSubmit={handleSubmitCustom} className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre del hito..."
            className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400 border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <button type="submit" disabled={!name.trim() || addTask.isPending} className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:opacity-40 flex-shrink-0">
            {addTask.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Agregar'}
          </button>
        </form>
      )}
    </div>
  )
}
