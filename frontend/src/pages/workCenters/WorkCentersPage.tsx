import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import * as XLSX from 'xlsx'
import type { LucideIcon } from 'lucide-react'
import {
  Plus, Pencil, Trash2, X, Save, Building2, Users, Briefcase,
  ChevronDown, ChevronUp, ChevronsUpDown, DollarSign, TrendingUp,
  TrendingDown, BarChart2, Search, Wallet, Percent, UserPlus,
  UserMinus, Stethoscope, Repeat, RefreshCw, FileDown,
} from 'lucide-react'
import {
  useWorkCenters, useCreateWorkCenter, useUpdateWorkCenter, useDeleteWorkCenter,
  useAddIngreso, useUpdateIngreso, useDeleteIngreso,
} from '@/hooks/useWorkCenters'
import { usePayrollTable, usePayrollYears, useMovements, useExpiringContracts } from '@/hooks/useDotacion'
import type { WorkCenter, WorkCenterIngreso, CostType, LegalEntity, PayrollRawEntry, PayrollItem, EmployeeStatus } from '@/types'

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

// ─── Dashboard card order ─────────────────────────────────────────────────────
const WC_CARD_IDS = [
  'centros', 'colaboradores', 'contratacion',
  'directo', 'indirecto', 'total-payroll',
  'fin-gastos', 'fin-ingresos', 'fin-diferencia',
] as const
type WCCardId = typeof WC_CARD_IDS[number]

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
type CenterSortKey = 'name' | 'ubicacion' | 'costType' | 'personal' | 'cargos' | 'ingresos' | 'gasto' | 'diferencia'
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

// ─── MultiSelect ──────────────────────────────────────────────────────────────

