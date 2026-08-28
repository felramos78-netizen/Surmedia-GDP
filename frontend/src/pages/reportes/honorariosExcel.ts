// Reporte mensual de Honorarios — formato estándar Surmedia (calca el Excel
// de referencia de RRHH: header negro, texto blanco en negrita, hoja nombrada
// por el mes).
//
// Reglas del estándar:
//   · el mes lo define la FECHA DE EMISIÓN (no el día de pago)
//   · solo boletas vigentes (las anuladas quedan fuera, las aplica el backend)
//   · una fila por boleta, RUT en formato XX.XXX.XXX-X
//   · las celdas sin clasificar salen vacías y RRHH las completa a mano
//
// Usa exceljs (no xlsx/SheetJS) porque necesitamos escribir estilos de celda
// (rellenos, negrita, bordes) para calzar visualmente con el Excel de RRHH —
// la edición community de SheetJS no soporta escritura de estilos.
import ExcelJS from 'exceljs'
import type { HonorarioReportRow } from '@/hooks/useReports'
import { CLP_FMT, MONTH_NAMES, periodoLabel, periodoSlug, toExcelDate } from './reportShared'

const HEADERS = [
  'Día de pago', 'Reembolsable', 'Contrato', 'Clasificacion interna',
  'Razón Social Interna', 'Fecha Emisión', 'Razón Social', 'Rut', 'Folio',
  'Monto Total', 'Pagado', 'Glosa',
] as const

const COL_WIDTHS = [11, 14.56, 33.44, 28.22, 12.67, 11, 29, 11, 11, 11, 11, 116.67]

// Columnas 1-based (según HEADERS)
const COL_DIA_PAGO = 1
const COL_FECHA_EM = 6
const COL_MONTO    = 10

const DIA_PAGO_FMT   = 'dd-mm-yy'
const FECHA_EMIS_FMT = 'd/m/yyyy'

// ── Estilos (calcados del Excel de referencia) ─────────────────────────────────

const BLACK_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  left:  { style: 'medium', color: { argb: 'FFCCCCCC' } },
  right: { style: 'medium', color: { argb: 'FFCCCCCC' } },
  top:   { style: 'medium', color: { argb: 'FFCCCCCC' } },
}

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Roboto' }
const DATA_FONT:   Partial<ExcelJS.Font> = { size: 12, color: { argb: 'FF000000' }, name: 'Roboto' }
const TOTAL_FONT:  Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: 'FF000000' }, name: 'Roboto' }

const HEADER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }
const CENTER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'center' }

export function buildHonorariosSheet(wb: ExcelJS.Workbook, rows: HonorarioReportRow[], month: number): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(MONTH_NAMES[month - 1])
  ws.properties.defaultRowHeight = 15
  ws.columns = COL_WIDTHS.map(width => ({ width }))

  const headerRow = ws.addRow([...HEADERS])
  headerRow.eachCell(cell => {
    cell.font      = HEADER_FONT
    cell.fill      = BLACK_FILL
    cell.border    = HEADER_BORDER
    cell.alignment = HEADER_ALIGN
  })

  for (const r of rows) {
    const row = ws.addRow([
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
    ])
    row.eachCell({ includeEmpty: true }, cell => { cell.font = DATA_FONT })
    row.getCell(2).alignment = CENTER_ALIGN
    row.getCell(COL_DIA_PAGO).numFmt = DIA_PAGO_FMT
    row.getCell(COL_FECHA_EM).numFmt = FECHA_EMIS_FMT
    row.getCell(COL_MONTO).numFmt    = CLP_FMT
  }

  // Fila de totales
  if (rows.length > 0) {
    const total = rows.reduce((s, r) => s + r.montoTotal, 0)
    const label = `TOTAL (${rows.length} boleta${rows.length !== 1 ? 's' : ''})`
    const totalRow = ws.addRow([null, null, null, null, null, null, null, null, label, total, null, null])
    totalRow.eachCell({ includeEmpty: true }, cell => { cell.font = TOTAL_FONT })
    totalRow.getCell(COL_MONTO).numFmt = CLP_FMT
  }

  ws.autoFilter = `A1:L${rows.length + 1}`
  return ws
}

export async function exportHonorariosToExcel(rows: HonorarioReportRow[], year: number, month: number) {
  const wb = new ExcelJS.Workbook()
  buildHonorariosSheet(wb, rows, month)
  const buffer = await wb.xlsx.writeBuffer()

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Honorarios-${periodoSlug(year, month)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return periodoLabel(year, month)
}
