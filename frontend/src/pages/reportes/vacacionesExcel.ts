// Reporte de Saldo de Vacaciones — mismas columnas base que el reporte que
// RRHH ya usaba (RUT, Nombre, Razón Social, Cargo, Período, Días Vacaciones
// Disponibles, Días Administrativos), con 4 columnas nuevas al final para el
// descuento de vacaciones ya aprobadas cuyo período todavía no ocurre.
// Header negro / texto blanco, mismo estilo que Honorarios.
//
// Regla del estándar (ver memoria del proyecto "vacaciones-aprobadas-libro-vacacion"):
//   · "Días Vacaciones Disponibles" = saldoLegal + saldoProgresivas de BUK
//   · se descuentan los días de vacaciones ya APROBADAS (Libro "Vacación" de BUK)
//     cuyo período todavía no ocurre — separado por tipo (Vacaciones vs Administrativos)
import ExcelJS from 'exceljs'
import type { VacacionReportRow } from '@/hooks/useReports'

const HEADERS = [
  'RUT', 'Nombre', 'Razón Social', 'Cargo', 'Período',
  'Días Vacaciones Disponibles', 'Días Administrativos',
  'Vacaciones Aprobadas Pendientes', 'Administrativos Aprobados Pendientes',
  'Vacaciones Disponibles (Ajustado)', 'Días Administrativos (Ajustado)',
] as const

const COL_WIDTHS = [14, 28, 24, 28, 10, 14, 14, 16, 18, 16, 16]

const NUM_FMT = '0.0'
const COLS_NUM = [6, 7, 8, 9, 10, 11] // 1-based

const BLACK_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Roboto' }
const DATA_FONT:   Partial<ExcelJS.Font> = { size: 12, color: { argb: 'FF000000' }, name: 'Roboto' }
const HEADER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }

function buildSheet(wb: ExcelJS.Workbook, rows: VacacionReportRow[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Saldos de Vacaciones')
  ws.properties.defaultRowHeight = 15
  ws.columns = COL_WIDTHS.map(width => ({ width }))

  const headerRow = ws.addRow([...HEADERS])
  headerRow.eachCell(cell => {
    cell.font      = HEADER_FONT
    cell.fill      = BLACK_FILL
    cell.alignment = HEADER_ALIGN
  })

  for (const r of rows) {
    const row = ws.addRow([
      r.rut, r.nombre, r.razonSocial, r.cargo, r.periodo,
      r.diasVacacionesDisponibles, r.diasAdministrativos,
      r.pendienteVacaciones, r.pendienteAdmin,
      r.diasVacacionesAjustado, r.diasAdministrativosAjustado,
    ])
    row.eachCell({ includeEmpty: true }, cell => { cell.font = DATA_FONT })
    for (const c of COLS_NUM) row.getCell(c).numFmt = NUM_FMT
  }

  ws.autoFilter = `A1:K${rows.length + 1}`
  return ws
}

export async function exportVacacionesToExcel(rows: VacacionReportRow[], asOfDate: string) {
  const wb = new ExcelJS.Workbook()
  buildSheet(wb, rows)
  const buffer = await wb.xlsx.writeBuffer()

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Saldo-Vacaciones-${asOfDate}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return rows.length
}
