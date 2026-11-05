// Reporte Excel del Presupuesto DPDO: hoja Resumen (segmentos y partidas elegidos) y hoja
// Detalle (documentos y rendiciones que componen el gasto). El Resumen usa fórmulas sobre el
// Detalle, así el archivo se puede filtrar o ajustar y sigue cuadrando.
import ExcelJS from 'exceljs'
import type { BudgetCategory, BudgetMovement } from '@/types'

const CLP = '$#,##0;-$#,##0;"-"'
const PCT = '0.0%'
const FONT = 'Arial'

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const NORMAL: Partial<ExcelJS.Font> = { name: FONT, size: 10 }
const BOLD_WHITE: Partial<ExcelJS.Font> = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
const HEADER_FILL = fill('FF000000')
const SEGMENT_FILL = fill('FF374151')
const TOTAL_FILL = fill('FF111827')

const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA: 'Consultoría',
}

const DETAIL_COLUMNS: [string, number][] = [
  ['Segmento', 28], ['Partida', 36], ['Tipo', 15], ['Fecha emisión', 12], ['Período tributario', 11],
  ['Trimestre', 10], ['Proveedor', 42], ['RUT', 13], ['Folio', 11], ['Razón social interna', 16],
  ['Monto', 14], ['Pagado', 8], ['Glosa', 80],
]

const SUMMARY_COLUMNS: [string, number][] = [
  ['Segmento / Partida', 46], ['Presupuestado', 15], ['Gastado', 15], ['Diferencia', 15], ['% ejecutado', 11],
  ['Q1', 14], ['Q2', 14], ['Q3', 14], ['Q4', 14], ['Promedio disponible por trimestre restante', 17],
]
const QUARTER_COLS = ['F', 'G', 'H', 'I']
const HEADER_ROW = 5

function styleHeader(row: ExcelJS.Row) {
  row.height = 42
  row.eachCell((cell, col) => {
    cell.font = BOLD_WHITE
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true }
  })
}

function buildDetail(wb: ExcelJS.Workbook, segments: BudgetCategory[], movements: BudgetMovement[]) {
  const ws = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false }] })
  ws.columns = DETAIL_COLUMNS.map(([, width]) => ({ width }))
  styleHeader(ws.addRow(DETAIL_COLUMNS.map(([h]) => h)))

  for (const seg of segments) {
    for (const item of seg.items) {
      const rows = movements
        .filter(m => m.itemId === item.id)
        .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      for (const m of rows) {
        const row = ws.addRow([
          seg.name, item.name, m.tipo, m.fecha ? new Date(m.fecha) : null, m.periodo, `Q${m.quarter}`,
          m.proveedor, m.rut, m.folio, m.legalEntity ? ENTITY_LABEL[m.legalEntity] ?? m.legalEntity : '',
          m.monto, m.pagado === null ? '' : m.pagado ? 'Sí' : 'No', m.glosa,
        ])
        row.font = NORMAL
        row.getCell(4).numFmt = 'dd/mm/yyyy'
        row.getCell(11).numFmt = CLP
      }
    }
  }

  const last = Math.max(ws.rowCount, 2)
  ws.autoFilter = `A1:M${last}`
  const total = ws.getRow(last + 1)
  total.getCell(10).value = 'Total visible'
  total.getCell(11).value = {
    formula: `SUBTOTAL(109,K2:K${last})`,
    result: movements.reduce((s, m) => s + m.monto, 0),
  }
  total.getCell(11).numFmt = CLP
  total.font = { ...NORMAL, bold: true }
  return last
}

