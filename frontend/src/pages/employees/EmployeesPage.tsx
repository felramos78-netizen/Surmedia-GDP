import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, RefreshCw, ChevronDown, Users, UserX, GitMerge, AlertTriangle, CheckCircle2, X, Eye, Save, Calendar, ChevronsUpDown, ChevronUp, DollarSign, List, Plus } from 'lucide-react'
import { useEmployees, useEmployeeStats, useMovements, useUpdateEmployee, type DotacionFilters } from '@/hooks/useDotacion'
import { useWorkCenters, useAssignWorkCenter, useUnassignWorkCenter } from '@/hooks/useWorkCenters'
import { formatDate } from '@/lib/utils'
import type { Employee, Contract, LegalEntity } from '@/types'
import EmployeeDrawer from './EmployeeDrawer'
import PayrollView from './PayrollView'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'Con permiso', DUPLICATE: 'Duplicado' }
const STATUS_COLOR: Record<string, string>  = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
  ON_LEAVE:  'bg-amber-100 text-amber-700',
  DUPLICATE: 'bg-orange-100 text-orange-600',
}
const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', HONORARIOS: 'Honorarios', PRACTICA: 'Práctica',
}
const GENDER_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', male: 'Masculino', female: 'Femenino' }

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, detail, onClick, active }: {
  label: string; value: number | string; sub?: string
  icon: React.ElementType; color: string
  detail?: { label: string; value: number | string; color: string }[]
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {detail && (
        <div className="flex gap-3 border-t border-gray-100 pt-3">
          {detail.map(d => (
            <div key={d.label} className="flex-1">
              <p className={`text-sm font-semibold ${d.color}`}>{d.value}</p>
              <p className="text-xs text-gray-400">{d.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FilterSelect (single) ────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── MultiFilterSelect (múltiple) ────────────────────────────────────────────

function MultiFilterSelect({ values, onChange, options, placeholder }: {
  values: string[]
  onChange: (v: string[]) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])

  const label = values.length === 0
    ? placeholder
    : values.length === 1
    ? (options.find(o => o.value === values[0])?.label ?? values[0])
    : `${values.length} seleccionados`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center pl-3 pr-8 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer whitespace-nowrap ${values.length > 0 ? 'border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700'}`}
      >
        {label}
        <ChevronDown size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-full py-1">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'firstName' | 'rut' | 'jobTitle' | 'legalEntity' | 'city' | 'costCenter' | 'exclusive' | 'vinculo' | 'status' | 'workSchedule' | 'contractType' | 'startDate' | 'endDate' | 'gender' | 'supervisorName'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
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

// ─── Asignador de centros de trabajo ─────────────────────────────────────────

function WorkCenterAssigner({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const { data: allCenters = [] } = useWorkCenters()
  const assign = useAssignWorkCenter()
  const unassign = useUnassignWorkCenter()

  const contracts = emp.contracts ?? []
  const legalEntities = Array.from(new Set(contracts.map(c => c.legalEntity).filter(Boolean))) as LegalEntity[]
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity>(legalEntities[0] ?? 'COMUNICACIONES_SURMEDIA')
  const [selectedCenter, setSelectedCenter] = useState('')

  const assignedForEntity = (emp.workCenters ?? []).filter(wc => wc.legalEntity === selectedEntity)

  async function handleAssign() {
    if (!selectedCenter) return
    await assign.mutateAsync({ workCenterId: selectedCenter, employeeId: emp.id, legalEntity: selectedEntity })
    setSelectedCenter('')
  }

  async function handleUnassign(workCenterId: string) {
    await unassign.mutateAsync({ workCenterId, employeeId: emp.id, legalEntity: selectedEntity })
  }

  const assignedIds = new Set(assignedForEntity.map(a => a.workCenterId))
  const available = allCenters.filter(c => !assignedIds.has(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Asignar centros de trabajo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {legalEntities.length > 1 && (
            <div className="flex gap-2">
              {legalEntities.map(le => (
                <button key={le} onClick={() => setSelectedEntity(le)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedEntity === le ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
                  <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                    {a.workCenter.name}
                    <button onClick={() => handleUnassign(a.workCenterId)} className="hover:text-red-500 transition-colors ml-0.5">
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
              <select
                value={selectedCenter}
                onChange={e => setSelectedCenter(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar centro…</option>
                {available.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedCenter || assign.isPending}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fila ─────────────────────────────────────────────────────────────────────

function VinculoCell({ emp }: { emp: Employee }) {
  const [editing, setEditing] = useState(false)
  const [editingReemplazo, setEditingReemplazo] = useState(false)
  const [reemplazoText, setReemplazoText] = useState(emp.reemplazaA ?? '')
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
              className="px-2 py-0.5 rounded text-xs border border-blue-300 text-blue-700 hover:bg-blue-50">{v}</button>
          ))}
          <button onClick={() => setVinculo(null)} className="px-2 py-0.5 rounded text-xs border border-gray-200 text-gray-400 hover:bg-gray-50">Quitar</button>
          <button onClick={() => setEditing(false)} className="text-gray-300 hover:text-gray-500 text-xs ml-1">✕</button>
        </div>
      ) : emp.vinculo ? (
        <div className="flex flex-col gap-0.5">
          <button onClick={() => setEditing(true)} className="text-left text-gray-700 hover:text-blue-600 transition-colors">
            {emp.vinculo}
          </button>
          {emp.vinculo === 'Reemplazo' && (
            editingReemplazo ? (
              <div className="flex gap-1 items-center">
                <input autoFocus value={reemplazoText} onChange={e => setReemplazoText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveReemplazo(); if (e.key === 'Escape') setEditingReemplazo(false) }}
                  placeholder="Nombre a quien reemplaza"
                  className="text-xs border border-blue-300 rounded px-1.5 py-0.5 w-44 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <button onClick={saveReemplazo} className="text-xs text-blue-600 hover:text-blue-800">✓</button>
                <button onClick={() => setEditingReemplazo(false)} className="text-xs text-gray-300 hover:text-gray-500">✕</button>
              </div>
            ) : (
              <button onClick={() => { setReemplazoText(emp.reemplazaA ?? ''); setEditingReemplazo(true) }}
                className="text-xs text-left text-gray-400 hover:text-blue-500 transition-colors">
                {emp.reemplazaA ? `↳ ${emp.reemplazaA}` : '+ reemplaza a'}
              </button>
            )
          )}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-gray-300 hover:text-blue-400 transition-colors">+ asignar</button>
      )}
    </td>
  )
}

function EmployeeRow({ emp, onClick, preferLegalEntity }: { emp: Employee; onClick: () => void; preferLegalEntity?: string }) {
  const [assigning, setAssigning] = useState(false)
  const contract = primaryContract(emp.contracts, preferLegalEntity)

  const empCenters = emp.workCenters ?? []
  const centerNames = Array.from(new Set(empCenters.map(wc => wc.workCenter.name)))

  return (
    <>
      <tr onClick={onClick} className="hover:bg-gray-50 cursor-pointer transition-colors">
        {/* Colaborador */}
        <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{initials(emp)}</div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${emp.status === 'ACTIVE' ? 'bg-green-500' : emp.status === 'ON_LEAVE' ? 'bg-amber-400' : emp.status === 'DUPLICATE' ? 'bg-orange-400' : 'bg-gray-300'}`} />
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{emp.firstName} {emp.lastName}</p>
              </div>
              <p className="text-xs text-gray-400">{emp.email}</p>
            </div>
          </div>
        </td>
        {/* Vínculo */}
        <VinculoCell emp={emp} />
        {/* Razón Social */}
        <td className="px-4 py-3">
          {(() => {
            const le = contract?.legalEntity ?? emp.workCenters?.[0]?.legalEntity
            if (le) return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEGAL_ENTITY_COLOR[le]}`}>{LEGAL_ENTITY_LABEL[le]}</span>
            if (emp.contracts && emp.contracts.length > 1) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Ambas</span>
            return <span className="text-gray-300 text-xs">—</span>
          })()}
        </td>
        {/* Centros de trabajo */}
        <td className="px-4 py-3" onClick={e => { e.stopPropagation(); setAssigning(true) }}>
          <div className="flex flex-wrap gap-1 items-center min-w-[120px] cursor-pointer group/center">
            {centerNames.length > 0 ? (
              <>
                {centerNames.slice(0, 2).map(name => (
                  <span key={name} className="inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium whitespace-nowrap">
                    {name}
                  </span>
                ))}
                {centerNames.length > 2 && (
                  <span className="text-xs text-gray-400">+{centerNames.length - 2}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-300 group-hover/center:text-blue-400 transition-colors">+ asignar</span>
            )}
          </div>
        </td>
        {/* Estado */}
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[emp.status]}`}>
            {STATUS_LABEL[emp.status]}
          </span>
        </td>
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

// ─── Página principal ─────────────────────────────────────────────────────────

// Años disponibles para filtro (últimos 10 años)
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)
const MONTHS = [
  { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

export default function EmployeesPage() {
  const [view, setView]         = useState<'dotacion' | 'remuneraciones'>('dotacion')
  const [filters, setFilters]   = useState<DotacionFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortKey, setSortKey]   = useState<SortKey>('firstName')
  const [sortDir, setSortDir]   = useState<SortDir>('asc')
  const [movYear,  setMovYear]  = useState(String(new Date().getFullYear()))
  const [movMonth, setMovMonth] = useState(String(new Date().getMonth() + 1))

  const tableWrapperRef    = useRef<HTMLDivElement>(null)
  const topScrollRef       = useRef<HTMLDivElement>(null)
  const topScrollInnerRef  = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useEmployees(filters)
  const { data: stats } = useEmployeeStats()
  const { data: movements } = useMovements({ year: movYear, month: movMonth })
  const allEmployees = data?.data ?? []

  function setFilter(key: 'search' | 'departmentId', value: string) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  function setArrayFilter(key: 'status' | 'legalEntity' | 'contractType', values: string[]) {
    setFilters(prev => ({ ...prev, [key]: values.length > 0 ? values : undefined }))
  }

  function setScalarFilter(key: 'activeYear' | 'activeMonth', value: string) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  // Dual-scroll sync: top scrollbar mirrors table horizontal scroll
  useEffect(() => {
    const wrapper  = tableWrapperRef.current
    const topScroll = topScrollRef.current
    const topInner  = topScrollInnerRef.current
    if (!wrapper || !topScroll || !topInner) return
    const updateWidth = () => { topInner.style.width = `${wrapper.scrollWidth}px` }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(wrapper)
    const syncTop     = () => { topScroll.scrollLeft = wrapper.scrollLeft }
    const syncWrapper = () => { wrapper.scrollLeft   = topScroll.scrollLeft }
    wrapper.addEventListener('scroll', syncTop)
    topScroll.addEventListener('scroll', syncWrapper)
    return () => { ro.disconnect(); wrapper.removeEventListener('scroll', syncTop); topScroll.removeEventListener('scroll', syncWrapper) }
  }, [])

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  const employees = useMemo(() => {
    let list = allEmployees

    // Sort
    list = [...list].sort((a, b) => {
      const pc = (e: Employee) => primaryContract(e.contracts)

      // RUT: comparación numérica (extrae el número sin puntos ni dígito verificador)
      if (sortKey === 'rut') {
        const toNum = (rut: string) => parseInt(rut.replace(/\./g, '').split('-')[0]) || 0
        const diff = toNum(a.rut ?? '') - toNum(b.rut ?? '')
        return sortDir === 'asc' ? diff : -diff
      }

      let va = '', vb = ''
      if      (sortKey === 'firstName')     { va = a.firstName ?? '';                   vb = b.firstName ?? '' }
      else if (sortKey === 'jobTitle')      { va = a.jobTitle ?? '';                    vb = b.jobTitle ?? '' }
      else if (sortKey === 'legalEntity')   { va = pc(a)?.legalEntity ?? '';            vb = pc(b)?.legalEntity ?? '' }
      else if (sortKey === 'city')          { va = a.city ?? '';                         vb = b.city ?? '' }
      else if (sortKey === 'costCenter')    { va = a.workCenters?.[0]?.workCenter?.name ?? ''; vb = b.workCenters?.[0]?.workCenter?.name ?? '' }
      else if (sortKey === 'exclusive')     { va = a.exclusive == null ? '' : a.exclusive ? 'Sí' : 'No'; vb = b.exclusive == null ? '' : b.exclusive ? 'Sí' : 'No' }
      else if (sortKey === 'vinculo')       { va = a.vinculo ?? '';                      vb = b.vinculo ?? '' }
      else if (sortKey === 'status')        { va = a.status;                              vb = b.status }
      else if (sortKey === 'workSchedule')  { va = a.workSchedule ?? '';                  vb = b.workSchedule ?? '' }
      else if (sortKey === 'contractType')  { va = pc(a)?.type ?? '';                     vb = pc(b)?.type ?? '' }
      else if (sortKey === 'startDate')     { va = a.startDate ?? '';                     vb = b.startDate ?? '' }
      else if (sortKey === 'endDate')       { va = a.endDate ?? '9999';                   vb = b.endDate ?? '9999' }
      else if (sortKey === 'gender')        { va = a.gender ?? '';                         vb = b.gender ?? '' }
      else if (sortKey === 'supervisorName'){ va = a.supervisorName ?? '';                 vb = b.supervisorName ?? '' }
      const cmp = va.localeCompare(vb, 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [allEmployees, sortKey, sortDir])

  const hasFilters = !!(
    filters.search ||
    filters.status?.length ||
    filters.legalEntity?.length ||
    filters.contractType?.length ||
    filters.departmentId ||
    filters.activeYear ||
    filters.activeMonth
  )

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dotación</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {stats !== undefined ? `${stats.total} colaboradores en base de datos` : 'Cargando…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button onClick={() => setView('dotacion')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${view === 'dotacion' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <List size={15} />Dotación
            </button>
            <button onClick={() => setView('remuneraciones')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${view === 'remuneraciones' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <DollarSign size={15} />Remuneraciones
            </button>
          </div>
        </div>
      </div>

      {view === 'remuneraciones' && <PayrollView />}

      {view === 'dotacion' && <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Activos" value={stats?.active ?? '—'} icon={Users} color="text-green-600 bg-green-50"
          detail={[
            { label: 'Comunicaciones', value: stats?.activeComunicaciones ?? '—', color: 'text-blue-600' },
            { label: 'Consultoría',    value: stats?.activeConsultoria    ?? '—', color: 'text-violet-600' },
          ]}
          active={(filters.status ?? []).includes('ACTIVE')}
          onClick={() => {
            const curr = filters.status ?? []
            setArrayFilter('status', curr.includes('ACTIVE') ? curr.filter(s => s !== 'ACTIVE') : [...curr, 'ACTIVE'])
          }}
        />
        <StatCard label="Activos Comunicaciones" value={stats?.activeComunicaciones ?? '—'} icon={Users} color="text-blue-600 bg-blue-50" sub="Comunicaciones Surmedia Spa" />
        <StatCard label="Activos Consultoría"    value={stats?.activeConsultoria    ?? '—'} icon={Users} color="text-violet-600 bg-violet-50" sub="Surmedia Consultoría Spa" />
      </div>

      {/* Movimientos e Ingresos/Salidas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-gray-800">Ingresos y Salidas</h3>
          <div className="flex items-center gap-2">
            <FilterSelect value={movMonth} onChange={setMovMonth} placeholder="Mes"
              options={MONTHS} />
            <FilterSelect value={movYear} onChange={setMovYear} placeholder="Año"
              options={YEARS.map(y => ({ value: String(y), label: String(y) }))} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ingresos */}
          <div>
            <p className="text-xs font-medium text-green-700 mb-2">
              Ingresos — {movements?.ingresos?.length ?? 0} colaboradores
            </p>
            {(movements?.ingresos?.length ?? 0) === 0
              ? <p className="text-xs text-gray-400">Sin ingresos en el período</p>
              : <div className="space-y-1.5">
                  {movements!.ingresos.map((e: any) => {
                    const le = e.contracts?.[0]?.legalEntity ?? e.workCenters?.[0]?.legalEntity
                    const leLabel = le === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : le === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : null
                    return (
                      <div key={e.id} className="flex items-start justify-between gap-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-800">{e.firstName} {e.lastName}</span>
                          {leLabel && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">{leLabel}</span>}
                        </div>
                        <span className="text-gray-400 whitespace-nowrap">{e.startDate ? formatDate(e.startDate) : '—'}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
          {/* Salidas */}
          <div>
            <p className="text-xs font-medium text-red-600 mb-2">
              Salidas — {movements?.salidas?.length ?? 0} colaboradores
            </p>
            {(movements?.salidas?.length ?? 0) === 0
              ? <p className="text-xs text-gray-400">Sin salidas en el período</p>
              : <div className="space-y-1.5">
                  {movements!.salidas.map((e: any) => {
                    const le = e.contracts?.[0]?.legalEntity ?? e.workCenters?.[0]?.legalEntity
                    const leLabel = le === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : le === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : null
                    return (
                      <div key={e.id} className="flex items-start justify-between gap-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-800">{e.firstName} {e.lastName}</span>
                          {leLabel && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">{leLabel}</span>}
                        </div>
                        <span className="text-gray-400 whitespace-nowrap">{e.endDate ? formatDate(e.endDate) : '—'}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>
      </div>

      {/* Vacaciones tomadas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Vacaciones tomadas — {MONTHS.find(m => m.value === movMonth)?.label} {movYear}
        </h3>
        {(movements?.vacaciones?.length ?? 0) === 0
          ? <p className="text-xs text-gray-400">Sin vacaciones en el período</p>
          : <div className="divide-y divide-gray-50">
              <div className="grid grid-cols-5 gap-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span className="col-span-2">Colaborador</span><span>Desde</span><span>Hasta</span><span>Días</span>
              </div>
              {movements!.vacaciones.map((leave: any) => {
                const leLabel = leave.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : leave.legalEntity === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : null
                return (
                  <div key={leave.id} className="grid grid-cols-5 gap-3 py-2 text-xs text-gray-700">
                    <div className="col-span-2">
                      <span className="font-medium">{leave.employee.firstName} {leave.employee.lastName}</span>
                      {leLabel && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">{leLabel}</span>}
                    </div>
                    <span>{formatDate(leave.startDate)}</span>
                    <span>{formatDate(leave.endDate)}</span>
                    <span>{leave.days} día{leave.days !== 1 ? 's' : ''}</span>
                  </div>
                )
              })}
            </div>
        }
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200">

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Nombre, RUT, cargo o correo…"
              value={filters.search ?? ''}
              onChange={e => setFilter('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <MultiFilterSelect
            values={filters.legalEntity ?? []}
            onChange={v => setArrayFilter('legalEntity', v)}
            placeholder="Todas las empresas"
            options={[{ value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' }, { value: 'SURMEDIA_CONSULTORIA', label: 'Consultoría' }]}
          />
          <MultiFilterSelect
            values={filters.status ?? []}
            onChange={v => setArrayFilter('status', v)}
            placeholder="Todos los estados"
            options={[{ value: 'ACTIVE', label: 'Activos' }, { value: 'INACTIVE', label: 'Inactivos' }, { value: 'DUPLICATE', label: 'Duplicados' }]}
          />
          <MultiFilterSelect
            values={filters.contractType ?? []}
            onChange={v => setArrayFilter('contractType', v)}
            placeholder="Tipo de contrato"
            options={[{ value: 'INDEFINIDO', label: 'Indefinido' }, { value: 'PLAZO_FIJO', label: 'Plazo fijo' }, { value: 'HONORARIOS', label: 'Honorarios' }, { value: 'PRACTICA', label: 'Práctica' }]}
          />
          <FilterSelect value={filters.activeYear ?? ''} onChange={v => setScalarFilter('activeYear', v)}
            placeholder="Año activo"
            options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
          />
          <FilterSelect value={filters.activeMonth ?? ''} onChange={v => setScalarFilter('activeMonth', v)}
            placeholder="Mes activo"
            options={MONTHS}
          />
          {hasFilters && (
            <button onClick={() => setFilters({})}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-16 text-center"><RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" /><p className="text-sm text-gray-400">Cargando colaboradores…</p></div>
        ) : isError ? (
          <div className="p-16 text-center"><AlertTriangle size={24} className="text-red-300 mx-auto mb-3" /><p className="text-sm text-gray-500">Error cargando datos. Intenta nuevamente.</p></div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No se encontraron colaboradores.</p>
            {hasFilters
              ? <p className="text-xs text-gray-400 mt-1">Prueba ajustando los filtros.</p>
              : <p className="text-xs text-gray-400 mt-1">Sincroniza desde BUK para importar la dotación.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <SortTh label="Colaborador"    col="firstName"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Vínculo"        col="vinculo"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Razón Social"   col="legalEntity"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Centros"        col="costCenter"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Estado"         col="status"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Cargo"          col="jobTitle"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Ciudad"         col="city"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Jornada"        col="workSchedule"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Vínculo"        col="contractType"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Ingreso"        col="startDate"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Término"        col="endDate"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Exclusividad"   col="exclusive"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="RUT"            col="rut"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Género"         col="gender"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Supervisor"     col="supervisorName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} onClick={() => setSelectedId(emp.id)}
                    preferLegalEntity={filters.legalEntity?.length === 1 ? filters.legalEntity[0] : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {employees.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {employees.length} colaboradores mostrados{data?.total && data.total > employees.length ? ` de ${data.total} en total` : ''}
          </div>
        )}
      </div>

      <EmployeeDrawer employeeId={selectedId} onClose={() => setSelectedId(null)} />
      </>}
    </div>
  )
}
