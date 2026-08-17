// Reporte mensual de Remuneraciones — formato estándar Surmedia.
//
// Layout (replica exactamente el informe que arma RRHH a mano, estilos incluidos):
//   · hoja "Remuneraciones": solo la tabla de datos, encabezados en la fila 1
//   · hoja "Resumen": dashboard aparte, columnas B (etiqueta) y C (valor),
//     con fórmulas que apuntan a la hoja "Remuneraciones"
//
// Reglas del estándar:
//   · una fila por colaborador × centro de trabajo, ponderación 1/n centros
//   · los montos ya vienen ponderados por esa fracción
//   · las columnas de reembolsables (bonos NR/R, HH extras) salen vacías/en NR:
//     las ajusta RRHH a mano, no se auto-clasifican por nombre de ítem
//   · el dashboard es 100% fórmulas (nada de valores pegados)
//
// Usa exceljs (no xlsx/SheetJS) porque necesitamos escribir estilos de celda
// (rellenos, negrita, bordes) para calzar visualmente con el Excel de RRHH —
// la edición community de SheetJS no soporta escritura de estilos.
import ExcelJS from 'exceljs'
import type { PayrollRawEntry, LegalEntity, EmployeeStatus } from '@/types'
import { aggregateWCRows, LEGAL_ENTITY_LABEL } from '@/pages/workCenters/wcUtils'
import { CLP_FMT, periodoLabel, periodoSlug } from './reportShared'

const HEADERS = [
  'Razón Social',
  'Estado',
  'Centro',
  'Colaborador',
  'RUT',
  'Cargo',
  'Ponderación',
  'Sueldo bruto ponderado',
  'Sueldo estándar ponderado',
  'Total bonos  NR',
  'Total Bonos R',
  'Bonos identificados',
  'HH Reembolsable ',
  'Total HH extra',
  'HH extra identificadas',
] as const

// Letras de columna de la tabla (hoja "Remuneraciones"), en el mismo orden que HEADERS
const COL = {
  razonSocial: 'A', estado: 'B', centro: 'C', colaborador: 'D', rut: 'E', cargo: 'F',
  ponderacion: 'G', bruto: 'H', estandar: 'I',
  bonosNR: 'J', bonosR: 'K', bonosNames: 'L',
  hhFlag: 'M', hh: 'N', hhDetail: 'O',
} as const

// Columnas con montos CLP (1-based): H, I, J, K, N
const CLP_COL_NUMBERS = [8, 9, 10, 11, 14]

const COL_WIDTHS = [16.75, 10.75, 24.75, 28.75, 12.25, 22, 17.5, 27.6, 30.4, 20.2, 18.5, 19.5, 22.6, 14.75, 45.3]

// ── Estilos (calcados del Excel de referencia) ─────────────────────────────────

const ACCOUNTING_FMT = '_ "$"* #,##0_ ;_ "$"* -#,##0_ ;_ "$"* "-"_ ;_ @_ '

const BLACK_FILL:    ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }
const DARKGRAY_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF262626' } }
const WHITE_FILL:    ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }

const MEDIUM: ExcelJS.Border = { style: 'medium', color: { argb: 'FF000000' } }
const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' }