// Valores de una fila del Resumen: las fórmulas llevan su resultado para que el archivo
// también se vea bien en vistas previas que no recalculan.
function writeCalcCols(ws: ExcelJS.Worksheet, r: number, annual: number, quarters: number[], remainingQ: number) {
  const spent = quarters.reduce((s, q) => s + q, 0)
  const diff = annual - spent
  ws.getCell(`C${r}`).value = { formula: `SUM(F${r}:I${r})`, result: spent }
  ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}`, result: diff }
  ws.getCell(`E${r}`).value = { formula: `IF(B${r}=0,"",C${r}/B${r})`, result: annual ? spent / annual : '' }
  ws.getCell(`J${r}`).value = { formula: `IF($B$3>0,D${r}/$B$3,0)`, result: remainingQ > 0 ? diff / remainingQ : 0 }
}

function styleSummaryRow(ws: ExcelJS.Worksheet, r: number, font: Partial<ExcelJS.Font>, rowFill?: ExcelJS.Fill) {
  for (let col = 1; col <= SUMMARY_COLUMNS.length; col++) {
    const cell = ws.getCell(r, col)
    cell.font = font
    if (rowFill) cell.fill = rowFill
    else cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
    if (col >= 2) {
      cell.numFmt = col === 5 ? PCT : CLP
      cell.alignment = { horizontal: 'right' }
    }
  }
}

function fillSummary(
  ws: ExcelJS.Worksheet,
  segments: BudgetCategory[],
  movements: BudgetMovement[],
  year: number,
  lastDetailRow: number,
  subtitle: string,
) {
  ws.columns = SUMMARY_COLUMNS.map(([, width]) => ({ width }))

  const today = new Date()
  const remainingQ = 4 - Math.floor(today.getMonth() / 3)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateLabel = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`
  ws.getCell('A1').value = `Presupuesto DPDO ${year}`
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true }
  ws.getCell('A2').value = `Datos al ${dateLabel} · ${subtitle}`
  ws.getCell('A2').font = { name: FONT, size: 10, color: { argb: 'FF6B7280' } }
  ws.getCell('A3').value = 'Trimestres restantes del año (incluye el actual)'
  ws.getCell('A3').font = NORMAL
  ws.getCell('B3').value = remainingQ
  ws.getCell('B3').font = { ...NORMAL, color: { argb: 'FF0000FF' } }
  ws.getCell('B3').alignment = { horizontal: 'right' }

  ws.getRow(HEADER_ROW).values = SUMMARY_COLUMNS.map(([h]) => h)
  styleHeader(ws.getRow(HEADER_ROW))

  const range = (col: string) => `Detalle!$${col}$2:$${col}$${lastDetailRow}`
  const quartersOf = (itemId: string) => [1, 2, 3, 4].map(q =>
    movements.filter(m => m.itemId === itemId && m.quarter === q).reduce((s, m) => s + m.monto, 0),
  )

  let r = HEADER_ROW + 1
  const segmentRows: number[] = []
  let totalAnnual = 0
  const totalQuarters = [0, 0, 0, 0]

  for (const seg of segments) {
    const segRow = r++
    segmentRows.push(segRow)
    ws.getCell(`A${segRow}`).value = seg.name
    let segAnnual = 0
    const segQuarters = [0, 0, 0, 0]

    for (const item of seg.items) {
      const quarters = quartersOf(item.id)
      ws.getCell(`A${r}`).value = item.name
      ws.getCell(`B${r}`).value = item.annualAmount
      QUARTER_COLS.forEach((col, i) => {
        ws.getCell(`${col}${r}`).value = {
          formula: `SUMIFS(${range('K')},${range('A')},$A$${segRow},${range('B')},$A${r},${range('F')},${col}$${HEADER_ROW})`,
          result: quarters[i],
        }
        segQuarters[i] += quarters[i]
      })
      writeCalcCols(ws, r, item.annualAmount, quarters, remainingQ)
      styleSummaryRow(ws, r, NORMAL)
      ws.getCell(`A${r}`).alignment = { indent: 2 }
      segAnnual += item.annualAmount
      r++
    }

    const first = segRow + 1
    const last = segRow + seg.items.length
    ws.getCell(`B${segRow}`).value = { formula: `SUM(B${first}:B${last})`, result: segAnnual }
    QUARTER_COLS.forEach((col, i) => {
      ws.getCell(`${col}${segRow}`).value = { formula: `SUM(${col}${first}:${col}${last})`, result: segQuarters[i] }
      totalQuarters[i] += segQuarters[i]
    })
    writeCalcCols(ws, segRow, segAnnual, segQuarters, remainingQ)
    styleSummaryRow(ws, segRow, BOLD_WHITE, SEGMENT_FILL)
    totalAnnual += segAnnual
  }

  const totalRow = r
  const sumSegments = (col: string) => segmentRows.map(s => `${col}${s}`).join('+')
  ws.getCell(`A${totalRow}`).value = 'TOTAL'
  ws.getCell(`B${totalRow}`).value = { formula: sumSegments('B'), result: totalAnnual }
  QUARTER_COLS.forEach((col, i) => {
    ws.getCell(`${col}${totalRow}`).value = { formula: sumSegments(col), result: totalQuarters[i] }
  })
  writeCalcCols(ws, totalRow, totalAnnual, totalQuarters, remainingQ)
  styleSummaryRow(ws, totalRow, BOLD_WHITE, TOTAL_FILL)

  // Sobregiros en rojo
  for (const col of ['D', 'J']) {
    ws.addConditionalFormatting({
      ref: `${col}${HEADER_ROW + 1}:${col}${totalRow}`,
      rules: [{
        type: 'cellIs', operator: 'lessThan', formulae: [0], priority: 1,
        style: { font: { color: { argb: 'FFF87171' }, bold: true } },
      }],
    })
  }

  const notes = [
    'Criterios',
    '• Gasto: BH, facturas y rendiciones imputadas a una partida, igual que la página Presupuesto DPDO de GDP.',
    '• Excluye documentos anulados y notas de crédito cuya factura de referencia no está en GDP.',
    '• Las notas de crédito restan. El trimestre sale del período tributario (o de la fecha de emisión si no lo tiene).',
    '• Presupuestado: monto anual de cada partida en GDP. Los gastos se calculan desde la hoja Detalle.',
    `• Solo incluye lo cargado desde Smart hasta el ${dateLabel}: el trimestre en curso puede estar incompleto.`,
  ]
  notes.forEach((text, i) => {
    const cell = ws.getCell(`A${totalRow + 2 + i}`)
    cell.value = text
    cell.font = { name: FONT, size: 9, bold: i === 0, color: { argb: 'FF4B5563' } }
  })
}

