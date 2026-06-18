import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, Filter, X, ChevronsUpDown, ChevronUp, ChevronDown,
  Users, RefreshCw, AlertTriangle, Plus, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useEmployees, useEmployeeStats, useUpdateEmployee } from '@/hooks/useDotacion'
import { useWorkCenters, useAssignWorkCenter, useUnassignWorkCenter } from '@/hooks/useWorkCenters'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatDate } from '@/lib/utils'
import type { Employee, Contract, LegalEntity } from '@/types'
import EmployeeDrawer from '../employees/EmployeeDrawer'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'Con permiso', DUPLICATE: 'Duplicado',
}
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
  ON_LEAVE:  'bg-amber-100 text-amber-700',
  DUPLICATE: 'bg-orange-100 text-orange-600',
}
const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', HONORARIOS: 'Honorarios', PRACTICA: 'Práctica',
}
const GENDER_LABEL: Record<string, string> = {
  M: 'Masculino', F: 'Femenino', male: 'Masculino', female: 'Femenino',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function primaryContract(contracts?: Contract[], preferLegalEntity?: string): Contract | undefined {
  if (!contracts?.length) return undefined
  if (preferLegalEntity) {
    const preferred =
      contracts.find(c => c.isActive && c.legalEntity === preferLegalEntity && c.salary > 0) ??
      contracts.find(c => c.isActive && c.legalEntity === preferLegalEntity)
    if (preferred) return preferred
  }
  return contracts.find(c => c.isActive && c.salary > 0) ?? contracts[0]
}

function initials(emp: Employee) {
  return `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase()
}

function dash(v: string | null | undefined) {
  return v ?? <span className="text-gray-300">—</span>
}

// ─── Sort & ColFilter ─────────────────────────────────────────────────────────

type SortKey = 'firstName' | 'rut' | 'email' | 'jobTitle' | 'legalEntity' | 'city' | 'costCenter' | 'exclusive' | 'vinculo' | 'status' | 'workSchedule' | 'contractType' | 'startDate' | 'endDate' | 'gender' | 'supervisorName'
type SortDir  = 'asc' | 'desc'
type ColFilters = Record<string, Set<string>>

function getEmpVal(e: Employee, col: string): string {
  const pc = primaryContract(e.contracts)
  switch (col) {
    case 'firstName':      return `${e.firstName} ${e.lastName}`.trim()
    case 'email':          return e.email ?? ''
    case 'vinculo':        return e.vinculo ?? ''
    case 'legalEntity':    return pc?.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : pc?.legalEntity === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : ''
    case 'status':         return e.status ?? ''
    case 'jobTitle':       return e.jobTitle ?? ''
    case 'city':           return e.city ?? ''
    case 'contractType':   return pc?.type ?? ''
    case 'exclusive':      return e.exclusive == null ? '' : e.exclusive ? 'Sí' : 'No'
    case 'gender':         return GENDER_LABEL[e.gender ?? ''] ?? e.gender ?? ''
    case 'supervisorName': return e.supervisorName ?? ''
    case 'workSchedule':   return e.workSchedule ?? ''
    case 'costCenter':     return (e.workCenters ?? []).map(w => w.workCenter.name).join(', ')
    case 'startDate':      return e.startDate ?? ''
    case 'endDate':        return e.endDate ?? ''
    case 'rut':            return e.rut ?? ''
    default: return ''
  }
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp   size={12} className="text-brand-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-brand-500 ml-1 inline" />
}

function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (c: SortKey) => void
}) {
  return (
    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700"
      onClick={() => onSort(col)}>
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  )
}

function FilterEmpTh({ label, col, sortKey, sortDir, onSort, allRows, colFilters, onFilterChange }: {
  label:          string
  col:            SortKey
  sortKey:        SortKey
  sortDir:        SortDir
  onSort:         (c: SortKey) => void
  allRows:        Employee[]
  colFilters:     ColFilters
  onFilterChange: (col: string, vals: Set<string>) => void
}) {
  const [open,          setOpen]         = useState(false)
  const [filterSearch,  setFilterSearch] = useState('')
  const [dropPos,       setDropPos]      = useState({ top: 0, left: 0 })
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
    () => [...new Set(allRows.map(e => getEmpVal(e, col)))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
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
    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide select-none whitespace-nowrap hover:text-gray-700">
      <div className="inline-flex items-center gap-1">
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

// ─── VinculoCell ──────────────────────────────────────────────────────────────

function VinculoCell({ emp }: { emp: Employee }) {
  const [editing,          setEditing]          = useState(false)
  const [editingReemplazo, setEditingReemplazo] = useState(false)
  const [reemplazoText,    setReemplazoText]    = useState(emp.reemplazaA ?? '')
  const update = useUpdateEmployee()

  const setVinculo = (v: string | null) => {
    update.mutate({ id: emp.id, vinculo: v, reemplazaA: v !== 'Reemplazo' ? null : emp.reemplazaA })
    setEditing(false)
  }

  const saveReemplazo = () => {
    update.mutate({ id: emp.id, reemplazaA: reemplazoText || null })
    setEditingReemplazo(false)
  }

  return (
    <td className="px-4 py-3 text-sm whitespace-nowrap" onClick={e => e.stopPropagation()}>
      {editing ? (
        <div className="flex gap-1">
          {['Planta', 'Reemplazo'].map(v => (
            <button key={v} onClick={() => setVinculo(v)}
              className="px-2 py-0.5 rounded text-xs border border-brand-300 text-brand-700 hover:bg-brand-50">{v}</button>
          ))}
          <button onClick={() => setVinculo(null)} className="px-2 py-0.5 rounded text-xs border border-gray-200 text-gray-400 hover:bg-gray-50">Quitar</button>
          <button onClick={() => setEditing(false)} className="text-gray-300 hover:text-gray-500 text-xs ml-1">✕</button>
        </div>
      ) : emp.vinculo ? (
        <div className="flex flex-col gap-0.5">
          <button onClick={() => setEditing(true)} className="text-left text-gray-700 hover:text-brand-600 transition-colors">
            {emp.vinculo}
          </button>
          {emp.vinculo === 'Reemplazo' && (
            editingReemplazo ? (
              <div className="flex gap-1 items-center">
                <input autoFocus value={reemplazoText} onChange={e => setReemplazoText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveReemplazo(); if (e.key === 'Escape') setEditingReemplazo(false) }}
                  placeholder="Nombre a quien reemplaza"
                  className="text-xs border border-brand-300 rounded px-1.5 py-0.5 w-44 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                <button onClick={saveReemplazo} className="text-xs text-brand-600 hover:text-brand-800">✓</button>
                <button onClick={() => setEditingReemplazo(false)} className="text-xs text-gray-300 hover:text-gray-500">✕</button>
              </div>
            ) : (
              <button onClick={() => { setReemplazoText(emp.reemplazaA ?? ''); setEditingReemplazo(true) }}
                className="text-xs text-left text-gray-400 hover:text-brand-500 transition-colors">
                {emp.reemplazaA ? `↳ ${emp.reemplazaA}` : '+ reemplaza a'}
              </button>
            )
          )}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-gray-300 hover:text-brand-400 transition-colors">+ asignar</button>
      )}
    </td>
  )
}

// ─── WorkCenterAssigner ───────────────────────────────────────────────────────

function WorkCenterAssigner({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  useEscapeKey(onClose)
  const { data: allCenters = [] } = useWorkCenters()
  const assign   = useAssignWorkCenter()
  const unassign = useUnassignWorkCenter()

  const contracts      = emp.contracts ?? []
  const legalEntities  = Array.from(new Set(contracts.map(c => c.legalEntity).filter(Boolean))) as LegalEntity[]
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity>(legalEntities[0] ?? 'COMUNICACIONES_SURMEDIA')
  const [selectedCenter, setSelectedCenter] = useState('')

  const assignedForEntity = (emp.workCenters ?? []).filter(wc => wc.legalEntity === selectedEntity)
  const assignedIds       = new Set(assignedForEntity.map(a => a.workCenterId))
  const available         = allCenters.filter(c => !assignedIds.has(c.id))

  async function handleAssign() {
    if (!selectedCenter) return
    await assign.mutateAsync({ workCenterId: selectedCenter, employeeId: emp.id, legalEntity: selectedEntity })
    setSelectedCenter('')
  }

  async function handleUnassign(workCenterId: string) {
    await unassign.mutateAsync({ workCenterId, employeeId: emp.id, legalEntity: selectedEntity })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Asignar centros de trabajo</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {legalEntities.length > 1 && (
            <div className="flex gap-2">
              {legalEntities.map(le => (
                <button key={le} onClick={() => setSelectedEntity(le)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedEntity === le ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {LEGAL_ENTITY_LABEL[le]}
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Centros asignados</p>
            {assignedForEntity.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin centros asignados</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {assignedForEntity.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium">
                    {a.workCenter.name}
                    <button onClick={() => handleUnassign(a.workCenterId)} aria-label="Quitar centro" className="hover:text-red-500 transition-colors ml-0.5">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Agregar centro</p>
            <div className="flex gap-2">
              <select value={selectedCenter} onChange={e => setSelectedCenter(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Seleccionar centro…</option>
                {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleAssign} disabled={!selectedCenter || assign.isPending}
                className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors">
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── EmployeeRow ──────────────────────────────────────────────────────────────

function EmployeeRow({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const [assigning, setAssigning] = useState(false)
  const contract   = primaryContract(emp.contracts)
  const centerNames = Array.from(new Set((emp.workCenters ?? []).map(wc => wc.workCenter.name)))

  return (
    <>
      <tr onClick={onClick} className="hover:bg-gray-50 cursor-pointer transition-colors">
        <td className="px-4 py-3 sticky left-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{initials(emp)}</div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${emp.status === 'ACTIVE' ? 'bg-green-500' : emp.status === 'ON_LEAVE' ? 'bg-amber-400' : emp.status === 'DUPLICATE' ? 'bg-orange-400' : 'bg-gray-300'}`} />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{emp.firstName} {emp.lastName}</p>
              </div>
              <p className="text-xs text-gray-400">{emp.email}</p>
            </div>
          </div>
        </td>
        <VinculoCell emp={emp} />
        <td className="px-4 py-3">
          {(() => {
            const le = contract?.legalEntity ?? emp.workCenters?.[0]?.legalEntity
            if (le) return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEGAL_ENTITY_COLOR[le]}`}>{LEGAL_ENTITY_LABEL[le]}</span>
            if (emp.contracts && emp.contracts.length > 1) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Ambas</span>
            return <span className="text-gray-300 text-xs">—</span>
          })()}
        </td>
        <td className="px-4 py-3" onClick={e => { e.stopPropagation(); setAssigning(true) }}>
          <div className="flex flex-wrap gap-1 items-center min-w-[120px] cursor-pointer group/center">
            {centerNames.length > 0 ? (
              <>
                {centerNames.slice(0, 2).map(name => (
                  <span key={name} className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium whitespace-nowrap">{name}</span>
                ))}
                {centerNames.length > 2 && <span className="text-xs text-gray-400">+{centerNames.length - 2}</span>}
              </>
            ) : (
              <span className="text-xs text-gray-300 group-hover/center:text-brand-400 transition-colors">+ asignar</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[emp.status]}`}>
            {STATUS_LABEL[emp.status]}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{dash(emp.email)}</td>
        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{dash(emp.jobTitle)}</td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{dash(emp.city)}</td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{dash(emp.workSchedule)}</td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {contract ? CONTRACT_LABEL[contract.type] ?? contract.type : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(emp.startDate)}</td>
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {emp.endDate ? <span className="text-amber-600">{formatDate(emp.endDate)}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {emp.exclusive != null ? (emp.exclusive ? 'Sí' : 'No') : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 font-mono whitespace-nowrap">{emp.rut}</td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {emp.gender ? (GENDER_LABEL[emp.gender] ?? emp.gender) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{dash(emp.supervisorName)}</td>
      </tr>
      {assigning && <WorkCenterAssigner emp={emp} onClose={() => setAssigning(false)} />}
    </>
  )
}

// ─── DotacionTab ──────────────────────────────────────────────────────────────

export function DotacionTab({ year, month }: { year: string; month: string }) {
  const [search,     setSearch]     = useState('')
  const [sortKey,    setSortKey]    = useState<SortKey>('firstName')
  const [sortDir,    setSortDir]    = useState<SortDir>('asc')
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filters = useMemo(() => ({
    search:      search || undefined,
    activeYear:  year   || undefined,
    activeMonth: month  || undefined,
  }), [search, year, month])

  const { data, isLoading, isError } = useEmployees(filters)
  const { data: stats }              = useEmployeeStats()
  const allEmployees                 = data?.data ?? []

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    return [...allEmployees].sort((a, b) => {
      const pc = (e: Employee) => primaryContract(e.contracts)
      if (sortKey === 'rut') {
        const toNum = (rut: string) => parseInt(rut.replace(/\./g, '').split('-')[0]) || 0
        const diff  = toNum(a.rut ?? '') - toNum(b.rut ?? '')
        return sortDir === 'asc' ? diff : -diff
      }
      let va = '', vb = ''
      if      (sortKey === 'firstName')     { va = a.firstName ?? '';                              vb = b.firstName ?? '' }
      else if (sortKey === 'email')         { va = a.email ?? '';                                  vb = b.email ?? '' }
      else if (sortKey === 'jobTitle')      { va = a.jobTitle ?? '';                               vb = b.jobTitle ?? '' }
      else if (sortKey === 'legalEntity')   { va = pc(a)?.legalEntity ?? '';                       vb = pc(b)?.legalEntity ?? '' }
      else if (sortKey === 'city')          { va = a.city ?? '';                                    vb = b.city ?? '' }
      else if (sortKey === 'costCenter')    { va = a.workCenters?.[0]?.workCenter?.name ?? '';      vb = b.workCenters?.[0]?.workCenter?.name ?? '' }
      else if (sortKey === 'exclusive')     { va = a.exclusive == null ? '' : a.exclusive ? 'Sí' : 'No'; vb = b.exclusive == null ? '' : b.exclusive ? 'Sí' : 'No' }
      else if (sortKey === 'vinculo')       { va = a.vinculo ?? '';                                 vb = b.vinculo ?? '' }
      else if (sortKey === 'status')        { va = a.status;                                        vb = b.status }
      else if (sortKey === 'workSchedule')  { va = a.workSchedule ?? '';                            vb = b.workSchedule ?? '' }
      else if (sortKey === 'contractType')  { va = pc(a)?.type ?? '';                               vb = pc(b)?.type ?? '' }
      else if (sortKey === 'startDate')     { va = a.startDate ?? '';                               vb = b.startDate ?? '' }
      else if (sortKey === 'endDate')       { va = a.endDate ?? '9999';                             vb = b.endDate ?? '9999' }
      else if (sortKey === 'gender')        { va = a.gender ?? '';                                   vb = b.gender ?? '' }
      else if (sortKey === 'supervisorName'){ va = a.supervisorName ?? '';                           vb = b.supervisorName ?? '' }
      const cmp = va.localeCompare(vb, 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allEmployees, sortKey, sortDir])

  const tableRows = useMemo(() => {
    const active = Object.entries(colFilters).filter(([, vals]) => vals.size > 0)
    if (active.length === 0) return sorted
    return sorted.filter(e => active.every(([col, vals]) => vals.has(getEmpVal(e, col))))
  }, [sorted, colFilters])

  function handleColFilter(col: string, vals: Set<string>) {
    setColFilters(prev => {
      if (vals.size === 0) { const { [col]: _, ...rest } = prev; return rest }
      return { ...prev, [col]: vals }
    })
  }

  function downloadExcel() {
    const wsData = [
      ['Colaborador', 'RUT', 'Correo', 'Vínculo', 'Razón Social', 'Centros de Trabajo', 'Estado', 'Cargo', 'Ciudad', 'Jornada', 'Tipo Contrato', 'Ingreso', 'Término', 'Exclusividad', 'Género', 'Supervisor'],
      ...tableRows.map(emp => {
        const contract = primaryContract(emp.contracts)
        const centerNames = Array.from(new Set((emp.workCenters ?? []).map(wc => wc.workCenter.name))).join(', ')
        const le = contract?.legalEntity ?? emp.workCenters?.[0]?.legalEntity
        return [
          `${emp.firstName} ${emp.lastName}`,
          emp.rut ?? '',
          emp.email ?? '',
          emp.vinculo ?? '',
          le ? LEGAL_ENTITY_LABEL[le as keyof typeof LEGAL_ENTITY_LABEL] ?? le : '',
          centerNames,
          STATUS_LABEL[emp.status] ?? emp.status,
          emp.jobTitle ?? '',
          emp.city ?? '',
          emp.workSchedule ?? '',
          contract ? (CONTRACT_LABEL[contract.type] ?? contract.type) : '',
          emp.startDate ? emp.startDate.split('T')[0] : '',
          emp.endDate ? emp.endDate.split('T')[0] : '',
          emp.exclusive == null ? '' : emp.exclusive ? 'Sí' : 'No',
          GENDER_LABEL[emp.gender ?? ''] ?? emp.gender ?? '',
          emp.supervisorName ?? '',
        ]
      }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dotación')
    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Dotacion_${fecha}.xlsx`)
  }

  const sharedTh = { sortKey, sortDir, onSort: handleSort, allRows: allEmployees, colFilters, onFilterChange: handleColFilter }

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><Users size={18} /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats?.active ?? '—'}</p>
            <p className="text-xs text-gray-500">Activos totales</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0"><Users size={18} /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats?.activeComunicaciones ?? '—'}</p>
            <p className="text-xs text-gray-500">Comunicaciones</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0"><Users size={18} /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats?.activeConsultoria ?? '—'}</p>
            <p className="text-xs text-gray-500">Consultoría</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0"><Users size={18} /></div>
          <div>
            <p className="text-xl font-bold text-gray-900">{stats?.inactive ?? '—'}</p>
            <p className="text-xs text-gray-500">Inactivos</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Nombre, RUT, cargo o correo…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {tableRows.length !== allEmployees.length
              ? `${tableRows.length} de ${allEmployees.length} colaboradores`
              : `${allEmployees.length} colaboradores`}
          </span>
          <button
            onClick={downloadExcel}
            disabled={tableRows.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
            title="Descargar tabla como Excel"
          >
            <Download size={13} />
            Descargar Excel
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-brand-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Cargando colaboradores…</p>
          </div>
        ) : isError ? (
          <div className="p-16 text-center">
            <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Error cargando datos.</p>
          </div>
        ) : allEmployees.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No se encontraron colaboradores.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <FilterEmpTh     label="Colaborador"   col="firstName"     {...sharedTh} />
                  <FilterEmpTh     label="Vínculo"       col="vinculo"       {...sharedTh} />
                  <FilterEmpTh     label="Razón Social"  col="legalEntity"   {...sharedTh} />
                  <FilterEmpTh     label="Centros"       col="costCenter"    {...sharedTh} />
                  <FilterEmpTh     label="Estado"        col="status"        {...sharedTh} />
                  <FilterEmpTh     label="Correo"        col="email"         {...sharedTh} />
                  <FilterEmpTh     label="Cargo"         col="jobTitle"      {...sharedTh} />
                  <FilterEmpTh     label="Ciudad"        col="city"          {...sharedTh} />
                  <FilterEmpTh     label="Jornada"       col="workSchedule"  {...sharedTh} />
                  <FilterEmpTh     label="Tipo Contrato" col="contractType"  {...sharedTh} />
                  <FilterEmpTh     label="Ingreso"       col="startDate"     {...sharedTh} />
                  <FilterEmpTh     label="Término"       col="endDate"       {...sharedTh} />
                  <FilterEmpTh     label="Exclusividad"  col="exclusive"     {...sharedTh} />
                  <FilterEmpTh     label="RUT"           col="rut"           {...sharedTh} />
                  <FilterEmpTh     label="Género"        col="gender"        {...sharedTh} />
                  <FilterEmpTh     label="Supervisor"    col="supervisorName" {...sharedTh} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tableRows.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} onClick={() => setSelectedId(emp.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {allEmployees.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {tableRows.length !== allEmployees.length
              ? `${tableRows.length} de ${allEmployees.length} colaboradores`
              : `${allEmployees.length} colaboradores`}
          </div>
        )}
      </div>

      <EmployeeDrawer employeeId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
