import * as XLSX from 'xlsx'
const wb = XLSX.readFile('G:/Unidades compartidas/GDP/Surmedia RRHH/Compensaciones/Honorarios/Reporte Honorarios 21-07.xlsx')
console.log('Hojas:', wb.SheetNames)
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  console.log(`\n===== HOJA "${sn}" — ${rows.length} filas =====`)
  if (rows.length) {
    console.log('Columnas:', Object.keys(rows[0]))
    console.log('\nPrimeras filas:')
    rows.slice(0, 5).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)))
  }
}
