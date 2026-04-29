/**
 * Script de importación inicial desde reportes BUK exportados a Excel.
 * Lee Dotación y Sueldos de ambas razones sociales y upserta en la DB.
 *
 * Uso: npx tsx --env-file=.env scripts/import-reportes.ts
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()
const REPORTES_DIR = path.join(__dirname, '..', 'reportes')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Excel serial → JS Date (UTC). Retorna null si no es número válido. */
function excelDate(val: unknown): Date | null {
  if (!val || typeof val !== 'number' || val < 1) return null
  return new Date((val - 25569) * 86400000)
}

function toLegalEntity(nombre: string): 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA' {
  const n = (nombre ?? '').toLowerCase()
  return n.includes('consult') ? 'SURMEDIA_CONSULTORIA' : 'COMUNICACIONES_SURMEDIA'
}

function toStatus(estado: string): 'ACTIVE' | 'INACTIVE' {
  return (estado ?? '').toLowerCase().trim() === 'activo' ? 'ACTIVE' : 'INACTIVE'
}

function toContractType(tipo: string): 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA' {
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('indefinido')) return 'INDEFINIDO'
  if (t.includes('plazo'))      return 'PLAZO_FIJO'
  if (t.includes('honorario'))  return 'HONORARIOS'
  if (t.includes('prác') || t.includes('prac')) return 'PRACTICA'
  return 'INDEFINIDO'
}

/** Lee un xlsx y retorna [headers, ...dataRows], saltando las primeras 5 filas de metadata BUK. */
function readBukSheet(filePath: string): { headers: string[]; rows: any[][] } {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][]
  const headers = (all[5] ?? []) as string[]
  const rows = all.slice(6).filter(r => r.some(v => v != null))
  return { headers, rows }
}

function col(headers: string[], row: any[], key: string): any {
  const idx = headers.indexOf(key)
  return idx >= 0 ? row[idx] : undefined
}

// ─── Import Dotación ──────────────────────────────────────────────────────────

