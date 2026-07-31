import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const normRut = (s: string) => String(s).replace(/[.\s]/g, '').replace(/-/g, '').toUpperCase()

async function main() {
  const wb = XLSX.readFile('G:/Unidades compartidas/GDP/Surmedia RRHH/Compensaciones/Honorarios/Reporte Honorarios 21-07.xlsx')
  const report: { rut: string; folio: string; sheet: string }[] = []
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], { defval: '' })
    for (const r of rows) if (String(r['Rut']).trim()) report.push({ rut: String(r['Rut']).trim(), folio: String(r['Folio']).trim(), sheet: sn })
  }
  console.log('Filas reporte:', report.length)

  // Traer todos los honorarios de la DB con campos relevantes
  const docs = await prisma.smartDocument.findMany({
    where: { category: 'HONORARIO' },
    select: { folio: true, tipo: true, categoria: true, clasificacion: true,
      proveedor: { select: { rut: true, razonSocial: true, clasificacion: true, area: true, categoria: true } } },
  })
  const byKey = new Map<string, typeof docs[number]>()
  for (const d of docs) byKey.set(`${normRut(d.proveedor.rut)}|${d.folio ?? ''}`, d)

  let matched = 0
  const tipoVals = new Set<string>(), catVals = new Set<string>(), provClasVals = new Set<string>()
  console.log('\nMuestra de matches (report -> GDP):')
  let shown = 0
  for (const r of report) {
    const d = byKey.get(`${normRut(r.rut)}|${r.folio}`)
    if (!d) continue
    matched++
    if (d.tipo) tipoVals.add(d.tipo)
    if (d.categoria) catVals.add(d.categoria)
    if (d.proveedor.clasificacion) provClasVals.add(d.proveedor.clasificacion)
    if (shown++ < 12) console.log(`  ${r.rut}/${r.folio}: tipo=${JSON.stringify(d.tipo)} docCat=${JSON.stringify(d.categoria)} provClasif=${JSON.stringify(d.proveedor.clasificacion)} provArea=${JSON.stringify(d.proveedor.area)} provCat=${JSON.stringify(d.proveedor.categoria)}`)
  }
  console.log(`\nMatched ${matched}/${report.length}`)
  console.log('Valores doc.tipo:', [...tipoVals])
  console.log('Valores doc.categoria:', [...catVals])
  console.log('Valores proveedor.clasificacion:', [...provClasVals])
}
main().catch(console.error).finally(() => prisma.$disconnect())
