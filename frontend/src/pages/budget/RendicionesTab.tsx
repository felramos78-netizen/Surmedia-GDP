import { useMemo, useState } from 'react'
import { Loader2, Pencil, Trash2, Plus, X } from 'lucide-react'
import { useBudgetSegments, useRendiciones, useSaveRendicion, useDeleteRendicion } from '@/hooks/useBudget'
import type { BudgetRendicion } from '@/types'
import { formatCLP, formatDate } from '@/lib/utils'
import { ColHeader, type SortState, type ColFilters } from '@/pages/workCenters/SmartDataTable'

const today = () => new Date().toISOString().slice(0, 10)

// ─── Selector de partida agrupado por segmento ────────────────────────────────
function PartidaSelect({
  value, onChange, placeholder = 'Partida…', className = '',
}: { value: string; onChange: (id: string) => void; placeholder?: string; className?: string }) {
  const segments = useBudgetSegments()
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Partida del presupuesto"
      className={`px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
    >
      <option value="">{placeholder}</option>
      {segments.map(seg => (
        <optgroup key={seg.id} label={seg.name}>
          {seg.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// ─── Orden y filtros de la tabla ──────────────────────────────────────────────
function rendicionVal(r: BudgetRendicion, col: string): string {
  switch (col) {
    case 'fecha':       return formatDate(r.date)
    case 'descripcion': return r.description
    case 'partida':     return r.item.name
    case 'segmento':    return r.item.category.name
    case 'monto':       return String(r.amount)
    case 'notas':       return r.notes ?? ''
    default:            return ''
  }
}

function compareRendicion(a: BudgetRendicion, b: BudgetRendicion, col: string): number {
  if (col === 'fecha') return a.date.localeCompare(b.date)
  if (col === 'monto') return a.amount - b.amount
  return rendicionVal(a, col).localeCompare(rendicionVal(b, col), 'es', { numeric: true, sensitivity: 'base' })
}

// ─── Rendiciones ──────────────────────────────────────────────────────────────
type Form = { id?: string; date: string; description: string; itemId: string; amount: string; notes: string }
const emptyForm = (): Form => ({ date: today(), description: '', itemId: '', amount: '', notes: '' })

export default function RendicionesTab() {
  const { data: rendiciones, isLoading } = useRendiciones()
  const save = useSaveRendicion()
  const remove = useDeleteRendicion()
  const [form, setForm] = useState<Form>(emptyForm)
  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }))

  const amount = parseInt(form.amount.replace(/\D/g, ''), 10)
  const valid = form.description.trim() && form.itemId && form.date && Number.isFinite(amount) && amount > 0

  const submit = async () => {
    if (!valid) return
    await save.mutateAsync({
      id: form.id, itemId: form.itemId, description: form.description, amount, date: form.date, notes: form.notes || null,
    })
    setForm(emptyForm())
  }

  const edit = (r: BudgetRendicion) =>
    setForm({ id: r.id, date: r.date.slice(0, 10), description: r.description, itemId: r.itemId, amount: String(r.amount), notes: r.notes ?? '' })

  const onDelete = (r: BudgetRendicion) => {
    if (window.confirm(`¿Eliminar la rendición "${r.description}" por ${formatCLP(r.amount)}?`)) remove.mutate(r.id)
  }

  const [sort, setSort] = useState<SortState>({ col: 'fecha', dir: 'desc' })
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const onSort = (col: string, dir?: 'asc' | 'desc') =>
    setSort(prev => ({ col, dir: dir ?? (prev?.col === col && prev.dir === 'asc' ? 'desc' : 'asc') }))
  const onFilterChange = (col: string, vals: Set<string>) =>
    setColFilters(prev => {
      const next = { ...prev }
      if (vals.size) next[col] = vals
      else delete next[col]
      return next
    })

  const all = useMemo(() => rendiciones ?? [], [rendiciones])
  const rows = useMemo(() => {
    let result = all
    for (const [col, vals] of Object.entries(colFilters)) result = result.filter(r => vals.has(rendicionVal(r, col)))
    if (sort) result = [...result].sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * compareRendicion(a, b, sort.col))
    return result
  }, [all, colFilters, sort])
  const filtered = Object.keys(colFilters).length > 0
  const total = rows.reduce((s, r) => s + r.amount, 0)

  const ch = (label: string, col: string, opts?: { numeric?: boolean; sortOnly?: boolean }) => ({
    label, col, allDocs: all, colFilters, onFilterChange, sort, onSort,
    getValue: (r: BudgetRendicion) => rendicionVal(r, col), ...opts,
  })

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Rendiciones</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Gastos rendidos que no son BH ni facturas (caja chica, tarjeta, reembolsos). Suman al gasto de su partida
          en el trimestre de su fecha.
        </p>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <input
          type="date" value={form.date} onChange={e => set({ date: e.target.value })} aria-label="Fecha"
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
        />
        <input
          value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Descripción"
          className="flex-1 min-w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
        />
        <PartidaSelect value={form.itemId} onChange={itemId => set({ itemId })} className="max-w-56" />
        <input
          value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="Monto" inputMode="numeric"
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right bg-white"
        />
        <input
          value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Notas (opcional)"
          className="w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
        />
        <button
          onClick={submit} disabled={!valid || save.isPending}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40"
        >
          {form.id ? <Pencil size={14} /> : <Plus size={14} />}
          {form.id ? 'Guardar' : 'Agregar'}
        </button>
        {form.id && (
          <button onClick={() => setForm(emptyForm())} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-600" /></div>
      ) : !all.length ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">Aún no hay rendiciones.</p>
      ) : (
        <div className="overflow-x-auto">
          {filtered && (
            <div className="px-5 pt-3 flex items-center gap-3 text-xs text-gray-500">
              {rows.length} de {all.length} rendiciones
              <button onClick={() => setColFilters({})} className="flex items-center gap-1 hover:text-red-600">
                <X size={11} /> Limpiar filtros
              </button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <ColHeader {...ch('Fecha', 'fecha')} />
                <ColHeader {...ch('Descripción', 'descripcion')} />
                <ColHeader {...ch('Partida', 'partida')} />
                <ColHeader {...ch('Segmento', 'segmento')} />
                <ColHeader {...ch('Monto', 'monto', { numeric: true, sortOnly: true })} />
                <ColHeader {...ch('Notas', 'notas')} />
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={`border-b border-gray-50 group ${form.id === r.id ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-2 text-gray-600 tabular-nums whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 text-gray-800">{r.description}</td>
                  <td className="px-4 py-2 text-gray-700">{r.item.name}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{r.item.category.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-800">{formatCLP(r.amount)}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{r.notes}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => edit(r)} title="Editar" className="text-gray-400 hover:text-brand-700"><Pencil size={13} /></button>
                      <button onClick={() => onDelete(r)} title="Eliminar" className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold text-gray-900">
                <td className="px-4 py-2" colSpan={4}>Total{filtered ? ' filtrado' : ''}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCLP(total)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
