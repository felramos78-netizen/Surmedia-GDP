/**
 * Importa solo vacaciones y licencias (fases 3 y 4).
 * Uso: npx tsx --env-file=.env scripts/import-vacaciones.ts
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()
const REPORTES_DIR = path.join(__dirname, '..', 'reportes')

function excelDate(val: unknown): Date | null {
  if (!val || typeof val !== 'number' || val < 1) return null
  return new Date((val - 25569) * 86400000)
}

function readBukSheet(filePath: string) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][]
  const headers = (all[5] ?? []) as string[]
  const rows = all.slice(6).filter((r: any[]) => r.some((v: any) => v != null))
  return { headers, rows }
}

function col(headers: string[], row: any[], key: string): any {
  const idx = headers.indexOf(key)
  return idx >= 0 ? row[idx] : undefined
}

async function importVacacionesTomadas(folder: string) {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Vacaciones tomadas') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Vacaciones tomadas`); return }

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Vacaciones tomadas: ${rows.length} filas — ${file}`)

  const allEmployees = await prisma.employee.findMany({ select: { id: true, rut: true } })
  const rutMap = new Map(allEmployees.map(e => [e.rut, e.id]))

  const leaves: any[] = []
  for (const row of rows) {
    const rut        = col(headers, row, 'Empleado - Número de Documento') as string
    const inicioVal  = col(headers, row, 'Vacaciones - Inicio (inclusive)')
    const terminoVal = col(headers, row, 'Vacaciones - Término (inclusive)')
    if (!rut || !inicioVal) continue

    const employeeId = rutMap.get(rut)
    if (!employeeId) continue

    const startDate = excelDate(inicioVal)
    const endDate   = excelDate(terminoVal) ?? startDate
    if (!startDate || !endDate) continue

    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    leaves.push({ employeeId, type: 'VACACIONES', startDate, endDate, days, status: 'APPROVED' })
  }

  if (leaves.length > 0) await prisma.leave.createMany({ data: leaves })
  console.log(`  ✓ creados: ${leaves.length}`)
}

async function importLicencias(folder: string) {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Vacaciones y licencia') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Vacaciones y licencia`); return }

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Vacaciones y licencia: ${rows.length} filas — ${file}`)

  const yearMatch = file.match(/(\d{4})-\d{2}-\d{2}\.xlsx$/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2026

  const allEmployees = await prisma.employee.findMany({ select: { id: true, rut: true } })
  const rutMap = new Map(allEmployees.map(e => [e.rut, e.id]))

  const leaves: any[] = []
  for (const row of rows) {
    const rut     = col(headers, row, 'Empleado - Número de Documento') as string
    const mes     = col(headers, row, 'Variables Mensuales - Mes de Cálculo') as number
    const diasLic = col(headers, row, 'Liquidación - Días de Licencias (Aplicadas)') as number
    if (!rut || !mes || !diasLic || diasLic <= 0) continue

    const employeeId = rutMap.get(rut)
    if (!employeeId) continue

    const startDate = new Date(Date.UTC(year, mes - 1, 1))
    const endDate   = new Date(Date.UTC(year, mes - 1, Math.min(diasLic, 28)))
    leaves.push({
      employeeId, type: 'LICENCIA_MEDICA', startDate, endDate,
      days: diasLic, status: 'APPROVED',
      reason: `Licencia médica mes ${mes}/${year}`,
    })
  }

  if (leaves.length > 0) await prisma.leave.createMany({ data: leaves })
  console.log(`  ✓ creados: ${leaves.length}`)
}

async function main() {
  const folders = fs.readdirSync(REPORTES_DIR).filter(f =>
    fs.statSync(path.join(REPORTES_DIR, f)).isDirectory()
  )

  console.log('\n═══ FASE 3: VACACIONES TOMADAS ═══')
  for (const folder of folders) await importVacacionesTomadas(folder)

  console.log('\n═══ FASE 4: LICENCIAS MÉDICAS ═══')
  for (const folder of folders) await importLicencias(folder)

  const leaves = await prisma.leave.count()
  console.log(`\n✓ leaves totales: ${leaves}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
