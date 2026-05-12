import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown, Search, X, Pencil, Filter, FileText, DollarSign, Percent, TrendingUp } from 'lucide-react'
import {
  fetchSmartPreview, useSmartApply,
  useSmartHonorarios, useSmartCompras, usePatchProveedor,
} from '@/hooks/useSmart'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import type { SmartDocument, SmartPreviewData, SmartPreviewRow, LegalEntity } from '@/types'

// ── Formatting ────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmt = (n: number | null | undefined) =>
  n == null || n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)
const fmtN = (n: number | null | undefined) => (n == null || n === 0 ? '—' : CLP.format(n))

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtPeriodo(p: string | null | undefined): string {
  if (!p || p.length < 6) return p ?? '—'
  const MONTHS: Record<string, string> = {
    '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
    '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
  }
  return `${MONTHS[p.slice(4)] ?? p.slice(4)} ${p.slice(0, 4)}`
}

export const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
export const ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

export type SmartCategory = 'honorarios' | 'compras'

// ── Constants for Areas and Categories ───────────────────────────────────────

const AREAS = ['Personas', 'Administración']

const CATEGORIES_BY_AREA: Record<string, string[]> = {
  Personas: [
    'Beneficios dotación',
    'Talleres interno',
    'Cultura/integración',
    'Formación/Capacitación',
    'EPPs',
    'Exámenes ocupacionales',
    'Sin clasificar',
  ],
  Administración: [
    'Arriendos',
    'Boleta de garantía',
    'Envíos',
    'Equipos',
    'Gastos bancarios',
    'Gastos oficina',
    'Gastos oficina Antofagasta',
    'Gastos oficina Rancagua',
    'Gastos oficina Santiago',
    'Hospedaje',
    'Movilización',
    'Seguros contratos',
    'Seguros directores',
    'Servicios',
    'Servicios administrativos',
    'Servicios contratos',
    'Servicios financieros',
    'Servicios legales',
    'Servicios oficina',
    'Software',
    'Vehículos',
    'Viajes',
  ],
}

// ── Preview section (used in SmartImportTab) ──────────────────────────────────

