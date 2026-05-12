import React, { useState, useMemo } from 'react'
import { CheckCircle2, Circle, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react'
import {
  useTemplateTasks, useUpdateTemplateTask, useCreateTemplateTask, useDeleteTemplateTask,
  useOnboardingProcesses, useEmailTemplates, useSheetTemplates,
} from '@/hooks/useOnboarding'
import { useProfiles } from '@/hooks/useProfiles'
import type { OnboardingDbTemplateTask, OnboardingTemplateSubTask, OnboardingPeriod, TaskAutomationType } from '@/types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_LABELS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'Pre Ingreso',
  DIA_1:       'Día 1 (Ingreso)',
  SEMANA_1:    'Primera Semana',
  MES_1:       'Primer Mes',
  EVALUACION:  'Segundo Mes',
}

const PERIOD_COLORS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'bg-violet-100 text-violet-700 border-violet-200',
  DIA_1:       'bg-blue-100 text-blue-700 border-blue-200',
  SEMANA_1:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  MES_1:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  EVALUACION:  'bg-amber-100 text-amber-700 border-amber-200',
}

const TOOL_OPTIONS = [
  { value: 'EMAIL',        label: 'Email' },
  { value: 'MANUAL',       label: 'Manual (no automatizable)' },
  { value: 'CALENDAR',     label: 'Calendar' },
  { value: 'SHEET_VERIFY', label: 'Sheet Verify' },
]