// Arma el libro solo con las partidas elegidas; un segmento sin partidas elegidas no aparece.
export function buildBudgetWorkbook(
  categories: BudgetCategory[],
  selectedItemIds: Set<string>,
  movements: BudgetMovement[],
  year: number,
): ExcelJS.Workbook {
  const segments = categories
    .map(c => ({ ...c, items: c.items.filter(i => selectedItemIds.has(i.id)) }))
    .filter(c => c.items.length > 0)
  const selected = movements.filter(m => selectedItemIds.has(m.itemId))

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)
  const selectedItems = segments.reduce((s, c) => s + c.items.length, 0)
  const subtitle = selectedItems === totalItems
    ? 'Todas las partidas'
    : `Selección: ${selectedItems} de ${totalItems} partidas`

  const wb = new ExcelJS.Workbook()
  wb.calcProperties.fullCalcOnLoad = true
  // Resumen queda como primera hoja, aunque se llena después porque sus fórmulas dependen del Detalle
  const summary = wb.addWorksheet('Resumen', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const lastDetailRow = buildDetail(wb, segments, selected)
  fillSummary(summary, segments, selected, year, lastDetailRow, subtitle)
  return wb
}

export async function downloadBudgetExcel(
  categories: BudgetCategory[],
  selectedItemIds: Set<string>,
  movements: BudgetMovement[],
  year: number,
) {
  const wb = buildBudgetWorkbook(categories, selectedItemIds, movements, year)
  const buffer = await wb.xlsx.writeBuffer()
  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Presupuesto-DPDO-${year}${selectedItemIds.size < totalItems ? '-seleccion' : ''}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