function PreviewSection({
  title, rows, selected, onToggle, onToggleAll, color, taxLabel,
}: {
  title:       string
  rows:        SmartPreviewRow[]
  selected:    Set<string>
  onToggle:    (id: string) => void
  onToggleAll: (on: boolean) => void
  color:       string
  taxLabel:    string
}) {
  const [open, setOpen] = useState(true)
  if (rows.length === 0) return null
  const allSel = rows.every(r => selected.has(r.smartId))

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-sm font-medium text-gray-800">{title}</span>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            {rows.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={allSel} onChange={e => onToggleAll(e.target.checked)}
                    className="rounded border-gray-300" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">RUT</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Razón Social</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Período</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Clasificación</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Documento</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Neto</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">{taxLabel}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.smartId} className={`hover:bg-gray-50 ${selected.has(r.smartId) ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selected.has(r.smartId)} onChange={() => onToggle(r.smartId)}
                      className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-600">{r.rut}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-[180px] truncate">{r.razonSocial}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[r.legalEntity]}`}>
                      {ENTITY_LABEL[r.legalEntity]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtPeriodo(r.periodoTributario)}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{r.clasificacion || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{r.documento}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtN(r.montoNeto)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {fmtN(r.category === 'HONORARIO' ? r.retencion : r.iva)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-800">{fmtN(r.montoTotal)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.pagado
                      ? <Check size={12} className="text-green-500 mx-auto" />
                      : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Category preview (Honorarios o Compras) ───────────────────────────────────

function CategoryPreview({
  data, category,
}: {
  data:     SmartPreviewData
  category: SmartCategory
}) {
  const section  = data[category]
  const taxLabel = category === 'honorarios' ? 'Retención' : 'IVA'
  const isHon    = category === 'honorarios'

  const [selNew,  setSelNew]  = useState<Set<string>>(() => new Set(section.nuevos.map(r => r.smartId)))
  const [selChg,  setSelChg]  = useState<Set<string>>(() => new Set(section.cambios.map(r => r.smartId)))
  const [selSync, setSelSync] = useState<Set<string>>(new Set())

  const apply     = useSmartApply()
  const isPending = apply.isPending
  const total     = selNew.size + selChg.size + selSync.size

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setFn(n)
  }
  function toggleAll(rows: SmartPreviewRow[], set: Set<string>, setFn: (s: Set<string>) => void, on: boolean) {
    setFn(on ? new Set(rows.map(r => r.smartId)) : new Set())
  }

  const hasAny = section.nuevos.length + section.cambios.length + section.sincronizados.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {section.nuevos.length} nuevo{section.nuevos.length !== 1 ? 's' : ''} ·{' '}
          {section.cambios.length} con cambio{section.cambios.length !== 1 ? 's' : ''} ·{' '}
          {section.sincronizados.length} sincronizado{section.sincronizados.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => apply.mutate(isHon ? { honorariosKeys: [...selNew, ...selChg, ...selSync] } : { comprasKeys: [...selNew, ...selChg, ...selSync] })}
          disabled={isPending || total === 0}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-4 py-2.5 rounded font-medium transition-colors"
        >
          {isPending && <RefreshCw size={11} className="animate-spin" />}
          Importar{total > 0 ? ` (${total})` : ''}
        </button>
      </div>

      {apply.isError && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle size={12} /> Error al importar. Intenta de nuevo.
        </div>
      )}
      {apply.isSuccess && (
        <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 rounded px-3 py-2">
          <Check size={12} /> Importado correctamente.
        </div>
      )}

      {!hasAny && (
        <p className="text-sm text-gray-400 text-center py-6">Sin archivos en reportes/Smart</p>
      )}

      <PreviewSection title="Nuevos"           rows={section.nuevos}        selected={selNew}  onToggle={id => toggleSet(selNew,  setSelNew,  id)} onToggleAll={(on) => toggleAll(section.nuevos,        selNew,  setSelNew,  on)} color="bg-green-400"  taxLabel={taxLabel} />
      <PreviewSection title="Cambios"          rows={section.cambios}       selected={selChg}  onToggle={id => toggleSet(selChg,  setSelChg,  id)} onToggleAll={(on) => toggleAll(section.cambios,       selChg,  setSelChg,  on)} color="bg-yellow-400" taxLabel={taxLabel} />
      <PreviewSection title="Ya sincronizados" rows={section.sincronizados} selected={selSync} onToggle={id => toggleSet(selSync, setSelSync, id)} onToggleAll={(on) => toggleAll(section.sincronizados, selSync, setSelSync, on)} color="bg-gray-300"   taxLabel={taxLabel} />
    </div>
  )
}

// ── SmartImportTab — for BukPage (Importables Excel > Smart CTO) ──────────────

