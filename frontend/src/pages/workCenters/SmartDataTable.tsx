import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Check, ChevronDown, ChevronUp, ChevronsUpDown, X, Pencil, Filter, FileText, DollarSign, Scale, Search } from 'lucide-react'
import { usePatchProveedor, usePatchDocument } from '@/hooks/useSmart'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import type { SmartDocument, LegalEntity } from '@/types'
import {
  ENTITY_LABEL, ENTITY_COLOR, fmt, fmtN, fmtDate, fmtPeriodo,
  AREAS, CATEGORIES_BY_AREA, TIPOS, CATEGORIAS_SURMEDIA, type SmartCategory,
} from './SmartShared'

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditableCell({
  value, proveedorId, documentId, field, type = 'text', options, currentArea, extraOptions = [],
}: {
  value:         string | null
  proveedorId?:  string
  documentId?:   string
  field:         'area' | 'categoria' | 'workCenterId' | 'tipo'
  type?:         'text' | 'select' | 'smart-select'
  options?:      { value: string; label: string }[]
  currentArea?:  string | null
  extraOptions?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [editingCustom, setEditingCustom] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const patchProv = usePatchProveedor()
  const patchDoc  = usePatchDocument()
  const patch      = documentId ? patchDoc : patchProv
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing || editingCustom) {
      // Use a timeout to ensure the element is in the DOM
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [editing, editingCustom])

  function save(customValue?: string) {
    setEditing(false)
    setEditingCustom(false)
    const finalVal = (customValue ?? val).trim() || null
    if (finalVal === (value ?? null)) return
    if (documentId) {
      patchDoc.mutate({ id: documentId, [field]: finalVal })
    } else if (proveedorId) {
      patchProv.mutate({ id: proveedorId, [field]: finalVal })
    }
  }

  // Generate options for smart-select (Area or Categoria)
  const smartOptions = useMemo(() => {
    if (type !== 'smart-select') return []

    let base: string[] = []
    if (field === 'area') {
      base = AREAS
    } else if (field === 'tipo') {
      base = TIPOS
    } else if (field === 'categoria') {
      // Documento (honorarios) → Categoría Surmedia; Proveedor (compras) → según área
      base = documentId ? CATEGORIAS_SURMEDIA : (currentArea ? (CATEGORIES_BY_AREA[currentArea] || []) : [])
    }

    // Merge with extra unique options found in data, avoiding duplicates
    const all = [...new Set([...base, ...extraOptions])].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    )
    return all.map(v => ({ value: v, label: v }))
  }, [type, field, currentArea, extraOptions, documentId])

  const display = value
    ? (type === 'select' || type === 'smart-select'
        ? (options?.find(o => o.value === value)?.label || smartOptions.find(o => o.value === value)?.label || value)
        : value)
    : null

  // Manual entry mode for "Otro"
  if (editingCustom) {
    return (
      <input
        ref={inputRef}
        value={val === 'Otro' ? '' : val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => save()}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setEditingCustom(false); setVal(value ?? '') }
        }}
        placeholder="Escribe..."
        className="text-xs border border-brand-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-28"
      />
    )
  }

  if (editing && (type === 'select' || type === 'smart-select')) {
    const opts = type === 'select' ? options : smartOptions
    const isSmart = type === 'smart-select'

    return (
      <select
        value={val}
        onChange={e => {
          if (isSmart && e.target.value === '___OTRO___') {
            setEditing(false)
            setEditingCustom(true)
            setVal('')
          } else {
            const newVal = e.target.value
            setVal(newVal)
            save(newVal)
          }
        }}
        onBlur={() => setEditing(false)}
        autoFocus
        className="text-xs border border-brand-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-32"
      >
        <option value="">—</option>
        {opts?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {isSmart && <option value="___OTRO___">+ Otro...</option>}
      </select>
    )
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => save()}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="text-xs border border-brand-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-28"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setEditing(true)
        setVal(value ?? '')
      }}
      className="group flex items-center gap-1 text-left hover:text-brand-600 transition-colors"
    >
      <span className={display ? 'text-gray-700' : 'text-gray-300'}>
        {display ?? '—'}
      </span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 text-gray-400 shrink-0" />
    </button>
  )
}

