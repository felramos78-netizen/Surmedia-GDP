import { useState, useMemo, useEffect, Fragment } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Plus, Pencil, Trash2, X, Save, Building2, Users, Briefcase,
  ChevronDown, ChevronUp, ChevronsUpDown, DollarSign, TrendingUp,
  TrendingDown, BarChart2, Search, Wallet, Percent, UserPlus,
  UserMinus, Stethoscope, Repeat, RefreshCw,
} from 'lucide-react'
import {
  useWorkCenters, useCreateWorkCenter, useUpdateWorkCenter, useDeleteWorkCenter,
} from '@/hooks/useWorkCenters'
import { usePayrollTable, usePayrollYears, useMovements } from '@/hooks/useDotacion'
import type { WorkCenter, CostType, LegalEntity, PayrollRawEntry, PayrollItem, EmployeeStatus } from '@/types'

// ─── Formatting ───────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmt = (n: number) => n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)
function fmtShort(n: number): string {
  if (n === 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return CLP.format(n)
}

const MONTHS_LABEL: Record<number, string> = {
  1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',
  7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic',
}
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS_LABEL[i + 1] }))

// ─── Label/color maps ─────────────────────────────────────────────────────────

const COST_TYPE_LABEL: Record<CostType, string>  = { DIRECTO: 'Directo', INDIRECTO: 'Indirecto' }
const COST_TYPE_COLOR: Record<CostType, string>  = {
  DIRECTO:   'bg-blue-100 text-blue-700',
  INDIRECTO: 'bg-gray-100 text-gray-600',
}
const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

// ─── Payroll parsing (same regexes as PayrollView.tsx) ────────────────────────

const SUELDO_BASE_RE   = /sueldo[\s_-]?base/i
const GRATIFICACION_RE = /gratificaci[oó]n/i
const HH_ANY_RE        = /horas?\s?extras?|hh[\s_-]?extra/i
const HH_50_RE         = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*50|50.*(horas?\s?extras?)/i
const HH_100_RE        = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*100|100.*(horas?\s?extras?)/i

interface ParsedItems {
  sueldoBase: number; gratificacion: number
  hhTotal: number; hh50Hours: number; hh100Hours: number; hhDetail: string
  bonosTotal: number; bonosNames: string
  noImponiblesTotal: number; noImponiblesNames: string
}

function extractHours(items: PayrollItem[]): number {
  return items.reduce((s, i) => {
    const m = i.name.match(/(\d+(?:[.,]\d+)?)\s*h(ora)?/i)
    return s + (m ? parseFloat(m[1].replace(',', '.')) : 0)
  }, 0)
}

function parsePayrollItems(items: PayrollItem[], grossSalary = 0): ParsedItems {
  let sueldoBase = 0, gratificacion = 0
  const hh50: PayrollItem[] = [], hh100: PayrollItem[] = []
  const bonos: PayrollItem[] = [], noImponibles: PayrollItem[] = []

  for (const item of items) {
    if (item.type === 'descuento') continue
    const n = item.name
    if (SUELDO_BASE_RE.test(n))   { sueldoBase    += item.amount; continue }
    if (GRATIFICACION_RE.test(n)) { gratificacion  += item.amount; continue }
    if (HH_50_RE.test(n))         { hh50.push(item);              continue }
    if (HH_100_RE.test(n))        { hh100.push(item);             continue }
    if (HH_ANY_RE.test(n))        { hh50.push(item);              continue }
    if (item.taxable === false) { noImponibles.push(item) } else { bonos.push(item) }
  }

  const hhTotal   = [...hh50, ...hh100].reduce((s, i) => s + i.amount, 0)
  const valorHora = grossSalary > 0 ? grossSalary / 240 : 0
  let hh50Hours   = extractHours(hh50)
  let hh100Hours  = extractHours(hh100)
  if (hh50Hours  === 0 && hh50.length  > 0 && valorHora > 0)
    hh50Hours  = Math.round(hh50.reduce ((s, i) => s + i.amount, 0) / (valorHora * 1.5) * 10) / 10
  if (hh100Hours === 0 && hh100.length > 0 && valorHora > 0)
    hh100Hours = Math.round(hh100.reduce((s, i) => s + i.amount, 0) / (valorHora * 2.0) * 10) / 10

  const parts: string[] = []
  if (hh50.length)  { const nn = [...new Set(hh50.map (i => i.name))].join(', '); parts.push(hh50Hours  > 0 ? `${nn} (~${hh50Hours.toFixed(1)}h)`  : nn) }
  if (hh100.length) { const nn = [...new Set(hh100.map(i => i.name))].join(', '); parts.push(hh100Hours > 0 ? `${nn} (~${hh100Hours.toFixed(1)}h)` : nn) }

  return {
    sueldoBase, gratificacion, hhTotal, hh50Hours, hh100Hours,
    hhDetail:          parts.join('; ') || '—',
    bonosTotal:        bonos.reduce       ((s, i) => s + i.amount, 0),
    bonosNames:        [...new Set(bonos.map        (i => i.name))].join(', ') || '—',
    noImponiblesTotal: noImponibles.reduce((s, i) => s + i.amount, 0),
    noImponiblesNames: [...new Set(noImponibles.map (i => i.name))].join(', ') || '—',
  }
}

// ─── AggRow — adds sueldoEstandar = base + gratif + noImp ────────────────────

