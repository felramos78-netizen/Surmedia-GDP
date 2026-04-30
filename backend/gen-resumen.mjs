import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// ── Clientes en el orden que pidió el usuario ────────────────────────────────
const CLIENTES = [
  'CODELCO DET',
  'CODELCO CORP',
  'GELNCORE',
  'CASERONES',
  'CANDELARIA',
  'CMP',
  'AMSA ZALDIVAR',
  'AMSA ANTUCOYA',
  'AMSA CENTINELLA',
  'AMNSA NUEVA CENTINELLA',
  'BHP MEL',
  'BHP SINDICAL',
  'BHP HSEC',
  'BHP SALAR',
  'BHP P&f',
  'CEIM',
  'FME',
  'ANGAMOS',
  'SQM',
  'KINROSS + LOBO MARTE',
]

// ── Consulta la BD ───────────────────────────────────────────────────────────
const [centers, payrollEntries] = await Promise.all([
  prisma.workCenter.findMany({
    include: {
      ingresos: true,
      assignments: { distinct: ['employeeId'] },
    },
  }),
  prisma.payrollEntry.findMany({
    where: { year: 2026 },
    include: {
      employee: {
        include: { workCenters: { include: { workCenter: true } } },
      },
    },
  }),
])

// Print DB work center names for matching reference
console.log('\nCentros en BD:')
centers.forEach(c => console.log(' -', JSON.stringify(c.name)))

// ── Compute gross salary per work center (ponderado) ────────────────────────
const gastoByCenter = new Map()

for (const e of payrollEntries) {
  const wcs = e.employee.workCenters.filter(a => a.legalEntity === e.legalEntity)
  if (!wcs.length) continue
  const portion = e.grossSalary / wcs.length
  for (const a of wcs) {
    const name = a.workCenter.name
    gastoByCenter.set(name, (gastoByCenter.get(name) ?? 0) + portion)
  }
}

// ── Compute dotación per work center ────────────────────────────────────────
const dotacionByCenter = new Map()
for (const c of centers) {
  dotacionByCenter.set(c.name, new Set(c.assignments.map(a => a.employeeId)).size)
}

// ── Compute ingresos per work center ────────────────────────────────────────
const ingresosByCenter = new Map()
for (const c of centers) {
  ingresosByCenter.set(c.name, c.ingresos.reduce((s, i) => s + i.amount, 0))
}

// ── Fuzzy match: find closest DB center name for each cliente ────────────────
function normalize(s) {
  return s.toLowerCase()
    .replace(/[áä]/g, 'a').replace(/[éë]/g, 'e').replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o').replace(/[úü]/g, 'u')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function bestMatch(query, candidates) {
  const q = normalize(query)
  let best = null, bestScore = 0
  for (const c of candidates) {
    const n = normalize(c)
    // Token overlap score
    const qt = new Set(q.split(' '))
    const nt = new Set(n.split(' '))
    const inter = [...qt].filter(t => nt.has(t)).length
    const score = inter / Math.max(qt.size, nt.size)
    if (score > bestScore) { bestScore = score; best = c }
  }
  return bestScore >= 0.3 ? best : null
}

const dbNames = centers.map(c => c.name)

// ── Build rows ───────────────────────────────────────────────────────────────
const CLPfmt = '$#,##0'
const PCTfmt = '0.0%'

// We'll use a 2D array so we can apply formulas and formats precisely
// Columns: A=CLIENTE, B=INGRESO, C=DOTACIÓN, D=RENTAS EQUIPO, E=GASTOS OP, F=TOTAL COSTOS, G=UTILIDAD, H=PORCENTAJE

const wb = XLSX.utils.book_new()
const wsData = []

// Header row
wsData.push([
  'CLIENTE', 'INGRESO', 'DOTACIÓN', 'RENTAS EQUIPO',
  'GASTOS OP', 'TOTAL COSTOS', 'UTILIDAD', 'PORCENTAJE',
])

