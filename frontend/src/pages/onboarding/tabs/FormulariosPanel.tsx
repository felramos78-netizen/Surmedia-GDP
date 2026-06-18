import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Copy, Check, ExternalLink, FileText, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react'
import {
  useProcessForms, useCreateForm, useUpdateForm,
  useDeleteForm, useFormResponses,
} from '@/hooks/useOnboarding'
import type { OnboardingProcess, OnboardingForm, FormField, FormFieldType, FormResponse } from '@/types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text:     'Texto corto',
  textarea: 'Párrafo',
  date:     'Fecha',
  select:   'Selección',
  radio:    'Opción única',
  checkbox: 'Casillas',
}

const FIELD_DEFAULTS: Record<FormFieldType, Partial<FormField>> = {
  text:     { placeholder: 'Escribe aquí…' },
  textarea: { placeholder: 'Escribe aquí…' },
  date:     {},
  select:   { options: ['Opción 1', 'Opción 2'] },
  radio:    { options: ['Opción 1', 'Opción 2'] },
  checkbox: { options: ['Opción 1', 'Opción 2'] },
}

function newField(type: FormFieldType = 'text'): FormField {
  return {
    id:       crypto.randomUUID(),
    label:    '',
    type,
    required: false,
    ...FIELD_DEFAULTS[type],
  }
}

// ─── Editor de campo ──────────────────────────────────────────────────────────