async function importDotacion(folder: string): Promise<void> {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Dotación') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Dotación`); return }

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Dotación: ${rows.length} filas — ${file}`)

  let created = 0, updated = 0, errors = 0

  for (const row of rows) {
    const rut = col(headers, row, 'Empleado - Número de Documento') as string
    if (!rut) continue

    const empresaNombre  = col(headers, row, 'Empresa - Nombre Empresa') as string
    const legalEntity    = toLegalEntity(empresaNombre)
    const status         = toStatus(col(headers, row, 'Empleado - Estado'))
    const firstName      = (col(headers, row, 'Empleado - Nombre') as string)?.trim() ?? ''
    const apellido1      = (col(headers, row, 'Empleado - Apellido') as string)?.trim() ?? ''
    const apellido2      = (col(headers, row, 'Empleado - Segundo Apellido') as string)?.trim() ?? ''
    const lastName       = [apellido1, apellido2].filter(Boolean).join(' ')
    const rawEmail       = (col(headers, row, 'Empleado - Email') as string)?.trim()?.toLowerCase()
    const email          = rawEmail || `${rut.replace(/[^0-9kK]/g, '')}@surmedia.cl`
    const personalEmail  = (col(headers, row, 'Empleado - Email Personal') as string)?.trim() || null
    const phone          = String(col(headers, row, 'Empleado - Teléfono Particular') ?? '').trim() || null
    const birthDate      = excelDate(col(headers, row, 'Empleado - Fecha de Nacimiento'))
    const startDateSerial = col(headers, row, 'Trabajo - Fecha Ingreso Compañía')
    const endDateSerial  = col(headers, row, 'Trabajo - Fecha Vencimiento Contrato')
    const startDate      = excelDate(startDateSerial) ?? new Date('2020-01-01')
    const endDate        = excelDate(endDateSerial)
    const city           = (col(headers, row, 'Empleado - Ciudad') as string)?.trim() || null
    const commune        = (col(headers, row, 'Empleado - Comuna') as string)?.trim() || null
    const address        = (col(headers, row, 'Empleado - Dirección') as string)?.trim() || null
    const genderRaw      = col(headers, row, 'Empleado - Sexo') as string
    const gender         = genderRaw === 'M' ? 'Masculino' : genderRaw === 'F' ? 'Femenino' : null
    const nationality    = (col(headers, row, 'Empleado - Nacionalidad') as string)?.trim() || null
    const afp            = (col(headers, row, 'Plan - Fondo de Cotización') as string)?.trim() || null
    const isapre         = (col(headers, row, 'Plan - Fonasa/Isapre') as string)?.trim() || null
    const contractTypeStr = col(headers, row, 'Trabajo - Tipo de Contrato') as string
    const workSchedule   = (col(headers, row, 'Trabajo - Jornada Laboral') as string)?.trim() || null
    const supervisorName = (col(headers, row, 'Trabajo - Nombre Supervisor') as string)?.trim() || null
    const supervisorTitle = (col(headers, row, 'Trabajo - Cargo Supervisor') as string)?.trim() || null
    const jobFamily      = (col(headers, row, 'Trabajo - Familia de Cargo') as string)?.trim() || null
    const jobTitle       = (col(headers, row, 'Trabajo - Cargo') as string)?.trim() || null
    const contractType   = toContractType(contractTypeStr)

    try {
      // Upsert employee by RUT
      const existing = await prisma.employee.findUnique({ where: { rut } })

      let employeeId: string
      if (existing) {
        // Prefer surmedia.cl email; only update if current email matches or is synthetic
        const keepEmail = existing.email.endsWith('@surmedia.cl') ? existing.email : email
        await prisma.employee.update({
          where: { rut },
          data: {
            firstName, lastName, email: keepEmail, personalEmail,
            phone, birthDate, startDate, endDate,
            city, commune, address, gender, nationality,
            afp, isapre, workSchedule, supervisorName, supervisorTitle,
            jobFamily, jobTitle, status,
          },
        })
        employeeId = existing.id
        updated++
      } else {
        const created_ = await prisma.employee.create({
          data: {
            rut, firstName, lastName, email, personalEmail,
            phone, birthDate, startDate, endDate,
            city, commune, address, gender, nationality,
            afp, isapre, workSchedule, supervisorName, supervisorTitle,
            jobFamily, jobTitle, status,
          },
        })
        employeeId = created_.id
        created++
      }

      // Upsert contract for this legalEntity (delete existing + create)
      await prisma.contract.deleteMany({
        where: { employeeId, legalEntity, deletedAt: null },
      })
      await prisma.contract.create({
        data: {
          employeeId,
          type: contractType,
          startDate,
          endDate,
          salary: 0,      // se actualiza al importar Sueldos
          currency: 'CLP',
          isActive: status === 'ACTIVE',
          legalEntity,
        },
      })
    } catch (e: any) {
      console.error(`  ERROR [${rut}]: ${e.message}`)
      errors++
    }
  }

  console.log(`  ✓ creados: ${created} | actualizados: ${updated} | errores: ${errors}`)
}

// ─── Import Sueldos ───────────────────────────────────────────────────────────

async function importSueldos(folder: string): Promise<void> {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Sueldos') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Sueldos`); return }

  // Year desde el nombre del archivo (ej: "2026-04-29 Sueldos 2026-01-01 - 2026-04-01.xlsx")
  const yearMatch = file.match(/Sueldos\s+(\d{4})-/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2026

  const legalEntity = folder.toLowerCase().includes('consult')
    ? 'SURMEDIA_CONSULTORIA' as const
    : 'COMUNICACIONES_SURMEDIA' as const

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Sueldos: ${rows.length} filas — ${file}`)

  // Identificar columnas de haberes (todo lo que empieza con "Haberes")
  const haberHeaders = headers.filter(h => h?.startsWith('Haberes'))

  let upserted = 0, skipped = 0, errors = 0

  for (const row of rows) {
    const rut = col(headers, row, 'Empleado - Número de Documento') as string
    if (!rut) continue

    const mes     = col(headers, row, 'Variables Mensuales - Mes de Cálculo') as number
    const liquid  = col(headers, row, 'Liquidación - Sueldo Líquido') as number ?? 0
    const gross   = col(headers, row, 'Liquidación - Sueldo Bruto') as number ?? 0
    const sueldoBase = col(headers, row, 'Haberes Imponibles - Sueldo Base') as number ?? 0

    if (!mes) { skipped++; continue }

    // Construir items desde columnas de haberes con valor > 0
    const items = haberHeaders
      .map(h => {
        const amount = col(headers, row, h) as number
        if (!amount || amount === 0) return null
        const isImponible = h.startsWith('Haberes Imponibles')
        const name = h.replace(/^Haberes (Imponibles|No Imponibles) - /, '')
        return { name, amount, taxable: isImponible, type: isImponible ? 'haber_imponible' : 'haber_no_imponible' }
      })
      .filter(Boolean)

    try {
      const employee = await prisma.employee.findUnique({ where: { rut } })
      if (!employee) { skipped++; continue }

      await prisma.payrollEntry.upsert({
        where: { employeeId_legalEntity_year_month: { employeeId: employee.id, legalEntity, year, month: mes } },
        create: { employeeId: employee.id, legalEntity, year, month: mes, grossSalary: gross, liquidSalary: liquid, items },
        update: { grossSalary: gross, liquidSalary: liquid, items },
      })

      // Actualizar el sueldo base en el contrato
      if (sueldoBase > 0) {
        await prisma.contract.updateMany({
          where: { employeeId: employee.id, legalEntity, deletedAt: null },
          data: { salary: sueldoBase, grossSalary: gross },
        })
      }

      upserted++
    } catch (e: any) {
      console.error(`  ERROR Sueldos [${rut} mes=${mes}]: ${e.message}`)
      errors++
    }
  }

  console.log(`  ✓ upserted: ${upserted} | skipped: ${skipped} | errores: ${errors}`)
}

// ─── Import Vacaciones Tomadas ────────────────────────────────────────────────

async function importVacacionesTomadas(folder: string): Promise<void> {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Vacaciones tomadas') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Vacaciones tomadas`); return }

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Vacaciones tomadas: ${rows.length} filas — ${file}`)

  // Pre-cargar empleados por RUT para mayor velocidad
  const allEmployees = await prisma.employee.findMany({ select: { id: true, rut: true } })
  const rutMap = new Map(allEmployees.map(e => [e.rut, e.id]))

  const leaves: { employeeId: string; type: 'VACACIONES'; startDate: Date; endDate: Date; days: number; status: 'APPROVED' }[] = []

  for (const row of rows) {
    const rut       = col(headers, row, 'Empleado - Número de Documento') as string
    const inicioVal = col(headers, row, 'Vacaciones - Inicio (inclusive)')
    const terminoVal = col(headers, row, 'Vacaciones - Término (inclusive)')
    if (!rut || !inicioVal) continue

    const employeeId = rutMap.get(rut)
    if (!employeeId) continue

    const startDate = excelDate(inicioVal)
    const endDate   = excelDate(terminoVal) ?? startDate
    if (!startDate || !endDate) continue

    const diffMs = endDate.getTime() - startDate.getTime()
    const days   = Math.round(diffMs / 86400000) + 1

    leaves.push({ employeeId, type: 'VACACIONES', startDate, endDate, days, status: 'APPROVED' })
  }

  if (leaves.length > 0) {
    await prisma.leave.createMany({ data: leaves, skipDuplicates: false })
  }
  console.log(`  ✓ creados: ${leaves.length} registros de vacaciones`)
}

// ─── Import Vacaciones y Licencia (licencias médicas) ────────────────────────

async function importLicencias(folder: string): Promise<void> {
  const dir = path.join(REPORTES_DIR, folder)
  const file = fs.readdirSync(dir).find(f => f.includes('Vacaciones y licencia') && f.endsWith('.xlsx'))
  if (!file) { console.log(`  [${folder}] Sin archivo Vacaciones y licencia`); return }

  const { headers, rows } = readBukSheet(path.join(dir, file))
  console.log(`\n[${folder}] Vacaciones y licencia: ${rows.length} filas — ${file}`)

  // Año desde nombre del archivo
  const yearMatch = file.match(/(\d{4})-\d{2}-\d{2}\.xlsx$/) ?? file.match(/(\d{4})-\d{2}-\d{2} -/)
  const year = yearMatch ? parseInt(yearMatch[1]) : 2026

  const allEmployees = await prisma.employee.findMany({ select: { id: true, rut: true } })
  const rutMap = new Map(allEmployees.map(e => [e.rut, e.id]))

  const leaves: { employeeId: string; type: 'LICENCIA_MEDICA'; startDate: Date; endDate: Date; days: number; status: 'APPROVED'; reason: string }[] = []

  for (const row of rows) {
    const rut      = col(headers, row, 'Empleado - Número de Documento') as string
    const mes      = col(headers, row, 'Variables Mensuales - Mes de Cálculo') as number
    const diasLic  = col(headers, row, 'Liquidación - Días de Licencias (Aplicadas)') as number
    if (!rut || !mes || !diasLic || diasLic <= 0) continue

    const employeeId = rutMap.get(rut)
    if (!employeeId) continue

    // Sin fechas exactas: usamos el mes como aproximación
    const startDate = new Date(Date.UTC(year, mes - 1, 1))
    const endDate   = new Date(Date.UTC(year, mes - 1, Math.min(diasLic, 28)))
    leaves.push({ employeeId, type: 'LICENCIA_MEDICA', startDate, endDate, days: diasLic, status: 'APPROVED', reason: `Licencia médica mes ${mes}/${year}` })
  }

  if (leaves.length > 0) {
    await prisma.leave.createMany({ data: leaves, skipDuplicates: false })
  }
  console.log(`  ✓ creados: ${leaves.length} registros de licencia médica`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const folders = fs.readdirSync(REPORTES_DIR).filter(f =>
    fs.statSync(path.join(REPORTES_DIR, f)).isDirectory()
  )
  console.log(`Carpetas encontradas: ${folders.join(', ')}`)

  // Fase 1: Dotación (crea empleados y contratos)
  console.log('\n═══ FASE 1: DOTACIÓN ═══')
  for (const folder of folders) await importDotacion(folder)

  // Fase 2: Sueldos (crea PayrollEntry)
  console.log('\n═══ FASE 2: SUELDOS ═══')
  for (const folder of folders) await importSueldos(folder)

  // Fase 3: Vacaciones tomadas
  console.log('\n═══ FASE 3: VACACIONES TOMADAS ═══')
  for (const folder of folders) await importVacacionesTomadas(folder)

  // Fase 4: Licencias médicas
  console.log('\n═══ FASE 4: LICENCIAS MÉDICAS ═══')
  for (const folder of folders) await importLicencias(folder)

  // Resumen
  const [employees, payroll, contracts, leaves] = await Promise.all([
    prisma.employee.count(),
    prisma.payrollEntry.count(),
    prisma.contract.count(),
    prisma.leave.count(),
  ])
  console.log(`\n═══ RESUMEN ═══`)
  console.log(`  employees:       ${employees}`)
  console.log(`  contracts:       ${contracts}`)
  console.log(`  payroll_entries: ${payroll}`)
  console.log(`  leaves:          ${leaves}`)
  console.log('\n✓ Importación completa.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
