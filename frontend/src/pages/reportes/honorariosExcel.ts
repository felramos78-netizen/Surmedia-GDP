// Reporte mensual de Honorarios — formato estándar Surmedia.
//
// Reglas del estándar:
//   · el mes lo define la FECHA DE EMISIÓN (no el día de pago)
//   · solo boletas vigentes (las anuladas quedan fuera, las aplica el backend)
//   · una fila por boleta, RUT en formato XX.XXX.XXX-X
//   · las celdas sin clasificar salen vacías y RRHH las completa a mano
import * as XLSX from 'xlsx'
import type { HonorarioReportRow } from '@/hooks/useReports'
import { CLP_FMT, DATE_FMT, formatColumn, periodoLabel, periodoSlug, toExcelDate } from './reportShared'

const HEADERS = [
  'Día de pago', 'Reembolsable', 'Contrato', 'Clasificacion interna',
  'Razón Social Interna', 'Fecha Emisión', 'Razón Social', 'Rut', 'Folio',
  'Monto Total', 'Pagado', 'Glosa',
] as const

const COL_WIDTHS = [12, 13, 30, 22, 20, 13, 32, 14, 10, 14, 9, 90]

// Índices de columna (0-based) según HEADERS
const COL_DIA_PAGO = 0
const COL_FECHA_EM = 5
const COL_MONTO    = 9

export function buildHonorariosSheet(rows: HonorarioReportRow[]): XLSX.WorkSheet {
  const aoa: (string | number | Date | null)[][] = [
    [...HEADERS],
    ...rows.map(r => [
      toExcelDate(r.diaPago),
      r.reembolsable,
      r.contrato,
      r.clasificacionInterna,
      r.razonSocialInterna,
      toExcelDate(r.fechaEmision),
      r.razonSocial,
      r.rut,
      r.folio,
      r.montoTotal,
      r.pagado,
      r.glosa,
    ]),
  ]

  // Fila de totales
  if (rows.length > 0) {
    const total = rows.reduce((s, r) => s + r.montoTotal, 0)
    const label = `TOTAL (${rows.length} boleta${rows.length !== 1 ? 's' : ''})`
    aoa.push([null, null, null, null, null, null, null, null, label, total, null, null])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  ws['!cols'] = COL_WIDTHS.map(wch => ({ wch }))
  formatColumn(ws, COL_DIA_PAGO, DATE_FMT)
  formatColumn(ws, COL_FECHA_EM, DATE_FMT)
  formatColumn(ws, COL_MONTO,    CLP_FMT)
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: HEADERS.length - 1 } }) }
  return ws
}

export function exportHonorariosToExcel(rows: HonorarioReportRow[], year: number, month: number) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildHonorariosSheet(rows), 'Honorarios')
  XLSX.writeFile(wb, `Honorarios-${periodoSlug(year, month)}.xlsx`)
  return periodoLabel(year, month)
}
