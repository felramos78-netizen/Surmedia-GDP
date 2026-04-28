import { useState, useMemo } from 'react'
import { RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react'
import { usePayrollTable, usePayrollYears } from '@/hooks/useDotacion'
import type { PayrollItem, PayrollRawEntry, LegalEntity } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmt = (n: number) => n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)

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

// ─── Parseo de ítems de remuneración ─────────────────────────────────────────

const SUELDO_BASE_RE   = /sueldo[\s_-]?base/i
const GRATIFICACION_RE = /gratificaci[oó]n/i
const HH_ANY_RE        = /hora[\s_-]?extra|hh[\s_-]?extra/i
const HH_50_RE         = /(hora[\s_-]?extra|h\.?e\.?|hh[\s_-]?extra).*50|50.*hora[\s_-]?extra/i
const HH_100_RE        = /(hora[\s_-]?extra|h\.?e\.?|hh[\s_-]?extra).*100|100.*hora[\s_-]?extra/i

interface ParsedItems {
  sueldoBase:    number
  gratificacion: number
  hhTotal:       number
  hhDetail:      string
  bonosTotal:    number
  bonosNames:    string
}

function parseItems(items: PayrollItem[]): ParsedItems {
  let sueldoBase = 0, gratificacion = 0
  const hh50: PayrollItem[] = [], hh100: PayrollItem[] = [], bonos: PayrollItem[] = []

  for (const item of items) {
    // solo haberes (excluir descuentos explícitos)
    if (item.type === 'descuento') continue
    const n = item.name
    if (SUELDO_BASE_RE.test(n))   { sueldoBase    += item.amount; continue }
    if (GRATIFICACION_RE.test(n)) { gratificacion  += item.amount; continue }
    if (HH_50_RE.test(n))         { hh50.push(item);               continue }
    if (HH_100_RE.test(n))        { hh100.push(item);              continue }
    if (HH_ANY_RE.test(n))        { hh50.push(item);               continue } // genérico → 50%
    // bono imponible: lo incluimos si taxable o si no es explícitamente no-imponible
    if (item.taxable !== false) bonos.push(item)
  }

  const hhTotal = [...hh50, ...hh100].reduce((s, i) => s + i.amount, 0)

  // Intentar extraer horas del nombre (e.g. "5.0 hrs", "8 horas", "3h")
  const hrs = (list: PayrollItem[]) => {
    const total = list.reduce((s, i) => {
      const m = i.name.match(/(\d+(?:[.,]\d+)?)\s*h(ora)?/i)
      return s + (m ? parseFloat(m[1].replace(',', '.')) : 0)
    }, 0)
    return total > 0 ? total : null
  }

  const parts: string[] = []
  if (hh50.length)  { const h = hrs(hh50);  parts.push(h != null ? `${h} a 50%`  : `${hh50.length} ítem 50%`) }
  if (hh100.length) { const h = hrs(hh100); parts.push(h != null ? `${h} a 100%` : `${hh100.length} ítem 100%`) }

  return {
    sueldoBase,
    gratificacion,
    hhTotal,
    hhDetail: parts.join(' y ') || '—',
    bonosTotal: bonos.reduce((s, i) => s + i.amount, 0),
    bonosNames: [...new Set(bonos.map(i => i.name))].join(', ') || '—',
  }
}

// ─── Agregación anual ─────────────────────────────────────────────────────────

interface AggRow {
  employeeId:    string
  employeeName:  string
  rut:           string
  legalEntity:   string
  period:        string   // "2025-03" o "2025 (anual)"
  grossSalary:   number
  liquidSalary:  number
  sueldoBase:    number
  gratificacion: number
  hhTotal:       number
  hhDetail:      string
  bonosTotal:    number
  bonosNames:    string
}

