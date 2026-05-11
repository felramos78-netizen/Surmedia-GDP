import React, { useState } from 'react'
import { Plus, Trash2, Edit2, X, Save, ExternalLink, Loader2, Check, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  useSheetTemplates, useCreateSheetTemplate, useUpdateSheetTemplate, useDeleteSheetTemplate,
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!valid || saving}
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

// ─── Panel principal ──────────────────────────────────────────────────────────

export default function SheetsPanel() {
  const { data: sheets = [], isLoading } = useSheetTemplates()
  const createSheet = useCreateSheetTemplate()
  const updateSheet = useUpdateSheetTemplate()
  const deleteSheet = useDeleteSheetTemplate()

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; sheet?: OnboardingSheetTemplate } | null>(null)

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
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                      className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink size={11} /> Abrir sheet
                    </a>
                  </div>
                  {Object.keys(sheet.columnMappings ?? {}).length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {Object.keys(sheet.columnMappings).length} columnas mapeadas al perfil del colaborador
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setModal({ mode: 'edit', sheet })}
                    className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
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
    </div>
  )
}