interface WCAggRow {
  employeeId: string; employeeName: string; rut: string
  legalEntity: string; status: EmployeeStatus; centers: string
  jobTitle: string; ponderacion: number   // ponderacion: 1/n centros misma empresa
  period: string; grossSalary: number; liquidSalary: number
  sueldoEstandar: number   // = sueldoBase + gratificacion + noImponiblesTotal
  sueldoBase: number; gratificacion: number
  hhTotal: number; hh50Hours: number; hh100Hours: number; hhDetail: string
  bonosTotal: number; bonosNames: string
  noImponiblesTotal: number; noImponiblesNames: string
}

function getCenters(wcs: { legalEntity: string; workCenter: { name: string } }[] | undefined, le: string): string {
  if (!wcs?.length) return '—'
  const names = wcs.filter(w => w.legalEntity === le).map(w => w.workCenter.name)
  return names.length > 0 ? names.join(', ') : '—'
}

function getPonderacion(wcs: { legalEntity: string; workCenter: { name: string } }[] | undefined, le: string): number {
  if (!wcs?.length) return 1
  const count = wcs.filter(w => w.legalEntity === le).length
  return count > 0 ? 1 / count : 1
}

function aggregateWCRows(entries: PayrollRawEntry[], monthly: boolean): WCAggRow[] {
  if (monthly) {
    return entries.map(e => {
      const p = parsePayrollItems(e.items ?? [], e.grossSalary)
      return {
        employeeId: e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut: e.employee.rut, legalEntity: e.legalEntity, status: e.employee.status,
        jobTitle: e.employee.jobTitle ?? '—',
        ponderacion: getPonderacion(e.employee.workCenters, e.legalEntity),
        centers: getCenters(e.employee.workCenters, e.legalEntity),
        period: `${MONTHS_LABEL[e.month] ?? e.month} ${e.year}`,
        grossSalary: e.grossSalary, liquidSalary: e.liquidSalary,
        sueldoEstandar: p.sueldoBase + p.gratificacion + p.noImponiblesTotal,
        ...p,
      }
    })
  }
  const map = new Map<string, WCAggRow>()
  for (const e of entries) {
    const key = `${e.employeeId}::${e.legalEntity}`
    const p   = parsePayrollItems(e.items ?? [], e.grossSalary)
    const se  = p.sueldoBase + p.gratificacion + p.noImponiblesTotal
    const ex  = map.get(key)
    if (!ex) {
      map.set(key, {
        employeeId: e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut: e.employee.rut, legalEntity: e.legalEntity, status: e.employee.status,
        jobTitle: e.employee.jobTitle ?? '—',
        ponderacion: getPonderacion(e.employee.workCenters, e.legalEntity),
        centers: getCenters(e.employee.workCenters, e.legalEntity),
        period: `${e.year} (anual)`,
        grossSalary: e.grossSalary, liquidSalary: e.liquidSalary,
        sueldoEstandar: se, ...p,
      })
    } else {
      ex.grossSalary       += e.grossSalary
      ex.liquidSalary      += e.liquidSalary
      ex.sueldoEstandar    += se
      ex.sueldoBase        += p.sueldoBase
      ex.gratificacion     += p.gratificacion
      ex.hhTotal           += p.hhTotal
      ex.hh50Hours         += p.hh50Hours
      ex.hh100Hours        += p.hh100Hours
      ex.bonosTotal        += p.bonosTotal
      ex.noImponiblesTotal += p.noImponiblesTotal
      const parts: string[] = []
      if (ex.hh50Hours  > 0) parts.push(`~${ex.hh50Hours.toFixed(1)}h a 50%`)
      if (ex.hh100Hours > 0) parts.push(`~${ex.hh100Hours.toFixed(1)}h a 100%`)
      ex.hhDetail = parts.join('; ') || '—'
      const allBonos = new Set([...ex.bonosNames.split(', ').filter(n => n !== '—'), ...p.bonosNames.split(', ').filter(n => n !== '—')])
      ex.bonosNames = allBonos.size > 0 ? [...allBonos].join(', ') : '—'
      const allNI = new Set([...ex.noImponiblesNames.split(', ').filter(n => n !== '—'), ...p.noImponiblesNames.split(', ').filter(n => n !== '—')])
      ex.noImponiblesNames = allNI.size > 0 ? [...allNI].join(', ') : '—'
    }
  }
  return [...map.values()]
}

// ─── sumPayrollStats ──────────────────────────────────────────────────────────

function sumPayrollStats(entries: PayrollRawEntry[]) {
  let grossSalary = 0, sueldoEstandar = 0, bonosTotal = 0, hhTotal = 0
  for (const e of entries) {
    const p = parsePayrollItems(e.items ?? [], e.grossSalary)
    grossSalary    += e.grossSalary
    sueldoEstandar += p.sueldoBase + p.gratificacion + p.noImponiblesTotal
    bonosTotal     += p.bonosTotal
    hhTotal        += p.hhTotal
  }
  return { grossSalary, sueldoEstandar, bonosTotal, hhTotal }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'employeeName' | 'legalEntity' | 'period' | 'liquidSalary' | 'grossSalary' | 'sueldoEstandar' | 'sueldoBase' | 'gratificacion' | 'bonosTotal' | 'hhTotal' | 'noImponiblesTotal'
type SortDir = 'asc' | 'desc'
const NUMERIC_KEYS = new Set<SortKey>(['liquidSalary', 'grossSalary', 'sueldoEstandar', 'sueldoBase', 'gratificacion', 'bonosTotal', 'hhTotal', 'noImponiblesTotal'])

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp   size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
}