function aggregateRows(entries: PayrollRawEntry[], monthly: boolean): AggRow[] {
  if (monthly) {
    return entries.map(e => {
      const parsed = parseItems(e.items ?? [])
      return {
        employeeId:   e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut:          e.employee.rut,
        legalEntity:  e.legalEntity,
        period:       `${MONTHS_LABEL[e.month] ?? e.month} ${e.year}`,
        grossSalary:  e.grossSalary,
        liquidSalary: e.liquidSalary,
        ...parsed,
      }
    })
  }

  // Agrupación anual por empleado + empresa
  const map = new Map<string, AggRow>()
  for (const e of entries) {
    const key = `${e.employeeId}::${e.legalEntity}`
    const parsed = parseItems(e.items ?? [])
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        employeeId:   e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        rut:          e.employee.rut,
        legalEntity:  e.legalEntity,
        period:       `${e.year} (anual)`,
        grossSalary:  e.grossSalary,
        liquidSalary: e.liquidSalary,
        ...parsed,
        bonosNames: parsed.bonosNames,
      })
    } else {
      existing.grossSalary   += e.grossSalary
      existing.liquidSalary  += e.liquidSalary
      existing.sueldoBase    += parsed.sueldoBase
      existing.gratificacion += parsed.gratificacion
      existing.hhTotal       += parsed.hhTotal
      existing.bonosTotal    += parsed.bonosTotal
      // Unir nombres de bonos únicos
      const allNames = new Set([
        ...existing.bonosNames.split(', ').filter(n => n !== '—'),
        ...parsed.bonosNames.split(', ').filter(n => n !== '—'),
      ])
      existing.bonosNames = allNames.size > 0 ? [...allNames].join(', ') : '—'
    }
  }
  return [...map.values()]
}

// ─── FilterSelect (reutilizable) ──────────────────────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS_LABEL[i + 1] }))

export default function PayrollView() {
  const [year,        setYear]        = useState(String(new Date().getFullYear()))
  const [month,       setMonth]       = useState('')
  const [legalEntity, setLegalEntity] = useState('')
  const [search,      setSearch]      = useState('')

  const { data: years = [] } = usePayrollYears()
  const { data: entries = [], isLoading, isError } = usePayrollTable({
    year,
    month:       month || undefined,
    legalEntity: legalEntity || undefined,
  })

  const isMonthly = !!month

  const rows = useMemo(() => {
    const agg = aggregateRows(entries, isMonthly)
    if (!search) return agg
    const q = search.toLowerCase()
    return agg.filter(r =>
      r.employeeName.toLowerCase().includes(q) || r.rut.includes(q)
    )
  }, [entries, isMonthly, search])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Buscar colaborador o RUT…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 pl-3 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <FilterSelect value={year} onChange={setYear} placeholder="Año"
          options={years.map(y => ({ value: String(y), label: String(y) }))}
        />
        <FilterSelect value={month} onChange={setMonth} placeholder="Todos los meses (anual)"
          options={MONTHS}
        />
        <FilterSelect value={legalEntity} onChange={setLegalEntity} placeholder="Todas las empresas"
          options={[
            { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
            { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
          ]}
        />
        {(month || legalEntity || search) && (
          <button onClick={() => { setMonth(''); setLegalEntity(''); setSearch('') }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200">
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
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Colaborador</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Razón Social</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Período</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Líquido</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Bruto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Sueldo Base</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Gratificación</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">HH Extra</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Detalle HH</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap text-right">Valor Bonos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Nombre Bonos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={`${row.employeeId}-${row.legalEntity}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{row.employeeName}</p>
                      <p className="text-xs text-gray-400 font-mono">{row.rut}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${LEGAL_ENTITY_COLOR[row.legalEntity as LegalEntity] ?? 'bg-gray-100 text-gray-700'}`}>
                        {LEGAL_ENTITY_LABEL[row.legalEntity as LegalEntity] ?? row.legalEntity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.period}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{fmt(row.liquidSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.grossSalary)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.sueldoBase)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.gratificacion)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.hhTotal)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.hhDetail}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(row.bonosTotal)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{row.bonosNames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {rows.length} {isMonthly ? 'registros' : 'colaboradores'} — {isMonthly ? `${MONTHS_LABEL[Number(month)]} ${year}` : `${year} (acumulado anual)`}
          </div>
        )}
      </div>
    </div>
  )
}