const HEADER_FONT:       Partial<ExcelJS.Font> = { bold: true,  size: 12, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
const DATA_FONT:         Partial<ExcelJS.Font> = { size: 12,               color: { argb: 'FF000000' }, name: 'Calibri' }
const TITLE_FONT:        Partial<ExcelJS.Font> = { bold: true,  size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
const BLOCK_HEADER_FONT: Partial<ExcelJS.Font> = { bold: true,  size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
const LABEL_FONT:        Partial<ExcelJS.Font> = { bold: true,  size: 12, color: { argb: 'FF000000' }, name: 'Calibri' }
const VALUE_FONT:        Partial<ExcelJS.Font> = { size: 12,               color: { argb: 'FF000000' }, name: 'Calibri' }

function estadoLabel(status: EmployeeStatus): string {
  return status === 'ACTIVE' || status === 'ON_LEAVE' ? 'Activo' : 'Inactivo'
}

export interface RemuneracionRow {
  razonSocial: string
  estado:      string
  centro:      string
  nombre:      string
  rut:         string
  cargo:       string
  ponderacion: number
  bruto:       number
  estandar:    number
  bonos:       number
  hh:          number
  bonosNames:  string
  hhDetail:    string
}

/** Expande las liquidaciones del mes a una fila por colaborador × centro. */
export function buildRemuneracionRows(entries: PayrollRawEntry[]): RemuneracionRow[] {
  const rows: RemuneracionRow[] = []

  for (const agg of aggregateWCRows(entries, true)) {
    const centros = agg.centers && agg.centers !== '—'
      ? agg.centers.split(', ').map(c => c.trim()).filter(Boolean)
      : ['—']

    for (const centro of centros) {
      rows.push({
        razonSocial: LEGAL_ENTITY_LABEL[agg.legalEntity as LegalEntity] ?? agg.legalEntity,
        estado:      estadoLabel(agg.status),
        centro,
        nombre:      agg.employeeName,
        rut:         agg.rut,
        cargo:       agg.jobTitle,
        ponderacion: Math.round(agg.ponderacion * 100),
        bruto:       Math.round(agg.grossSalary    * agg.ponderacion),
        estandar:    Math.round(agg.sueldoEstandar * agg.ponderacion),
        bonos:       Math.round(agg.bonosTotal     * agg.ponderacion),
        hh:          Math.round(agg.hhTotal        * agg.ponderacion),
        bonosNames:  agg.bonosNames,
        hhDetail:    agg.hhDetail,
      })
    }
  }

  // Razón Social → Centro → Colaborador
  rows.sort((a, b) =>
    a.razonSocial.localeCompare(b.razonSocial, 'es') ||
    a.centro.localeCompare(b.centro, 'es') ||
    a.nombre.localeCompare(b.nombre, 'es')
  )
  return rows
}

/** Hoja "Remuneraciones": tabla de datos con estilo (header negro, autofiltro). */
function buildDataSheet(wb: ExcelJS.Workbook, rows: RemuneracionRow[]): void {
  const ws = wb.addWorksheet('Remuneraciones', { views: [{ zoomScale: 70 }] })
  ws.properties.defaultRowHeight = 15
  ws.columns = COL_WIDTHS.map(width => ({ width }))

  const headerRow = ws.addRow([...HEADERS])
  headerRow.eachCell(cell => {
    cell.font      = HEADER_FONT
    cell.fill      = BLACK_FILL
    cell.alignment = CENTER
  })

  for (const r of rows) {
    const row = ws.addRow([
      r.razonSocial, r.estado, r.centro, r.nombre, r.rut, r.cargo, r.ponderacion,
      r.bruto, r.estandar,
      r.bonos, null,   // Total bonos NR (por defecto todo acá) / Total Bonos R — RRHH mueve montos a mano
      r.bonosNames,
      null, r.hh,      // HH Reembolsable (flag, se marca a mano) / Total HH extra
      r.hhDetail,
    ])
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = DATA_FONT
      cell.fill = WHITE_FILL
      if (CLP_COL_NUMBERS.includes(colNumber)) cell.numFmt = CLP_FMT
    })
  }

  ws.autoFilter = `A1:O${rows.length + 1}`
}

interface DashItem { label: string; formula?: string }

/** Hoja "Resumen": dashboard 100% fórmulas + estilo de bloques (título/gris oscuro/blanco). */
function buildResumenSheet(wb: ExcelJS.Workbook, rows: RemuneracionRow[], year: number, month: number): void {
  const last = rows.length + 1 // última fila con datos en "Remuneraciones"
  const R    = (col: string) => `Remuneraciones!$${col}$2:$${col}$${last}`
  const sumOf  = (col: string) => `SUM(${R(col)})`
  const byRS   = (rs: string, col: string) => `SUMIF(${R(COL.razonSocial)},"${rs}",${R(col)})`
  const byFlag = (flag: string, col: string) => `SUMIF(${R(flag)},"Sí",${R(col)})`

  const blocks: DashItem[][] = []

  blocks.push([
    { label: 'TOTALES SUELDOS BRUTOS', formula: sumOf(COL.bruto) },
    { label: 'COMUNICACIONES',         formula: byRS('Comunicaciones', COL.bruto) },
    { label: 'CONSULTORÍA',            formula: byRS('Consultoría',    COL.bruto) },
  ])
  // Bonos: suma de las dos columnas (NR + R), por razón social
  blocks.push([
    { label: 'TOTALES BONOS',  formula: `${sumOf(COL.bonosNR)}+${sumOf(COL.bonosR)}` },
    { label: 'COMUNICACIONES', formula: `${byRS('Comunicaciones', COL.bonosNR)}+${byRS('Comunicaciones', COL.bonosR)}` },
    { label: 'CONSULTORÍA',    formula: `${byRS('Consultoría',    COL.bonosNR)}+${byRS('Consultoría',    COL.bonosR)}` },
  ])
  blocks.push([
    { label: 'TOTALES HORAS EXTRAS', formula: sumOf(COL.hh) },
    { label: 'COMUNICACIONES',       formula: byRS('Comunicaciones', COL.hh) },
    { label: 'CONSULTORÍA',          formula: byRS('Consultoría',    COL.hh) },
  ])

  // Reembolsables: Total Bonos R ya es el monto reembolsable; HH depende del flag manual.
  // Fila 1 en blanco + fila 2 título + 3 filas por cada bloque anterior.
  const rowsBeforeReemb = 2 + blocks.reduce((n, b) => n + b.length, 0)
  const reembBonosRow = rowsBeforeReemb + 2
  const reembHHRow    = rowsBeforeReemb + 3
  blocks.push([
    { label: 'TOTAL REEMBOLSABLES', formula: `C${reembBonosRow}+C${reembHHRow}` },
    { label: 'BONOS',               formula: sumOf(COL.bonosR) },
    { label: 'HH EXTRAS',           formula: byFlag(COL.hhFlag, COL.hh) },
  ])

  // Sueldo bruto ponderado por centro de trabajo
  const centros = [...new Set(rows.map(r => r.centro))].sort((a, b) => a.localeCompare(b, 'es'))
  const rowsBeforeCentro = rowsBeforeReemb + 3
  const firstCentroRow   = rowsBeforeCentro + 2
  const lastCentroRow    = firstCentroRow + centros.length - 1
  blocks.push([
    {
      label:   'SUELDO BRUTO PONDERADO POR CENTRO DE TRABAJO',
      formula: centros.length > 0 ? `SUM(C${firstCentroRow}:C${lastCentroRow})` : '0',
    },
    ...centros.map(centro => ({
      label:   centro,
      formula: `SUMIF(${R(COL.centro)},"${centro.replace(/"/g, '""')}",${R(COL.bruto)})`,
    })),
  ])

  // ── Escritura ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Resumen')
  ws.columns = [{ width: 3.5 }, { width: 56 }, { width: 20.6 }]

  ws.addRow([]) // fila 1 en blanco

  const titleRow = ws.addRow([null, `DASHBOARD — REMUNERACIONES ${periodoLabel(year, month).toUpperCase()}`, null])
  const tB = titleRow.getCell(2)
  const tC = titleRow.getCell(3)
  tB.font = TITLE_FONT; tB.fill = BLACK_FILL; tB.alignment = CENTER; tB.border = { top: MEDIUM, left: MEDIUM }
  tC.border = { top: MEDIUM, right: MEDIUM }
  ws.mergeCells('B2:C2')

  for (const block of blocks) {
    block.forEach((item, i) => {
      const isLast = i === block.length - 1
      const isHeader = i === 0
      const row = ws.addRow([null, item.label, null])
      const b = row.getCell(2)
      const c = row.getCell(3)

      if (isHeader) {
        b.font = BLOCK_HEADER_FONT; b.fill = DARKGRAY_FILL; b.alignment = CENTER
        c.font = BLOCK_HEADER_FONT; c.fill = DARKGRAY_FILL; c.alignment = CENTER; c.numFmt = ACCOUNTING_FMT
        b.border = { top: MEDIUM, left: MEDIUM, bottom: MEDIUM }
        c.border = { top: MEDIUM, right: MEDIUM, bottom: MEDIUM }
      } else {
        b.font = LABEL_FONT; b.fill = WHITE_FILL
        c.font = VALUE_FONT; c.fill = WHITE_FILL; c.numFmt = CLP_FMT
        b.border = { left: MEDIUM, ...(isLast ? { bottom: MEDIUM } : {}) }
        c.border = { right: MEDIUM, ...(isLast ? { bottom: MEDIUM } : {}) }
      }
      if (item.formula) c.value = { formula: item.formula, result: 0 }
    })
  }
}

async function buildWorkbook(rows: RemuneracionRow[], year: number, month: number): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  buildDataSheet(wb, rows)
  buildResumenSheet(wb, rows, year, month)
  return wb
}

export async function exportRemuneracionesToExcel(entries: PayrollRawEntry[], year: number, month: number) {
  const rows   = buildRemuneracionRows(entries)
  const wb     = await buildWorkbook(rows, year, month)
  const buffer = await wb.xlsx.writeBuffer()

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Remuneraciones-${periodoSlug(year, month)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return rows.length
}