export function SmartImportTab() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [preview, setPreview] = useState<SmartPreviewData | null>(null)
  const [subTab,  setSubTab]  = useState<SmartCategory>('honorarios')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await fetchSmartPreview()
      setPreview(data)
    } catch {
      setError('No se pudo leer los archivos. Verifica que estén en reportes/Smart/Comunicaciones y reportes/Smart/Consultoría.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Lee los archivos Excel de <code className="text-xs bg-gray-100 px-1 rounded">reportes/Smart/</code>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Comunicaciones y Consultoría · Honorarios y Libro de Compras
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Leyendo archivos…' : preview ? 'Recargar' : 'Cargar y previsualizar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          {/* Sub-tabs: Honorarios / Compras */}
          <div className="flex border-b border-gray-200">
            {(['honorarios', 'compras'] as SmartCategory[]).map(key => {
              const section = preview[key]
              const pending = section.nuevos.length + section.cambios.length
              return (
                <button key={key} onClick={() => setSubTab(key)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {key === 'honorarios' ? 'Honorarios' : 'Compras'}
                  {pending > 0 && (
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-semibold">
                      {pending}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <CategoryPreview data={preview} category={subTab} />
        </div>
      )}
    </div>
  )
}

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditableCell({
  value, proveedorId, field, type = 'text', options, currentArea, extraOptions = [],
}: {
  value:        string | null
  proveedorId:  string
  field:        'area' | 'categoria' | 'workCenterId'
  type?:        'text' | 'select' | 'smart-select'
  options?:     { value: string; label: string }[]
  currentArea?: string | null
  extraOptions?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [editingCustom, setEditingCustom] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const patch = usePatchProveedor()
  const inputRef = useRef<HTMLInputElement>(null)

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
    patch.mutate({ id: proveedorId, [field]: finalVal })
  }

  // Generate options for smart-select (Area or Categoria)
  const smartOptions = useMemo(() => {
    if (type !== 'smart-select') return []

    let base: string[] = []
    if (field === 'area') {
      base = AREAS
    } else if (field === 'categoria') {
      base = currentArea ? (CATEGORIES_BY_AREA[currentArea] || []) : []
    }

    // Merge with extra unique options found in data, avoiding duplicates
    const all = [...new Set([...base, ...extraOptions])].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    )
    return all.map(v => ({ value: v, label: v }))
  }, [type, field, currentArea, extraOptions])

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
        className="text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-28"
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
        className="text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-32"
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
        className="text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-white focus:outline-none w-28"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setEditing(true)
        setVal(value ?? '')
      }}
      className="group flex items-center gap-1 text-left hover:text-blue-600 transition-colors"
    >
      <span className={display ? 'text-gray-700' : 'text-gray-300'}>
        {display ?? '—'}
      </span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 text-gray-400 shrink-0" />
    </button>
  )
}

// ── Column filter types + helpers ─────────────────────────────────────────────

type SortState  = { col: string; dir: 'asc' | 'desc' } | null
type ColFilters = Record<string, Set<string>>

function getDocVal(d: SmartDocument, col: string): string {
  switch (col) {
    case 'rut':           return d.proveedor.rut ?? ''
    case 'razonSocial':   return d.proveedor.razonSocial ?? ''
    case 'empresa':       return ENTITY_LABEL[d.legalEntity as LegalEntity] ?? d.legalEntity
    case 'periodo':       return fmtPeriodo(d.periodoTributario)
    case 'clasificacion': return d.clasificacion ?? ''
    case 'area':          return d.proveedor.area ?? ''
    case 'categoria':     return d.proveedor.categoria ?? ''
    case 'workCenter':    return d.proveedor.workCenter?.name ?? ''
    case 'documento':     return d.documento ?? ''
    case 'emision':       return d.fechaEmision ?? ''
    case 'pago':          return d.fechaPago ?? ''
    case 'neto':          return String(d.montoNeto ?? 0)
    case 'retencion':     return String(d.retencion ?? 0)
    case 'iva':           return String(d.iva ?? 0)
    case 'total':         return String(d.montoTotal ?? 0)
    case 'pagado':        return d.pagado ? 'Pagado' : 'Sin pagar'
    default:              return ''
  }
}

function compareDocVal(a: SmartDocument, b: SmartDocument, col: string): number {
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
            ? <ChevronUp   size={12} className="text-blue-500 ml-1 inline" />
            : sortDir === 'desc'
            ? <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
            : <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />}
        </button>

        {!sortOnly && (
          <button
            ref={btnRef}
            onClick={handleOpen}
            className={`rounded p-0.5 hover:bg-gray-200 transition-colors ${isFiltered ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-gray-500'}`}
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
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${sortDir === 'asc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
            >
              ↑ A→Z
            </button>
            <button
              onClick={() => { onSort(col, 'desc'); setOpen(false) }}
              className={`flex-1 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors ${sortDir === 'desc' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
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
              className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
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
                className="rounded border-gray-300 text-blue-600"
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
                  className="rounded border-gray-300 text-blue-600 shrink-0"
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

function DataTable({
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
            <ColHeader {...ch('Área', 'area')} />
            <ColHeader {...ch('Categoría', 'categoria')} />
            <ColHeader {...ch('Centro de Trabajo', 'workCenter')} />
            <ColHeader {...ch('Documento', 'documento')} />
            <ColHeader {...ch('Emisión', 'emision', { sortOnly: true })} />
            <ColHeader {...ch('Pago', 'pago', { sortOnly: true })} />
            <ColHeader {...ch('Neto', 'neto', { numeric: true, sortOnly: true })} />
            <ColHeader {...ch(taxLabel, taxCol, { numeric: true, sortOnly: true })} />
            <ColHeader {...ch('Total', 'total', { numeric: true, sortOnly: true })} />
            <ColHeader {...ch('Pagado', 'pagado')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docs.map(d => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 font-mono text-gray-600 whitespace-nowrap">{d.proveedor.rut}</td>
              <td className="px-4 py-2.5 text-gray-800 max-w-[160px] truncate">{d.proveedor.razonSocial}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[d.legalEntity]}`}>
                  {ENTITY_LABEL[d.legalEntity]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtPeriodo(d.periodoTributario)}</td>
              <td className="px-4 py-2.5 text-gray-600 max-w-[120px] truncate">{d.clasificacion || '—'}</td>
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
              <td className="px-4 py-2.5">
                <EditableCell
                  value={d.proveedor.workCenterId}
                  proveedorId={d.proveedor.id}
                  field="workCenterId"
                  type="select"
                  options={wcOptions}
                />
              </td>
              <td className="px-4 py-2.5 text-gray-500 max-w-[110px] truncate">{d.documento}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCards({ docs, category }: { docs: SmartDocument[]; category: SmartCategory }) {
  const total    = docs.reduce((s, d) => s + d.montoTotal, 0)
  const neto     = docs.reduce((s, d) => s + d.montoNeto, 0)
  const tax      = docs.reduce((s, d) => s + (category === 'honorarios' ? (d.retencion ?? 0) : (d.iva ?? 0)), 0)
  const pagados  = docs.filter(d => d.pagado).length
  const taxLabel = category === 'honorarios' ? 'Retención Total' : 'IVA Total'

  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: 'Documentos', value: docs.length.toString(), sub: `${pagados} pagados`, icon: FileText,   color: 'bg-blue-50 text-blue-600' },
        { label: 'Monto Neto', value: fmtN(neto),             sub: '',                  icon: DollarSign,  color: 'bg-green-50 text-green-600' },
        { label: taxLabel,     value: fmtN(tax),              sub: '',                  icon: Percent,     color: 'bg-amber-50 text-amber-600' },
        { label: 'Total',      value: fmtN(total),            sub: '',                  icon: TrendingUp,  color: 'bg-indigo-50 text-indigo-600' },
      ].map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.color}`}>
            <c.icon size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
            {c.sub && <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── SmartTab — data view only (Centros de Trabajo) ────────────────────────────

export function SmartTab({ category, year, month }: { category: SmartCategory; year?: string; month?: string }) {
  const [search,     setSearch]     = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [sort,       setSort]       = useState<SortState>(null)

  // Sync periodo column filter with header year/month
  useEffect(() => {
    setColFilters(prev => {
      if (year && month) {
        const periodo = fmtPeriodo(`${year}${month.padStart(2, '0')}`)
        return { ...prev, periodo: new Set([periodo]) }
      }
      const { periodo: _, ...rest } = prev
      return rest
    })
  }, [year, month])

  // Fetch all data for current period (server-side) or all if no month selected
  const serverParams = (year && month) ? { periodo: `${year}${month.padStart(2, '0')}` } : {}
  const honQuery = useSmartHonorarios(category === 'honorarios' ? serverParams : { periodo: 'none' })
  const cmpQuery = useSmartCompras(category === 'compras'       ? serverParams : { periodo: 'none' })
  const { data: allDocs = [], isLoading } = category === 'honorarios' ? honQuery : cmpQuery

  function handleSort(col: string, dir?: 'asc' | 'desc') {
    setSort(prev => {
      if (dir) return { col, dir }
      if (!prev || prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc') return { col, dir: 'desc' }
      return null
    })
  }

  function handleFilterChange(col: string, vals: Set<string>) {
    setColFilters(prev => {
      if (vals.size === 0) {
        const { [col]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [col]: vals }
    })
  }

  const filteredDocs = useMemo(() => {
    let result = allDocs

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.proveedor.rut.toLowerCase().includes(q) ||
        d.proveedor.razonSocial.toLowerCase().includes(q),
      )
    }

    for (const [col, vals] of Object.entries(colFilters)) {
      if (vals.size === 0) continue
      result = result.filter(d => vals.has(getDocVal(d, col)))
    }

    if (sort) {
      result = [...result].sort((a, b) => {
        const cmp = compareDocVal(a, b, sort.col)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [allDocs, search, colFilters, sort])

  const hasFilters = search || Object.values(colFilters).some(s => s.size > 0) || !!sort

  return (
    <div className="space-y-5">
      <SummaryCards docs={filteredDocs} category={category} />

      {/* Search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor o RUT…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setColFilters({}); setSort(null) }}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <X size={11} /> Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filteredDocs.length !== allDocs.length
            ? `${filteredDocs.length} de ${allDocs.length} registros`
            : `${allDocs.length} registros`}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <DataTable
          allDocs={allDocs}
          docs={filteredDocs}
          category={category}
          isLoading={isLoading}
          colFilters={colFilters}
          onFilterChange={handleFilterChange}
          sort={sort}
          onSort={handleSort}
        />
      </div>
    </div>
  )
}