function SortTh({ label, col, sortKey, sortDir, onSort, right, highlight }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir
  onSort: (c: SortKey) => void; right?: boolean; highlight?: boolean
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700 ${right ? 'text-right' : ''} ${highlight ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}
    >
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  )
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── MiniStat card ────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: LucideIcon; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ─── MovementList ─────────────────────────────────────────────────────────────

function MovementList({ title, items, color }: {
  title: string
  items: { name: string; rut?: string; date?: string | Date; info?: string }[]
  color: 'green' | 'red' | 'amber' | 'violet'
}) {
  const borderBg = { green: 'border-green-100 bg-green-50', red: 'border-red-100 bg-red-50', amber: 'border-amber-100 bg-amber-50', violet: 'border-violet-100 bg-violet-50' }
  const dot      = { green: 'bg-green-500', red: 'bg-red-500', amber: 'bg-amber-400', violet: 'bg-violet-500' }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title} ({items.length})</p>
      <div className={`rounded-lg border p-3 space-y-2 ${borderBg[color]}`}>
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

// ─── WorkCenterModal ──────────────────────────────────────────────────────────

function WorkCenterModal({ initial, onClose }: { initial?: WorkCenter | null; onClose: () => void }) {
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              value={name} onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Ej: CODELCO DET"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de costo</label>
            <div className="flex gap-3">
              {(['DIRECTO', 'INDIRECTO'] as CostType[]).map(t => (
                <button key={t} onClick={() => setCostType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    costType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
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
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Save size={14} />
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WorkCenterDetailPanel ────────────────────────────────────────────────────

type DetailSortKey = 'employeeName' | 'jobTitle' | 'ponderacion' | 'grossSalary' | 'sueldoEstandar' | 'bonosTotal' | 'hhTotal'

function DetailSortIcon({ col, sortKey, sortDir }: { col: DetailSortKey; sortKey: DetailSortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} className="text-gray-300 ml-0.5 inline" />
  return sortDir === 'asc'
    ? <ChevronUp   size={11} className="text-blue-500 ml-0.5 inline" />
    : <ChevronDown size={11} className="text-blue-500 ml-0.5 inline" />
}

function WorkCenterDetailPanel({ wc, allEntries, year, month, onEdit, onClose }: {
  wc: WorkCenter
  allEntries: PayrollRawEntry[]
  year: string; month: string
  onEdit: () => void; onClose: () => void
}) {
  const [outerTab,  setOuterTab]  = useState<'personas' | 'honorarios' | 'compras'>('personas')
  const [personTab, setPersonTab] = useState<'sueldos' | 'movimientos' | 'provisiones'>('sueldos')

  // Ingresos mensuales editable state
  const [ingresosEdit, setIngresosEdit] = useState(false)
  const [ingresosVal,  setIngresosVal]  = useState(
    wc.ingresosMensuales ? String(Math.round(wc.ingresosMensuales)) : ''
  )
  const updateWC = useUpdateWorkCenter()

  // Annual data (always year-only, for Gastos acumulados part 1)
  const { data: annualEntries = [] } = usePayrollTable({ year, month: undefined })

  // Movements for this center
  const { data: movements, isLoading: movLoading } = useMovements({ year, month: month || undefined })

  // Entries filtered to this work center
  const centerEntries = useMemo(() =>
    allEntries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    ),
  [allEntries, wc.name])

  const centerAnnual = useMemo(() =>
    annualEntries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    ),
  [annualEntries, wc.name])

  // Payroll aggregation for table (respects month selection)
  const [detailSearch, setDetailSearch] = useState('')
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey>('employeeName')
  const [detailSortDir, setDetailSortDir] = useState<SortDir>('asc')

  const payrollRows = useMemo(() => {
    let rows = aggregateWCRows(centerEntries, !!month)
    if (detailSearch) {
      const q = detailSearch.toLowerCase()
      rows = rows.filter(r => r.employeeName.toLowerCase().includes(q) || r.rut.includes(q))
    }
    return [...rows].sort((a, b) => {
      const diff = typeof a[detailSortKey] === 'number'
        ? (a[detailSortKey] as number) - (b[detailSortKey] as number)
        : String(a[detailSortKey]).localeCompare(String(b[detailSortKey]), 'es')
      return detailSortDir === 'asc' ? diff : -diff
    })
  }, [centerEntries, month, detailSearch, detailSortKey, detailSortDir])

  function handleDetailSort(col: DetailSortKey) {
    if (col === detailSortKey) setDetailSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setDetailSortKey(col); setDetailSortDir('asc') }
  }

  // Gastos acumulados stats
  const brutoanual    = centerAnnual.reduce((s, e) => s + e.grossSalary, 0)
  const brutoMensual  = month ? centerEntries.reduce((s, e) => s + e.grossSalary, 0) : null

  const estandarAnual = centerAnnual.reduce((s, e) => {
    const p = parsePayrollItems(e.items ?? [], e.grossSalary)
    return s + p.sueldoBase + p.gratificacion + p.noImponiblesTotal
  }, 0)
  const estandarMensual = month ? centerEntries.reduce((s, e) => {
    const p = parsePayrollItems(e.items ?? [], e.grossSalary)
    return s + p.sueldoBase + p.gratificacion + p.noImponiblesTotal
  }, 0) : null

  // Movements filtered to this center
  const filterByCenter = (emps: any[]) =>
    (emps ?? []).filter((e: any) => e.workCenters?.some((a: any) => a.workCenter?.name === wc.name))

  const movIngresos   = useMemo(() => filterByCenter(movements?.ingresos   ?? []), [movements, wc.name])
  const movSalidas    = useMemo(() => filterByCenter(movements?.salidas    ?? []), [movements, wc.name])
  const movVacaciones = useMemo(() =>
    (movements?.vacaciones ?? []).filter((v: any) =>
      v.employee?.workCenters?.some((a: any) => a.workCenter?.name === wc.name)
    ),
  [movements, wc.name])
  const movLicencias  = useMemo(() =>
    (movements?.licencias ?? []).filter((l: any) =>
      l.employee?.workCenters?.some((a: any) => a.workCenter?.name === wc.name)
    ),
  [movements, wc.name])
  const movReemplazos = useMemo(() => filterByCenter(movements?.reemplazos ?? []), [movements, wc.name])

  async function saveIngresos() {
    const val = ingresosVal.trim() ? (Number(ingresosVal.replace(/[^0-9]/g, '')) || null) : null
    await updateWC.mutateAsync({ id: wc.id, ingresosMensuales: val })
    setIngresosEdit(false)
  }

  const periodoLabel = month ? `${MONTHS_LABEL[Number(month)]} ${year}` : year

  return (
    <div className="border border-blue-200 rounded-xl bg-white mt-1 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-blue-100 bg-blue-50/40 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-blue-500" />
          <span className="font-semibold text-gray-900 text-sm">{wc.name}</span>
          <span className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COST_TYPE_COLOR[wc.costType]}`}>
            {COST_TYPE_LABEL[wc.costType]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit}
            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
            <Pencil size={12} /> Editar
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 transition-colors ml-1">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Outer tabs: Personas | Honorarios | Compras */}
      <div className="flex border-b border-gray-100">
        {(['personas', 'honorarios', 'compras'] as const).map(key => (
          <button key={key} onClick={() => setOuterTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              outerTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-5">

        {/* ══ PERSONAS ══ */}
        {outerTab === 'personas' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(['sueldos', 'movimientos', 'provisiones'] as const).map(key => (
                <button key={key} onClick={() => setPersonTab(key)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                    personTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Sueldos ── */}
            {personTab === 'sueldos' && (
              <div className="space-y-4">
                {!year ? (
                  <p className="text-sm text-gray-400 text-center py-4">Selecciona un período para ver datos</p>
                ) : (
                  <>
                    {/* ── Cálculos derivados ── */}
                    {(() => {
                      const CONTRACTUAL = 120_000
                      const nAnual      = new Set(centerAnnual.map(e => `${e.employeeId}::${e.legalEntity}`)).size
                      const nMensual    = month ? new Set(centerEntries.map(e => `${e.employeeId}::${e.legalEntity}`)).size : null

                      const contractAnual   = nAnual   * CONTRACTUAL * 12
                      const contractMensual = nMensual !== null ? nMensual * CONTRACTUAL : null

                      const totalGastosAnual   = brutoanual + contractAnual
                      const totalGastosMensual = brutoMensual !== null ? brutoMensual + (contractMensual ?? 0) : null

                      const ingresosAnual  = (wc.ingresosMensuales ?? 0) * 12

                      return (
                        <>
                          {/* 3 viñetas de detalle */}
                          <div className="grid grid-cols-3 gap-4">

                            {/* Gastos acumulados — 6 datos */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <TrendingUp size={13} className="text-gray-400" /> Gastos acumulados
                              </p>
                              <div className="space-y-2">
                                {/* Bruto + Contractual */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Bruto + Contratación</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(totalGastosAnual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(totalGastosMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Sueldos brutos */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Sueldo bruto</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(brutoanual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(brutoMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Sueldos estándar */}
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Sueldo estándar</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-blue-700">{fmtShort(estandarAnual)}</span>
                                  </div>
                                  {month && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-blue-600">{fmtShort(estandarMensual ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Gastos de contratación */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-gray-400" /> Gastos de contratación
                              </p>
                              <div className="space-y-2">
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">$120.000 / persona</p>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-gray-900">{fmtShort(contractAnual)}</span>
                                  </div>
                                  {month && contractMensual !== null && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">{MONTHS_LABEL[Number(month)]}</span>
                                      <span className="text-sm font-semibold text-gray-700">{fmtShort(contractMensual)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Personas consideradas</p>
                                  <p className="text-sm font-bold text-gray-900">{nAnual} {month && nMensual !== null ? `(${nMensual} en ${MONTHS_LABEL[Number(month)]})` : ''}</p>
                                </div>
                              </div>
                            </div>

                            {/* Ingresos mensuales */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                                  <Wallet size={13} className="text-gray-400" /> Ingresos mensuales
                                </p>
                                {!ingresosEdit && (
                                  <button onClick={() => setIngresosEdit(true)}
                                    className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                                    <Pencil size={11} /> Editar
                                  </button>
                                )}
                              </div>
                              {ingresosEdit ? (
                                <div className="space-y-2">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                    <input
                                      autoFocus
                                      value={ingresosVal}
                                      onChange={e => setIngresosVal(e.target.value)}
                                      placeholder="0"
                                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={saveIngresos} disabled={updateWC.isPending}
                                      className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1">
                                      <Save size={12} /> Guardar
                                    </button>
                                    <button onClick={() => setIngresosEdit(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-[10px] text-gray-400">Mensual</span>
                                      <span className="text-sm font-bold text-emerald-700">
                                        {wc.ingresosMensuales ? fmtShort(wc.ingresosMensuales) : <span className="text-gray-300">—</span>}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-gray-400">Anual {year}</span>
                                      <span className="text-sm font-bold text-emerald-600">
                                        {wc.ingresosMensuales ? fmtShort(ingresosAnual) : <span className="text-gray-300">—</span>}
                                      </span>
                                    </div>
                                  </div>
                                  {!wc.ingresosMensuales && (
                                    <p className="text-xs text-gray-400 text-center">Sin definir</p>
                                  )}
                                </div>
                              )}
                            </div>

                          </div>
                        </>
                      )
                    })()}

                    {/* Tabla colaboradores */}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                            placeholder="Buscar colaborador…"
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {payrollRows.length} colaborador{payrollRows.length !== 1 ? 'es' : ''} · {periodoLabel}
                        </span>
                      </div>
                      {payrollRows.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Sin datos de remuneraciones para este período</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-left">
                                <th onClick={() => handleDetailSort('employeeName')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                                  Colaborador<DetailSortIcon col="employeeName" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('jobTitle')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap">
                                  Cargo<DetailSortIcon col="jobTitle" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('ponderacion')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Ponderación<DetailSortIcon col="ponderacion" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('grossSalary')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Sueldo bruto<DetailSortIcon col="grossSalary" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('sueldoEstandar')}
                                  className="px-4 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide cursor-pointer hover:text-blue-700 whitespace-nowrap text-right bg-blue-50/40">
                                  Sueldo estándar<DetailSortIcon col="sueldoEstandar" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th onClick={() => handleDetailSort('bonosTotal')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Total bonos<DetailSortIcon col="bonosTotal" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                  Bonos identificados
                                </th>
                                <th onClick={() => handleDetailSort('hhTotal')}
                                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 whitespace-nowrap text-right">
                                  Total HH extra<DetailSortIcon col="hhTotal" sortKey={detailSortKey} sortDir={detailSortDir} />
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                  HH extra identificadas
                                </th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">
                                  Gastos contractuales
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {payrollRows.map((r, i) => (
                                <tr key={`${r.employeeId}-${i}`} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 bg-white">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        r.status === 'ACTIVE' ? 'bg-green-500' : r.status === 'ON_LEAVE' ? 'bg-amber-400' : 'bg-gray-300'
                                      }`} />
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{r.employeeName}</p>
                                        <p className="text-xs text-gray-400 font-mono">{r.rut}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap max-w-[160px] truncate" title={r.jobTitle}>{r.jobTitle}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap font-mono text-xs">
                                    {(r.ponderacion * 100).toFixed(0)}%
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(r.grossSalary * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50/40">{fmt(r.sueldoEstandar * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.bonosTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={r.bonosNames}>{r.bonosNames}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.hhTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.hhDetail}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(120_000)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Movimientos ── */}
            {personTab === 'movimientos' && (
              <div>
                {!year ? (
                  <p className="text-sm text-gray-400 text-center py-4">Selecciona un período para ver movimientos</p>
                ) : movLoading ? (
                  <div className="text-center py-6"><RefreshCw size={20} className="animate-spin text-blue-400 mx-auto" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <MiniStat label="Ingresos"   value={movIngresos.length}   icon={UserPlus}    color="text-green-600  bg-green-50"  />
                      <MiniStat label="Salidas"    value={movSalidas.length}    icon={UserMinus}   color="text-red-500    bg-red-50"    />
                      <MiniStat label="Vacaciones" value={movVacaciones.length} icon={TrendingDown} color="text-sky-600    bg-sky-50"   />
                      <MiniStat label="Licencias"  value={movLicencias.length}  icon={Stethoscope} color="text-amber-600  bg-amber-50"  />
                      <MiniStat label="Reemplazos" value={movReemplazos.length} icon={Repeat}      color="text-violet-600 bg-violet-50" />
                    </div>
                    {movIngresos.length > 0 && (
                      <MovementList title="Ingresos" color="green"
                        items={movIngresos.map((e: any) => ({ name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.startDate }))} />
                    )}
                    {movSalidas.length > 0 && (
                      <MovementList title="Salidas" color="red"
                        items={movSalidas.map((e: any) => ({ name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.endDate }))} />
                    )}
                    {movVacaciones.length > 0 && (
                      <MovementList title="Vacaciones" color="green"
                        items={movVacaciones.map((v: any) => ({
                          name: `${v.employee.firstName} ${v.employee.lastName}`,
                          date: v.startDate, info: `${v.days} días`,
                        }))} />
                    )}
                    {movLicencias.length > 0 && (
                      <MovementList title="Licencias médicas" color="amber"
                        items={movLicencias.map((l: any) => ({
                          name: `${l.employee.firstName} ${l.employee.lastName}`,
                          rut: l.employee.rut, date: l.startDate, info: `${l.days} días`,
                        }))} />
                    )}
                    {movReemplazos.length > 0 && (
                      <MovementList title="Reemplazos" color="violet"
                        items={movReemplazos.map((e: any) => ({
                          name: `${e.firstName} ${e.lastName}`, rut: e.rut, date: e.startDate,
                          info: e.reemplazaA ? `Reemplaza a: ${e.reemplazaA}` : undefined,
                        }))} />
                    )}
                    {!movIngresos.length && !movSalidas.length && !movVacaciones.length && !movLicencias.length && !movReemplazos.length && (
                      <p className="text-sm text-gray-400 text-center py-4">Sin movimientos en este centro para el período</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Provisiones ── */}
            {personTab === 'provisiones' && (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">Próximamente</p>
              </div>
            )}
          </div>
        )}

        {/* ══ HONORARIOS ══ */}
        {outerTab === 'honorarios' && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">Próximamente</p>
          </div>
        )}

        {/* ══ COMPRAS ══ */}
        {outerTab === 'compras' && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">Próximamente</p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkCentersPage() {
  const [tab,          setTab]          = useState<'centros' | 'remuneraciones'>('centros')
  const [year,         setYear]         = useState('')
  const [month,        setMonth]        = useState('')
  const [modal,        setModal]        = useState<'create' | WorkCenter | null>(null)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState<'' | CostType>('')
  const [selectedWC,   setSelectedWC]   = useState<WorkCenter | null>(null)
  const [remSearch,    setRemSearch]    = useState('')
  const [centerFilter, setCenterFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('employeeName')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')

  const { data: centers = [], isLoading: centersLoading } = useWorkCenters()
  const { data: years   = [] }                             = usePayrollYears()
  const deleteWC                                           = useDeleteWorkCenter()
  const updateWC                                           = useUpdateWorkCenter()

  useEffect(() => {
    if (years.length > 0 && !year) setYear(String(years[0]))
  }, [years, year])

  const { data: allEntries = [], isLoading: payrollLoading } = usePayrollTable({
    year, month: month || undefined,
  })

  const isMonthly = !!month

  // ── Centros tab stats ───────────────────────────────────────────────────────

  const filtered = useMemo(() => centers.filter(wc => {
    const matchSearch = !search || wc.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || wc.costType === typeFilter
    return matchSearch && matchType
  }), [centers, search, typeFilter])

  const centerStats = useMemo(() => {
    const totalBudget    = centers.reduce((s, c) => s + (c.presupuesto ?? 0), 0)
    const totalPersonnel = centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)
    return {
      total: centers.length,
      directCount:   centers.filter(c => c.costType === 'DIRECTO').length,
      indirectCount: centers.filter(c => c.costType === 'INDIRECTO').length,
      totalPersonnel, totalBudget,
    }
  }, [centers])

  // ── Indirect cost % from payroll ────────────────────────────────────────────

  const payrollStats = useMemo(() => {
    const typeMap = new Map(centers.map(c => [c.name, c.costType]))
    let directCost = 0, indirectCost = 0
    for (const e of allEntries) {
      const isIndirect = e.employee.workCenters
        ?.filter(a => a.legalEntity === e.legalEntity)
        .some(a => typeMap.get(a.workCenter.name) === 'INDIRECTO')
      if (isIndirect) indirectCost += e.grossSalary
      else            directCost   += e.grossSalary
    }
    const total = directCost + indirectCost
    return { directCost, indirectCost, total, pctIndirecto: total > 0 ? (indirectCost / total) * 100 : 0 }
  }, [allEntries, centers])

  // ── Remuneraciones tab rows ─────────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    let e = allEntries
    if (centerFilter)
      e = e.filter(entry =>
        entry.employee.workCenters?.some(a => a.workCenter.name === centerFilter && a.legalEntity === entry.legalEntity)
      )
    if (entityFilter)
      e = e.filter(entry => entry.legalEntity === entityFilter)
    return e
  }, [allEntries, centerFilter, entityFilter])

  const rows = useMemo(() => {
    let agg = aggregateWCRows(filteredEntries, isMonthly)
    if (remSearch) {
      const q = remSearch.toLowerCase()
      agg = agg.filter(r => r.employeeName.toLowerCase().includes(q) || r.rut.includes(q))
    }
    return [...agg].sort((a, b) => {
      if (NUMERIC_KEYS.has(sortKey)) {
        const diff = (a[sortKey] as number) - (b[sortKey] as number)
        return sortDir === 'asc' ? diff : -diff
      }
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredEntries, isMonthly, remSearch, sortKey, sortDir])

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  async function handleDelete(id: string) {
    await deleteWC.mutateAsync(id)
    setConfirmId(null)
    if (selectedWC?.id === id) setSelectedWC(null)
  }

  const periodoLabel = isMonthly ? `${MONTHS_LABEL[Number(month)]} ${year}` : year ? `${year} (anual)` : ''

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Centros de Trabajo</h2>
          <p className="text-sm text-gray-500 mt-1">{centers.length} centros registrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect value={year} onChange={setYear} placeholder="Año"
            options={years.map(y => ({ value: String(y), label: String(y) }))} />
          <FilterSelect value={month} onChange={setMonth} placeholder="Todo el año"
            options={MONTHS} />
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} /> Nuevo centro
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([['centros', 'Centros'], ['remuneraciones', 'Remuneraciones']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: CENTROS ══════════════ */}
      {tab === 'centros' && (
        <div className="space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-900">{centerStats.total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total centros</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-blue-600">{centerStats.directCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Costos directos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-500">{centerStats.indirectCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Costos indirectos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-lg font-bold text-blue-700">
                {payrollStats.directCost > 0 ? fmtShort(payrollStats.directCost) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Gasto directo{periodoLabel ? ` ${periodoLabel}` : ''}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-lg font-bold text-gray-600">
                {payrollStats.indirectCost > 0 ? fmtShort(payrollStats.indirectCost) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Gasto indirecto{periodoLabel ? ` ${periodoLabel}` : ''}</p>
              {payrollStats.total > 0 && (
                <p className="text-xs text-amber-500 mt-0.5">{payrollStats.pctIndirecto.toFixed(1)}% del total</p>
              )}
            </div>
          </div>

          {/* Location totals */}
          {year && payrollStats.total > 0 && (() => {
            const locMap = new Map(centers.map(c => [c.name, c.ubicacion ?? '']))
            const locLabels = ['Antofagasta', 'Atacama', 'Santiago / Rancagua']
            const gastoByLoc: Record<string, number> = {}
            for (const e of allEntries) {
              const wcs = e.employee.workCenters?.filter(a => a.legalEntity === e.legalEntity) ?? []
              for (const a of wcs) {
                const loc = locMap.get(a.workCenter.name) ?? ''
                if (!loc) continue
                const portion = e.grossSalary / wcs.length
                if (loc === 'Transversal') {
                  locLabels.forEach(lbl => { gastoByLoc[lbl] = (gastoByLoc[lbl] ?? 0) + portion / 3 })
                } else {
                  const key = (loc === 'Santiago' || loc === 'Rancagua') ? 'Santiago / Rancagua' : loc
                  gastoByLoc[key] = (gastoByLoc[key] ?? 0) + portion
                }
              }
            }
            return (
              <div className="grid grid-cols-3 gap-3">
                {locLabels.map(loc => (
                  <div key={loc} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full bg-blue-200 flex-shrink-0" />
                    <div>
                      <p className="text-base font-bold text-gray-900">
                        {gastoByLoc[loc] ? fmtShort(gastoByLoc[loc]) : <span className="text-gray-300 font-normal text-sm">—</span>}
                      </p>
                      <p className="text-xs text-gray-500">{loc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Resumen total módulo (3 + 3) */}
          {year && (() => {
            const nPersonas      = new Set(allEntries.map(e => e.employeeId)).size
            const gastosContract = nPersonas * 120_000 * (month ? 1 : 12)
            const totalGastos    = payrollStats.total + gastosContract
            const totalIngresos  = centers.reduce((s, c) => s + (c.ingresosMensuales ?? 0), 0) * (month ? 1 : 12)
            const diferencia     = totalIngresos - totalGastos
            const dPos           = diferencia >= 0
            const label          = month ? `${MONTHS_LABEL[Number(month)]} ${year}` : `Anual ${year}`
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <TrendingDown size={12} className="text-red-400" /> Total gastos
                  </p>
                  <p className="text-lg font-bold text-gray-900">{fmtShort(totalGastos)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label} · sueldos + contratación</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-emerald-400" /> Total ingresos
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {totalIngresos > 0 ? fmtShort(totalIngresos) : <span className="text-gray-300 font-normal text-sm">Sin definir</span>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
                <div className={`rounded-xl border p-4 ${dPos ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <BarChart2 size={12} className={dPos ? 'text-emerald-400' : 'text-red-400'} /> Diferencia
                  </p>
                  <p className={`text-lg font-bold ${dPos ? 'text-emerald-700' : 'text-red-600'}`}>
                    {totalIngresos > 0 ? fmtShort(diferencia) : <span className="text-gray-300 font-normal text-sm">—</span>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              </div>
            )
          })()}

          {/* Centers table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" placeholder="Buscar centro…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <FilterSelect value={typeFilter} onChange={v => setTypeFilter(v as '' | CostType)} placeholder="Todos los tipos"
                options={[{ value: 'DIRECTO', label: 'Directo' }, { value: 'INDIRECTO', label: 'Indirecto' }]}
              />
            </div>

            {centersLoading ? (
              <div className="p-16 text-center text-sm text-gray-400">Cargando centros…</div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center">
                <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hay centros de trabajo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargos</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingresos (mes/año)</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {periodoLabel ? `Gasto ${periodoLabel}` : 'Gasto período'}
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(wc => {
                      const wcEntries = allEntries.filter(e =>
                        e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
                      )
                      const gastoReal = wcEntries.reduce((s, e) => s + e.grossSalary, 0)
                      const isSelected = selectedWC?.id === wc.id
                      return (
                        <Fragment key={wc.id}>
                          <tr
                            onClick={() => setSelectedWC(isSelected ? null : wc)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 size={15} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
                                <span className="text-sm font-medium text-gray-900">{wc.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select
                                value={wc.ubicacion ?? ''}
                                onChange={e => updateWC.mutate({ id: wc.id, ubicacion: e.target.value || null })}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
                              >
                                <option value="">—</option>
                                {['Antofagasta', 'Atacama', 'Santiago', 'Rancagua', 'Transversal'].map(loc => (
                                  <option key={loc} value={loc}>{loc}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COST_TYPE_COLOR[wc.costType]}`}>
                                {COST_TYPE_LABEL[wc.costType]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                <Users size={14} className="text-gray-400" />
                                {wc.totalPersonnel ?? 0}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1 text-sm text-gray-500">
                                <Briefcase size={14} />
                                {wc.positions?.length ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {wc.presupuesto ? fmtShort(wc.presupuesto) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {year ? fmtShort(gastoReal) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setModal(wc)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => setConfirmId(wc.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isSelected && (
                            <tr>
                              <td colSpan={8} className="px-4 pb-4">
                                <WorkCenterDetailPanel
                                  wc={wc}
                                  allEntries={allEntries}
                                  year={year} month={month}
                                  onEdit={() => setModal(wc)}
                                  onClose={() => setSelectedWC(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  {year && filtered.length > 0 && (() => {
                    const totalGasto = filtered.reduce((sum, wc) => {
                      const wcEntries = allEntries.filter(e =>
                        e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
                      )
                      return sum + wcEntries.reduce((s, e) => s + e.grossSalary, 0)
                    }, 0)
                    const totalPresupuesto = filtered.reduce((s, c) => s + (c.presupuesto ?? 0), 0)
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide" colSpan={5}>
                            Total ({filtered.length} centros)
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                            {totalPresupuesto > 0 ? fmtShort(totalPresupuesto) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            {fmtShort(totalGasto)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: REMUNERACIONES ══════════════ */}
      {tab === 'remuneraciones' && (
        <div className="space-y-5">

          {/* Cost-type breakdown cards */}
          {year && payrollStats.total > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MiniStat label={`Costo total${periodoLabel ? ` ${periodoLabel}` : ''}`} value={fmtShort(payrollStats.total)}       icon={DollarSign}  color="text-gray-600   bg-gray-100"   />
              <MiniStat label="Costo directo"                                          value={fmtShort(payrollStats.directCost)}   icon={TrendingUp}  color="text-blue-600  bg-blue-50"    />
              <MiniStat label="Costo indirecto"                                        value={fmtShort(payrollStats.indirectCost)} icon={TrendingDown} color="text-gray-500  bg-gray-100"   />
              <MiniStat label="% Costo indirecto"                                      value={`${payrollStats.pctIndirecto.toFixed(1)}%`} icon={Percent} color="text-amber-600 bg-amber-50" />
            </div>
          )}

          {/* Payroll table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Nombre o RUT…"
                  value={remSearch} onChange={e => setRemSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <FilterSelect value={centerFilter} onChange={setCenterFilter} placeholder="Todos los centros"
                options={centers.map(c => ({ value: c.name, label: c.name }))}
              />
              <FilterSelect value={entityFilter} onChange={setEntityFilter} placeholder="Todas las empresas"
                options={[
                  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
                  { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
                ]}
              />
              {(remSearch || centerFilter || entityFilter) && (
                <button onClick={() => { setRemSearch(''); setCenterFilter(''); setEntityFilter('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2">
                  Limpiar
                </button>
              )}
            </div>

            {!year ? (
              <div className="p-16 text-center">
                <p className="text-sm text-gray-400">Selecciona un año para ver remuneraciones</p>
              </div>
            ) : payrollLoading ? (
              <div className="p-16 text-center">
                <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Cargando remuneraciones…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-16 text-center">
                <DollarSign size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Sin datos para el período seleccionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th
                        className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-white cursor-pointer select-none hover:text-gray-700"
                        onClick={() => handleSort('employeeName')}
                      >
                        Colaborador<SortIcon col="employeeName" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <SortTh label="Razón social"          col="legalEntity"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Centro</th>
                      <SortTh label="Período"               col="period"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortTh label="Sueldo líquido"        col="liquidSalary"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <SortTh label="Sueldo bruto"          col="grossSalary"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <SortTh label="Sueldo estándar"       col="sueldoEstandar"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right highlight />
                      <SortTh label="Sueldo base"           col="sueldoBase"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <SortTh label="Gratificación"         col="gratificacion"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <SortTh label="Total bonos"           col="bonosTotal"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Bonos identificados</th>
                      <SortTh label="Total HH extra"        col="hhTotal"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">HH extra identificadas</th>
                      <SortTh label="Total hab. no imp."    col="noImponiblesTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Hab. no imp. identificados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                      <tr key={`${row.employeeId}-${row.legalEntity}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.status === 'ACTIVE' ? 'bg-green-500' : row.status === 'ON_LEAVE' ? 'bg-amber-400' : 'bg-gray-300'}`} />
                            <div>
                              <p className="font-medium text-gray-900">{row.employeeName}</p>
                              <p className="text-xs text-gray-400 font-mono">{row.rut}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEGAL_ENTITY_COLOR[row.legalEntity as LegalEntity] ?? 'bg-gray-100 text-gray-700'}`}>
                            {LEGAL_ENTITY_LABEL[row.legalEntity as LegalEntity] ?? row.legalEntity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[140px] truncate" title={row.centers}>{row.centers}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.period}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(row.liquidSalary)}</td>
                        <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{fmt(row.grossSalary)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50/40">{fmt(row.sueldoEstandar)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.sueldoBase)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.gratificacion)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.bonosTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.bonosNames}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.hhTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.hhDetail}</td>
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.noImponiblesTotal)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.noImponiblesNames}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                {rows.length} {isMonthly ? 'registros' : 'colaboradores'} — {periodoLabel}
                {centerFilter && <> · Filtrado por: <strong>{centerFilter}</strong></>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {modal && (
        <WorkCenterModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">¿Eliminar centro?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminarán también todas las asignaciones de colaboradores a este centro.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmId)} disabled={deleteWC.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleteWC.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
