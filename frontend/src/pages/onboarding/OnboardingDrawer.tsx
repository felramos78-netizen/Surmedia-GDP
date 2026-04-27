import React, { useState, useRef } from 'react'
import { X, CheckCircle2, Circle, Clock, Building2, CalendarDays, AlertTriangle, Mail, Calendar, RefreshCw, Wrench, Globe, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Pencil, Check, Save, FileText, ExternalLink, Users, ListChecks } from 'lucide-react'
import { useOnboardingProcess, useUpdateTask, useAddTask, useDeleteTask, useRunAutomation, useUpdateOnboardingStatus, useUpdateOnboarding, useDeleteOnboarding, useAddTaskAssignment, useDeleteTaskAssignment } from '@/hooks/useOnboarding'
import { useProfiles, ROLE_TYPES } from '@/hooks/useProfiles'
import type { OnboardingPeriod, OnboardingTask, TaskAutomationType, AutomationStatus, OnboardingProcess, TaskAssignment } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_META: Record<OnboardingPeriod, { label: string; range: string; colorClass: string; bgClass: string }> = {
  PRE_INGRESO: { label: 'Pre-ingreso',     range: 'Día -7 a 0',   colorClass: 'text-purple-700', bgClass: 'bg-purple-50 border-purple-200' },
  DIA_1:       { label: 'Día 1 — Ingreso', range: 'Fecha ingreso', colorClass: 'text-blue-700',   bgClass: 'bg-blue-50 border-blue-200' },
  SEMANA_1:    { label: 'Primera semana',  range: 'Días 1–7',      colorClass: 'text-cyan-700',   bgClass: 'bg-cyan-50 border-cyan-200' },
  MES_1:       { label: 'Primer mes',      range: 'Días 7–30',     colorClass: 'text-green-700',  bgClass: 'bg-green-50 border-green-200' },
  EVALUACION:  { label: 'Evaluación',      range: 'Días 60–90',    colorClass: 'text-amber-700',  bgClass: 'bg-amber-50 border-amber-200' },
}

const AUTO_META: Record<TaskAutomationType, { label: string; icon: React.ReactNode; color: string }> = {
  MANUAL:       { label: 'Manual',    icon: <Wrench size={11} />,     color: 'bg-gray-100 text-gray-500' },
  EMAIL:        { label: 'Correo',    icon: <Mail size={11} />,       color: 'bg-blue-100 text-blue-600' },
  CALENDAR:     { label: 'Calendar',  icon: <Calendar size={11} />,   color: 'bg-purple-100 text-purple-600' },
  BUK_CHECK:    { label: 'BUK',       icon: <RefreshCw size={11} />,  color: 'bg-orange-100 text-orange-600' },
  EXTERNAL:     { label: 'Externo',   icon: <Globe size={11} />,      color: 'bg-teal-100 text-teal-600' },
  SHEET_VERIFY: { label: 'Formulario',icon: <FileText size={11} />,   color: 'bg-green-100 text-green-600' },
}

const ROLE_LABELS: Record<string, string> = {
  RESPONSABLE_HITO:   'Responsable',
  COPIA_CORREOS:      'Copia',
  ENVIA_CORREOS:      'Envía',
  RECIBE_CORREOS:     'Recibe',
  PREPARA_ADM_FISICA: 'Adm. física',
}

const ROLE_COLORS: Record<string, string> = {
  RESPONSABLE_HITO:   'bg-blue-100 text-blue-700',
  COPIA_CORREOS:      'bg-gray-100 text-gray-600',
  ENVIA_CORREOS:      'bg-green-100 text-green-700',
  RECIBE_CORREOS:     'bg-amber-100 text-amber-700',
  PREPARA_ADM_FISICA: 'bg-purple-100 text-purple-700',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Ejecutado',   color: 'text-green-600' },
  FAILED:  { label: 'Error',       color: 'text-red-500' },
  SKIPPED: { label: 'Omitido',     color: 'text-gray-400' },
  RUNNING: { label: 'Ejecutando…', color: 'text-blue-500' },
  PENDING: { label: 'Pendiente',   color: 'text-gray-400' },
}

// ─── Herramientas disponibles ─────────────────────────────────────────────────

const TOOLS = [
  'Correo',
  'Google Calendar',
  'BUK API',
  'Google Sheets API',
  'Google Workspace API',
  'Físico/Manual',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) { return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtShort(d: string) { return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) }
