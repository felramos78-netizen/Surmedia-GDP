import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX } from 'lucide-react'
import { fold } from '@/lib/utils'

// Tabla genérica de GDP: toda columna se puede ordenar (clic en el encabezado)
// y filtrar (fila de filtros bajo el encabezado).

export type CellValue = string | number | boolean | null | undefined

export interface Column<T> {
  key:        string
  header:     string
  /** Valor para ordenar y filtrar */
  value:      (row: T) => CellValue
  /** Contenido de la celda (por defecto, el valor) */
  render?:    (row: T) => ReactNode
  /** text: contiene · select: lista de valores · range: mín/máx numérico · false: sin filtro */
  filter?:    'text' | 'select' | 'range' | false
  sortable?:  boolean
  align?:     'left' | 'right' | 'center'
  /** Clases de la celda (ancho, truncado…) */
  className?: string
  title?:     string
}

type Sort = { key: string; dir: 'asc' | 'desc' }
type FilterValue = string | { min: string; max: string }

const EMPTY = '(vacío)'
// Clases literales para que Tailwind las detecte
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

function compare(a: CellValue, b: CellValue): number {
  const ea = a === null || a === undefined || a === ''
  const eb = b === null || b === undefined || b === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1 // vacíos al final
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}

export default function DataTable<T>({
  rows, columns, rowKey, onRowClick, initialSort, emptyText = 'Sin resultados', rowClassName, toolbar,
}: {
  rows:          T[]
  columns:       Column<T>[]
  rowKey:        (row: T) => string
  onRowClick?:   (row: T) => void
  initialSort?:  Sort
  emptyText?:    string
  rowClassName?: (row: T) => string
  /** Contenido a la derecha del contador (botones, etc.) */
  toolbar?:      ReactNode
}) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null)
  const [filters, setFilters] = useState<Record<string, FilterValue>>({})

  const options = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const c of columns) {
      if (c.filter !== 'select') continue
      const set = new Set(rows.map(r => { const v = c.value(r); return v === null || v === undefined || v === '' ? EMPTY : String(v) }))
      out[c.key] = [...set].sort((a, b) => a === EMPTY ? 1 : b === EMPTY ? -1 : a.localeCompare(b, 'es', { numeric: true }))
    }
    return out
  }, [rows, columns])

  const visible = useMemo(() => {
    let out = rows.filter(r => columns.every(c => {
      const f = filters[c.key]
      if (!f) return true
      const v = c.value(r)
      if (typeof f === 'object') {
        const n = typeof v === 'number' ? v : Number(v)
        if (f.min !== '' && !(n >= Number(f.min))) return false
        if (f.max !== '' && !(n <= Number(f.max))) return false
        return true
      }
      if ((c.filter ?? 'text') === 'select') return (v === null || v === undefined || v === '' ? EMPTY : String(v)) === f
      return fold(String(v ?? '')).includes(fold(f))
    }))
    if (sort) {
      const col = columns.find(c => c.key === sort.key)
      if (col) out = [...out].sort((a, b) => {
        const r = compare(col.value(a), col.value(b))
        // Los vacíos quedan al final en ambos sentidos
        const va = col.value(a), vb = col.value(b)
        const emptyA = va === null || va === undefined || va === '', emptyB = vb === null || vb === undefined || vb === ''
        if (emptyA !== emptyB) return r
        return sort.dir === 'asc' ? r : -r
      })
    }
    return out
  }, [rows, columns, filters, sort])

  const activeFilters = Object.values(filters).filter(f => typeof f === 'object' ? f.min !== '' || f.max !== '' : f !== '').length
  const setFilter = (key: string, v: FilterValue) => setFilters(prev => ({ ...prev, [key]: v }))
  const toggleSort = (key: string) => setSort(s =>
    s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null)

  const inputCls = 'w-full min-w-0 px-1.5 py-1 text-[11px] font-normal border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        <span>
          {visible.length === rows.length ? `${rows.length} filas` : `${visible.length} de ${rows.length} filas`}
          {activeFilters > 0 && (
            <button onClick={() => setFilters({})} className="ml-2 inline-flex items-center gap-1 text-brand-600 hover:underline">
              <FilterX size={11} /> Limpiar {activeFilters} filtro{activeFilters !== 1 && 's'}
            </button>
          )}
        </span>
        {toolbar}
      </div>
      <div className="border border-gray-200 rounded-xl bg-white overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
            <tr>
              {columns.map(c => {
                const active = sort?.key === c.key
                const sortable = c.sortable !== false
                return (
                  <th key={c.key} title={c.title}
                    className={`px-2 pt-2 pb-1 font-medium whitespace-nowrap ${ALIGN[c.align ?? 'left']}`}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {sortable ? (
                      <button onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 hover:text-gray-800 ${active ? 'text-gray-900' : ''}`}>
                        {c.header}
                        {active ? (sort!.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                      </button>
                    ) : c.header}
                  </th>
                )
              })}
            </tr>
            <tr className="border-b border-gray-200">
              {columns.map(c => {
                const kind = c.filter ?? 'text'
                const f = filters[c.key]
                return (
                  <th key={c.key} className="px-1.5 pb-1.5 font-normal">
                    {kind === 'text' && (
                      <input value={(f as string) ?? ''} onChange={e => setFilter(c.key, e.target.value)}
                        placeholder="Filtrar…" aria-label={`Filtrar ${c.header}`} className={inputCls} />
                    )}
                    {kind === 'select' && (
                      <select value={(f as string) ?? ''} onChange={e => setFilter(c.key, e.target.value)}
                        aria-label={`Filtrar ${c.header}`} className={inputCls}>
                        <option value="">Todos</option>
                        {options[c.key]?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {kind === 'range' && (
                      <div className="flex gap-0.5">
                        {(['min', 'max'] as const).map(k => (
                          <input key={k} type="number" value={(f as { min: string; max: string })?.[k] ?? ''}
                            onChange={e => setFilter(c.key, { min: '', max: '', ...(f as object), [k]: e.target.value })}
                            placeholder={k === 'min' ? 'mín' : 'máx'} aria-label={`${c.header} ${k === 'min' ? 'mínimo' : 'máximo'}`}
                            className={`${inputCls} w-12`} />
                        ))}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-gray-400">{emptyText}</td></tr>
            ) : visible.map(r => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-gray-50 ${rowClassName?.(r) ?? ''}`}>
                {columns.map(c => (
                  <td key={c.key} className={`px-2 py-2 align-top ${ALIGN[c.align ?? 'left']} ${c.className ?? ''}`}>
                    {c.render ? c.render(r) : (c.value(r) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
