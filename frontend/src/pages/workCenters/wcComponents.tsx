// Componentes UI reutilizables de Centros de Trabajo. Extraído de WorkCentersPage.tsx.
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter, X } from 'lucide-react'
import {
  type SortKey, type SortDir, type DetailSortKey, type RemColFilters, type WCAggRow,
  getRemVal,
} from './wcUtils'

// ─── Sort icons ───────────────────────────────────────────────────────────────

export function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp   size={12} className="text-brand-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-brand-500 ml-1 inline" />
}

export function DetailSortIcon({ col, sortKey, sortDir }: { col: DetailSortKey; sortKey: DetailSortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 inline" />
  return sortDir === 'asc'
    ? <ChevronUp   size={11} className="text-brand-500 ml-0.5 inline" />
    : <ChevronDown size={11} className="text-brand-500 ml-0.5 inline" />
}

// ─── Column filter for Remuneraciones ────────────────────────────────────────

export function FilterRemTh({ label, col, sortKey, sortDir, onSort, allRows, colFilters, onFilterChange, right, highlight, sticky }: {
  label:          string
  col:            SortKey
  sortKey:        SortKey
  sortDir:        SortDir
  onSort:         (c: SortKey) => void
  allRows:        WCAggRow[]
  colFilters:     RemColFilters
  onFilterChange: (col: string, vals: Set<string>) => void
  right?:         boolean
  highlight?:     boolean
  sticky?:        boolean
}) {
  const [open,         setOpen]         = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [dropPos,      setDropPos]      = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const isFiltered = (colFilters[col]?.size ?? 0) > 0

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 2, left: r.left })
    }
    setOpen(o => !o)
  }

  const uniqueVals = useMemo(
    () => [...new Set(allRows.map(r => getRemVal(r, col)))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    [allRows, col],
  )

  const visibleVals  = filterSearch ? uniqueVals.filter(v => v.toLowerCase().includes(filterSearch.toLowerCase())) : uniqueVals
  const selected     = colFilters[col] ?? new Set<string>()
  const allSelected  = visibleVals.length > 0 && visibleVals.every(v => selected.has(v))
  const someSelected = !allSelected && visibleVals.some(v => selected.has(v))

  function toggleAll() {
    const next = new Set(selected)
    allSelected ? visibleVals.forEach(v => next.delete(v)) : visibleVals.forEach(v => next.add(v))
    onFilterChange(col, next)
  }
  function toggleVal(v: string) {
    const next = new Set(selected)
    next.has(v) ? next.delete(v) : next.add(v)
    onFilterChange(col, next)
  }

  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap hover:text-gray-700 ${right ? 'text-right' : ''} ${highlight ? 'bg-brand-50 text-brand-600' : sticky ? 'bg-white text-gray-500' : 'text-gray-500'} ${sticky ? 'sticky left-0' : ''}`}>
      <div className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
        <button onClick={() => onSort(col)} className="hover:text-gray-900 transition-colors cursor-pointer">
          {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
        </button>
        <button
          ref={btnRef}
          onClick={handleOpen}
          className={`rounded p-0.5 hover:bg-gray-200 transition-colors ${isFiltered ? 'text-brand-600 bg-brand-50' : 'text-gray-300 hover:text-gray-500'}`}
        >
          <Filter size={10} />
        </button>
      </div>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="w-56 bg-white border border-gray-200 rounded-lg shadow-xl text-xs"
        >
          <div className="flex gap-1 p-1.5 border-b border-gray-100">
            <button onClick={() => { onSort(col); setOpen(false) }}
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${col === sortKey && sortDir === 'asc' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}>
              ↑ A→Z
            </button>
            <button onClick={() => { if (col !== sortKey || sortDir !== 'desc') onSort(col); setOpen(false) }}
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${col === sortKey && sortDir === 'desc' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}>
              ↓ Z→A
            </button>
          </div>
          <div className="p-1.5 border-b border-gray-100">
            <input autoFocus value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </div>
          <div className="px-2 py-1 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-gray-900">
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                ref={el => { if (el) el.indeterminate = someSelected }}
                className="rounded border-gray-300 text-brand-600" />
              <span className="font-medium">(Seleccionar todo)</span>
            </label>
          </div>
          <div className="max-h-44 overflow-y-auto px-2 py-1">
            {visibleVals.map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-gray-900">
                <input type="checkbox" checked={selected.has(v)} onChange={() => toggleVal(v)}
                  className="rounded border-gray-300 text-brand-600 shrink-0" />
                <span className="truncate">{v}</span>
              </label>
            ))}
            {visibleVals.length === 0 && <p className="text-gray-400 text-center py-2">Sin resultados</p>}
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
            <span className="text-gray-400">{selected.size > 0 ? `${selected.size} sel.` : ''}</span>
            {isFiltered && (
              <button onClick={() => { onFilterChange(col, new Set()); setOpen(false) }}
                className="text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={10} /> Limpiar
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </th>
  )
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────

export function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────

export function MultiSelect<T extends string>({ label, selected, onChange, options }: {
  label: string
  selected: T[]
  onChange: (v: T[]) => void
  options: { value: T; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle(v: T) {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  }

  const count = selected.length
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-2 text-sm border rounded-lg bg-white transition-colors ${
          count > 0 ? 'border-brand-400 text-brand-700 bg-brand-50/60' : 'border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
      >
        {label}
        {count > 0 && (
          <span className="ml-0.5 bg-brand-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown size={13} className={`ml-0.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-max py-1.5">
          <button
            onClick={() => onChange([])}
            className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${count === 0 ? 'text-brand-600 font-semibold' : 'text-gray-500'}`}
          >
            Todos
          </button>
          <div className="border-t border-gray-100 my-1" />
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2.5 hover:bg-gray-50 ${
                selected.includes(o.value) ? 'text-brand-700 font-medium' : 'text-gray-700'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                selected.includes(o.value) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
              }`}>
                {selected.includes(o.value) && (
                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1.5,6 5,9.5 10.5,2.5" />
                  </svg>
                )}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MiniStat card ────────────────────────────────────────────────────────────

export function MiniStat({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: LucideIcon; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 gdp-val">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 gdp-val">{sub}</p>}
      </div>
    </div>
  )
}

// ─── MovementList ─────────────────────────────────────────────────────────────

export function MovementList({ title, items, color }: {
  title: string
  items: { name: string; rut?: string; date?: string | Date; info?: string }[]
  color: 'green' | 'red' | 'amber' | 'violet'
}) {
  const borderBg = { green: 'border-green-100 bg-green-50', red: 'border-red-100 bg-red-50', amber: 'border-amber-100 bg-amber-50', violet: 'border-violet-100 bg-violet-50' }
  const dot      = { green: 'bg-green-500', red: 'bg-red-500', amber: 'bg-amber-400', violet: 'bg-violet-500' }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title} ({items.length})</p>
      <div className={`rounded-lg border p-3 space-y-2 gdp-content ${borderBg[color]}`}>
        {items.slice(0, 6).map((item, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot[color]}`} />
            <span className="text-sm font-medium text-gray-900">{item.name}</span>
            {item.rut && <span className="text-xs text-gray-400 font-mono">{item.rut}</span>}
            {item.info && <span className="text-xs text-gray-500">{item.info}</span>}
            {item.date && (
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(item.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        ))}
        {items.length > 6 && <p className="text-xs text-gray-400">+{items.length - 6} más</p>}
      </div>
    </div>
  )
}
