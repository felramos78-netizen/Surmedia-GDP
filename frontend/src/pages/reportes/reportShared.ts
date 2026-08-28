// Constantes y helpers compartidos por los reportes mensuales estandarizados.
import * as XLSX from 'xlsx'

export const CLP_FMT  = '$#,##0'

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const ENTITY_OPTIONS = [
  { value: '',                        label: 'Ambas razones sociales' },
  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
  { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
]

/** "Julio 2026" */
export function periodoLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** "2026-07" — para nombres de archivo ordenables */
export function periodoSlug(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Celda de fórmula numérica. El `v: 0` es el valor cacheado: sin él la librería
 * descarta la celda al escribir el archivo. Excel recalcula al abrir.
 */
export function formulaCell(f: string, z = CLP_FMT): XLSX.CellObject {
  return { t: 'n', v: 0, f, z } as XLSX.CellObject
}

/** Fecha ISO → Date para que Excel la trate como fecha real, no como texto. */
export function toExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}