const dataStartRow = 2 // 1-indexed, row 2 is first data row

const matchLog = []
let row = dataStartRow

for (const cliente of CLIENTES) {
  const matched = bestMatch(cliente, dbNames)
  const dotacion   = matched ? (dotacionByCenter.get(matched) ?? '') : ''
  const rentas     = matched ? Math.round(gastoByCenter.get(matched) ?? 0) : ''
  const ingresos   = matched ? Math.round(ingresosByCenter.get(matched) ?? 0) : ''

  matchLog.push({ cliente, matched: matched ?? '(sin match)', dotacion, rentas, ingresos })

  // Formulas (1-indexed columns: B=2, D=4, E=5, F=6, G=7, H=8)
  const colB = XLSX.utils.encode_cell({ r: row - 1, c: 1 }) // INGRESO
  const colD = XLSX.utils.encode_cell({ r: row - 1, c: 3 }) // RENTAS
  const colE = XLSX.utils.encode_cell({ r: row - 1, c: 4 }) // GASTOS OP
  const fTotalCostos = `=${colD}+${colE}`                    // F = D + E
  const fUtilidad    = `=${colB}-F${row}`                    // G = B - F
  const fPct         = `=IF(${colB}>0,G${row}/${colB},"")`  // H = G/B

  wsData.push([
    cliente,
    ingresos || '',  // INGRESO: from DB if available, else blank
    dotacion,
    rentas || '',
    '',              // GASTOS OP: blank (user fills)
    { f: fTotalCostos },
    { f: fUtilidad },
    { f: fPct },
  ])
  row++
}

// Totals row
const lastData = row - 1
wsData.push([
  'TOTAL',
  { f: `=SUM(B${dataStartRow}:B${lastData})` },
  { f: `=SUM(C${dataStartRow}:C${lastData})` },
  { f: `=SUM(D${dataStartRow}:D${lastData})` },
  { f: `=SUM(E${dataStartRow}:E${lastData})` },
  { f: `=SUM(F${dataStartRow}:F${lastData})` },
  { f: `=SUM(G${dataStartRow}:G${lastData})` },
  { f: `=IF(B${row}>0,G${row}/B${row},"")` },
])

const ws = XLSX.utils.aoa_to_sheet(wsData)

// Column widths
ws['!cols'] = [
  { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 18 },
  { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
]

// Apply number formats
const totalRows = wsData.length
for (let r = 1; r < totalRows; r++) {   // skip header (r=0)
  for (const c of [1, 3, 4, 5, 6]) {    // B, D, E, F, G (0-indexed)
    const addr = XLSX.utils.encode_cell({ r, c })
    if (!ws[addr]) ws[addr] = { t: 'n', v: 0 }
    ws[addr].z = CLPfmt
  }
  // UTILIDAD (col 6 = G)
  const gu = XLSX.utils.encode_cell({ r, c: 6 })
  if (ws[gu]) ws[gu].z = CLPfmt
  // PORCENTAJE (col 7 = H)
  const ph = XLSX.utils.encode_cell({ r, c: 7 })
  if (ws[ph]) ws[ph].z = PCTfmt
}

// Freeze header row
ws['!freeze'] = { xSplit: 0, ySplit: 1 }

XLSX.utils.book_append_sheet(wb, ws, 'Resumen Clientes')
const outPath = 'C:/Users/Felipe/Desktop/resumen-clientes-2026.xlsx'
XLSX.writeFile(wb, outPath)

// Print match log
console.log('\n── Match log ─────────────────────────────────────────────────────')
for (const m of matchLog) {
  console.log(`  ${m.cliente.padEnd(28)} → ${(m.matched ?? '(sin match)').padEnd(30)} dotación=${m.dotacion}  rentas=${m.rentas}  ingresos=${m.ingresos}`)
}

console.log(`\nArchivo generado: ${outPath}`)
await prisma.$disconnect()
