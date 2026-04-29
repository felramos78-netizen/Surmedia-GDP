import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, Users, DollarSign, TrendingUp, BarChart2, Search, Upload, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePayrollTable, usePayrollYears, useImportPayroll } from '@/hooks/useDotacion'
import type { PayrollItem, PayrollRawEntry, LegalEntity, EmployeeStatus } from '@/types'

// ─── Formateo ─────────────────────────────────────────────────────────────────

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

const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, detail }: {
  label: string; value: number | string; sub?: string
  icon: React.ElementType; color: string
  detail?: { label: string; value: number | string; color: string }[]
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
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
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
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

// ─── Parseo de ítems de remuneración ─────────────────────────────────────────

const SUELDO_BASE_RE   = /sueldo[\s_-]?base/i
const GRATIFICACION_RE = /gratificaci[oó]n/i
const HH_ANY_RE        = /horas?\s?extras?|hh[\s_-]?extra/i
const HH_50_RE         = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*50|50.*(horas?\s?extras?)/i
const HH_100_RE        = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*100|100.*(horas?\s?extras?)/i

interface ParsedItems {
  sueldoBase:        number
  gratificacion:     number
  hhTotal:           number
  hh50Hours:         number
  hh100Hours:        number
  hhDetail:          string
  bonosTotal:        number
  bonosNames:        string
  noImponiblesTotal: number
  noImponiblesNames: string
}

function extractHours(items: PayrollItem[]): number {
  return items.reduce((s, i) => {
    const m = i.name.match(/(\d+(?:[.,]\d+)?)\s*h(ora)?/i)
    return s + (m ? parseFloat(m[1].replace(',', '.')) : 0)
  }, 0)
}

function parseItems(items: PayrollItem[], grossSalary = 0): ParsedItems {
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

  const hhTotal = [...hh50, ...hh100].reduce((s, i) => s + i.amount, 0)

  // Intentar extraer horas del nombre; si no hay, estimar desde el monto
  // Fórmula: valor hora normal = grossSalary / 30 días / 8 horas = grossSalary / 240
  // HH 50%: × 1.5  →  horas = monto × 160 / grossSalary
  // HH 100%: × 2.0 →  horas = monto × 120 / grossSalary
  let hh50Hours  = extractHours(hh50)
  let hh100Hours = extractHours(hh100)
  const valorHora = grossSalary > 0 ? grossSalary / 240 : 0
  if (hh50Hours  === 0 && hh50.length  > 0 && valorHora > 0)
    hh50Hours  = Math.round(hh50.reduce((s, i)  => s + i.amount, 0) / (valorHora * 1.5) * 10) / 10
  if (hh100Hours === 0 && hh100.length > 0 && valorHora > 0)
    hh100Hours = Math.round(hh100.reduce((s, i) => s + i.amount, 0) / (valorHora * 2.0) * 10) / 10

  const parts: string[] = []
  if (hh50.length) {
    const names = [...new Set(hh50.map(i => i.name))].join(', ')
    parts.push(hh50Hours > 0 ? `${names} (~${hh50Hours.toFixed(1)}h)` : names)
  }
  if (hh100.length) {
    const names = [...new Set(hh100.map(i => i.name))].join(', ')
    parts.push(hh100Hours > 0 ? `${names} (~${hh100Hours.toFixed(1)}h)` : names)
  }

  return {
    sueldoBase,
    gratificacion,
    hhTotal,
    hh50Hours,
    hh100Hours,
    hhDetail:          parts.join('; ') || '—',
    bonosTotal:        bonos.reduce((s, i) => s + i.amount, 0),
    bonosNames:        [...new Set(bonos.map(i => i.name))].join(', ') || '—',
    noImponiblesTotal: noImponibles.reduce((s, i) => s + i.amount, 0),
    noImponiblesNames: [...new Set(noImponibles.map(i => i.name))].join(', ') || '—',
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'Con permiso', DUPLICATE: 'Duplicado',
}
const STATUS_COLOR: Record<EmployeeStatus, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
  ON_LEAVE:  'bg-amber-100 text-amber-700',
  DUPLICATE: 'bg-orange-100 text-orange-600',
}

function getCenters(wcs: { legalEntity: string; workCenter: { name: string } }[] | undefined, le: string): string {
  if (!wcs?.length) return '—'
  const names = wcs.filter(w => w.legalEntity === le).map(w => w.workCenter.name)
  return names.length > 0 ? names.join(', ') : '—'
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type PayrollSortKey = 'employeeName' | 'legalEntity' | 'status' | 'period' | 'liquidSalary' | 'grossSalary' | 'sueldoBase' | 'gratificacion' | 'bonosTotal' | 'hhTotal' | 'noImponiblesTotal'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: PayrollSortKey; sortKey: PayrollSortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-gray-300 ml-1 inline" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500 ml-1 inline" />
    : <ChevronDown size={12} className="text-blue-500 ml-1 inline" />
}

function SortTh({ label, col, sortKey, sortDir, onSort, right }: {
  label: string; col: PayrollSortKey; sortKey: PayrollSortKey; sortDir: SortDir
  onSort: (c: PayrollSortKey) => void; right?: boolean
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-700 ${right ? 'text-right' : ''}`}
      onClick={() => onSort(col)}
    >
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  )
}

// ─── Tipos y agregación ───────────────────────────────────────────────────────

interface AggRow {
  employeeId:        string
  employeeName:      string
  rut:               string
  legalEntity:       string
  status:            EmployeeStatus
  centers:           string
  period:            string
  grossSalary:       number
  liquidSalary:      number
  sueldoBase:        number
  gratificacion:     number
  hhTotal:           number
  hh50Hours:         number
  hh100Hours:        number
  hhDetail:          string
  bonosTotal:        number
  bonosNames:        string
  noImponiblesTotal: number
  noImponiblesNames: string
}

function aggregateRows(entries: PayrollRawEntry[], monthly: boolean): AggRow[] {
  if (monthly) {
    return entries.map(e => {
      const parsed = parseItems(e.items ?? [], e.grossSalary)
      return {
        employeeId:   e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut:          e.employee.rut,
        legalEntity:  e.legalEntity,
        status:       e.employee.status,
        centers:      getCenters(e.employee.workCenters, e.legalEntity),
        period:       `${MONTHS_LABEL[e.month] ?? e.month} ${e.year}`,
        grossSalary:  e.grossSalary,
        liquidSalary: e.liquidSalary,
        ...parsed,
      }
    })
  }

  const map = new Map<string, AggRow>()
  for (const e of entries) {
    const key    = `${e.employeeId}::${e.legalEntity}`
    const parsed = parseItems(e.items ?? [], e.grossSalary)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        employeeId:   e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut:          e.employee.rut,
        legalEntity:  e.legalEntity,
        status:       e.employee.status,
        centers:      getCenters(e.employee.workCenters, e.legalEntity),
        period:       `${e.year} (anual)`,
        grossSalary:  e.grossSalary,
        liquidSalary: e.liquidSalary,
        ...parsed,
      })
    } else {
      existing.grossSalary       += e.grossSalary
      existing.liquidSalary      += e.liquidSalary
      existing.sueldoBase        += parsed.sueldoBase
      existing.gratificacion     += parsed.gratificacion
      existing.hhTotal           += parsed.hhTotal
      existing.hh50Hours         += parsed.hh50Hours
      existing.hh100Hours        += parsed.hh100Hours
      existing.bonosTotal        += parsed.bonosTotal
      existing.noImponiblesTotal += parsed.noImponiblesTotal

      // Reconstruir detalle de HH desde horas acumuladas
      const parts: string[] = []
      if (existing.hh50Hours  > 0) parts.push(`~${existing.hh50Hours.toFixed(1)}h a 50%`)
      if (existing.hh100Hours > 0) parts.push(`~${existing.hh100Hours.toFixed(1)}h a 100%`)
      existing.hhDetail = parts.join('; ') || '—'

      // Unir nombres únicos de bonos imponibles
      const allBonos = new Set([
        ...existing.bonosNames.split(', ').filter(n => n !== '—'),
        ...parsed.bonosNames.split(', ').filter(n => n !== '—'),
      ])
      existing.bonosNames = allBonos.size > 0 ? [...allBonos].join(', ') : '—'

      // Unir nombres únicos de haberes no imponibles
      const allNI = new Set([
        ...existing.noImponiblesNames.split(', ').filter(n => n !== '—'),
        ...parsed.noImponiblesNames.split(', ').filter(n => n !== '—'),
      ])
      existing.noImponiblesNames = allNI.size > 0 ? [...allNI].join(', ') : '—'
    }
  }
  return [...map.values()]
}

// ─── Parser de Excel BUK ─────────────────────────────────────────────────────

const LEGAL_ENTITY_OPTIONS = [
  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones Surmedia Spa' },
  { value: 'SURMEDIA_CONSULTORIA',    label: 'Surmedia Consultoría Spa' },
]

function normalizeRut(raw: string): string {
  const clean = raw.replace(/\./g, '').trim()
  const [body, dv] = clean.split('-')
  if (!body || !dv) return raw
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv.toUpperCase()}`
}

function detectLegalEntityFromFilename(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('consultor')) return 'SURMEDIA_CONSULTORIA'
  if (n.includes('comunicac')) return 'COMUNICACIONES_SURMEDIA'
  return ''
}

function detectYearFromFilename(name: string): string {
  // "Sueldos 2026-01-01 - 2026-04-01" → "2026"
  const mSueldos = name.match(/[Ss]ueldos[^\d]*(20\d{2})/i)
  if (mSueldos) return mSueldos[1]
  const mAny = name.match(/20\d{2}/)
  return mAny ? mAny[0] : ''
}

interface BukExcelRow {
  rut: string; year: number; month: number
  grossSalary: number; liquidSalary: number
  items: { name: string; amount: number; taxable: boolean }[]
}

function parseBukExcel(buffer: ArrayBuffer, startYear: number): BukExcelRow[] {
  const wb   = XLSX.read(buffer, { type: 'array' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const raw  = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

  // Encontrar fila de encabezados (tiene "Empleado - Estado" en col 0)
  const hdrIdx = raw.findIndex(r => String(r[0]).toLowerCase().includes('empleado') && String(r[0]).toLowerCase().includes('estado'))
  if (hdrIdx === -1) throw new Error('No se encontró la fila de encabezados en el Excel')

  const headers = raw[hdrIdx].map(h => String(h).trim())
  const col = (term: string) => headers.findIndex(h => h.toLowerCase() === term.toLowerCase())
  const colContains = (term: string) => headers.findIndex(h => h.toLowerCase().includes(term.toLowerCase()))

  const RUT_COL  = colContains('número de documento')
  const MES_COL  = colContains('mes de cálculo')
  const LIQ_COL  = colContains('sueldo líquido')
  const BRU_COL  = colContains('sueldo bruto')

  if (RUT_COL === -1 || MES_COL === -1 || LIQ_COL === -1 || BRU_COL === -1) {
    throw new Error('Columnas requeridas no encontradas. Verifica que sea un export de BUK Sueldos.')
  }

  // Mapear todos los ítems de haberes (imponibles y no imponibles)
  const itemCols: { idx: number; name: string; taxable: boolean }[] = []
  headers.forEach((h, i) => {
    if (h.startsWith('Haberes Imponibles -')) {
      itemCols.push({ idx: i, name: h.replace('Haberes Imponibles - ', ''), taxable: true })
    } else if (h.startsWith('Haberes No Imponibles -')) {
      itemCols.push({ idx: i, name: h.replace('Haberes No Imponibles - ', ''), taxable: false })
    }
  })

  // Primer paso: recopilar (rut, month) en orden de aparición para detectar años por empleado
  const rawData: { rut: string; month: number; rowIdx: number }[] = []
  for (let i = hdrIdx + 1; i < raw.length; i++) {
    const r   = raw[i]
    const rut = String(r[RUT_COL] ?? '').trim()
    if (!rut) continue
    const month = Number(r[MES_COL]) || 0
    if (month === 0) continue
    rawData.push({ rut, month, rowIdx: i })
  }

  // Calcular año por empleado (cada empleado tiene su propio contador)
  const yearByRut  = new Map<string, number>()
  const prevByRut  = new Map<string, number>()
  const resolvedYear = new Map<number, number>() // rowIdx → year

  for (const { rut, month, rowIdx } of rawData) {
    if (!yearByRut.has(rut)) yearByRut.set(rut, startYear)
    const prev = prevByRut.get(rut) ?? 0
    if (prev > 0 && month < prev) yearByRut.set(rut, (yearByRut.get(rut) ?? startYear) + 1)
    prevByRut.set(rut, month)
    resolvedYear.set(rowIdx, yearByRut.get(rut) ?? startYear)
  }

  const rows: BukExcelRow[] = []
  for (const { rut, month, rowIdx } of rawData) {
    const r            = raw[rowIdx]
    const grossSalary  = Number(String(r[BRU_COL]).replace(/[^0-9.-]/g, '')) || 0
    const liquidSalary = Number(String(r[LIQ_COL]).replace(/[^0-9.-]/g, '')) || 0
    if (grossSalary === 0 && liquidSalary === 0) continue

    const items = itemCols
      .map(ic => ({ name: ic.name, amount: Number(r[ic.idx]) || 0, taxable: ic.taxable }))
      .filter(it => it.amount !== 0)

    rows.push({ rut: normalizeRut(rut), year: resolvedYear.get(rowIdx) ?? startYear, month, grossSalary, liquidSalary, items })
  }

  return rows
}

// ─── Modal de importación Excel ───────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const [file,        setFile]        = useState<File | null>(null)
  const [legalEntity, setLegalEntity] = useState('')
  const [startYear,   setStartYear]   = useState('2025')
  const [preview,     setPreview]     = useState<{ rows: BukExcelRow[]; error?: string } | null>(null)
  const { mutate: doImport, isPending, data: result, error: importError } = useImportPayroll()

  function handleFile(f: File) {
    setFile(f)
    setPreview(null)
    const detected = detectLegalEntityFromFilename(f.name)
    if (detected) setLegalEntity(detected)
    const year = detectYearFromFilename(f.name)
    if (year) setStartYear(year)
  }

  async function handlePreview() {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const rows = parseBukExcel(buf, Number(startYear) || 2025)
      setPreview({ rows })
    } catch (e: any) {
      setPreview({ rows: [], error: e.message })
    }
  }

  function handleImport() {
    if (!preview?.rows.length || !legalEntity) return
    doImport({ legalEntity, rows: preview.rows })
  }

  const done = !!result || !!importError

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Importar liquidaciones desde Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo Excel de BUK (Sueldos)</label>
            <input type="file" accept=".xlsx,.xls"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && <p className="text-xs text-gray-400 mt-1">{file.name}</p>}
          </div>

          {/* Empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
            <select value={legalEntity} onChange={e => setLegalEntity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccionar...</option>
              {LEGAL_ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Año inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año de inicio del período</label>
            <input type="number" value={startYear} onChange={e => setStartYear(e.target.value)} min={2020} max={2030}
              className="w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">El año del primer mes del archivo (si cubre varios años, se detectan automáticamente).</p>
          </div>

          {/* Preview */}
          {preview && !preview.error && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-700">{preview.rows.length} filas parseadas</p>
              {preview.rows.length > 0 && (
                <p className="text-gray-500 text-xs mt-1">
                  Meses: {[...new Set(preview.rows.map(r => `${r.month}/${r.year}`))].slice(0, 6).join(', ')}{preview.rows.length > 6 ? '…' : ''}
                </p>
              )}
            </div>
          )}
          {preview?.error && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-600">{preview.error}</div>
          )}

          {/* Resultado */}
          {done && result && (
            <div className={`rounded-lg p-3 text-sm ${result.upserted > 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              <p className="font-medium">{result.upserted} liquidaciones importadas · {result.skipped} sin coincidencia</p>
              {result.skippedSample?.length > 0 && (
                <p className="text-xs mt-1 opacity-70">Sin match: {result.skippedSample.join(', ')}</p>
              )}
              {(result as any).errors?.length > 0 && (
                <p className="text-xs mt-1 opacity-80 text-red-600">Errores SQL: {(result as any).errors.join(' | ')}</p>
              )}
            </div>
          )}
          {importError && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-600">Error al importar: {String(importError)}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cerrar</button>
          {!preview && (
            <button onClick={handlePreview} disabled={!file}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
              Vista previa
            </button>
          )}
          {preview && !preview.error && !done && (
            <button onClick={handleImport} disabled={isPending || !legalEntity || preview.rows.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {isPending && <RefreshCw size={13} className="animate-spin" />}
              {isPending ? 'Importando…' : `Importar ${preview.rows.length} filas`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS_LABEL[i + 1] }))

export default function PayrollView() {
  const [year,          setYear]          = useState('')
  const [month,         setMonth]         = useState('')
  const [legalEntities, setLegalEntities] = useState<string[]>([])
  const [statusFilter,  setStatusFilter]  = useState<string[]>([])
  const [search,        setSearch]        = useState('')
  const [showImport,    setShowImport]    = useState(false)
  const [sortKey,       setSortKey]       = useState<PayrollSortKey>('employeeName')
  const [sortDir,       setSortDir]       = useState<SortDir>('asc')

  const { data: years = [], refetch: refetchYears } = usePayrollYears()
  // Seleccionar automáticamente el año más reciente con datos
  useEffect(() => {
    if (years.length > 0 && !year) setYear(String(years[0]))
  }, [years, year])

  const { data: entries = [], isLoading, isError } = usePayrollTable({
    year,
    month:       month || undefined,
    legalEntity: legalEntities.length > 0 ? legalEntities : undefined,
  })

  const isMonthly = !!month

  function handleSort(col: PayrollSortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  const NUMERIC_KEYS = new Set<PayrollSortKey>(['liquidSalary', 'grossSalary', 'sueldoBase', 'gratificacion', 'bonosTotal', 'hhTotal', 'noImponiblesTotal'])

  const rows = useMemo(() => {
    let agg = aggregateRows(entries, isMonthly)

    if (statusFilter.length > 0) agg = agg.filter(r => statusFilter.includes(r.status))

    if (search) {
      const q = search.toLowerCase()
      agg = agg.filter(r => r.employeeName.toLowerCase().includes(q) || r.rut.includes(q))
    }

    agg = [...agg].sort((a, b) => {
      if (NUMERIC_KEYS.has(sortKey)) {
        const diff = (a[sortKey] as number) - (b[sortKey] as number)
        return sortDir === 'asc' ? diff : -diff
      }
      const va = String(a[sortKey] ?? '')
      const vb = String(b[sortKey] ?? '')
      const cmp = va.localeCompare(vb, 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return agg
  }, [entries, isMonthly, search, statusFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    const byCom = rows.filter(r => r.legalEntity === 'COMUNICACIONES_SURMEDIA')
    const byCon = rows.filter(r => r.legalEntity === 'SURMEDIA_CONSULTORIA')
    return {
      uniqueEmps:    new Set(rows.map(r => r.employeeId)).size,
      uniqueEmpsCom: new Set(byCom.map(r => r.employeeId)).size,
      uniqueEmpsCon: new Set(byCon.map(r => r.employeeId)).size,
      totalLiquido:  rows.reduce((s, r) => s + r.liquidSalary, 0),
      liquidoCom:    byCom.reduce((s, r) => s + r.liquidSalary, 0),
      liquidoCon:    byCon.reduce((s, r) => s + r.liquidSalary, 0),
      totalBruto:    rows.reduce((s, r) => s + r.grossSalary, 0),
      totalBonos:    rows.reduce((s, r) => s + r.bonosTotal, 0),
    }
  }, [rows])

  const hasFilters   = !!(month || legalEntities.length || statusFilter.length || search)
  const periodoLabel = isMonthly ? `${MONTHS_LABEL[Number(month)]} ${year}` : `${year} (anual)`

  return (
    <>
    <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Colaboradores" value={stats.uniqueEmps || '—'} icon={Users}
          color="text-blue-600 bg-blue-50" sub={periodoLabel}
          detail={[
            { label: 'Comunicaciones', value: stats.uniqueEmpsCom || '—', color: 'text-blue-600' },
            { label: 'Consultoría',    value: stats.uniqueEmpsCon || '—', color: 'text-violet-600' },
          ]}
        />
        <StatCard
          label="Masa salarial líquida" value={fmtShort(stats.totalLiquido)}
          icon={DollarSign} color="text-green-600 bg-green-50" sub={periodoLabel}
          detail={[
            { label: 'Comunicaciones', value: fmtShort(stats.liquidoCom), color: 'text-blue-600' },
            { label: 'Consultoría',    value: fmtShort(stats.liquidoCon), color: 'text-violet-600' },
          ]}
        />
        <StatCard
          label="Masa salarial bruta" value={fmtShort(stats.totalBruto)}
          icon={TrendingUp} color="text-gray-500 bg-gray-100" sub={periodoLabel}
        />
        <StatCard
          label="Total bonos imponibles" value={fmtShort(stats.totalBonos)}
          icon={BarChart2} color="text-violet-600 bg-violet-50" sub={periodoLabel}
        />
      </div>

      {/* Tabla con filtros */}
      <div className="bg-white rounded-xl border border-gray-200">

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Nombre o RUT…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <FilterSelect value={year} onChange={setYear} placeholder="Año"
            options={years.map(y => ({ value: String(y), label: String(y) }))}
          />
          <FilterSelect value={month} onChange={setMonth} placeholder="Todos los meses (anual)"
            options={MONTHS}
          />
          <MultiFilterSelect
            values={legalEntities}
            onChange={setLegalEntities}
            placeholder="Todas las empresas"
            options={[
              { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
              { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
            ]}
          />
          <MultiFilterSelect
            values={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos los estados"
            options={[
              { value: 'ACTIVE',   label: 'Activos' },
              { value: 'INACTIVE', label: 'Inactivos' },
              { value: 'ON_LEAVE', label: 'Con permiso' },
            ]}
          />
          {hasFilters && (
            <button onClick={() => { setMonth(''); setLegalEntities([]); setStatusFilter([]); setSearch('') }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2">
              Limpiar filtros
            </button>
          )}
          <div className="ml-auto flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                <Upload size={13} />
                Importar Excel
              </button>
            </div>
          </div>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Cargando remuneraciones…</p>
          </div>
        ) : isError ? (
          <div className="p-16 text-center">
            <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Error cargando datos.</p>
          </div>
        ) : years.length === 0 ? (
          <div className="p-16 text-center">
            <DollarSign size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Sin datos de remuneraciones.</p>
            <p className="text-xs text-gray-400 mt-1">Usa el botón <strong>Importar Excel</strong> para cargar los datos de nómina.</p>
          </div>
        ) : !year ? (
          <div className="p-16 text-center">
            <p className="text-sm text-gray-400">Selecciona un año para ver las remuneraciones.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-gray-400">Sin datos para el período seleccionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-white cursor-pointer select-none hover:text-gray-700"
                      onClick={() => handleSort('employeeName')}>
                    Colaborador<SortIcon col="employeeName" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <SortTh label="Razón Social"              col="legalEntity"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Centros</th>
                  <SortTh label="Estado"                    col="status"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Período"                   col="period"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Sueldo líquido"            col="liquidSalary"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <SortTh label="Sueldo bruto"              col="grossSalary"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <SortTh label="Sueldo base"               col="sueldoBase"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <SortTh label="Gratificación"             col="gratificacion"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <SortTh label="Total bonos"               col="bonosTotal"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Bonos identificados</th>
                  <SortTh label="Total horas extras"        col="hhTotal"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Horas extras identificadas</th>
                  <SortTh label="Total hab. no imponibles"  col="noImponiblesTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Hab. no imponibles identificados</th>
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
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap max-w-[160px] truncate" title={row.centers}>{row.centers}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.period}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(row.liquidSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.grossSalary)}</td>
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
          </div>
        )}
      </div>
    </div>

    {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  )
}
