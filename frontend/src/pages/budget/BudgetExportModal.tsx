import { useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { fetchBudgetMovements } from '@/hooks/useBudget'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatCLP } from '@/lib/utils'
import type { BudgetCategory } from '@/types'
import { downloadBudgetExcel } from './budgetExcel'

// Elegir qué segmentos y partidas van en el reporte Excel. Marcar un segmento marca todas
// sus partidas; también se pueden elegir partidas sueltas.
export default function BudgetExportModal({ categories, onClose }: { categories: BudgetCategory[]; onClose: () => void }) {
  useEscapeKey(onClose)
  const segments = categories.filter(c => c.items.length > 0)
  const allIds = segments.flatMap(c => c.items.map(i => i.id))
  const [selected, setSelected] = useState(() => new Set(allIds))
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(false)

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function toggleSegment(seg: BudgetCategory, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const item of seg.items) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  const chosen = segments.flatMap(c => c.items).filter(i => selected.has(i.id))
  const annual = chosen.reduce((s, i) => s + i.annualAmount, 0)
  const spent = chosen.reduce((s, i) => s + i.spentAmount, 0)

  async function download() {
    setDownloading(true)
    setError(false)
    try {
      const { year, movements } = await fetchBudgetMovements()
      await downloadBudgetExcel(segments, selected, movements, year)
      onClose()
    } catch {
      setError(true)
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Descargar reporte de partidas"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Descargar reporte de partidas</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 text-xs">
          <span className="text-gray-500">{chosen.length} de {allIds.length} partidas</span>
          <span className="flex gap-3">
            <button onClick={() => setSelected(new Set(allIds))} className="font-medium text-brand-600 hover:text-brand-700">Marcar todas</button>
            <button onClick={() => setSelected(new Set())} className="font-medium text-gray-500 hover:text-gray-700">Quitar todas</button>
          </span>
        </div>

        <div className="px-6 py-3 space-y-3 overflow-y-auto">
          {segments.map(seg => {
            const count = seg.items.filter(i => selected.has(i.id)).length
            return (
              <div key={seg.id}>
                <label className="flex items-center gap-2 py-1 text-sm font-semibold text-gray-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={count === seg.items.length}
                    ref={el => { if (el) el.indeterminate = count > 0 && count < seg.items.length }}
                    onChange={e => toggleSegment(seg, e.target.checked)}
                    className="accent-brand-600"
                  />
                  {seg.name}
                </label>
                {seg.items.map(item => (
                  <label key={item.id} className="flex items-center gap-2 py-1 pl-6 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="accent-brand-600"
                    />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{formatCLP(item.annualAmount)}</span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          <p className="text-xs text-gray-500">
            Presupuestado {formatCLP(annual)} · Gastado {formatCLP(spent)}. El Excel trae un resumen y el detalle de documentos y rendiciones.
          </p>
          {error && <p className="text-xs text-red-600">No se pudo generar el reporte. Intenta nuevamente.</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button
              onClick={download}
              disabled={chosen.length === 0 || downloading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
