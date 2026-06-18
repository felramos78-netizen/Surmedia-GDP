// Utilidades puras de Centros de Trabajo: formato, parsing de remuneraciones,
// tipos de ordenamiento y mapas de etiquetas. Extraído de WorkCentersPage.tsx.
import type { CostType, LegalEntity, PayrollRawEntry, PayrollItem, EmployeeStatus } from '@/types'

// ─── Formatting ───────────────────────────────────────────────────────────────

export const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const fmt = (n: number) => n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)
export function fmtShort(n: number): string {
  if (n === 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`
  return CLP.format(n)
}

export const MONTHS_LABEL: Record<number, string> = {
  1:'Ene',2:'Feb',3:'Mar',4:'Abr',5:'May',6:'Jun',
  7:'Jul',8:'Ago',9:'Sep',10:'Oct',11:'Nov',12:'Dic',
}
export const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS_LABEL[i + 1] }))

// ─── Dashboard card order ─────────────────────────────────────────────────────
export const WC_CARD_IDS = [
  'centros', 'colaboradores', 'contratacion',
  'directo', 'indirecto', 'total-payroll',
  'fin-gastos', 'fin-ingresos', 'fin-diferencia',
] as const
export type WCCardId = typeof WC_CARD_IDS[number]

// ─── Label/color maps ─────────────────────────────────────────────────────────

export const COST_TYPE_LABEL: Record<CostType, string>  = { DIRECTO: 'Directo', INDIRECTO: 'Indirecto' }
export const COST_TYPE_COLOR: Record<CostType, string>  = {
  DIRECTO:   'bg-brand-100 text-brand-700',
  INDIRECTO: 'bg-gray-100 text-gray-600',
}
export const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
export const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

// ─── Payroll parsing (same regexes as PayrollView.tsx) ────────────────────────

const SUELDO_BASE_RE   = /sueldo[\s_-]?base/i
const GRATIFICACION_RE = /gratificaci[oó]n/i
const HH_ANY_RE        = /horas?\s?extras?|hh[\s_-]?extra/i
const HH_50_RE         = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*50|50.*(horas?\s?extras?)/i
const HH_100_RE        = /(horas?\s?extras?|h\.?e\.?|hh[\s_-]?extra).*100|100.*(horas?\s?extras?)/i

export interface ParsedItems {
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

export function parsePayrollItems(items: PayrollItem[], grossSalary = 0): ParsedItems {
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

export interface WCAggRow {
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

export function getCenters(wcs: { legalEntity: string; workCenter: { name: string } }[] | undefined, le: string): string {
  if (!wcs?.length) return '—'
  const names = wcs.filter(w => w.legalEntity === le).map(w => w.workCenter.name)
  return names.length > 0 ? names.join(', ') : '—'
}

export function getPonderacion(wcs: { legalEntity: string; workCenter: { name: string } }[] | undefined, le: string): number {
  if (!wcs?.length) return 1
  const count = wcs.filter(w => w.legalEntity === le).length
  return count > 0 ? 1 / count : 1
}

export function aggregateWCRows(entries: PayrollRawEntry[], monthly: boolean): WCAggRow[] {
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

// ─── Sort types ───────────────────────────────────────────────────────────────

export type SortKey = 'employeeName' | 'centers' | 'legalEntity' | 'period' | 'liquidSalary' | 'grossSalary' | 'sueldoEstandar' | 'sueldoBase' | 'gratificacion' | 'bonosTotal' | 'bonosNames' | 'hhTotal' | 'hhDetail' | 'noImponiblesTotal' | 'noImponiblesNames'
export type CenterSortKey = 'name' | 'ubicacion' | 'costType' | 'personal' | 'cargos' | 'ingresos' | 'gasto' | 'diferencia'
export type SortDir = 'asc' | 'desc'
export type DetailSortKey = 'employeeName' | 'jobTitle' | 'ponderacion' | 'grossSalary' | 'sueldoEstandar' | 'bonosTotal' | 'hhTotal'
export const NUMERIC_KEYS = new Set<SortKey>(['liquidSalary', 'grossSalary', 'sueldoEstandar', 'sueldoBase', 'gratificacion', 'bonosTotal', 'hhTotal', 'noImponiblesTotal'])

// ─── Column filter helpers for Remuneraciones ────────────────────────────────

export type RemColFilters = Record<string, Set<string>>

export function getRemVal(r: WCAggRow, col: string): string {
  switch (col) {
    case 'employeeName':      return r.employeeName
    case 'legalEntity':       return LEGAL_ENTITY_LABEL[r.legalEntity as LegalEntity] ?? r.legalEntity
    case 'centers':           return r.centers
    case 'period':            return r.period
    case 'liquidSalary':      return r.liquidSalary      > 0 ? String(r.liquidSalary)      : '—'
    case 'grossSalary':       return r.grossSalary       > 0 ? String(r.grossSalary)       : '—'
    case 'sueldoEstandar':    return r.sueldoEstandar    > 0 ? String(r.sueldoEstandar)    : '—'
    case 'sueldoBase':        return r.sueldoBase        > 0 ? String(r.sueldoBase)        : '—'
    case 'gratificacion':     return r.gratificacion     > 0 ? String(r.gratificacion)     : '—'
    case 'bonosTotal':        return r.bonosTotal        > 0 ? String(r.bonosTotal)        : '—'
    case 'bonosNames':        return r.bonosNames
    case 'hhTotal':           return r.hhTotal           > 0 ? String(r.hhTotal)           : '—'
    case 'hhDetail':          return r.hhDetail
    case 'noImponiblesTotal': return r.noImponiblesTotal > 0 ? String(r.noImponiblesTotal) : '—'
    case 'noImponiblesNames': return r.noImponiblesNames
    default: return ''
  }
}