function daysIn(s: string) { return Math.floor((Date.now() - new Date(s).getTime()) / 864e5) }

// ─── Multi-select de herramientas ────────────────────────────────────────────

function ToolsSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value ? value.split(',').map(t => t.trim()).filter(Boolean) : []

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (tool: string) => {
    const next = selected.includes(tool)
      ? selected.filter(t => t !== tool)
      : [...selected, tool]
    onChange(next.join(', '))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-left flex items-center justify-between gap-2 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[34px]"
      >
        <span className="flex flex-wrap gap-1 flex-1">
          {selected.length === 0
            ? <span className="text-gray-400">Seleccionar herramientas…</span>
            : selected.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px]">
                  {t}
                </span>
              ))
          }
        </span>
        <ChevronDown size={12} className="flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1 max-h-48 overflow-y-auto">
          {TOOLS.map(tool => (
            <label key={tool} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(tool)}
                onChange={() => toggle(tool)}
                className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-700">{tool}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Badge de tipo de automatización ─────────────────────────────────────────

function AutoBadge({ type }: { type: TaskAutomationType }) {
  const m = AUTO_META[type] ?? { label: type, icon: null, color: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${m.color}`}>
      {m.icon}{m.label}
    </span>
  )
}

// ─── Plantillas de correo ─────────────────────────────────────────────────────

function buildEmail(task: OnboardingTask, process: OnboardingProcess): { to: string; subject: string; body: string } {
  const cfg = task.automationConfig as Record<string, any> | null
  const name     = process.collaboratorName
  const position = process.collaboratorPosition ?? 'colaborador/a'
  const start    = process.startDate ? new Date(process.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const corpEmail = process.collaboratorEmail ?? ''
  const persEmail = process.collaboratorPersonalEmail ?? ''

  const recipientTo = cfg?.emailTo === 'collaborator'
    ? (corpEmail || persEmail)
    : cfg?.emailTo === 'rrhh'
      ? 'rrhh@surmedia.cl'
      : 'equipo@surmedia.cl'

  const templates: Record<string, { subject: string; body: string }> = {
    bienvenida: {
      subject: `¡Bienvenido/a a Surmedia, ${name}!`,
      body: `Hola ${name},\n\nNos alegra darte la bienvenida a Surmedia como ${position}.\n\nTu fecha de ingreso es el ${start}. En los próximos días recibirás toda la información necesaria para comenzar.\n\nEn caso de cualquier consulta, no dudes en contactarnos.\n\nEquipo RRHH Surmedia`,
    },
    seguro_complementario: {
      subject: 'Formulario Seguro Complementario — Surmedia',
      body: `Hola ${name},\n\nTe enviamos el formulario para activar tu seguro complementario de salud.\n\nPor favor complétalo y envíalo de vuelta antes de tu primer día.\n\n[Adjuntar formulario]\n\nEquipo RRHH Surmedia`,
    },
    mentor_asignado: {
      subject: `Tu mentor en Surmedia — ${name}`,
      body: `Hola ${name},\n\nComo parte de tu proceso de onboarding, hemos asignado un mentor que te acompañará durante tus primeros 90 días.\n\nPronto recibirás los datos de contacto de tu mentor.\n\nEquipo RRHH Surmedia`,
    },
  }

  const templateKey = cfg?.template ?? ''
  const tpl = templates[templateKey] ?? {
    subject: `[Onboarding] ${task.name} — ${name}`,
    body: `Hola,\n\nEste correo corresponde al hito "${task.name}" del proceso de onboarding de ${name} (${position}).\n\nFecha de ingreso: ${start}\n\nEquipo RRHH Surmedia`,
  }

  return { to: recipientTo, subject: tpl.subject, body: tpl.body }
}

// ─── Modal verificación de documentos (Google Sheet) ─────────────────────────

import api from '@/lib/api'

function SheetVerifyModal({
  task, process, onClose,
}: { task: OnboardingTask; process: OnboardingProcess; onClose: () => void }) {
  const cfg = task.automationConfig as Record<string, any> | null
  const nameColumn = cfg?.nameColumn ?? 'Nombre completo'
  const docColumns: string[] = cfg?.docColumns ?? []

  const [rows, setRows]           = useState<Record<string, string>[] | null>(null)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState<Record<string, string> | null>(null)
  const [checked, setChecked]     = useState<Set<string>>(new Set())
  const updateTask = useUpdateTask()

  React.useEffect(() => {
    api.get('/onboarding/sheet/form-responses')
      .then(r => setRows(r.data.data))
      .catch(() => setError('No se pudo cargar el formulario'))
  }, [])

  const handleSelect = (row: Record<string, string>) => {
    setSelected(row)
    setChecked(new Set())
  }

  const toggleDoc = (col: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      return next
    })
  }

  const allChecked = docColumns.filter(c => selected?.[c]).every(c => checked.has(c))

  const handleConfirm = async () => {
    await updateTask.mutateAsync({ processId: process.id, taskId: task.id, completed: true })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Verificar documentos del formulario</h2>
            <p className="text-xs text-gray-400 mt-0.5">{process.collaboratorName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!rows && !error && <p className="text-sm text-gray-400">Cargando respuestas...</p>}

          {rows && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Selecciona el ingresante ({rows.length} respuestas)
              </label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
                onChange={e => {
                  const row = rows.find(r => r[nameColumn] === e.target.value)
                  if (row) handleSelect(row)
                }}
              >
                <option value="" disabled>Seleccionar...</option>
                {rows.map((r, i) => (
                  <option key={i} value={r[nameColumn]}>{r[nameColumn]}</option>
                ))}
              </select>
            </div>
          )}

          {selected && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Documentos adjuntos — marca cada uno como revisado</p>
              <div className="flex flex-col gap-2">
                {docColumns.map(col => {
                  const url = selected[col]
                  const hasDoc = !!url
                  return (
                    <div key={col} className={`flex items-center gap-3 p-3 rounded-lg border ${checked.has(col) ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={checked.has(col)}
                        onChange={() => hasDoc && toggleDoc(col)}
                        disabled={!hasDoc}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className={`flex-1 text-sm ${hasDoc ? 'text-gray-800' : 'text-gray-400'}`}>{col}</span>
                      {hasDoc ? (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink size={11} /> Ver
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No adjuntado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!selected || !allChecked || updateTask.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {updateTask.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Confirmar documentos validados
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal previsualización de correo ─────────────────────────────────────────

function EmailPreviewModal({
  task, process, onClose, onSent,
}: { task: OnboardingTask; process: OnboardingProcess; onClose: () => void; onSent: () => void }) {
  const initial = buildEmail(task, process)
  const [from,    setFrom]    = useState('rrhh@surmedia.cl')
  const [to,      setTo]      = useState(initial.to)
  const [cc,      setCc]      = useState('')
  const [subject, setSubject] = useState(initial.subject)
  const [body,    setBody]    = useState(initial.body)
  const runAuto = useRunAutomation()

  const handleSend = async () => {
    await runAuto.mutateAsync({ processId: process.id, taskId: task.id })
    onSent()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Previsualizar correo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{task.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
            <input value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Para</label>
            <input value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CC (opcional)</label>
            <input value={cc} onChange={e => setCc(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Asunto</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cuerpo</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-xs" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={handleSend} disabled={runAuto.isPending || !to}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {runAuto.isPending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            {runAuto.isPending ? 'Enviando…' : 'Enviar correo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila de tarea (pestaña Progreso) ─────────────────────────────────────────

function TaskRow({
  task,
  processId,
  process,
  canEdit,
}: { task: OnboardingTask; processId: string; process: OnboardingProcess; canEdit: boolean }) {
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState(task.name)
  const [showResult, setShowResult]   = useState(false)
  const [emailModal, setEmailModal]   = useState(false)
  const [sheetModal, setSheetModal]   = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)

  const updateTask  = useUpdateTask()
  const deleteTask  = useDeleteTask()
  const runAuto     = useRunAutomation()

  const isRunning  = runAuto.isPending
  const autoStatus = task.automationStatus as AutomationStatus | null
  const result     = task.automationResult as Record<string, any> | null

  const handleToggle = () => {
    if (!canEdit) return
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
    runAuto.mutate({ processId, taskId: task.id })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('¿Eliminar este hito del proceso?')) {
      deleteTask.mutate({ processId, taskId: task.id })
    }
  }

  return (
    <div className={`rounded-lg border transition-colors ${task.completedAt ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-white'} mb-1`}>
      <div className="flex items-start gap-2.5 p-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={!canEdit || updateTask.isPending}
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
                className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={handleSaveName} className="text-green-600"><Check size={14} /></button>
              <button onClick={() => setEditing(false)} className="text-gray-400"><X size={14} /></button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm leading-snug ${task.completedAt ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {task.name}
              </p>
              {canEdit && (
                <button onClick={() => setEditing(true)} className="flex-shrink-0 text-gray-300 hover:text-gray-500 mt-0.5">
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
                  : 'text-blue-500 hover:bg-blue-50'
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
    </div>
  )
}

// ─── Formulario: Agregar hito personalizado ───────────────────────────────────

function AddTaskForm({ processId, period, onDone }: { processId: string; period: OnboardingPeriod; onDone: () => void }) {
  const [name, setName] = useState('')
  const addTask = useAddTask()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addTask.mutate({ processId, period, name: name.trim() }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/30">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre del hito..."
        className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
      />
      <button type="submit" disabled={!name.trim() || addTask.isPending} className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40">
        {addTask.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Agregar'}
      </button>
      <button type="button" onClick={onDone} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
    </form>
  )
}

// ─── Tarjeta de configuración de hito (pestaña Hitos) ────────────────────────

function HitoConfigCard({ task, processId, canEdit }: { task: OnboardingTask; processId: string; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    name:        task.name,
    tool:        task.tool ?? '',
    appliesWhen: task.appliesWhen ?? '',
    period:      task.period as string,
  })
  const [addProfileId,  setAddProfileId]  = useState('')
  const [addRoleType,   setAddRoleType]   = useState('RESPONSABLE_HITO')

  const { data: profiles = [] } = useProfiles()
  const updateTask        = useUpdateTask()
  const deleteTask        = useDeleteTask()
  const addAssignment     = useAddTaskAssignment()
  const deleteAssignment  = useDeleteTaskAssignment()

  const assignments: TaskAssignment[] = task.assignments ?? []

  const handleSaveEdit = async () => {
    await updateTask.mutateAsync({
      processId,
      taskId:     task.id,
      name:       form.name.trim(),
      tool:       form.tool.trim() || undefined,
      appliesWhen: form.appliesWhen.trim() || null,
      period:     form.period || undefined,
    })
    setEditMode(false)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('¿Eliminar este hito del proceso?')) {
      deleteTask.mutate({ processId, taskId: task.id })
    }
  }

  const handleAddAssignment = async () => {
    if (!addProfileId) return
    try {
      await addAssignment.mutateAsync({ processId, taskId: task.id, profileId: addProfileId, roleType: addRoleType })
      setAddProfileId('')
    } catch {}
  }

  const alreadyAssignedProfileIds = assignments.map(a => `${a.profileId}:${a.roleType}`)

  return (
    <div className="rounded-lg border border-gray-100 bg-white mb-1.5 overflow-hidden">
      {/* Fila compacta */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-gray-300">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          <div className="min-w-0">
            <p className="text-sm text-gray-800 truncate">{task.name}</p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              <AutoBadge type={task.automationType} />
              {task.tool && task.tool.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-100">{t}</span>
              ))}
              {task.appliesWhen && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-100">{task.appliesWhen}</span>}
            </div>
          </div>
        </button>
        {assignments.length > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded">
            <Users size={10} />{assignments.length}
          </span>
        )}
        {canEdit && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-1 rounded text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="border-t border-gray-50 px-3 pb-3 pt-3 space-y-4">

          {/* Edición de campos */}
          {editMode ? (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Herramientas</label>
                  <ToolsSelect value={form.tool} onChange={v => setForm(f => ({ ...f, tool: v }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Aplica cuando</label>
                  <input
                    value={form.appliesWhen}
                    onChange={e => setForm(f => ({ ...f, appliesWhen: e.target.value }))}
                    placeholder="ej. si aplica"
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Período</label>
                <select
                  value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {PERIOD_ORDER.map(p => (
                    <option key={p} value={p}>{PERIOD_META[p].label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setForm({ name: task.name, tool: task.tool ?? '', appliesWhen: task.appliesWhen ?? '', period: task.period }); setEditMode(false) }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!form.name.trim() || updateTask.isPending}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updateTask.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-gray-500 space-y-1.5">
                {task.tool && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-gray-400 flex-shrink-0">Herramientas:</span>
                    {task.tool.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className="inline-flex items-center px-1.5 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded text-[10px]">{t}</span>
                    ))}
                  </div>
                )}
                {task.appliesWhen && <p><span className="text-gray-400">Aplica cuando:</span> {task.appliesWhen}</p>}
                {!task.tool && !task.appliesWhen && <p className="text-gray-300 italic text-[11px]">Sin detalles adicionales</p>}
              </div>
              {canEdit && (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={11} /> Editar
                </button>
              )}
            </div>
          )}

          {/* Sección de perfiles */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Perfiles asociados</p>

            {assignments.length === 0 && (
              <p className="text-xs text-gray-300 italic mb-2">Sin perfiles asignados</p>
            )}

            <div className="flex flex-col gap-1 mb-2.5">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{a.profile.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{a.profile.position}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${ROLE_COLORS[a.roleType] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[a.roleType] ?? a.roleType}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => deleteAssignment.mutate({ processId, taskId: task.id, assignmentId: a.id })}
                      className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex gap-1.5">
                <select
                  value={addProfileId}
                  onChange={e => setAddProfileId(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="">Seleccionar perfil…</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={addRoleType}
                  onChange={e => setAddRoleType(e.target.value)}
                  className="w-32 flex-shrink-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  {ROLE_TYPES.map(r => (
                    <option
                      key={r.value}
                      value={r.value}
                      disabled={alreadyAssignedProfileIds.includes(`${addProfileId}:${r.value}`)}
                    >
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddAssignment}
                  disabled={!addProfileId || addAssignment.isPending}
                  className="flex-shrink-0 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {addAssignment.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pestaña: Hitos ───────────────────────────────────────────────────────────

function HitosTab({ process, canEdit }: { process: OnboardingProcess; canEdit: boolean }) {
  const [addingPeriod, setAddingPeriod] = useState<OnboardingPeriod | null>(null)

  const tasks = [...process.tasks].sort((a, b) => {
    const pi = PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
    return pi !== 0 ? pi : a.sortOrder - b.sortOrder
  })

  const tasksByPeriod = PERIOD_ORDER.reduce<Record<OnboardingPeriod, OnboardingTask[]>>(
    (acc, p) => { acc[p] = tasks.filter(t => t.period === p); return acc },
    {} as any
  )

  return (
    <div className="space-y-5">
      {PERIOD_ORDER.map(period => {
        const periodTasks = tasksByPeriod[period]
        const meta = PERIOD_META[period]
        const withProfiles = periodTasks.filter(t => t.assignments && t.assignments.length > 0).length

        return (
          <div key={period}>
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.bgClass} ${meta.colorClass}`}>
                {meta.label}
                <span className="font-normal opacity-60">{periodTasks.length} hitos</span>
                {withProfiles > 0 && <span className="font-normal opacity-60">· {withProfiles} con perfiles</span>}
              </span>
              {canEdit && (
                <button
                  onClick={() => setAddingPeriod(addingPeriod === period ? null : period)}
                  className="flex items-center gap-1 text-xs text-gray-300 hover:text-blue-500 transition-colors"
                >
                  <Plus size={11} /> Agregar
                </button>
              )}
            </div>

            {periodTasks.map(task => (
              <HitoConfigCard key={task.id} task={task} processId={process.id} canEdit={canEdit} />
            ))}

            {canEdit && addingPeriod === period && (
              <AddTaskForm processId={process.id} period={period} onDone={() => setAddingPeriod(null)} />
            )}

            {periodTasks.length === 0 && addingPeriod !== period && (
              <p className="text-xs text-gray-300 italic px-2">Sin hitos en este período</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Modal: Editar proceso ────────────────────────────────────────────────────

function EditProcessModal({ process, onClose }: { process: OnboardingProcess; onClose: () => void }) {
  const [form, setForm] = useState({
    collaboratorName:          process.collaboratorName ?? '',
    collaboratorEmail:         process.collaboratorEmail ?? '',
    collaboratorPersonalEmail: process.collaboratorPersonalEmail ?? '',
    collaboratorPosition:      process.collaboratorPosition ?? '',
    collaboratorPhone:    process.collaboratorPhone ?? '',
    legalEntity:          process.legalEntity ?? '',
    startDate:            process.startDate ? process.startDate.slice(0, 10) : '',
    notes:                process.notes ?? '',
  })

  const updateOnboarding = useUpdateOnboarding()
  const field = (key: keyof typeof form, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.collaboratorName.trim()) return
    try {
      await updateOnboarding.mutateAsync({
        id:                    process.id,
        collaboratorName:          form.collaboratorName.trim(),
        collaboratorEmail:         form.collaboratorEmail.trim() || null,
        collaboratorPersonalEmail: form.collaboratorPersonalEmail.trim() || null,
        collaboratorPosition:  form.collaboratorPosition.trim() || null,
        collaboratorPhone:     form.collaboratorPhone.trim() || null,
        legalEntity:           form.legalEntity || null,
        startDate:             form.startDate || undefined,
        notes:                 form.notes.trim() || null,
      })
      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al guardar los cambios')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Editar proceso</h2>
            <p className="text-xs text-gray-400 mt-0.5">Modifica los datos del colaborador</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Nombre completo <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={form.collaboratorName}
                onChange={e => field('collaboratorName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo</label>
              <input
                type="email"
                value={form.collaboratorEmail}
                onChange={e => field('collaboratorEmail', e.target.value)}
                placeholder="juan.perez@surmedia.cl"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email personal</label>
              <input
                type="email"
                value={form.collaboratorPersonalEmail}
                onChange={e => field('collaboratorPersonalEmail', e.target.value)}
                placeholder="juan.perez@gmail.com"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
              <input
                type="text"
                value={form.collaboratorPhone}
                onChange={e => field('collaboratorPhone', e.target.value)}
                placeholder="+56 9 XXXX XXXX"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo</label>
              <input
                type="text"
                value={form.collaboratorPosition}
                onChange={e => field('collaboratorPosition', e.target.value)}
                placeholder="Ej: Diseñador Gráfico"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa</label>
              <select
                value={form.legalEntity}
                onChange={e => field('legalEntity', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Sin especificar</option>
                <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
                <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => field('startDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => field('notes', e.target.value)}
                placeholder="Información relevante para el proceso..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!form.collaboratorName.trim() || updateOnboarding.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {updateOnboarding.isPending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><Save size={14} /> Guardar cambios</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

interface Props {
  processId: string
  onClose: () => void
}

export default function OnboardingDrawer({ processId, onClose }: Props) {
  const { data: process, isLoading } = useOnboardingProcess(processId)
  const updateStatus  = useUpdateOnboardingStatus()
  const deleteProcess = useDeleteOnboarding()
  const [activeTab,    setActiveTab]    = useState<'progreso' | 'hitos'>('progreso')
  const [addingPeriod, setAddingPeriod] = useState<OnboardingPeriod | null>(null)
  const [showEdit,     setShowEdit]     = useState(false)

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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
              {(process.collaboratorName ?? '?').split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('')}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{process.collaboratorName}</p>
              <p className="text-xs text-gray-400">{process.collaboratorPosition ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowEdit(true)}
              title="Editar proceso"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Pencil size={15} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
          {legalEntityLabel && <span className="flex items-center gap-1"><Building2 size={11} />{legalEntityLabel}</span>}
          {process.collaboratorEmail && <span className="flex items-center gap-1"><Mail size={11} />{process.collaboratorEmail}</span>}
          <span className="flex items-center gap-1"><CalendarDays size={11} />Ingreso {fmt(process.startDate)}</span>
          <span className="flex items-center gap-1"><Clock size={11} />Día {days} de 90</span>
          {{
            IN_PROGRESS: <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">En proceso</span>,
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
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'progreso'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <ListChecks size={13} /> Progreso
          </button>
          <button
            onClick={() => setActiveTab('hitos')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'hitos'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Users size={13} /> Hitos
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
                        <AddTaskForm processId={process.id} period={period} onDone={() => setAddingPeriod(null)} />
                      ) : (
                        <button
                          onClick={() => setAddingPeriod(period)}
                          className="flex items-center gap-1 text-xs text-gray-300 hover:text-blue-400 mt-1 px-2 py-1 transition-colors"
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

          {activeTab === 'hitos' && (
            <HitosTab process={process} canEdit={canEdit} />
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