function MultiSelect<T extends string>({ label, selected, onChange, options }: {
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
          count > 0 ? 'border-blue-400 text-blue-700 bg-blue-50/60' : 'border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
      >
        {label}
        {count > 0 && (
          <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown size={13} className={`ml-0.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-max py-1.5">
          <button
            onClick={() => onChange([])}
            className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${count === 0 ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}
          >
            Todos
          </button>
          <div className="border-t border-gray-100 my-1" />
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2.5 hover:bg-gray-50 ${
                selected.includes(o.value) ? 'text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                selected.includes(o.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
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

// ─── Excel export ─────────────────────────────────────────────────────────────

function applyClpFormat(ws: XLSX.WorkSheet, cols: number[], clpFmt = '$#,##0') {
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (const C of cols) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && typeof cell.v === 'number') cell.z = clpFmt
    }
  }
}

function exportCentrosToExcel(
  centers: WorkCenter[],
  allEntries: PayrollRawEntry[],
  periodoLabel: string,
  isMonthly: boolean,
) {
  const wb = XLSX.utils.book_new()
  const CONTRACTUAL = 160_000

  function filterForCenter(entries: PayrollRawEntry[], wc: WorkCenter): PayrollRawEntry[] {
    const idSet = new Set(wc.employeeIds ?? [])
    if (idSet.size > 0) return entries.filter(e => idSet.has(e.employeeId))
    const byWC = entries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    )
    if (byWC.length > 0) return byWC
    return entries.filter(e => e.employee.costCenter === wc.name)
  }

  // Pre-computar primer centro por empleado (en orden de la lista)
  const employeeFirstCenter = new Map<string, string>()
  for (const wc of centers) {
    for (const e of filterForCenter(allEntries, wc)) {
      if (!employeeFirstCenter.has(e.employeeId)) {
        employeeFirstCenter.set(e.employeeId, wc.name)
      }
    }
  }

  // ── Hoja 1: Resumen ──────────────────────────────────────────────────────────
  const data = centers.map(wc => {
    const wcEntries = filterForCenter(allEntries, wc)
    let gastoReal = 0, gastoEstandar = 0, gastoLiquido = 0
    let gastoBonos = 0, gastoHH = 0, gastoNoImp = 0
    for (const e of wcEntries) {
      const p    = parsePayrollItems(e.items ?? [], e.grossSalary)
      const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
      gastoReal     += e.grossSalary * pond
      gastoLiquido  += e.liquidSalary * pond
      gastoEstandar += (p.sueldoBase + p.gratificacion + p.noImponiblesTotal) * pond
      gastoBonos    += p.bonosTotal * pond
      gastoHH       += p.hhTotal * pond
      gastoNoImp    += p.noImponiblesTotal * pond
    }
    const nColabs   = new Set(wcEntries.map(e => e.employeeId)).size
    // Solo cuenta empleados cuyo primer centro es este
    const nPrimary  = new Set(
      wcEntries.filter(e => employeeFirstCenter.get(e.employeeId) === wc.name).map(e => e.employeeId)
    ).size
    const gastoContract  = nPrimary * CONTRACTUAL * (isMonthly ? 1 : 12)
    const ingresos       = (wc.totalIngresos ?? 0) * (isMonthly ? 1 : 12)
    const diferencia     = ingresos > 0 ? ingresos - (gastoReal + gastoContract) : null
    return {
      'Centro':                wc.name,
      'Ubicación':             wc.ubicacion ?? '',
      'Tipo de Costo':         COST_TYPE_LABEL[wc.costType],
      'Colaboradores período': nColabs,
      'N° Cargos':             wc.positions?.length ?? 0,
      'Ingresos':              ingresos,
      'Sueldo Bruto':          gastoReal,
      'Sueldo Estándar':       gastoEstandar,
      'Sueldo Líquido':        gastoLiquido,
      'Total Bonos':           gastoBonos,
      'Total HH Extra':        gastoHH,
      'Total Hab. No Imp.':    gastoNoImp,
      'Gastos Contractuales':  gastoContract,
      'Diferencia Ing−Gasto':  diferencia,
    }
  })

  const sumCols = [
    'Colaboradores período', 'N° Cargos', 'Ingresos',
    'Sueldo Bruto', 'Sueldo Estándar', 'Sueldo Líquido',
    'Total Bonos', 'Total HH Extra', 'Total Hab. No Imp.',
    'Gastos Contractuales', 'Diferencia Ing−Gasto',
  ]
  const totals: Record<string, number | string | null> = {
    'Centro': `TOTAL (${centers.length} centros)`,
    'Ubicación': '', 'Tipo de Costo': '',
  }
  for (const col of sumCols) {
    totals[col] = data.reduce((s, r) => {
      const v = (r as Record<string, unknown>)[col]
      return s + (typeof v === 'number' ? v : 0)
    }, 0)
  }

  const ws = XLSX.utils.json_to_sheet([...data, totals])
  ws['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 10 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
  ]
  // cols: Ingresos(5), Bruto(6), Estándar(7), Líquido(8), Bonos(9), HH(10), NoImp(11), Contract(12), Diferencia(13)
  applyClpFormat(ws, [5, 6, 7, 8, 9, 10, 11, 12, 13])
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen')

  // ── Hoja por centro ──────────────────────────────────────────────────────────
  for (const wc of centers) {
    const wcEntries = filterForCenter(allEntries, wc)
    const rows = aggregateWCRows(wcEntries, isMonthly)

    type DetailRow = Record<string, string | number | null>
    const chargedInCenter = new Set<string>()
    const detailData: DetailRow[] = rows.map(r => {
      const isFirstCenter = employeeFirstCenter.get(r.employeeId) === wc.name
      const chargeHere    = isFirstCenter && !chargedInCenter.has(r.employeeId)
      if (chargeHere) chargedInCenter.add(r.employeeId)
      return {
        'Colaborador':               r.employeeName,
        'RUT':                       r.rut,
        'Razón Social':              LEGAL_ENTITY_LABEL[r.legalEntity as LegalEntity] ?? r.legalEntity,
        'Cargo':                     r.jobTitle,
        'Período':                   r.period,
        'Ponderación':               r.ponderacion,
        'Sueldo Bruto':              r.grossSalary,
        'Sueldo Bruto Ponderado':    r.grossSalary       * r.ponderacion,
        'Sueldo Estándar':           r.sueldoEstandar    * r.ponderacion,
        'Sueldo Líquido':            r.liquidSalary      * r.ponderacion,
        'Sueldo Base':               r.sueldoBase        * r.ponderacion,
        'Gratificación':             r.gratificacion     * r.ponderacion,
        'Total Bonos':               r.bonosTotal        * r.ponderacion,
        'Bonos identificados':       r.bonosNames,
        'Total HH Extra':            r.hhTotal           * r.ponderacion,
        'HH identificadas':          r.hhDetail,
        'Total Hab. No Imp.':        r.noImponiblesTotal * r.ponderacion,
        'Hab. No Imp.':              r.noImponiblesNames,
        'Gastos Contractuales':      chargeHere ? CONTRACTUAL : 0,
      }
    })

    // Fila de totales
    if (detailData.length > 0) {
      const numCols = [
        'Sueldo Bruto', 'Sueldo Bruto Ponderado', 'Sueldo Estándar', 'Sueldo Líquido', 'Sueldo Base',
        'Gratificación', 'Total Bonos', 'Total HH Extra', 'Total Hab. No Imp.',
        'Gastos Contractuales',
      ]
      const rowTotals: DetailRow = {
        'Colaborador': `TOTAL (${detailData.length} colaboradores)`,
        'RUT': '', 'Razón Social': '', 'Cargo': '', 'Período': '',
        'Ponderación': null,
        'Bonos identificados': '', 'HH identificadas': '', 'Hab. No Imp.': '',
      }
      for (const col of numCols) {
        rowTotals[col] = detailData.reduce((s, r) => s + (typeof r[col] === 'number' ? (r[col] as number) : 0), 0)
      }
      detailData.push(rowTotals)
    }

    const dws = XLSX.utils.json_to_sheet(
      detailData.length > 0
        ? detailData
        : [{ 'Colaborador': 'Sin datos de remuneración para el período seleccionado' }]
    )
    dws['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
      { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
      { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, { wch: 20 },
    ]
    // CLP: Bruto(6), BrutoPond(7), Estándar(8), Líquido(9), Base(10), Gratif(11), Bonos(12), HH(14), NoImp(16), Contract(18)
    applyClpFormat(dws, [6, 7, 8, 9, 10, 11, 12, 14, 16, 18])
    const drng = XLSX.utils.decode_range(dws['!ref']!)
    for (let R = drng.s.r + 1; R <= drng.e.r; R++) {
      const cell = dws[XLSX.utils.encode_cell({ r: R, c: 5 })]
      if (cell && typeof cell.v === 'number') cell.z = '0%'
    }

    const sheetName = wc.name.replace(/[\\/?*[\]:']/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, dws, sheetName || `Centro ${wc.id.slice(0, 6)}`)
  }

  const safe = periodoLabel.replace(/[\s/]+/g, '-').toLowerCase()
  XLSX.writeFile(wb, `centros-de-trabajo${safe ? `-${safe}` : ''}.xlsx`)
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

  // Ingresos state
  const [addingIngreso, setAddingIngreso] = useState(false)
  const [newName,       setNewName]       = useState('')
  const [newAmount,     setNewAmount]     = useState('')
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editName,      setEditName]      = useState('')
  const [editAmount,    setEditAmount]    = useState('')

  const addIngreso    = useAddIngreso()
  const updateIngreso = useUpdateIngreso()
  const deleteIngreso = useDeleteIngreso()
  const updateWC      = useUpdateWorkCenter()

  async function handleAddIngreso() {
    const amt = Number(newAmount.replace(/[^0-9]/g, ''))
    if (!newName.trim() || !amt) return
    await addIngreso.mutateAsync({ workCenterId: wc.id, name: newName.trim(), amount: amt })
    setNewName(''); setNewAmount(''); setAddingIngreso(false)
  }

  function startEdit(ing: WorkCenterIngreso) {
    setEditingId(ing.id)
    setEditName(ing.name)
    setEditAmount(String(Math.round(ing.amount)))
  }

  async function handleUpdateIngreso() {
    if (!editingId) return
    const amt = Number(editAmount.replace(/[^0-9]/g, ''))
    if (!editName.trim() || !amt) return
    await updateIngreso.mutateAsync({ workCenterId: wc.id, ingresoId: editingId, name: editName.trim(), amount: amt })
    setEditingId(null)
  }

  async function handleDeleteIngreso(ingresoId: string) {
    await deleteIngreso.mutateAsync({ workCenterId: wc.id, ingresoId })
  }

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
                      const CONTRACTUAL = 160_000
                      const nAnual      = new Set(centerAnnual.map(e => `${e.employeeId}::${e.legalEntity}`)).size
                      const nMensual    = month ? new Set(centerEntries.map(e => `${e.employeeId}::${e.legalEntity}`)).size : null

                      const contractAnual   = nAnual   * CONTRACTUAL * 12
                      const contractMensual = nMensual !== null ? nMensual * CONTRACTUAL : null

                      const totalGastosAnual   = brutoanual + contractAnual
                      const totalGastosMensual = brutoMensual !== null ? brutoMensual + (contractMensual ?? 0) : null

                      const ingresosAnual  = wc.totalIngresos * 12

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
                                {!addingIngreso && (
                                  <button onClick={() => setAddingIngreso(true)}
                                    className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                                    <Plus size={11} /> Agregar
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                {wc.ingresos.map(ing => (
                                  <div key={ing.id} className="bg-white rounded-lg border border-gray-100 p-2.5">
                                    {editingId === ing.id ? (
                                      <div className="space-y-1.5">
                                        <input
                                          autoFocus
                                          value={editName}
                                          onChange={e => setEditName(e.target.value)}
                                          placeholder="Nombre"
                                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                          <input
                                            value={editAmount}
                                            onChange={e => setEditAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={handleUpdateIngreso}
                                            disabled={updateIngreso.isPending}
                                            className="flex-1 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1"
                                          >
                                            <Save size={11} /> Guardar
                                          </button>
                                          <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600 flex-1 truncate" title={ing.name}>{ing.name}</span>
                                        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtShort(ing.amount)}</span>
                                        <button onClick={() => startEdit(ing)} className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0">
                                          <Pencil size={11} />
                                        </button>
                                        <button onClick={() => handleDeleteIngreso(ing.id)} disabled={deleteIngreso.isPending} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {addingIngreso && (
                                  <div className="bg-white rounded-lg border border-blue-200 p-2.5 space-y-1.5">
                                    <input
                                      autoFocus
                                      value={newName}
                                      onChange={e => setNewName(e.target.value)}
                                      placeholder="Nombre (ej: Contrato Codelco)"
                                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                      <input
                                        value={newAmount}
                                        onChange={e => setNewAmount(e.target.value)}
                                        placeholder="0"
                                        onKeyDown={e => e.key === 'Enter' && handleAddIngreso()}
                                        className="w-full pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={handleAddIngreso}
                                        disabled={addIngreso.isPending}
                                        className="flex-1 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1"
                                      >
                                        <Save size={11} /> Agregar
                                      </button>
                                      <button onClick={() => { setAddingIngreso(false); setNewName(''); setNewAmount('') }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {wc.ingresos.length === 0 && !addingIngreso && (
                                  <p className="text-xs text-gray-400 text-center py-1">Sin ingresos definidos</p>
                                )}
                              </div>

                              {wc.totalIngresos > 0 && (
                                <div className="mt-2 bg-white rounded-lg border border-gray-100 p-2.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] text-gray-400">Total mensual</span>
                                    <span className="text-sm font-bold text-emerald-700">{fmtShort(wc.totalIngresos)}</span>
                                  </div>
                                  <div className="flex justify-between items-baseline mt-1">
                                    <span className="text-[10px] text-gray-400">Anual {year}</span>
                                    <span className="text-sm font-bold text-emerald-600">{fmtShort(ingresosAnual)}</span>
                                  </div>
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
                                  <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${r.sueldoEstandar !== r.grossSalary ? 'text-blue-700 bg-blue-50/40' : 'text-gray-700'}`}>{fmt(r.sueldoEstandar * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.bonosTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={r.bonosNames}>{r.bonosNames}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(r.hhTotal * r.ponderacion)}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{r.hhDetail}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(160_000)}</td>
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
  const [typeFilters,  setTypeFilters]  = useState<CostType[]>([])
  const [ubicFilters,  setUbicFilters]  = useState<string[]>([])
  const [selectedWC,   setSelectedWC]   = useState<WorkCenter | null>(null)
  const [remSearch,    setRemSearch]    = useState('')
  const [centerFilter, setCenterFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('employeeName')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [cSortKey,     setCSort]        = useState<CenterSortKey>('name')
  const [cSortDir,     setCDir]         = useState<SortDir>('asc')
  const [movTab,       setMovTab]       = useState<'vacaciones' | 'licencias' | 'reemplazos' | 'contratos'>('vacaciones')
  const [cardOrder,    setCardOrder]    = useState<WCCardId[]>(() => {
    try {
      const s = localStorage.getItem('gdp-wc-cards')
      const p = s ? JSON.parse(s) : null
      if (Array.isArray(p) && p.length === WC_CARD_IDS.length) return p as WCCardId[]
    } catch {}
    return [...WC_CARD_IDS]
  })
  const [dgFrom,       setDgFrom]       = useState<number | null>(null)
  const [dgOver,       setDgOver]       = useState<number | null>(null)

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

  const { data: movements }         = useMovements({ year, month: month || undefined })
  const { data: expiringContracts = [] } = useExpiringContracts()

  const isMonthly = !!month

  // ── Centros tab stats ───────────────────────────────────────────────────────

  const ubicaciones = useMemo(() =>
    [...new Set(centers.map(c => c.ubicacion).filter((u): u is string => !!u))].sort()
  , [centers])

  const filtered = useMemo(() => centers.filter(wc => {
    const matchSearch = !search || wc.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilters.length === 0 || typeFilters.includes(wc.costType)
    const matchUbic   = ubicFilters.length === 0 || ubicFilters.includes(wc.ubicacion ?? '')
    return matchSearch && matchType && matchUbic
  }), [centers, search, typeFilters, ubicFilters])

  const enrichedCenters = useMemo(() =>
    filtered.map(wc => {
      const wcEntries = allEntries.filter(e =>
        e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
      )
      const gastoReal  = wcEntries.reduce((s, e) => s + e.grossSalary, 0)
      const ingresos   = wc.totalIngresos
      const diferencia = ingresos > 0 ? ingresos - gastoReal : null
      return { wc, gastoReal, diferencia }
    })
  , [filtered, allEntries])

  const sortedCenters = useMemo(() =>
    [...enrichedCenters].sort((a, b) => {
      let cmp = 0
      switch (cSortKey) {
        case 'name':      cmp = a.wc.name.localeCompare(b.wc.name, 'es'); break
        case 'ubicacion': cmp = (a.wc.ubicacion ?? '').localeCompare(b.wc.ubicacion ?? '', 'es'); break
        case 'costType':  cmp = a.wc.costType.localeCompare(b.wc.costType); break
        case 'personal':  cmp = (a.wc.totalPersonnel ?? 0) - (b.wc.totalPersonnel ?? 0); break
        case 'cargos':    cmp = (a.wc.positions?.length ?? 0) - (b.wc.positions?.length ?? 0); break
        case 'ingresos':  cmp = (a.wc.totalIngresos) - (b.wc.totalIngresos); break
        case 'gasto':     cmp = a.gastoReal - b.gastoReal; break
        case 'diferencia':cmp = (a.diferencia ?? -Infinity) - (b.diferencia ?? -Infinity); break
      }
      return cSortDir === 'asc' ? cmp : -cmp
    })
  , [enrichedCenters, cSortKey, cSortDir])

  function swapDashCards(a: number, b: number) {
    const next = [...cardOrder]
    ;[next[a], next[b]] = [next[b], next[a]]
    setCardOrder(next)
    setDgFrom(null); setDgOver(null)
    try { localStorage.setItem('gdp-wc-cards', JSON.stringify(next)) } catch {}
  }

  function handleCenterSort(col: CenterSortKey) {
    if (col === cSortKey) setCDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCSort(col); setCDir('asc') }
  }

  const centerStats = useMemo(() => {
    const totalBudget    = centers.reduce((s, c) => s + (c.presupuesto ?? 0), 0)
    const totalPersonnel = centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)
    const byUbic: Record<string, number> = {}
    for (const c of centers) {
      const u = c.ubicacion ?? 'Sin ubicación'
      byUbic[u] = (byUbic[u] ?? 0) + 1
    }
    return {
      total: centers.length,
      directCount:   centers.filter(c => c.costType === 'DIRECTO').length,
      indirectCount: centers.filter(c => c.costType === 'INDIRECTO').length,
      totalPersonnel, totalBudget, byUbic,
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

          {/* ── Dashboard 3/3/3/2 ─────────────────────────────────────── */}
          {(() => {
            // ── Computations ──────────────────────────────────────────────
            const uniquePeople = new Set(allEntries.map(e => e.employeeId)).size
            // Activos = still employed on the 1st of the NEXT period
            // Monthly: endDate null OR >= 2026-02-01
            // Annual:  endDate null OR >= 2027-01-01
            const nextPeriodStart = year
              ? (month ? new Date(Number(year), Number(month), 1)       // 1st of next month
                       : new Date(Number(year) + 1, 0, 1))              // 1st of next year
              : null
            const periodStart = year
              ? (month ? new Date(Number(year), Number(month) - 1, 1)
                       : new Date(Number(year), 0, 1))
              : null
            const isActiveAtClose = (e: typeof allEntries[0]) => {
              const ed = e.employee.endDate ? new Date(e.employee.endDate) : null
              return !ed || !nextPeriodStart || ed >= nextPeriodStart
            }
            const totalActive = new Set(allEntries.filter(isActiveAtClose).map(e => e.employeeId)).size
            const comActive   = new Set(allEntries.filter(e => e.legalEntity === 'COMUNICACIONES_SURMEDIA' && isActiveAtClose(e)).map(e => e.employeeId)).size
            const conActive   = new Set(allEntries.filter(e => e.legalEntity === 'SURMEDIA_CONSULTORIA'    && isActiveAtClose(e)).map(e => e.employeeId)).size
            // Bajas = endDate within the period
            const totalBajas  = new Set(allEntries.filter(e => {
              const ed = e.employee.endDate ? new Date(e.employee.endDate) : null
              return ed && periodStart && nextPeriodStart && ed >= periodStart && ed < nextPeriodStart
            }).map(e => e.employeeId)).size
            const contratacionN    = uniquePeople || centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)
            const contratacionCost = contratacionN * 160_000 * (month ? 1 : 12)
            const totalGastos      = payrollStats.total + uniquePeople * 160_000 * (month ? 1 : 12)
            const totalIngresos    = centers.reduce((s, c) => s + c.totalIngresos, 0) * (month ? 1 : 12)
            const diferencia       = totalIngresos - totalGastos
            const dPos             = diferencia >= 0
            const label            = year ? (month ? `${MONTHS_LABEL[Number(month)]} ${year}` : `Anual ${year}`) : ''
            const locMap           = new Map(centers.map(c => [c.name, c.ubicacion ?? '']))
            const locLabels        = ['Antofagasta', 'Atacama', 'Santiago / Rancagua']
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
            const locTotal    = locLabels.reduce((s, l) => s + (gastoByLoc[l] ?? 0), 0)
            const ingresos    = movements?.ingresos   ?? []
            const salidas     = movements?.salidas    ?? []
            const vacaciones  = movements?.vacaciones ?? []
            const licencias   = movements?.licencias  ?? []
            const reemplazos  = movements?.reemplazos ?? []

            function fmtDate(d: any) {
              if (!d) return '—'
              const dt = new Date(d)
              return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
            }
            function getCenter(wcs: any[]) { return wcs?.[0]?.workCenter?.name ?? '—' }

            // ── Shared card shell ──────────────────────────────────────────
            const C = 'bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden h-full select-none'
            const H = 'px-3.5 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0'
            const hl = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'
            const sub = 'text-[10px] text-gray-300'
            const noData = <span className="text-gray-300 font-normal text-xl">—</span>

            // ── Card content by ID ─────────────────────────────────────────
            const renderCard = (id: WCCardId) => {
              switch (id) {

                case 'centros': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Building2 size={10}/>Centros</span></div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{centerStats.total}</p>
                      <p className="text-xs text-gray-500 mt-1">{centerStats.directCount} directos · {centerStats.indirectCount} indirectos</p>
                      <div className="mt-2 space-y-0.5">
                        {Object.entries(centerStats.byUbic).sort((a,b)=>b[1]-a[1]).map(([u,n])=>(
                          <div key={u} className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0"/>
                            <span className="text-[10px] text-gray-400 truncate">{n} · {u}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )

                case 'colaboradores': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Users size={10}/>Colaboradores</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{uniquePeople || centers.reduce((s,c)=>s+(c.totalPersonnel??0),0)}</p>
                      {uniquePeople > 0
                        ? <>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-700 font-medium">{totalActive} activos</span>
                              {totalBajas > 0 && (
                                <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                                  {totalBajas} {totalBajas === 1 ? 'baja' : 'bajas'}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{comActive}</span>
                                <span className="text-[10px] text-gray-400">Comunicaciones</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">{conActive}</span>
                                <span className="text-[10px] text-gray-400">Consultoría</span>
                              </div>
                            </div>
                          </>
                        : <p className="text-xs text-gray-400 mt-1">Selecciona un período</p>
                      }
                    </div>
                  </div>
                )

                case 'contratacion': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><Briefcase size={10}/>Gastos Contratación</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-violet-700">{contratacionN>0?fmtShort(contratacionCost):noData}</p>
                      {contratacionN>0&&<><p className="text-xs text-gray-500 mt-1">{contratacionN} personas · $160K c/u</p><p className="text-[10px] text-gray-300 mt-0.5">Sin duplicados entre empresas</p></>}
                    </div>
                  </div>
                )

                case 'directo': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingUp size={10} className="text-blue-400"/>Gasto Directo</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-blue-700">{payrollStats.directCost>0?fmtShort(payrollStats.directCost):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-gray-400 mt-1">{(100-payrollStats.pctIndirecto).toFixed(1)}% del gasto total</p>}
                    </div>
                  </div>
                )

                case 'indirecto': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingDown size={10} className="text-gray-400"/>Gasto Indirecto</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-600">{payrollStats.indirectCost>0?fmtShort(payrollStats.indirectCost):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-amber-500 mt-1">{payrollStats.pctIndirecto.toFixed(1)}% del gasto total</p>}
                    </div>
                  </div>
                )

                case 'total-payroll': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><BarChart2 size={10}/>Gasto Total</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{payrollStats.total>0?fmtShort(payrollStats.total):noData}</p>
                      {payrollStats.total>0&&<p className="text-xs text-gray-400 mt-1">Sueldos brutos</p>}
                    </div>
                  </div>
                )

                case 'fin-gastos': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingDown size={10} className="text-red-400"/>Total Gastos</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-gray-900">{year?fmtShort(totalGastos):noData}</p>
                      <p className="text-[10px] text-gray-300 mt-1">Sueldos + contratación</p>
                    </div>
                  </div>
                )

                case 'fin-ingresos': return (
                  <div className={C}>
                    <div className={H}><span className={hl}><TrendingUp size={10} className="text-emerald-400"/>Total Ingresos</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className="text-2xl font-bold text-emerald-700">{totalIngresos>0?fmtShort(totalIngresos):<span className="text-gray-300 font-normal text-xl">Sin definir</span>}</p>
                    </div>
                  </div>
                )

                case 'fin-diferencia': return (
                  <div className={`${C} ${year&&totalIngresos>0?(dPos?'border-emerald-200':'border-red-200'):''}`}>
                    <div className={H}><span className={hl}><BarChart2 size={10} className={year&&totalIngresos>0?(dPos?'text-emerald-400':'text-red-400'):'text-gray-400'}/>Diferencia</span>{label&&<span className={sub}>{label}</span>}</div>
                    <div className="p-4 flex-1">
                      <p className={`text-2xl font-bold ${year&&totalIngresos>0?(dPos?'text-emerald-700':'text-red-600'):'text-gray-900'}`}>{year&&totalIngresos>0?fmtShort(diferencia):noData}</p>
                    </div>
                  </div>
                )
              }
            }

            // ── Drag style helper ──────────────────────────────────────────
            const dragCls = (idx: number) =>
              `rounded-xl transition-all duration-100 ${dgFrom===idx?'opacity-25 scale-[0.97]':''} ${dgOver===idx&&dgFrom!==null&&dgFrom!==idx?'ring-2 ring-blue-400 ring-offset-1':''}`

            return (
              <div className="space-y-3">

                {/* ── 9 viñetas arrastrables (3 × 3) ── */}
                <div className="grid grid-cols-3 gap-3" style={{ gridAutoRows: '1fr' }}>
                  {cardOrder.map((id, idx) => (
                    <div
                      key={id}
                      draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed='move'; setDgFrom(idx) }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDgOver(idx) }}
                      onDrop={e => { e.preventDefault(); if(dgFrom!==null&&dgFrom!==idx) swapDashCards(dgFrom,idx) }}
                      onDragEnd={() => { setDgFrom(null); setDgOver(null) }}
                      className={`cursor-grab active:cursor-grabbing ${dragCls(idx)}`}
                      title="Arrastra para reorganizar"
                    >
                      {renderCard(id)}
                    </div>
                  ))}
                </div>

                {/* ── 2 paneles proporcionales (1/3 + 2/3) ── */}
                {year && (
                  <div className="grid grid-cols-3 gap-3" style={{ height: 360 }}>

                    {/* Panel: Ubicaciones (1/3) */}
                    <div className="col-span-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                      <div className={H}>
                        <span className={hl}>Gasto por Ubicación</span>
                        <span className={sub}>{label}</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-around overflow-y-auto">
                        {locLabels.map(loc => {
                          const val = gastoByLoc[loc] ?? 0
                          const pct = locTotal>0?(val/locTotal)*100:0
                          return (
                            <div key={loc}>
                              <div className="flex items-baseline justify-between mb-1">
                                <span className="text-xs font-medium text-gray-700 truncate">{loc}</span>
                                <span className="text-xs font-bold text-gray-900 ml-2 flex-shrink-0">{val>0?fmtShort(val):<span className="text-gray-300">—</span>}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-300 rounded-full transition-all duration-500" style={{width:`${pct}%`}}/>
                              </div>
                              {locTotal>0&&<p className="text-[10px] text-gray-300 mt-0.5 text-right">{pct.toFixed(1)}%</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Panel: Movimientos (2/3) */}
                    <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
                      <div className={H}>
                        <span className={hl}>Movimientos</span>
                        <span className={sub}>{label}</span>
                      </div>

                      {/* Ingresos / Salidas */}
                      <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
                        {([
                          { icon: <UserPlus size={10} className="text-emerald-500"/>, label: 'Ingresos', list: ingresos, dateFn: (m:any)=>m.startDate, badge:'text-emerald-600 bg-emerald-50' },
                          { icon: <UserMinus size={10} className="text-red-400"/>,    label: 'Salidas',  list: salidas,  dateFn: (m:any)=>m.endDate,   badge:'text-red-500 bg-red-50'     },
                        ]).map(col => (
                          <div key={col.label} className="p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              {col.icon}
                              <span className="text-[10px] font-semibold text-gray-600">{col.label}</span>
                              <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>{col.list.length}</span>
                            </div>
                            {col.list.length===0
                              ? <p className="text-[10px] text-gray-300">—</p>
                              : <ul className="space-y-1.5 max-h-24 overflow-y-auto">
                                  {col.list.map((m:any,i:number)=>(
                                    <li key={i}>
                                      <p className="text-[11px] font-medium text-gray-700 truncate">{m.firstName} {m.lastName}</p>
                                      <p className="text-[10px] text-gray-400 truncate">{fmtDate(col.dateFn(m))} · {getCenter(m.workCenters)}</p>
                                    </li>
                                  ))}
                                </ul>
                            }
                          </div>
                        ))}
                      </div>

                      {/* Tabs */}
                      <div className="flex border-b border-gray-100 flex-shrink-0">
                        {([
                          {key:'vacaciones' as const, label:'Vacaciones', count:vacaciones.length,        active:'border-blue-500 text-blue-600',    num:'text-blue-600'},
                          {key:'licencias'  as const, label:'Licencias',  count:licencias.length,         active:'border-amber-500 text-amber-600',  num:'text-amber-600'},
                          {key:'reemplazos' as const, label:'Reemplazos', count:reemplazos.length,        active:'border-purple-500 text-purple-600',num:'text-purple-600'},
                          {key:'contratos'  as const, label:'Por vencer', count:expiringContracts.length, active:'border-rose-500 text-rose-600',    num:'text-rose-600'},
                        ]).map(t=>(
                          <button key={t.key} onClick={()=>setMovTab(t.key)}
                            className={`flex-1 py-2 flex flex-col items-center border-b-2 transition-colors ${movTab===t.key?t.active:'border-transparent text-gray-400 hover:text-gray-600'}`}
                          >
                            <span className={`text-sm font-bold leading-none ${movTab===t.key?t.num:'text-gray-500'}`}>{t.count}</span>
                            <span className="text-[9px] uppercase tracking-wide mt-0.5">{t.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div className="flex-1 overflow-y-auto p-3 min-h-0 text-[10px]">
                        {movTab==='vacaciones'&&(vacaciones.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin vacaciones en el período</p>
                          :<ul className="space-y-2">{vacaciones.map((v:any,i:number)=>(
                            <li key={i} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-700 truncate">{v.employee.firstName} {v.employee.lastName}</p>
                                <p className="text-gray-400">{fmtDate(v.startDate)} → {fmtDate(v.endDate)}</p>
                                <p className="text-gray-400 truncate">{getCenter(v.employee.workCenters)}</p>
                              </div>
                              <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{v.days}d</span>
                            </li>
                          ))}</ul>
                        )}
                        {movTab==='licencias'&&(licencias.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin licencias en el período</p>
                          :<ul className="space-y-2">{licencias.map((l:any,i:number)=>{
                            const days=l.days??(Math.round((new Date(l.endDate).getTime()-new Date(l.startDate).getTime())/86400000)+1)
                            return(
                              <li key={i} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-700 truncate">{l.employee.firstName} {l.employee.lastName}</p>
                                  <p className="text-gray-400">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</p>
                                  <p className="text-gray-400 truncate">{getCenter(l.employee.workCenters)}</p>
                                </div>
                                <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{days}d</span>
                              </li>
                            )
                          })}</ul>
                        )}
                        {movTab==='reemplazos'&&(reemplazos.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin reemplazos en el período</p>
                          :<ul className="space-y-2">{reemplazos.map((r:any,i:number)=>(
                            <li key={i} className="bg-purple-50/50 rounded-lg p-2">
                              <p className="font-semibold text-gray-700 truncate">{r.firstName} {r.lastName}</p>
                              <p className="text-gray-500 truncate">↳ {r.reemplazaA??'Sin especificar'}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-emerald-600 font-medium">Ing: {fmtDate(r.startDate)}</span>
                                {r.endDate&&<span className="text-red-400 font-medium">Sal: {fmtDate(r.endDate)}</span>}
                                <span className="text-gray-400 ml-auto truncate">{getCenter(r.workCenters)}</span>
                              </div>
                            </li>
                          ))}</ul>
                        )}
                        {movTab==='contratos'&&(expiringContracts.length===0
                          ?<p className="text-gray-300 text-center py-4">Sin contratos por vencer (próx. 3 meses)</p>
                          :<ul className="space-y-2">{expiringContracts.map((c:any,i:number)=>{
                            const daysLeft=Math.ceil((new Date(c.endDate).getTime()-Date.now())/86400000)
                            return(
                              <li key={i} className="bg-rose-50/50 rounded-lg p-2">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-semibold text-gray-700 truncate">{c.employee.firstName} {c.employee.lastName}</p>
                                  <span className={`font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${daysLeft<=15?'bg-red-100 text-red-600':'bg-rose-100 text-rose-600'}`}>{daysLeft}d</span>
                                </div>
                                <p className="text-gray-400 truncate">{getCenter(c.employee.workCenters)}</p>
                                <p className="text-gray-400">Vence: {fmtDate(c.endDate)}</p>
                              </li>
                            )
                          })}</ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
              <MultiSelect<CostType>
                label="Tipo"
                selected={typeFilters}
                onChange={setTypeFilters}
                options={[{ value: 'DIRECTO', label: 'Directo' }, { value: 'INDIRECTO', label: 'Indirecto' }]}
              />
              <MultiSelect<string>
                label="Ubicación"
                selected={ubicFilters}
                onChange={setUbicFilters}
                options={ubicaciones.map(u => ({ value: u, label: u }))}
              />
              {(typeFilters.length > 0 || ubicFilters.length > 0) && (
                <button
                  onClick={() => { setTypeFilters([]); setUbicFilters([]) }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => exportCentrosToExcel(filtered, allEntries, periodoLabel, isMonthly)}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Exportar tabla a Excel"
              >
                <FileDown size={14} />
                Exportar Excel
              </button>
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
                {(() => {
                  const cTh = (label: string, col: CenterSortKey, right?: boolean) => (
                    <th
                      onClick={() => handleCenterSort(col)}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700 ${right ? 'text-right' : ''} ${cSortKey === col ? 'text-blue-600' : 'text-gray-500'}`}
                    >
                      {label}
                      {cSortKey === col
                        ? (cSortDir === 'asc'
                            ? <ChevronUp   size={12} className="ml-1 inline text-blue-500" />
                            : <ChevronDown size={12} className="ml-1 inline text-blue-500" />)
                        : <ChevronsUpDown size={12} className="ml-1 inline text-gray-300" />
                      }
                    </th>
                  )
                  return (
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      {cTh('Nombre', 'name')}
                      {cTh('Ubicación', 'ubicacion')}
                      {cTh('Tipo', 'costType')}
                      {cTh('Personal', 'personal')}
                      {cTh('Cargos', 'cargos')}
                      {cTh('Ingresos', 'ingresos', true)}
                      {cTh(periodoLabel ? `Gasto ${periodoLabel}` : 'Gasto período', 'gasto', true)}
                      <th
                        onClick={() => handleCenterSort('diferencia')}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap text-right ${cSortKey === 'diferencia' ? 'text-blue-600' : 'text-gray-500'} hover:text-gray-700`}
                      >
                        Diferencia
                        {cSortKey === 'diferencia'
                          ? (cSortDir === 'asc'
                              ? <ChevronUp   size={12} className="ml-1 inline text-blue-500" />
                              : <ChevronDown size={12} className="ml-1 inline text-blue-500" />)
                          : <ChevronsUpDown size={12} className="ml-1 inline text-gray-300" />
                        }
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedCenters.map(({ wc, gastoReal, diferencia }) => {
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
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {wc.totalIngresos > 0 ? fmtShort(wc.totalIngresos) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              {year ? fmtShort(gastoReal) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {year && diferencia !== null ? (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                                  diferencia >= 0
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  {diferencia >= 0
                                    ? <TrendingUp  size={13} />
                                    : <TrendingDown size={13} />}
                                  {fmtShort(Math.abs(diferencia))}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
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
                              <td colSpan={9} className="px-4 pb-4">
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
                  {year && sortedCenters.length > 0 && (() => {
                    const totalGasto    = sortedCenters.reduce((s, { gastoReal }) => s + gastoReal, 0)
                    const totalIngresos = sortedCenters.reduce((s, { wc }) => s + (wc.totalIngresos), 0)
                    const totalDiff     = totalIngresos > 0 ? totalIngresos - totalGasto : null
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide" colSpan={5}>
                            Total ({sortedCenters.length} centros)
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                            {totalIngresos > 0 ? fmtShort(totalIngresos) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                            {fmtShort(totalGasto)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {totalDiff !== null ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                                totalDiff >= 0
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                                {totalDiff >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                {fmtShort(Math.abs(totalDiff))}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
                  )
                })()}
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
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${row.sueldoEstandar !== row.grossSalary ? 'text-blue-700 bg-blue-50/40' : 'text-gray-700'}`}>{fmt(row.sueldoEstandar)}</td>
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