function FieldEditor({
  field, idx, total, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  field:       FormField
  idx:         number
  total:       number
  onChange:    (f: FormField) => void
  onRemove:    () => void
  onMoveUp:    () => void
  onMoveDown:  () => void
}) {
  const upd = (partial: Partial<FormField>) => onChange({ ...field, ...partial })
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type)

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium">{idx + 1}</span>
        <input
          type="text"
          value={field.label}
          onChange={e => upd({ label: e.target.value })}
          placeholder="Etiqueta del campo *"
          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={field.type}
          onChange={e => upd({ type: e.target.value as FormFieldType, ...FIELD_DEFAULTS[e.target.value as FormFieldType] })}
          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none bg-white"
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={field.required} onChange={e => upd({ required: e.target.checked })} className="rounded" />
          Requerido
        </label>
        <div className="flex gap-1">
          <button onClick={onMoveUp}   disabled={idx === 0}           aria-label="Mover arriba" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronUp size={13} /></button>
          <button onClick={onMoveDown} disabled={idx === total - 1}   aria-label="Mover abajo" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronDown size={13} /></button>
          <button onClick={onRemove} aria-label="Eliminar campo" className="p-1 text-red-400 hover:text-red-600"><X size={13} /></button>
        </div>
      </div>

      {/* Opciones para select/radio/checkbox */}
      {hasOptions && (
        <div className="space-y-1.5 pl-4">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Opciones</p>
          {(field.options ?? []).map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <input
                type="text"
                value={opt}
                onChange={e => {
                  const opts = [...(field.options ?? [])]
                  opts[oi] = e.target.value
                  upd({ options: opts })
                }}
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <button
                onClick={() => upd({ options: (field.options ?? []).filter((_, i) => i !== oi) })}
                aria-label="Eliminar opción"
                className="p-0.5 text-gray-300 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={() => upd({ options: [...(field.options ?? []), `Opción ${(field.options?.length ?? 0) + 1}`] })}
            className="text-[11px] text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            <Plus size={10} /> Agregar opción
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Constructor de formulario ────────────────────────────────────────────────

function FormBuilder({
  form,
  processId,
  onClose,
}: {
  form:      OnboardingForm | null
  processId: string
  onClose:   () => void
}) {
  const [title,  setTitle]  = useState(form?.title ?? '')
  const [fields, setFields] = useState<FormField[]>((form?.fields as FormField[]) ?? [])

  const createForm = useCreateForm()
  const updateForm = useUpdateForm()

  const dirty  = form ? (title !== form.title || JSON.stringify(fields) !== JSON.stringify(form.fields)) : true
  const valid  = title.trim().length > 0

  const addField = (type: FormFieldType = 'text') => setFields(f => [...f, newField(type)])

  const moveField = (idx: number, dir: 'up' | 'down') => {
    setFields(f => {
      const arr = [...f]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  const handleSave = async () => {
    if (!valid) return
    if (form) {
      await updateForm.mutateAsync({ formId: form.id, processId, title: title.trim(), fields })
    } else {
      await createForm.mutateAsync({ processId, title: title.trim(), fields })
    }
    onClose()
  }

  const isPending = createForm.isPending || updateForm.isPending

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">Título del formulario *</label>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Datos de ingreso — Formulario de bienvenida"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">Campos ({fields.length})</p>
          <div className="flex items-center gap-1">
            {(['text', 'textarea', 'date', 'select', 'radio', 'checkbox'] as FormFieldType[]).map(type => (
              <button
                key={type}
                onClick={() => addField(type)}
                title={`Agregar ${FIELD_TYPE_LABELS[type]}`}
                className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
              >
                + {FIELD_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        {fields.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center text-gray-400 text-sm">
            Agrega campos usando los botones de arriba
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {fields.map((f, i) => (
              <FieldEditor
                key={f.id}
                field={f}
                idx={i}
                total={fields.length}
                onChange={upd => setFields(prev => prev.map((x, j) => j === i ? upd : x))}
                onRemove={() => setFields(prev => prev.filter((_, j) => j !== i))}
                onMoveUp={() => moveField(i, 'up')}
                onMoveDown={() => moveField(i, 'down')}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
        <button
          onClick={handleSave}
          disabled={!valid || !dirty || isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Guardando…' : form ? 'Actualizar formulario' : 'Crear formulario'}
        </button>
      </div>
    </div>
  )
}

// ─── Visor de respuestas ──────────────────────────────────────────────────────

function ResponsesViewer({ form }: { form: OnboardingForm }) {
  const { data: responses = [], isLoading } = useFormResponses(form.id)
  const fields = form.fields as FormField[]

  if (isLoading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
        <FileText size={26} className="opacity-30" />
        <p className="text-sm">Sin respuestas todavía.</p>
      </div>
    )
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-gray-400 mb-3">{responses.length} respuesta{responses.length !== 1 ? 's' : ''}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-100 px-3 py-2 text-left text-gray-500 bg-gray-50">Respondente</th>
            <th className="border border-gray-100 px-3 py-2 text-left text-gray-500 bg-gray-50">Fecha</th>
            {fields.map(f => (
              <th key={f.id} className="border border-gray-100 px-3 py-2 text-left text-gray-500 bg-gray-50 max-w-[160px]">
                {f.label || f.type}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((r: FormResponse) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="border border-gray-100 px-3 py-2">
                <p className="font-medium">{r.respondentName ?? '—'}</p>
                {r.respondentEmail && <p className="text-gray-400">{r.respondentEmail}</p>}
              </td>
              <td className="border border-gray-100 px-3 py-2 whitespace-nowrap text-gray-500">{fmtDate(r.submittedAt)}</td>
              {fields.map(f => (
                <td key={f.id} className="border border-gray-100 px-3 py-2 max-w-[160px] truncate text-gray-700">
                  {Array.isArray((r.data as any)[f.id])
                    ? ((r.data as any)[f.id] as string[]).join(', ')
                    : String((r.data as any)[f.id] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Panel principal Formularios ──────────────────────────────────────────────

interface Props {
  processes: OnboardingProcess[]
}

export default function FormulariosPanel({ processes }: Props) {
  const [processId, setProcessId] = useState<string | null>(processes[0]?.id ?? null)
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [editing, setEditing] = useState<OnboardingForm | null | 'new'>(null)
  const [panelTab, setPanelTab] = useState<'editor' | 'responses'>('editor')
  const [copied, setCopied] = useState(false)

  const { data: forms = [], isLoading } = useProcessForms(processId)
  const deleteForm = useDeleteForm()

  const selectedForm = forms.find(f => f.id === selectedFormId) ?? forms[0] ?? null
  const activeProcs  = processes.filter(p => p.status === 'IN_PROGRESS')

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/forms/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDeleteForm = async (form: OnboardingForm) => {
    if (!confirm(`¿Eliminar el formulario "${form.title}"? Esta acción es irreversible.`)) return
    await deleteForm.mutateAsync({ formId: form.id, processId: processId! })
    if (selectedFormId === form.id) setSelectedFormId(null)
  }

  if (editing !== null) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {editing === 'new' ? 'Nuevo formulario' : `Editar: ${(editing as OnboardingForm).title}`}
          </h3>
        </div>
        <FormBuilder
          form={editing === 'new' ? null : editing as OnboardingForm}
          processId={processId!}
          onClose={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Selector de proceso */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Proceso:</label>
        <select
          value={processId ?? ''}
          onChange={e => { setProcessId(e.target.value || null); setSelectedFormId(null) }}
          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">— Seleccionar proceso —</option>
          {activeProcs.map(p => (
            <option key={p.id} value={p.id}>{p.collaboratorName} · {p.collaboratorPosition ?? '—'}</option>
          ))}
          {processes.filter(p => p.status !== 'IN_PROGRESS').map(p => (
            <option key={p.id} value={p.id}>[{p.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}] {p.collaboratorName}</option>
          ))}
        </select>
        {processId && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <Plus size={12} /> Nuevo formulario
          </button>
        )}
      </div>

      {!processId ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
          <FileText size={32} className="opacity-30" />
          <p className="text-sm">Selecciona un proceso para ver o crear formularios.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 gap-3">
          <FileText size={32} className="opacity-30" />
          <p className="text-sm">No hay formularios para este proceso.</p>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <Plus size={14} /> Crear formulario
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-5">
          {/* Lista de formularios */}
          <div className="bg-white rounded-xl border border-gray-100 h-fit overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Formularios</p>
            </div>
            <div className="divide-y divide-gray-50">
              {forms.map(form => (
                <button
                  key={form.id}
                  onClick={() => setSelectedFormId(form.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    selectedForm?.id === form.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedForm?.id === form.id ? 'text-brand-700' : 'text-gray-800'}`}>
                      {form.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {(form.fields as FormField[]).length} campos · {form._count?.responses ?? 0} respuestas
                    </p>
                  </div>
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ml-2 ${form.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Panel derecho */}
          {selectedForm && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{selectedForm.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(selectedForm.fields as FormField[]).length} campos · {selectedForm._count?.responses ?? 0} respuestas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(selectedForm)} aria-label="Editar formulario" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteForm(selectedForm)} aria-label="Eliminar formulario" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Link para colaborador */}
              <div className="px-4 py-3 bg-brand-50/50 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-1.5">Enlace para colaborador</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-brand-700 truncate">
                    {window.location.origin}/forms/{selectedForm.token}
                  </code>
                  <button
                    onClick={() => copyLink(selectedForm.token)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-white text-gray-600 transition-colors"
                  >
                    {copied ? <><Check size={12} className="text-green-600" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                  <a
                    href={`/forms/${selectedForm.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-500 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Tabs: Campos / Respuestas */}
              <div className="flex border-b border-gray-100">
                {([['editor', 'Campos'], ['responses', `Respuestas (${selectedForm._count?.responses ?? 0})`]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setPanelTab(k)}
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      panelTab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>{l}</button>
                ))}
              </div>

              <div className="p-4">
                {panelTab === 'editor' && (
                  <div className="space-y-2">
                    {(selectedForm.fields as FormField[]).length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-6">Sin campos. Edita el formulario para agregar.</div>
                    ) : (
                      (selectedForm.fields as FormField[]).map((f, i) => (
                        <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <span className="text-xs text-gray-300 w-5 text-right">{i + 1}</span>
                          <div className="flex-1">
                            <span className="text-sm text-gray-800">{f.label}</span>
                            {f.required && <span className="ml-1 text-red-400 text-xs">*</span>}
                          </div>
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{FIELD_TYPE_LABELS[f.type]}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {panelTab === 'responses' && <ResponsesViewer form={selectedForm} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
