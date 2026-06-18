// Modal de creación/edición de Centro de Trabajo. Extraído de WorkCentersPage.tsx.
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useCreateWorkCenter, useUpdateWorkCenter } from '@/hooks/useWorkCenters'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { WorkCenter, CostType } from '@/types'
import { COST_TYPE_LABEL } from './wcUtils'

export function WorkCenterModal({ initial, onClose }: { initial?: WorkCenter | null; onClose: () => void }) {
  useEscapeKey(onClose)
  const [name,        setName]        = useState(initial?.name ?? '')
  const [costType,    setCostType]    = useState<CostType>(initial?.costType ?? 'DIRECTO')
  const [presupuesto, setPresupuesto] = useState(initial?.presupuesto ? String(Math.round(initial.presupuesto)) : '')
  const [error,       setError]       = useState('')

  const create    = useCreateWorkCenter()
  const update    = useUpdateWorkCenter()
  const isPending = create.isPending || update.isPending

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    const budgetVal = presupuesto.trim() ? (Number(presupuesto.replace(/[^0-9]/g, '')) || null) : null
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, name: name.trim(), costType, presupuesto: budgetVal })
      } else {
        await create.mutateAsync({ name: name.trim(), costType, presupuesto: budgetVal })
      }
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {initial ? 'Editar centro' : 'Nuevo centro de trabajo'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              value={name} onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Ej: CODELCO DET"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de costo</label>
            <div className="flex gap-3">
              {(['DIRECTO', 'INDIRECTO'] as CostType[]).map(t => (
                <button key={t} onClick={() => setCostType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    costType === t ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {COST_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto mensual (CLP)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                value={presupuesto} onChange={e => setPresupuesto(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Opcional · Permite calcular ejecución presupuestaria</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={handleSave} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            <Save size={14} />
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
