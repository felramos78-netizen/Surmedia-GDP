import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, X, Save, ExternalLink, Loader2, Check, ToggleLeft, ToggleRight, Wand2, AlertTriangle } from 'lucide-react'
import {
  useSheetTemplates, useCreateSheetTemplate, useUpdateSheetTemplate, useDeleteSheetTemplate,
  useSheetTargetFields, useSheetColumns,
} from '@/hooks/useOnboarding'
import type { OnboardingSheetTemplate } from '@/types'

// ─── Modal crear / editar ─────────────────────────────────────────────────────

interface SheetForm {
  key:         string
  name:        string
  url:         string
  rutColumn:   string
  sheetName:   string
  description: string
}

function emptyForm(): SheetForm {
  return { key: '', name: '', url: '', rutColumn: 'RUT', sheetName: '', description: '' }
}

function sheetToForm(s: OnboardingSheetTemplate): SheetForm {
  return {
    key:         s.key,
    name:        s.name,
    url:         s.url,
    rutColumn:   s.rutColumn,
    sheetName:   s.sheetName ?? '',
    description: s.description ?? '',
  }
}

function SheetModal({
  initial, editing, onSave, onClose, saving,
}: {
  initial:  SheetForm
  editing:  boolean
  onSave:   (form: SheetForm) => Promise<void>
  onClose:  () => void
  saving:   boolean
}) {
  const [form, setForm] = useState<SheetForm>(initial)
  const [error, setError] = useState('')
  const f = (k: keyof SheetForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  const valid = form.name.trim() && form.url.trim() && form.rutColumn.trim() && (editing || form.key.trim())

  const handleSave = async () => {
    setError('')
    try {
      await onSave(form)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al guardar. Verifica que el backend esté corriendo y la DB migrada.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{editing ? 'Editar Sheet' : 'Nuevo Sheet'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}
          {!editing && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Key único <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                value={form.key}
                onChange={e => f('key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="ej. ficha-personal"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus={editing}
              value={form.name}
              onChange={e => f('name', e.target.value)}
              placeholder="Ej: Ficha Personal del Ingresante"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              URL de Google Sheets <span className="text-red-400">*</span>
            </label>
            <input
              value={form.url}
              onChange={e => f('url', e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Columna RUT <span className="text-red-400">*</span>
              </label>
              <input
                value={form.rutColumn}
                onChange={e => f('rutColumn', e.target.value)}
                placeholder="RUT"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">Encabezado exacto de la columna RUT</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Pestaña del sheet
              </label>
              <input
                value={form.sheetName}
                onChange={e => f('sheetName', e.target.value)}
                placeholder="Hoja1 (vacío = primera)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => f('description', e.target.value)}
              rows={2}
              placeholder="Para qué sirve este formulario..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!valid || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Mapeo de columnas ─────────────────────────────────────────────────

function ColumnMappingModal({ sheet, onClose }: { sheet: OnboardingSheetTemplate; onClose: () => void }) {
  const { data: fields = [] } = useSheetTargetFields()
  const fetchColumns = useSheetColumns()
  const updateSheet  = useUpdateSheetTemplate()
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [headers, setHeaders] = useState<string[]>([])
  const [autoSuggested, setAutoSuggested] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchColumns.mutate(sheet.key, {
      onSuccess: (data) => {
        setHeaders(data.headers)
        const initial: Record<string, string> = {}
        const auto = new Set<string>()
        for (const h of data.headers) {
          if (data.current[h]) {
            initial[h] = data.current[h]
          } else if (data.suggested[h]) {
            initial[h] = data.suggested[h]
            auto.add(h)
          }
        }
        setMapping(initial)
        setAutoSuggested(auto)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.key])

  const setField = (header: string, field: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (field) next[header] = field; else delete next[header]
      return next
    })
    setAutoSuggested(prev => {
      const next = new Set(prev); next.delete(header); return next
    })
  }

  const mappedCount = Object.keys(mapping).length

  const handleSave = async () => {
    await updateSheet.mutateAsync({ key: sheet.key, columnMappings: mapping })
    onClose()
  }

  const usedFields = new Set(Object.values(mapping))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mapeo de columnas</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sheet.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3">
          {fetchColumns.isPending && (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Leyendo encabezados del sheet...</span>
            </div>
          )}

          {fetchColumns.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertTriangle size={14} />
              {(fetchColumns.error as any)?.response?.data?.message ?? 'Error al leer el sheet.'}
            </div>
          )}

          {fetchColumns.isSuccess && headers.length === 0 && (
            <p className="text-sm text-gray-400 py-4">El sheet no tiene encabezados (primera fila vacía).</p>
          )}

          {fetchColumns.isSuccess && headers.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Wand2 size={12} className="text-brand-400" />
                Las columnas resaltadas se mapearon automáticamente comparando el encabezado con los campos del sistema. Revisa y ajusta antes de guardar.
              </div>
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-medium text-gray-500 w-1/2">Columna del sheet</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 w-1/2">Campo del sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map(header => (
                      <tr key={header} className={`border-b border-gray-50 last:border-0 ${autoSuggested.has(header) ? 'bg-brand-50/30' : ''}`}>
                        <td className="px-3 py-2 text-gray-700">
                          {header}
                          {autoSuggested.has(header) && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-brand-100 text-brand-600">auto</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={mapping[header] ?? ''}
                            onChange={e => setField(header, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="">No mapear</option>
                            {fields.map(f => (
                              <option
                                key={f.key}
                                value={f.key}
                                disabled={usedFields.has(f.key) && mapping[header] !== f.key}
                              >
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">{mappedCount} {mappedCount === 1 ? 'columna mapeada' : 'columnas mapeadas'}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={updateSheet.isPending || fetchColumns.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {updateSheet.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar mapeo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export default function SheetsPanel() {
  const { data: sheets = [], isLoading } = useSheetTemplates()
  const createSheet = useCreateSheetTemplate()
  const updateSheet = useUpdateSheetTemplate()
  const deleteSheet = useDeleteSheetTemplate()

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; sheet?: OnboardingSheetTemplate } | null>(null)
  const [mappingModal, setMappingModal] = useState<OnboardingSheetTemplate | null>(null)

  const handleSave = async (form: SheetForm) => {
    if (modal?.mode === 'edit' && modal.sheet) {
      await updateSheet.mutateAsync({
        key:         modal.sheet.key,
        name:        form.name.trim(),
        url:         form.url.trim(),
        rutColumn:   form.rutColumn.trim(),
        sheetName:   form.sheetName.trim() || undefined,
        description: form.description.trim() || undefined,
      })
    } else {
      await createSheet.mutateAsync({
        key:         form.key.trim(),
        name:        form.name.trim(),
        url:         form.url.trim(),
        rutColumn:   form.rutColumn.trim(),
        sheetName:   form.sheetName.trim() || undefined,
        description: form.description.trim() || undefined,
      })
    }
    setModal(null)
  }

  const handleDelete = (sheet: OnboardingSheetTemplate) => {
    if (!confirm(`¿Eliminar el sheet "${sheet.name}"? Esta acción no se puede deshacer.`)) return
    deleteSheet.mutate(sheet.key)
  }

  const toggleActive = (sheet: OnboardingSheetTemplate) => {
    updateSheet.mutate({ key: sheet.key, isActive: !sheet.isActive })
  }

  const saving = createSheet.isPending || updateSheet.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">Repositorio de Google Sheets</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Cada sheet aquí puede vincularse a un hito con herramienta <span className="font-medium">Sheet Verify</span>. La columna RUT se usa para hacer match con el colaborador del proceso.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
        >
          <Plus size={14} /> Agregar sheet
        </button>
      </div>

      {/* Lista */}
      {sheets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm">No hay sheets vinculados todavía.</p>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus size={14} /> Agregar el primero
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sheets.map(sheet => (
            <div
              key={sheet.id}
              className={`bg-white border rounded-xl p-4 transition-all ${sheet.isActive ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{sheet.name}</p>
                    <code className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{sheet.key}</code>
                    {!sheet.isActive && (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Inactivo</span>
                    )}
                  </div>
                  {sheet.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{sheet.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                    <span>
                      Columna RUT: <span className="font-medium text-gray-600">"{sheet.rutColumn}"</span>
                    </span>
                    {sheet.sheetName && (
                      <span>Pestaña: <span className="font-medium text-gray-600">"{sheet.sheetName}"</span></span>
                    )}
                    <a
                      href={sheet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-brand-500 hover:text-brand-700"
                    >
                      <ExternalLink size={11} /> Abrir sheet
                    </a>
                  </div>
                  {Object.keys(sheet.columnMappings ?? {}).length > 0 ? (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {Object.keys(sheet.columnMappings).length} columnas mapeadas al perfil del colaborador
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> Sin columnas mapeadas — la verificación no actualizará nada
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setMappingModal(sheet)}
                    className="p-1.5 text-gray-300 hover:text-brand-500 transition-colors"
                    title="Mapear columnas"
                  >
                    <Wand2 size={13} />
                  </button>
                  <button
                    onClick={() => setModal({ mode: 'edit', sheet })}
                    className="p-1.5 text-gray-300 hover:text-brand-500 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => toggleActive(sheet)}
                    className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors"
                    title={sheet.isActive ? 'Desactivar' : 'Activar'}
                  >
                    {sheet.isActive
                      ? <ToggleRight size={15} className="text-green-500" />
                      : <ToggleLeft size={15} />}
                  </button>
                  <button
                    onClick={() => handleDelete(sheet)}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <SheetModal
          initial={modal.mode === 'edit' && modal.sheet ? sheetToForm(modal.sheet) : emptyForm()}
          editing={modal.mode === 'edit'}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {mappingModal && (
        <ColumnMappingModal sheet={mappingModal} onClose={() => setMappingModal(null)} />
      )}
    </div>
  )
}