const TOOL_COLORS: Record<string, string> = {
  EMAIL:        'bg-blue-50 text-blue-700',
  CALENDAR:     'bg-purple-50 text-purple-700',
  MANUAL:       'bg-gray-100 text-gray-500',
  SHEET_VERIFY: 'bg-green-50 text-green-700',
  BUK_CHECK:    'bg-orange-50 text-orange-700',
  EXTERNAL:     'bg-cyan-50 text-cyan-700',
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function ToolBadge({ type }: { type: string }) {
  const label = TOOL_OPTIONS.find(t => t.value === type)?.label ?? type
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TOOL_COLORS[type] ?? 'bg-gray-100 text-gray-500'}`}>
      {label}
    </span>
  )
}

// ─── SubTask row in edit form ─────────────────────────────────────────────────

interface SubTaskForm {
  id?: string
  name: string
  responsableProfileId: string
  tool: string
  plantilla: string
  // Calendar-specific
  calendarAttendeeIds: string[]
  calendarDaysFromStart: string
  calendarDurationMinutes: string
  calendarAllDay: boolean
}

function SubTaskRow({
  st, index, profiles, emailTemplates, sheetTemplates, onChange, onDelete,
}: {
  st: SubTaskForm
  index: number
  profiles: { id: string; name: string; email: string }[]
  emailTemplates: { key: string; name: string }[]
  sheetTemplates: { key: string; name: string }[]
  onChange: (i: number, f: Partial<SubTaskForm>) => void
  onDelete: (i: number) => void
}) {
  const inputCls = "px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"

  if (st.tool === 'CALENDAR') {
    return (
      <div className="rounded-lg border border-purple-100 bg-purple-50/20 p-2 space-y-2">
        <div className="grid grid-cols-[1fr_120px_120px_28px] gap-1.5 items-center">
          <input
            value={st.name}
            onChange={e => onChange(index, { name: e.target.value })}
            placeholder="Acción..."
            className={inputCls}
          />
          <select
            value={st.responsableProfileId}
            onChange={e => onChange(index, { responsableProfileId: e.target.value })}
            className={inputCls}
          >
            <option value="">Responsable…</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={st.tool}
            onChange={e => onChange(index, { tool: e.target.value, plantilla: '', calendarAttendeeIds: [], calendarDaysFromStart: '0', calendarDurationMinutes: '60' })}
            className={inputCls}
          >
            <option value="">Herramienta…</option>
            {TOOL_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => onDelete(index)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="flex items-start gap-2 pl-1">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Invitados</p>
            <div className="max-h-[72px] overflow-y-auto border border-purple-200 rounded-lg bg-white py-0.5 px-1">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-purple-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={st.calendarAttendeeIds.includes(p.id)}
                    onChange={e => {
                      const ids = e.target.checked
                        ? [...st.calendarAttendeeIds, p.id]
                        : st.calendarAttendeeIds.filter(id => id !== p.id)
                      onChange(index, { calendarAttendeeIds: ids })
                    }}
                    className="w-3 h-3 rounded accent-purple-600 flex-shrink-0"
                  />
                  <span className="text-[10px] text-gray-700 truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0">
            <p className="text-[9px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Día</p>
            <input
              type="number"
              value={st.calendarDaysFromStart}
              onChange={e => onChange(index, { calendarDaysFromStart: e.target.value })}
              placeholder="0"
              min={0}
              max={365}
              className="w-16 px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
          <div className="flex-shrink-0">
            <p className="text-[9px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Duración</p>
            <label className="flex items-center gap-1 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={st.calendarAllDay}
                onChange={e => onChange(index, { calendarAllDay: e.target.checked })}
                className="w-3 h-3 rounded accent-purple-600"
              />
              <span className="text-[10px] text-gray-600">Día completo</span>
            </label>
            {!st.calendarAllDay && (
              <input
                type="number"
                value={st.calendarDurationMinutes}
                onChange={e => onChange(index, { calendarDurationMinutes: e.target.value })}
                placeholder="60"
                min={15}
                step={15}
                className="w-16 px-2 py-1.5 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  const plantillaField = () => {
    if (!st.tool || st.tool === 'MANUAL') return <div />
    if (st.tool === 'EMAIL') {
      return (
        <select
          value={st.plantilla}
          onChange={e => onChange(index, { plantilla: e.target.value })}
          className={inputCls}
        >
          <option value="">Correo…</option>
          {emailTemplates.map(tpl => (
            <option key={tpl.key} value={tpl.key}>{tpl.name}</option>
          ))}
        </select>
      )
    }
    if (st.tool === 'SHEET_VERIFY') {
      return (
        <select
          value={st.plantilla}
          onChange={e => onChange(index, { plantilla: e.target.value })}
          className={inputCls}
        >
          <option value="">Sheet…</option>
          {sheetTemplates.map(s => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        value={st.plantilla}
        onChange={e => onChange(index, { plantilla: e.target.value })}
        placeholder="Plantilla…"
        disabled={!st.tool}
        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-300"
      />
    )
  }

  return (
    <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-1.5 items-center">
      <input
        value={st.name}
        onChange={e => onChange(index, { name: e.target.value })}
        placeholder="Acción..."
        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <select
        value={st.responsableProfileId}
        onChange={e => onChange(index, { responsableProfileId: e.target.value })}
        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">Responsable…</option>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select
        value={st.tool}
        onChange={e => onChange(index, { tool: e.target.value, plantilla: '' })}
        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">Herramienta…</option>
        {TOOL_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {plantillaField()}
      <button onClick={() => onDelete(index)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Formulario edición / creación ────────────────────────────────────────────

interface HitoForm {
  name: string
  period: string
  taskType: string
  tool: string
  plantilla: string
  responsableProfileId: string
  appliesTo: string
  daysFromStart: string
  subTasks: SubTaskForm[]
  // Calendar-specific (FECHA_ESPECIFICA hito with tool=CALENDAR)
  calendarAttendeeIds: string[]
  calendarDurationMinutes: string
  calendarAllDay: boolean
}

function emptyForm(): HitoForm {
  return {
    name: '', period: 'PRE_INGRESO', taskType: 'PLAZO', tool: '', plantilla: '',
    responsableProfileId: '', appliesTo: '', daysFromStart: '', subTasks: [],
    calendarAttendeeIds: [], calendarDurationMinutes: '60', calendarAllDay: false,
  }
}

function taskToForm(t: OnboardingDbTemplateTask): HitoForm {
  const cfg = (t.automationConfig as any) ?? {}
  return {
    name:                t.name,
    period:              t.period,
    taskType:            t.taskType ?? 'PLAZO',
    tool:                t.tool ?? '',
    plantilla:           cfg.templateKey ?? '',
    responsableProfileId: t.responsableProfileId ?? '',
    appliesTo:           (t.appliesTo ?? []).join(', '),
    daysFromStart:       cfg.daysFromStart?.toString() ?? '',
    calendarAttendeeIds:     cfg.attendeeProfileIds ?? [],
    calendarDurationMinutes: cfg.durationMinutes === 0 ? '60' : (cfg.durationMinutes?.toString() ?? '60'),
    calendarAllDay:          cfg.durationMinutes === 0,
    subTasks: (t.subTasks ?? []).map(st => {
      let calendarAttendeeIds: string[]  = []
      let calendarDaysFromStart          = ''
      let calendarDurationMinutes        = '60'
      let calendarAllDay                 = false
      let plantilla                      = st.plantilla ?? ''
      if (st.tool === 'CALENDAR' && st.plantilla) {
        try {
          const c = JSON.parse(st.plantilla)
          calendarAttendeeIds     = c.attendeeProfileIds ?? []
          calendarDaysFromStart   = c.daysFromStart?.toString() ?? '0'
          calendarAllDay          = c.durationMinutes === 0
          calendarDurationMinutes = c.durationMinutes === 0 ? '60' : (c.durationMinutes?.toString() ?? '60')
          plantilla = ''
        } catch {}
      }
      return {
        id:                   st.id,
        name:                 st.name,
        responsableProfileId: st.responsableProfileId ?? '',
        tool:                 st.tool ?? '',
        plantilla,
        calendarAttendeeIds,
        calendarDaysFromStart,
        calendarDurationMinutes,
        calendarAllDay,
      }
    }),
  }
}

function HitoFormFields({
  form, setForm, profiles, jobTitles,
}: {
  form: HitoForm
  setForm: React.Dispatch<React.SetStateAction<HitoForm>>
  profiles: { id: string; name: string; email: string }[]
  jobTitles: string[]
}) {
  const { data: emailTemplates  = [] } = useEmailTemplates()
  const { data: sheetTemplates  = [] } = useSheetTemplates()
  const f = <K extends keyof HitoForm>(key: K, val: HitoForm[K]) => setForm(prev => ({ ...prev, [key]: val }))

  const addSubTask = () => setForm(prev => ({
    ...prev,
    subTasks: [...prev.subTasks, {
      name: '', responsableProfileId: '', tool: '', plantilla: '',
      calendarAttendeeIds: [], calendarDaysFromStart: '0', calendarDurationMinutes: '60', calendarAllDay: false,
    }],
  }))

  const updateSubTask = (i: number, patch: Partial<SubTaskForm>) =>
    setForm(prev => ({ ...prev, subTasks: prev.subTasks.map((st, idx) => idx === i ? { ...st, ...patch } : st) }))

  const deleteSubTask = (i: number) =>
    setForm(prev => ({ ...prev, subTasks: prev.subTasks.filter((_, idx) => idx !== i) }))

  const daysLabel = form.period === 'PRE_INGRESO'
    ? 'Días antes del ingreso (ej. 7 = una semana antes)'
    : 'Días desde el ingreso (ej. 0 = Día 1, 30 = Mes 1)'

  return (
    <div className="space-y-3">
      {/* Nombre */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Nombre <span className="text-red-400">*</span>
        </label>
        <input
          autoFocus
          value={form.name}
          onChange={e => f('name', e.target.value)}
          placeholder="Nombre del hito..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Segmento + Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Segmento</label>
          <select
            value={form.period}
            onChange={e => f('period', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {PERIOD_ORDER.map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
          <select
            value={form.taskType}
            onChange={e => f('taskType', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="PLAZO">Plazo</option>
            <option value="FECHA_ESPECIFICA">Fecha específica</option>
          </select>
        </div>
      </div>

      {/* Días desde el ingreso */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Día del proceso
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.daysFromStart}
            onChange={e => f('daysFromStart', e.target.value)}
            placeholder="ej. 0"
            min={-90}
            max={365}
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">{daysLabel}</span>
        </div>
      </div>

      {/* Responsable */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsable</label>
        <select
          value={form.responsableProfileId}
          onChange={e => f('responsableProfileId', e.target.value)}
          className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Sin responsable</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Cargos que aplica */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Cargos que aplica
          <span className="ml-1 font-normal text-gray-400 normal-case">(vacío = Todos)</span>
        </label>
        <input
          value={form.appliesTo}
          onChange={e => f('appliesTo', e.target.value)}
          placeholder="Diseñador Gráfico, Desarrollador... (separar por coma)"
          list="hito-jobtitles"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="hito-jobtitles">
          {jobTitles.map(jt => <option key={jt} value={jt} />)}
        </datalist>
      </div>

      {/* Herramienta + Plantilla — solo para FECHA_ESPECIFICA */}
      {form.taskType === 'FECHA_ESPECIFICA' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Herramienta</label>
            <select
              value={form.tool}
              onChange={e => setForm(prev => ({ ...prev, tool: e.target.value, plantilla: '' }))}
              className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Sin herramienta</option>
              {TOOL_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {form.tool === 'EMAIL' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Plantilla de correo</label>
              <select
                value={form.plantilla}
                onChange={e => f('plantilla', e.target.value)}
                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Sin plantilla</option>
                {emailTemplates.map(tpl => (
                  <option key={tpl.key} value={tpl.key}>{tpl.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.tool === 'SHEET_VERIFY' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sheet vinculado</label>
              <select
                value={form.plantilla}
                onChange={e => f('plantilla', e.target.value)}
                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Sin sheet</option>
                {sheetTemplates.map(s => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.tool === 'CALENDAR' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Invitados al evento
                </label>
                <div className="max-h-28 overflow-y-auto border border-gray-200 rounded-lg bg-white py-1 px-1.5">
                  {profiles.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-purple-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.calendarAttendeeIds.includes(p.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...form.calendarAttendeeIds, p.id]
                            : form.calendarAttendeeIds.filter(id => id !== p.id)
                          f('calendarAttendeeIds', ids)
                        }}
                        className="w-3.5 h-3.5 rounded accent-purple-600 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-auto truncate">{p.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Duración
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.calendarAllDay}
                      onChange={e => f('calendarAllDay', e.target.checked)}
                      className="w-4 h-4 rounded accent-purple-600"
                    />
                    <span className="text-sm text-gray-600">Día completo</span>
                  </label>
                  {!form.calendarAllDay && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={form.calendarDurationMinutes}
                        onChange={e => f('calendarDurationMinutes', e.target.value)}
                        min={15}
                        step={15}
                        placeholder="60"
                        className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-xs text-gray-400">minutos</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Subtareas — solo para PLAZO */}
      {form.taskType === 'PLAZO' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Tareas <span className="font-normal text-gray-400 normal-case">({form.subTasks.length})</span>
            </label>
            <button
              type="button"
              onClick={addSubTask}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus size={11} /> Agregar tarea
            </button>
          </div>

          {form.subTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-1.5 px-0.5">
                <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Acción</span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Responsable</span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Herramienta</span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">Plantilla</span>
                <span />
              </div>
              {form.subTasks.map((st, i) => (
                <SubTaskRow
                  key={i}
                  st={st}
                  index={i}
                  profiles={profiles}
                  emailTemplates={emailTemplates}
                  sheetTemplates={sheetTemplates}
                  onChange={updateSubTask}
                  onDelete={deleteSubTask}
                />
              ))}
            </div>
          )}

          {form.subTasks.length === 0 && (
            <p className="text-xs text-gray-300 italic">Sin tareas — agrega tareas específicas para este hito.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal para crear / editar hito ──────────────────────────────────────────

function HitoModal({
  initial, jobTitles, onSave, onClose, saving,
}: {
  initial: HitoForm
  jobTitles: string[]
  onSave: (form: HitoForm) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm]     = useState<HitoForm>(initial)
  const { data: profiles = [] } = useProfiles()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{initial.name ? 'Editar hito' : 'Nuevo hito'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <HitoFormFields form={form} setForm={setForm} profiles={profiles} jobTitles={jobTitles} />
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de hito en vista plantilla ──────────────────────────────────────

function HitoCard({
  task, jobTitles, onEdit, onDelete,
}: {
  task: OnboardingDbTemplateTask
  jobTitles: string[]
  onEdit: (t: OnboardingDbTemplateTask) => void
  onDelete: (t: OnboardingDbTemplateTask) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: profiles = [] }  = useProfiles()
  const updateTask = useUpdateTemplateTask()

  const toggleActive = () => {
    updateTask.mutate({ key: task.key, isActive: !task.isActive })
  }

  const responsableName = task.responsable?.name
    ?? profiles.find(p => p.id === task.responsableProfileId)?.name

  const appliesTo: string[] = task.appliesTo ?? []

  return (
    <div className={`rounded-lg border bg-white overflow-hidden transition-all ${task.isActive ? 'border-gray-100' : 'border-gray-100 opacity-40'}`}>
      {/* Fila principal */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => setExpanded(v => !v)} className="text-gray-300 flex-shrink-0">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(v => !v)}>
          <p className="text-sm text-gray-800 truncate">{task.name}</p>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PERIOD_COLORS[task.period]}`}>
              {PERIOD_LABELS[task.period]}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              (task.taskType ?? 'PLAZO') === 'FECHA_ESPECIFICA'
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {(task.taskType ?? 'PLAZO') === 'FECHA_ESPECIFICA' ? 'Fecha específica' : 'Plazo'}
            </span>
            {task.tool && <ToolBadge type={task.tool} />}
            {responsableName && (
              <span className="text-[10px] text-gray-400 truncate">· {responsableName}</span>
            )}
            {(task.subTasks ?? []).length > 0 && (
              <span className="text-[10px] text-gray-400">· {task.subTasks.length} tareas</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
            title="Editar hito"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={toggleActive}
            className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors"
            title={task.isActive ? 'Desactivar' : 'Activar'}
          >
            {task.isActive
              ? <Check size={12} className="text-green-500" />
              : <Circle size={12} />
            }
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
            title="Eliminar hito"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Panel expandido */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 space-y-2 bg-gray-50/40">
          {/* Cargos que aplica */}
          <div className="flex items-start gap-2 text-xs">
            <span className="text-gray-400 flex-shrink-0">Cargos:</span>
            <span className="text-gray-600">
              {appliesTo.length === 0 ? 'Todos' : appliesTo.join(', ')}
            </span>
          </div>

          {/* Día del proceso */}
          {(task.automationConfig as any)?.daysFromStart !== undefined && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-400 flex-shrink-0">Día:</span>
              <span className="text-indigo-600 font-medium">
                {task.period === 'PRE_INGRESO'
                  ? `${(task.automationConfig as any).daysFromStart} días antes del ingreso`
                  : `Día ${(task.automationConfig as any).daysFromStart}`}
              </span>
            </div>
          )}

          {/* Plantilla vinculada */}
          {(task.automationConfig as any)?.templateKey && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-gray-400 flex-shrink-0">Plantilla:</span>
              <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                {(task.automationConfig as any).templateKey}
              </code>
            </div>
          )}

          {/* Subtareas */}
          {(task.subTasks ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Tareas ({task.subTasks.length})
              </p>
              <div className="space-y-1">
                {task.subTasks.map((st, i) => (
                  <div key={st.id ?? i} className="flex items-center gap-2 text-xs px-2.5 py-1.5 bg-white rounded-lg border border-gray-100">
                    <Circle size={11} className="text-gray-300 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">{st.name}</span>
                    {st.tool && <ToolBadge type={st.tool} />}
                    {st.plantilla && <span className="text-gray-400 text-[10px] truncate max-w-[80px]">{st.plantilla}</span>}
                    {st.responsable && (
                      <span className="text-[10px] text-gray-400">{st.responsable.name.split(' ')[0]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-tab: Plantilla global ────────────────────────────────────────────────

function PlantillaTab() {
  const { data: tasks = [], isLoading } = useTemplateTasks()
  const createTask  = useCreateTemplateTask()
  const updateTask  = useUpdateTemplateTask()
  const deleteTask  = useDeleteTemplateTask()

  const [modal, setModal]   = useState<{ mode: 'create' | 'edit'; task?: OnboardingDbTemplateTask } | null>(null)
  const [newPeriod, setNewPeriod] = useState<OnboardingPeriod | null>(null)

  // For new hito, pre-fill the period
  const openCreate = (period?: OnboardingPeriod) => {
    setNewPeriod(period ?? 'PRE_INGRESO')
    setModal({ mode: 'create' })
  }

  const openEdit = (t: OnboardingDbTemplateTask) => setModal({ mode: 'edit', task: t })

  const initialForm = useMemo<HitoForm>(() => {
    if (modal?.mode === 'edit' && modal.task) return taskToForm(modal.task)
    const base = emptyForm()
    if (newPeriod) base.period = newPeriod
    return base
  }, [modal, newPeriod])

  const handleDelete = (t: OnboardingDbTemplateTask) => {
    if (!confirm(`¿Eliminar el hito "${t.name}"? Esta acción no se puede deshacer.`)) return
    deleteTask.mutate(t.key)
  }

  const handleSave = async (form: HitoForm) => {
    const appliesToArr = form.appliesTo.split(',').map(s => s.trim()).filter(Boolean)
    const daysFromStartNum = form.daysFromStart !== '' ? parseInt(form.daysFromStart, 10) : null
    const configEntries: Record<string, any> = {}
    if (daysFromStartNum !== null && !isNaN(daysFromStartNum)) configEntries.daysFromStart = daysFromStartNum
    if (form.taskType === 'FECHA_ESPECIFICA') {
      if (form.tool === 'CALENDAR') {
        if (form.calendarAttendeeIds.length > 0) configEntries.attendeeProfileIds = form.calendarAttendeeIds
        configEntries.durationMinutes = form.calendarAllDay ? 0 : (parseInt(form.calendarDurationMinutes || '60', 10) || 60)
      } else if (form.plantilla) {
        configEntries.templateKey = form.plantilla
      }
    }
    const automationConfig = Object.keys(configEntries).length > 0 ? configEntries : null
    const subTasksPayload = form.taskType === 'PLAZO'
      ? form.subTasks.filter(st => st.name.trim()).map((st, i) => {
          let plantilla: string | null = st.plantilla || null
          if (st.tool === 'CALENDAR') {
            plantilla = JSON.stringify({
              attendeeProfileIds: st.calendarAttendeeIds,
              daysFromStart: st.calendarDaysFromStart !== '' ? parseInt(st.calendarDaysFromStart, 10) : 0,
              durationMinutes: st.calendarAllDay ? 0 : parseInt(st.calendarDurationMinutes || '60', 10),
            })
          }
          return {
            name:                st.name.trim(),
            responsableProfileId: st.responsableProfileId || null,
            tool:                st.tool || null,
            plantilla,
            sortOrder:           i,
          }
        })
      : []

    const payload = {
      name:                 form.name.trim(),
      period:               form.period,
      taskType:             form.taskType,
      tool:                 form.taskType === 'FECHA_ESPECIFICA' ? (form.tool || null) : null,
      automationType:       form.taskType === 'FECHA_ESPECIFICA' ? (form.tool || 'MANUAL') : 'MANUAL',
      automationConfig,
      responsableProfileId: form.responsableProfileId || null,
      appliesTo:            appliesToArr,
      subTasks:             subTasksPayload,
    }

    if (modal?.mode === 'edit' && modal.task) {
      await updateTask.mutateAsync({ key: modal.task.key, ...payload })
    } else {
      await createTask.mutateAsync(payload)
    }
    setModal(null)
  }

  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingDbTemplateTask[]>()
    PERIOD_ORDER.forEach(p => map.set(p, []))
    tasks.forEach(t => map.get(t.period as OnboardingPeriod)?.push(t))
    return map
  }, [tasks])

  // Collect all job titles from appliesTo fields for datalist
  const jobTitles = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => (t.appliesTo ?? []).forEach(jt => set.add(jt)))
    return [...set].sort()
  }, [tasks])

  const saving = createTask.isPending || updateTask.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <strong>{tasks.filter(t => t.isActive).length}</strong> hitos activos de {tasks.length} en la plantilla global.
        </p>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Nuevo hito
        </button>
      </div>

      {/* Grupos por segmento */}
      {PERIOD_ORDER.map(period => {
        const periodTasks = byPeriod.get(period) ?? []
        return (
          <div key={period}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${PERIOD_COLORS[period]}`}>
                  {PERIOD_LABELS[period]}
                </span>
                <span className="text-xs text-gray-400">
                  {periodTasks.filter(t => t.isActive).length} / {periodTasks.length}
                </span>
              </div>
              <button
                onClick={() => openCreate(period)}
                className="flex items-center gap-1 text-xs text-gray-300 hover:text-blue-500 transition-colors"
              >
                <Plus size={11} /> Agregar
              </button>
            </div>

            <div className="space-y-1.5">
              {periodTasks.map(task => (
                <HitoCard
                  key={task.id}
                  task={task}
                  jobTitles={jobTitles}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
              {periodTasks.length === 0 && (
                <p className="text-xs text-gray-300 italic px-2">Sin hitos en este segmento</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Modal */}
      {modal && (
        <HitoModal
          initial={initialForm}
          jobTitles={jobTitles}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

// ─── Sub-tab: Vista Cruzada ───────────────────────────────────────────────────

function VistaCruzadaTab() {
  const { data: tasks = [], isLoading: loadingTasks } = useTemplateTasks()
  const { data: processes = [], isLoading: loadingProcs } = useOnboardingProcesses()

  const activeTasks = useMemo(() => tasks.filter(t => t.isActive), [tasks])
  const activeProcs = useMemo(() => processes.filter(p => p.status === 'IN_PROGRESS'), [processes])
  const isLoading   = loadingTasks || loadingProcs

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
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide border border-gray-100 ${PERIOD_COLORS[period]}`}
                  >
                    {PERIOD_LABELS[period]}
                  </td>
                </tr>
                {periodTasks.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white border border-gray-100 px-3 py-2 text-gray-700">
                      {task.name}
                      {(task.automationConfig as any)?.daysFromStart !== undefined && (
                        <span className="ml-1 text-[10px] text-indigo-400">
                          · día {(task.automationConfig as any).daysFromStart}
                        </span>
                      )}
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