// ── Truncated cell with hover tooltip ────────────────────────────────────────

function TruncCell({
  value, className = '',
}: {
  value:      string | null | undefined
  className?: string
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  if (!value) return <span className="text-gray-300">—</span>

  return (
    <>
      <span
        className={`block truncate cursor-default ${className}`}
        onMouseEnter={e => {
          const el = e.currentTarget
          if (el.scrollWidth > el.clientWidth) {
            const r = el.getBoundingClientRect()
            setPos({ x: r.left, y: r.bottom + 4 })
          }
        }}
        onMouseLeave={() => setPos(null)}
      >
        {value}
      </span>
      {pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.y, left: pos.x, zIndex: 9999, maxWidth: 360 }}
          className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none leading-relaxed break-words"
        >
          {value}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Column filter types + helpers ─────────────────────────────────────────────

export type SortState  = { col: string; dir: 'asc' | 'desc' } | null
export type ColFilters = Record<string, Set<string>>

export function getDocVal(d: SmartDocument, col: string): string {
  switch (col) {
    case 'rut':           return d.proveedor.rut ?? ''
    case 'razonSocial':   return d.proveedor.razonSocial ?? ''
    case 'empresa':       return ENTITY_LABEL[d.legalEntity as LegalEntity] ?? d.legalEntity
    case 'periodo':       return fmtPeriodo(d.periodoTributario)
    case 'clasificacion': return d.clasificacion ?? ''
    case 'tipo':          return d.tipo ?? ''
    case 'docCategoria':  return d.categoria ?? ''
    case 'area':          return d.proveedor.area ?? ''
    case 'categoria':     return d.proveedor.categoria ?? ''
    case 'workCenter':    return d.workCenter?.name ?? ''
    case 'documento':     return d.documento ?? ''
    case 'folio':         return d.folio ?? ''
    case 'glosa':         return d.glosa ?? ''
    case 'emision':       return d.fechaEmision ?? ''
    case 'pago':          return d.fechaPago ?? ''
    case 'neto':          return String(d.montoNeto ?? 0)
    case 'retencion':     return String(d.retencion ?? 0)
    case 'iva':           return String(d.iva ?? 0)
    case 'total':         return String(d.montoTotal ?? 0)
    case 'pagado':        return d.pagado ? 'Pagado' : 'Sin pagar'
    case 'vigente':       return d.vigente ? 'Vigente' : 'Anulada'
    default:              return ''
  }
}

export function compareDocVal(a: SmartDocument, b: SmartDocument, col: string): number {
  switch (col) {
    case 'neto':      return (a.montoNeto ?? 0) - (b.montoNeto ?? 0)
    case 'retencion': return (a.retencion ?? 0) - (b.retencion ?? 0)
    case 'iva':       return (a.iva ?? 0) - (b.iva ?? 0)
    case 'total':     return (a.montoTotal ?? 0) - (b.montoTotal ?? 0)
    case 'emision':   return (a.fechaEmision ?? '').localeCompare(b.fechaEmision ?? '')
    case 'pago':      return (a.fechaPago ?? '').localeCompare(b.fechaPago ?? '')
    default:          return getDocVal(a, col).localeCompare(getDocVal(b, col), 'es', { numeric: true, sensitivity: 'base' })
  }
}

// ── Column header with Excel-style filter dropdown ────────────────────────────

function ColHeader({
  label, col, allDocs, colFilters, onFilterChange, sort, onSort, getValue, numeric, sortOnly,
}: {
  label:          string
  col:            string
  allDocs:        SmartDocument[]
  colFilters:     ColFilters
  onFilterChange: (col: string, vals: Set<string>) => void
  sort:           SortState
  onSort:         (col: string, dir?: 'asc' | 'desc') => void
  getValue:       (d: SmartDocument) => string
  numeric?:       boolean
  sortOnly?:      boolean
}) {
  const [open,         setOpen]         = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [dropPos,      setDropPos]      = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const isSorted   = sort?.col === col
  const sortDir    = isSorted ? sort!.dir : null
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
    () => [...new Set(allDocs.map(getValue))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })),
    [allDocs, getValue],
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
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none ${numeric ? 'text-right' : 'text-left'}`}>
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => onSort(col)}
          className="hover:text-gray-900 transition-colors cursor-pointer"
        >
          {label}
          {sortDir === 'asc'
            ? <ChevronUp   size={12} className="text-brand-500 ml-1 inline" />
            : sortDir === 'desc'
            ? <ChevronDown size={12} className="text-brand-500 ml-1 inline" />
            : <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />}
        </button>

        {!sortOnly && (
          <button
            ref={btnRef}
            onClick={handleOpen}
            className={`rounded p-0.5 hover:bg-gray-200 transition-colors ${isFiltered ? 'text-brand-600 bg-brand-50' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <Filter size={10} />
          </button>
        )}
      </div>

      {open && !sortOnly && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="w-56 bg-white border border-gray-200 rounded-lg shadow-xl text-xs"
        >
          {/* Sort */}
          <div className="flex gap-1 p-1.5 border-b border-gray-100">
            <button
              onClick={() => { onSort(col, 'asc'); setOpen(false) }}
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${sortDir === 'asc' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}
            >
              ↑ A→Z
            </button>
            <button
              onClick={() => { onSort(col, 'desc'); setOpen(false) }}
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${sortDir === 'desc' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}
            >
              ↓ Z→A
            </button>
          </div>

          {/* Search */}
          <div className="p-1.5 border-b border-gray-100">
            <input
              autoFocus
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {/* Select all */}
          <div className="px-2 py-1 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-gray-900">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
                className="rounded border-gray-300 text-brand-600"
              />
              <span className="font-medium">(Seleccionar todo)</span>
            </label>
          </div>

          {/* Values */}
          <div className="max-h-44 overflow-y-auto px-2 py-1">
            {visibleVals.map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selected.has(v)}
                  onChange={() => toggleVal(v)}
                  className="rounded border-gray-300 text-brand-600 shrink-0"
                />
                <span className="truncate">{v || <span className="text-gray-400 italic">(vacío)</span>}</span>
              </label>
            ))}
            {visibleVals.length === 0 && <p className="text-gray-400 text-center py-2">Sin resultados</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
            <span className="text-gray-400">
              {selected.size > 0 ? `${selected.size} seleccionado${selected.size > 1 ? 's' : ''}` : ''}
            </span>
            {isFiltered && (
              <button
                onClick={() => { onFilterChange(col, new Set()); setOpen(false) }}
                className="text-red-500 hover:text-red-700 flex items-center gap-1"
              >
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

// ── Data table ────────────────────────────────────────────────────────────────

export function DataTable({
  allDocs, docs, category, isLoading, colFilters, onFilterChange, sort, onSort,
}: {
  allDocs:        SmartDocument[]
  docs:           SmartDocument[]
  category:       SmartCategory
  isLoading:      boolean
  colFilters:     ColFilters
  onFilterChange: (col: string, vals: Set<string>) => void
  sort:           SortState
  onSort:         (col: string, dir?: 'asc' | 'desc') => void
}) {
  const taxLabel = category === 'honorarios' ? 'Retención' : 'IVA'
  const taxCol   = category === 'honorarios' ? 'retencion' : 'iva'
  const { data: centers = [] } = useWorkCenters()
  const wcOptions = centers.map(c => ({ value: c.id, label: c.name }))

  // Calculate unique areas and categories already in data that are NOT in base constants
  const extraAreas = useMemo(() => {
    const unique = new Set(allDocs.map(d => d.proveedor.area).filter(Boolean) as string[])
    return [...unique].filter(a => !AREAS.includes(a))
  }, [allDocs])

  const extraCategoriesByArea = useMemo(() => {
    const map: Record<string, string[]> = {}
    allDocs.forEach(d => {
      const a = d.proveedor.area
      const c = d.proveedor.categoria
      if (a && c) {
        if (!map[a]) map[a] = []
        const base = CATEGORIES_BY_AREA[a] || []
        if (!base.includes(c) && !map[a].includes(c)) {
          map[a].push(c)
        }
      }
    })
    return map
  }, [allDocs])

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <RefreshCw size={20} className="animate-spin text-gray-400 mx-auto" />
      </div>
    )
  }
  if (allDocs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Sin registros. Ve a <strong>Importables Excel → Smart CTO</strong> para cargar datos.
      </div>
    )
  }

  function ch(label: string, col: string, opts?: { numeric?: boolean; sortOnly?: boolean }) {
    return { label, col, allDocs, colFilters, onFilterChange, sort, onSort, getValue: (d: SmartDocument) => getDocVal(d, col), ...opts }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <ColHeader {...ch('RUT', 'rut')} />
            <ColHeader {...ch('Razón Social', 'razonSocial')} />
            <ColHeader {...ch('Empresa', 'empresa')} />
            <ColHeader {...ch('Período', 'periodo')} />
            <ColHeader {...ch('Clasificación', 'clasificacion')} />
            {category === 'honorarios' ? (
              <>
                <ColHeader {...ch('Tipo', 'tipo')} />
                <ColHeader {...ch('Categoría', 'docCategoria')} />
              </>
            ) : (
              <>
                <ColHeader {...ch('Área', 'area')} />
                <ColHeader {...ch('Categoría', 'categoria')} />
              </>
            )}
            <ColHeader {...ch('Centro de Trabajo', 'workCenter')} />
            <ColHeader {...ch('Documento', 'documento')} />
            <ColHeader {...ch('Folio', 'folio')} />
            <ColHeader {...ch('Glosa', 'glosa')} />
            <ColHeader {...ch('Emisión', 'emision', { sortOnly: true })} />
            <ColHeader {...ch('Pago', 'pago', { sortOnly: true })} />
            <ColHeader {...ch('Neto', 'neto', { numeric: true, sortOnly: true })} />
            <ColHeader {...ch(taxLabel, taxCol, { numeric: true, sortOnly: true })} />
            <ColHeader {...ch('Total', 'total', { numeric: true, sortOnly: true })} />
            <ColHeader {...ch('Pagado', 'pagado')} />
            <ColHeader {...ch('Vigencia', 'vigente')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docs.map(d => (
            <tr key={d.id} className={d.vigente ? 'hover:bg-gray-50 transition-colors' : 'bg-red-50/70 hover:bg-red-100/70 transition-colors'}>
              <td className="px-4 py-2.5 font-mono text-gray-600 whitespace-nowrap">{d.proveedor.rut}</td>
              <td className="px-4 py-2.5 text-gray-800 max-w-[160px]">
                <TruncCell value={d.proveedor.razonSocial} className="text-gray-800" />
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[d.legalEntity]}`}>
                  {ENTITY_LABEL[d.legalEntity]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtPeriodo(d.periodoTributario)}</td>
              <td className="px-4 py-2.5 max-w-[120px]">
                <TruncCell value={d.clasificacion || null} className="text-gray-600" />
              </td>
              {category === 'honorarios' ? (
                <>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={d.tipo}
                      documentId={d.id}
                      field="tipo"
                      type="select"
                      options={TIPOS.map(t => ({ value: t, label: t }))}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={d.categoria}
                      documentId={d.id}
                      field="categoria"
                      type="smart-select"
                    />
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={d.proveedor.area}
                      proveedorId={d.proveedor.id}
                      field="area"
                      type="smart-select"
                      extraOptions={extraAreas}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={d.proveedor.categoria}
                      proveedorId={d.proveedor.id}
                      field="categoria"
                      type="smart-select"
                      currentArea={d.proveedor.area}
                      extraOptions={d.proveedor.area ? extraCategoriesByArea[d.proveedor.area] : []}
                    />
                  </td>
                </>
              )}
              <td className="px-4 py-2.5">
                <EditableCell
                  value={d.workCenterId}
                  documentId={d.id}
                  field="workCenterId"
                  type="select"
                  options={wcOptions}
                />
              </td>
              <td className="px-4 py-2.5 max-w-[110px]">
                <TruncCell value={d.documento} className="text-gray-500" />
              </td>
              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{d.folio || '—'}</td>
              <td className="px-4 py-2.5 max-w-[200px]">
                <TruncCell value={d.glosa} className="text-gray-500" />
              </td>
              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(d.fechaEmision)}</td>
              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(d.fechaPago)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmt(d.montoNeto)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                {fmt(category === 'honorarios' ? d.retencion : d.iva)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-800">{fmt(d.montoTotal)}</td>
              <td className="px-4 py-2.5 text-center">
                {d.pagado
                  ? <Check size={12} className="text-green-500 mx-auto" />
                  : <span className="text-gray-300 text-[10px]">—</span>}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${d.vigente ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {d.vigente ? 'Vigente' : 'Anulada'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Summary cards ─────────────────────────────────────────────────────────────

// ── Breakdown tables (dashboard Honorarios) ──────────────────────────────────

// Categorías Surmedia que se muestran como columna de conteo en "Totales por
// Centros de Trabajo" (en el orden solicitado por RRHH).
const CENTRO_CATEGORIAS = [
  'Apoyo Operacional',
  'Aseo y Servicios',
  'Asesoría',
  'Cobertura Operacional',
  'Planta Operacional',
  'Práctica',
  'Reemplazo',
] as const

// Encabezados abreviados (la categoría completa va en el atributo title).
const CAT_ABBR: Record<string, string> = {
  'Apoyo Operacional':     'Apoyo Op.',
  'Aseo y Servicios':      'Aseo/Serv.',
  'Asesoría':              'Asesoría',
  'Cobertura Operacional': 'Cobert. Op.',
  'Planta Operacional':    'Planta Op.',
  'Práctica':              'Práctica',
  'Reemplazo':             'Reemplazo',
}

// Orden y filtro de columna para las tablas agregadas del dashboard
type TableSort = { col: string; dir: 'asc' | 'desc' } | null

// Encabezado clickeable: 1er clic asc, 2º desc, 3º limpia el orden
function SortTh({ label, col, sort, setSort, align = 'right', title }: {
  label:   string
  col:     string
  sort:    TableSort
  setSort: (s: TableSort) => void
  align?:  'left' | 'right'
  title?:  string
}) {
  const active = sort?.col === col
  const icon = !active
    ? <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 inline" />
    : sort!.dir === 'asc'
      ? <ChevronUp size={11} className="text-gray-500 ml-0.5 inline" />
      : <ChevronDown size={11} className="text-gray-500 ml-0.5 inline" />
  return (
    <th
      title={title}
      onClick={() => setSort(
        !active ? { col, dir: 'asc' } : sort!.dir === 'asc' ? { col, dir: 'desc' } : null,
      )}
      className={`pb-1.5 font-normal cursor-pointer select-none hover:text-gray-600 whitespace-nowrap ${align === 'left' ? 'text-left' : 'text-right pr-2'}`}
    >
      {label}{icon}
    </th>
  )
}

// Caja de búsqueda para filtrar por nombre de entidad
function TableSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Filtrar entidad…"
        className="pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md w-44 focus:outline-none focus:ring-1 focus:ring-brand-300"
      />
    </div>
  )
}

type EntityRow = {
  label:          string
  colorClass?:    string
  docs:           number
  vigentes:       number
  anuladas:       number
  bruto:          number
  reembolsable:   number
  noReembolsable: number
}

type CenterRow = {
  label:        string
  vigentes:     number
  bruto:        number
  reembolsable: number
  catCounts:    Record<string, number>
}

function EntityBreakdownTable({ title, rows }: { title: string; rows: EntityRow[] }) {
  const [sort, setSort] = useState<TableSort>(null)
  const [q, setQ]       = useState('')

  const view = useMemo(() => {
    let r = rows
    const n = q.trim().toLowerCase()
    if (n) r = r.filter(x => x.label.toLowerCase().includes(n))
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      r = [...r].sort((a, b) =>
        sort.col === 'label'
          ? a.label.localeCompare(b.label, 'es') * dir
          : ((a[sort.col as keyof EntityRow] as number) - (b[sort.col as keyof EntityRow] as number)) * dir,
      )
    }
    return r
  }, [rows, q, sort])

  const t = view.reduce(
    (a, r) => ({
      docs:           a.docs + r.docs,
      vigentes:       a.vigentes + r.vigentes,
      anuladas:       a.anuladas + r.anuladas,
      bruto:          a.bruto + r.bruto,
      reembolsable:   a.reembolsable + r.reembolsable,
      noReembolsable: a.noReembolsable + r.noReembolsable,
    }),
    { docs: 0, vigentes: 0, anuladas: 0, bruto: 0, reembolsable: 0, noReembolsable: 0 },
  )
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <TableSearch value={q} onChange={setQ} />
      </div>
      {view.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">Sin datos</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <SortTh label="Entidad"        col="label"          sort={sort} setSort={setSort} align="left" />
              <SortTh label="Docs"           col="docs"           sort={sort} setSort={setSort} />
              <SortTh label="Vigentes"       col="vigentes"       sort={sort} setSort={setSort} />
              <SortTh label="Anuladas"       col="anuladas"       sort={sort} setSort={setSort} />
              <SortTh label="Bruto"          col="bruto"          sort={sort} setSort={setSort} />
              <SortTh label="Reembolsable"   col="reembolsable"   sort={sort} setSort={setSort} />
              <SortTh label="No Reembolsable" col="noReembolsable" sort={sort} setSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {view.map(r => (
              <tr key={r.label} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 pr-2">
                  {r.colorClass
                    ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.colorClass}`}>{r.label}</span>
                    : <span className="text-gray-700">{r.label}</span>
                  }
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-500 pr-2">{r.docs}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{r.vigentes}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-400 pr-2">{r.anuladas || ''}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{fmtN(r.bruto)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{fmtN(r.reembolsable)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700">{fmtN(r.noReembolsable)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold text-gray-900">
              <td className="pt-1.5 font-medium text-gray-500">Total</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{t.docs}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{t.vigentes}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{t.anuladas || ''}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{fmtN(t.bruto)}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{fmtN(t.reembolsable)}</td>
              <td className="pt-1.5 text-right tabular-nums">{fmtN(t.noReembolsable)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function CenterBreakdownTable({ title, rows }: { title: string; rows: CenterRow[] }) {
  const [sort, setSort] = useState<TableSort>(null)
  const [q, setQ]       = useState('')

  const val = (r: CenterRow, col: string): number | string =>
    col === 'label'           ? r.label
    : col.startsWith('cat:')  ? (r.catCounts[col.slice(4)] ?? 0)
    : ((r[col as keyof CenterRow] as number) ?? 0)

  const view = useMemo(() => {
    let r = rows
    const n = q.trim().toLowerCase()
    if (n) r = r.filter(x => x.label.toLowerCase().includes(n))
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      r = [...r].sort((a, b) => {
        const va = val(a, sort.col), vb = val(b, sort.col)
        return typeof va === 'string' || typeof vb === 'string'
          ? String(va).localeCompare(String(vb), 'es') * dir
          : (va - vb) * dir
      })
    }
    return r
  }, [rows, q, sort])

  const t = {
    vigentes:     view.reduce((s, r) => s + r.vigentes, 0),
    bruto:        view.reduce((s, r) => s + r.bruto, 0),
    reembolsable: view.reduce((s, r) => s + r.reembolsable, 0),
    catCounts:    Object.fromEntries(
      CENTRO_CATEGORIAS.map(c => [c, view.reduce((s, r) => s + (r.catCounts[c] ?? 0), 0)]),
    ) as Record<string, number>,
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <TableSearch value={q} onChange={setQ} />
      </div>
      {view.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">Sin datos</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <SortTh label="Entidad"      col="label"        sort={sort} setSort={setSort} align="left" />
              <SortTh label="Vigentes"     col="vigentes"     sort={sort} setSort={setSort} />
              <SortTh label="Bruto"        col="bruto"        sort={sort} setSort={setSort} />
              <SortTh label="Reembolsable" col="reembolsable" sort={sort} setSort={setSort} />
              {CENTRO_CATEGORIAS.map(c => (
                <SortTh key={c} label={CAT_ABBR[c]} col={`cat:${c}`} sort={sort} setSort={setSort} title={c} />
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map(r => (
              <tr key={r.label} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 pr-2 text-gray-700 whitespace-nowrap">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{r.vigentes}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{fmtN(r.bruto)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">{fmtN(r.reembolsable)}</td>
                {CENTRO_CATEGORIAS.map(c => (
                  <td key={c} className="py-1.5 text-right tabular-nums text-gray-500 pr-2">{r.catCounts[c] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold text-gray-900">
              <td className="pt-1.5 font-medium text-gray-500">Total</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{t.vigentes}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{fmtN(t.bruto)}</td>
              <td className="pt-1.5 text-right tabular-nums pr-2">{fmtN(t.reembolsable)}</td>
              {CENTRO_CATEGORIAS.map(c => (
                <td key={c} className="pt-1.5 text-right tabular-nums pr-2">{t.catCounts[c] || ''}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

export function SummaryCards({ docs }: { docs: SmartDocument[]; category: SmartCategory }) {
  const activeDocs = docs.filter(d => d.vigente)
  const anuladas   = docs.length - activeDocs.length
  const neto       = activeDocs.reduce((s, d) => s + d.montoNeto, 0)
  const bruto      = activeDocs.reduce((s, d) => s + d.montoBruto, 0)
  const pagados    = activeDocs.filter(d => d.pagado).length
  const reembolsable = activeDocs.reduce((s, d) => s + (d.tipo === 'Reembolsable' ? d.montoBruto : 0), 0)
  const brutoSinReemb = bruto - reembolsable

  // Totales por Razón Social — sobre TODOS los documentos (para contar anuladas)
  const entityMap = new Map<LegalEntity, EntityRow>()
  for (const d of docs) {
    const e   = d.legalEntity as LegalEntity
    const cur = entityMap.get(e) ?? {
      label: ENTITY_LABEL[e], colorClass: ENTITY_COLOR[e],
      docs: 0, vigentes: 0, anuladas: 0, bruto: 0, reembolsable: 0, noReembolsable: 0,
    }
    cur.docs += 1
    if (d.vigente) {
      cur.vigentes += 1
      cur.bruto    += d.montoBruto
      if (d.tipo === 'Reembolsable')    cur.reembolsable   += d.montoBruto
      if (d.tipo === 'No Reembolsable') cur.noReembolsable += d.montoBruto
    } else {
      cur.anuladas += 1
    }
    entityMap.set(e, cur)
  }
  const entityRows = (Object.keys(ENTITY_LABEL) as LegalEntity[]).filter(e => entityMap.has(e)).map(e => entityMap.get(e)!)

  // Totales por Centro de Trabajo — sobre documentos vigentes
  const centerMap = new Map<string, CenterRow>()
  for (const d of activeDocs) {
    const key  = d.workCenter?.id ?? '__sin__'
    const name = d.workCenter?.name ?? '(Sin centro)'
    const cur  = centerMap.get(key) ?? { label: name, vigentes: 0, bruto: 0, reembolsable: 0, catCounts: {} }
    cur.vigentes += 1
    cur.bruto    += d.montoBruto
    if (d.tipo === 'Reembolsable') cur.reembolsable += d.montoBruto
    if (d.categoria) cur.catCounts[d.categoria] = (cur.catCounts[d.categoria] ?? 0) + 1
    centerMap.set(key, cur)
  }
  const centerRows = [...centerMap.values()].sort((a, b) => b.bruto - a.bruto)

  return (
    <div className="space-y-4">
      {/* Top summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-50 text-brand-600">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{activeDocs.length}</p>
            <p className="text-xs text-gray-500">Documentos</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{pagados} pagados{anuladas > 0 ? ` · ${anuladas} anuladas` : ''}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-50 text-green-600">
            <DollarSign size={18} />
          </div>
          <div className="flex gap-10">
            <div>
              <p className="text-xl font-bold text-gray-900">{fmtN(neto)}</p>
              <p className="text-xs text-gray-500">Monto Neto</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{fmtN(bruto)}</p>
              <p className="text-xs text-gray-500">Monto Bruto</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600">
            <Scale size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{fmtN(brutoSinReemb)}</p>
            <p className="text-xs text-gray-500">Bruto − Reembolsable</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Bruto {fmtN(bruto)} − reemb. {fmtN(reembolsable)}</p>
          </div>
        </div>
      </div>

      {/* Totales por Razón Social — fila propia */}
      <EntityBreakdownTable title="Totales por Razón Social" rows={entityRows} />

      {/* Totales por Centros de Trabajo — fila propia */}
      <CenterBreakdownTable title="Totales por Centros de Trabajo" rows={centerRows} />
    </div>
  )
}
