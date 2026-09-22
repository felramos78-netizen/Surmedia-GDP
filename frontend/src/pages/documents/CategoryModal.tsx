import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useSaveDocCategory, useDeleteDocCategory, type DocCategoryInput, type DocCategorySummary } from '@/hooks/useBukDocuments'
import { useEscapeKey } from '@/hooks/useEscapeKey'

// Crear / editar una categoría de documentos. Al guardar, el backend reclasifica
// todos los documentos con las nuevas palabras clave.
export default function CategoryModal({ category, draft, groups, onClose }: {
  category?: DocCategorySummary                // edición
  draft?:    Partial<DocCategoryInput>          // creación con valores sugeridos
  groups:    string[]
  onClose:   () => void
}) {
  useEscapeKey(onClose)
  const save   = useSaveDocCategory()
  const remove = useDeleteDocCategory()
  const [name,      setName]      = useState(category?.name ?? draft?.name ?? '')
  const [group,     setGroup]     = useState(category?.group ?? draft?.group ?? '')
  const [keywords,  setKeywords]  = useState((category?.keywords ?? draft?.keywords ?? []).join(', '))
  const [required,  setRequired]  = useState(category?.required ?? draft?.required ?? false)
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? draft?.sortOrder ?? 500))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean)
  const valid  = name.trim() && group.trim() && kwList.length > 0
  const error  = (save.error || remove.error) as { response?: { data?: { message?: string } } } | null

  async function submit() {
    await save.mutateAsync({ id: category?.id, name, group, keywords: kwList, required, sortOrder: Number(sortOrder) || 0 })
    onClose()
  }

  async function doDelete() {
    await remove.mutateAsync(category!.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={category ? 'Editar categoría' : 'Nueva categoría'}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{category ? 'Editar categoría' : 'Nueva categoría'}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Nombre</span>
            <input
              value={name} onChange={e => setName(e.target.value)} autoFocus
              placeholder="Ej. Certificado de antecedentes"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Grupo</span>
            <input
              value={group} onChange={e => setGroup(e.target.value)} list="doc-category-groups"
              placeholder="Ej. Documentos personales"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <datalist id="doc-category-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Palabras clave (separadas por coma)</span>
            <input
              value={keywords} onChange={e => setKeywords(e.target.value)}
              placeholder="Ej. antecedentes, certificado de antecedentes"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="block mt-1 text-xs text-gray-400">
              Se buscan en el nombre del archivo (y si no hay coincidencia, en la carpeta), sin distinguir tildes ni
              mayúsculas, como <strong>inicio de palabra</strong>: “capacitaci” encuentra “Capacitación” y “Capacitacin”;
              “odi” encuentra “ODI” pero no “periodo”.
            </span>
          </label>
          <div className="flex items-end gap-6">
            <label className="block w-32">
              <span className="text-xs font-medium text-gray-600">Prioridad</span>
              <input
                type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded" />
              Obligatorio para todo colaborador activo
            </label>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Menor número = mayor prioridad. Si un documento coincide con varias categorías, gana la de menor número
            (pon las específicas, como “Anexo teletrabajo”, antes que las genéricas, como “Anexo”).
          </p>
          {error && <p className="text-sm text-red-500">{error.response?.data?.message ?? 'No se pudo guardar'}</p>}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100">
          {category && (confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">¿Eliminar? Sus documentos quedarán sin clasificar o pasarán a otra categoría.</span>
              <button onClick={doDelete} disabled={remove.isPending} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                Eliminar
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={14} /> Eliminar
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
            <button
              onClick={submit}
              disabled={!valid || save.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando y reclasificando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
