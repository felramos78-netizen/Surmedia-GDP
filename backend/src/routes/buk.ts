import type { FastifyPluginAsync } from 'fastify'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { requireRole } from '../middleware/requireRole'

function resolveReportesDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'reportes'),        // cwd = backend → ../reportes
    path.join(process.cwd(), 'reportes'),              // cwd = project root
    path.resolve(__dirname, '../../../reportes'),
    path.resolve(__dirname, '../../../../reportes'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
}
const REPORTES_DIR = resolveReportesDir()

const FOLDERS = [
  { dir: 'Comunicaciones', entity: 'COMUNICACIONES_SURMEDIA' as const },
  { dir: 'Consultoría',    entity: 'SURMEDIA_CONSULTORIA'    as const },
]
type LegalEntityKey = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRut(raw: unknown): string {
  const s = String(raw ?? '').trim()
  const clean = s.replace(/\./g, '')
  const [body, dv] = clean.split('-')
  if (!body || !dv) return s
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv.toUpperCase()}`
}

// Excel serial number → JS Date (UTC)
function serialToDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  const n = Number(val)
  if (!n || isNaN(n)) return null
  return new Date((n - 25569) * 86400 * 1000)
}

// Incluye variantes mayús/minús del dígito verificador para queries case-sensitive
function rutVariants(ruts: string[]): string[] {
  const set = new Set<string>()
  for (const r of ruts) { set.add(r); set.add(r.toLowerCase()); set.add(r.toUpperCase()) }
  return [...set]
}
// Normaliza RUT de DB a mayúsculas para comparar con normalizeRut()
const upRut = (r: string) => r.replace(/-([a-z])$/, (_, dv: string) => `-${dv.toUpperCase()}`)

function latestFile(folder: string, keyword: string): string | null {
  if (!fs.existsSync(folder)) return null
  const f = fs.readdirSync(folder).filter(n => n.includes(keyword)).sort().reverse()[0]
  return f ? path.join(folder, f) : null
}

// ── Sueldos parser ────────────────────────────────────────────────────────────

interface SueldosRow {
  key: string
  legalEntity: LegalEntityKey
  rut: string
  nombre: string
  year: number
  month: number
  grossSalary: number
  liquidSalary: number
  items: Array<{ name: string; amount: number; taxable: boolean }>
}

function parseSueldos(yearOverride?: number): SueldosRow[] {
  const out: SueldosRow[] = []
  for (const { dir, entity } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), 'Sueldos')
    if (!fp) continue
    const wb  = XLSX.readFile(fp)
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][]
    const hdrIdx = raw.findIndex(r =>
      String(r[0]).toLowerCase().includes('empleado') && String(r[0]).toLowerCase().includes('estado'))
    if (hdrIdx === -1) continue

    const headers = raw[hdrIdx].map((h: any) => String(h).trim())
    const cc = (t: string) => headers.findIndex(h => h.toLowerCase().includes(t.toLowerCase()))
    const RUT_COL = cc('número de documento'), NOM_COL = cc('nombre completo')
    const MES_COL = cc('mes de cálculo'), LIQ_COL = cc('sueldo líquido'), BRU_COL = cc('sueldo bruto')
    if ([RUT_COL, MES_COL, LIQ_COL, BRU_COL].some(c => c === -1)) continue

    const fname   = path.basename(fp)
    const yrMatch = fname.match(/[Ss]ueldos[^\d]*(20\d{2})/i)
    const startYr = yearOverride ?? (yrMatch ? Number(yrMatch[1]) : new Date().getFullYear())

    const itemCols: Array<{ idx: number; name: string; taxable: boolean }> = []
    headers.forEach((h, i) => {
      if (h.startsWith('Haberes Imponibles -'))
        itemCols.push({ idx: i, name: h.replace('Haberes Imponibles - ', ''), taxable: true })
      else if (h.startsWith('Haberes No Imponibles -'))
        itemCols.push({ idx: i, name: h.replace('Haberes No Imponibles - ', ''), taxable: false })
    })

    const rawRows: { rut: string; nombre: string; month: number; rowIdx: number }[] = []
    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i], rut = String(r[RUT_COL] ?? '').trim()
      if (!rut) continue
      const month = Number(r[MES_COL]) || 0
      if (!month) continue
      rawRows.push({ rut: normalizeRut(rut), nombre: String(r[NOM_COL] || '').trim(), month, rowIdx: i })
    }

    // Resolve year per employee (tracks month-rollover across years)
    const yearMap = new Map<string, number>(), prevMap = new Map<string, number>()
    const resolvedYr = new Map<number, number>()
    for (const { rut, month, rowIdx } of rawRows) {
      if (!yearMap.has(rut)) yearMap.set(rut, startYr)
      const prev = prevMap.get(rut) ?? 0
      if (prev > 0 && month < prev) yearMap.set(rut, (yearMap.get(rut) ?? startYr) + 1)
      prevMap.set(rut, month)
      resolvedYr.set(rowIdx, yearMap.get(rut) ?? startYr)
    }

    for (const { rut, nombre, month, rowIdx } of rawRows) {
      const r            = raw[rowIdx]
      const grossSalary  = Math.round(Number(String(r[BRU_COL]).replace(/[^0-9.-]/g, '')) || 0)
      const liquidSalary = Math.round(Number(String(r[LIQ_COL]).replace(/[^0-9.-]/g, '')) || 0)
      if (!grossSalary && !liquidSalary) continue
      const year  = resolvedYr.get(rowIdx) ?? startYr
      const items = itemCols
        .map(ic => ({ name: ic.name, amount: Number(r[ic.idx]) || 0, taxable: ic.taxable }))
        .filter(it => it.amount !== 0)
      out.push({ key: `${entity}|${rut}|${year}|${month}`, legalEntity: entity, rut, nombre, year, month, grossSalary, liquidSalary, items })
    }
  }
  return out
}

// ── Dotación parser ───────────────────────────────────────────────────────────

interface DotacionRow {
  legalEntity: LegalEntityKey
  rut: string
  nombre: string
  estado: string
  afp: string
  isapre: string
  cargo: string
  familaCargo: string
  supervisorNombre: string
  supervisorCargo: string
  jornada: string
  tipoContrato: string
  fechaIngreso: Date | null
  fechaVencimiento: Date | null
  city: string
  commune: string
  address: string
  excelEmail: string
  personalEmail: string
  birthDate: Date | null
  gender: string
  nationality: string
  phone: string
}

function parseDotacion(): DotacionRow[] {
  const out: DotacionRow[] = []
  for (const { dir, entity } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), 'Dotación')
    if (!fp) continue
    const wb  = XLSX.readFile(fp)
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][]
    const hdrIdx = raw.findIndex(r =>
      String(r[0]).toLowerCase().includes('empleado') && String(r[0]).toLowerCase().includes('estado'))
    if (hdrIdx === -1) continue

    const headers = raw[hdrIdx].map((h: any) => String(h).trim())
    const col = (exact: string) => headers.indexOf(exact)

    const RUT_COL = col('Empleado - Número de Documento')
    if (RUT_COL === -1) continue
    const NOM_COL = col('Empleado - Nombre Completo')
    const AFP_COL = col('Plan - Fondo de Cotización')
    const ISA_COL = col('Plan - Fonasa/Isapre')
    const CAR_COL = col('Trabajo - Cargo')
    const FAM_COL = col('Trabajo - Familia de Cargo')
    const SNM_COL = col('Trabajo - Nombre Supervisor')
    const SCA_COL = col('Trabajo - Cargo Supervisor')
    const JOR_COL = col('Trabajo - Jornada Laboral')
    const TIP_COL = col('Trabajo - Tipo de Contrato')
    const ING_COL = col('Trabajo - Fecha Ingreso Compañía')
    const VEN_COL = col('Trabajo - Fecha Vencimiento Contrato')
    const CIU_COL = col('Empleado - Ciudad')
    const COM_COL = col('Empleado - Comuna')
    const DIR_COL = col('Empleado - Dirección')
    const EML_COL = col('Empleado - Email')
    const PEM_COL = col('Empleado - Email Personal')
    const NAC_COL = col('Empleado - Fecha de Nacimiento')
    const SEX_COL = col('Empleado - Sexo')
    const NAL_COL = col('Empleado - Nacionalidad')
    const TEL_COL = col('Empleado - Teléfono Particular')

    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i]
      const rut = String(r[RUT_COL] ?? '').trim()
      if (!rut) continue
      out.push({
        legalEntity:      entity,
        rut:              normalizeRut(rut),
        nombre:           String(r[NOM_COL]  ?? '').trim(),
        estado:           String(r[0]         ?? '').trim(),
        afp:              String(r[AFP_COL]  ?? '').trim().toLowerCase(),
        isapre:           String(r[ISA_COL]  ?? '').trim().toLowerCase(),
        cargo:            String(r[CAR_COL]  ?? '').trim(),
        familaCargo:      String(r[FAM_COL]  ?? '').trim(),
        supervisorNombre: String(r[SNM_COL]  ?? '').trim(),
        supervisorCargo:  String(r[SCA_COL]  ?? '').trim(),
        jornada:          String(r[JOR_COL]  ?? '').trim(),
        tipoContrato:     String(r[TIP_COL]  ?? '').trim(),
        fechaIngreso:     serialToDate(r[ING_COL]),
        fechaVencimiento: r[VEN_COL] ? serialToDate(r[VEN_COL]) : null,
        city:             String(r[CIU_COL]  ?? '').trim(),
        commune:          String(r[COM_COL]  ?? '').trim(),
        address:          String(r[DIR_COL]  ?? '').trim(),
        excelEmail:       String(r[EML_COL]  ?? '').trim(),
        personalEmail:    String(r[PEM_COL]  ?? '').trim(),
        birthDate:        r[NAC_COL] ? serialToDate(r[NAC_COL]) : null,
        gender:           String(r[SEX_COL]  ?? '').trim(),
        nationality:      String(r[NAL_COL]  ?? '').trim(),
        phone:            String(r[TEL_COL]  ?? '').trim(),
      })
    }
  }
  return out
}

// ── Vacaciones tomadas parser ─────────────────────────────────────────────────

interface VacRow {
  key: string
  legalEntity: LegalEntityKey
  rut: string
  nombre: string
  startDate: Date
  endDate: Date
  days: number
}

function parseVacaciones(): VacRow[] {
  const out: VacRow[] = []
  const seenKeys = new Set<string>()
  for (const { dir, entity } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), 'Vacaciones tomadas')
    if (!fp) continue
    const wb  = XLSX.readFile(fp)
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][]
    const hdrIdx = raw.findIndex(r =>
      r.some((c: any) => String(c).toLowerCase().includes('número de documento')))
    if (hdrIdx === -1) continue

    const headers = raw[hdrIdx].map((h: any) => String(h).trim())
    const cc = (t: string) => headers.findIndex(h => h.toLowerCase().includes(t.toLowerCase()))
    const RUT_COL = cc('número de documento'), NOM_COL = cc('nombre completo')
    const INI_COL = cc('inicio'), TER_COL = cc('término')
    if (RUT_COL === -1 || INI_COL === -1 || TER_COL === -1) continue

    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r   = raw[i]
      const rut = String(r[RUT_COL] ?? '').trim()
      if (!rut) continue
      const sd = serialToDate(r[INI_COL]), ed = serialToDate(r[TER_COL])
      if (!sd || !ed) continue
      const key = `vac|${normalizeRut(rut)}|${sd.toISOString().slice(0, 10)}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)
      const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1
      out.push({
        key,
        legalEntity: entity,
        rut: normalizeRut(rut),
        nombre: String(r[NOM_COL] || '').trim(),
        startDate: sd, endDate: ed, days,
      })
    }
  }
  return out
}

// ── Vacaciones y licencia parser ──────────────────────────────────────────────

interface VacLicRow {
  key:         string
  legalEntity: LegalEntityKey
  rut:         string
  nombre:      string
  year:        number
  month:       number
  saldoLegal:           number
  saldoProgresivas:     number
  saldoAdministrativos: number
  diasLicencias:        number
  vacacionesTomadas:    number
}

function parseVacLicencia(yearOverride?: number): VacLicRow[] {
  const out: VacLicRow[] = []
  const year = yearOverride ?? new Date().getFullYear()
  for (const { dir, entity } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), 'Vacaciones y licencia')
    if (!fp) continue
    const wb  = XLSX.readFile(fp)
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) as any[][]
    // Header row contains 'Mes de Cálculo' and 'Número de Documento'
    const hdrIdx = raw.findIndex(r => r.some((c: any) => String(c ?? '').includes('Mes de Cálculo')))
    if (hdrIdx === -1) continue
    const headers = raw[hdrIdx].map((h: any) => String(h ?? '').trim())
    const col = (t: string) => headers.findIndex(h => h.includes(t))

    const MES_COL  = col('Mes de Cálculo')
    const RUT_COL  = col('Número de Documento')
    const NOM_COL  = col('Nombre Completo')
    const LIC_COL  = col('Días de Licencias (Aplicadas)')
    const VAC_COL  = col('Vacaciones Tomadas')
    const ACM_COL  = col('Saldo Vacaciones Acumuladas')
    const ADM_COL  = col('Saldo Vacaciones Días Administrativos')
    const PRG_COL  = col('Saldo Vacaciones Progresivas')
    const LEG_COL  = col('Saldo Vacaciones Legales')
    if (RUT_COL === -1 || MES_COL === -1) continue

    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i]
      const rut = String(r[RUT_COL] ?? '').trim()
      if (!rut) continue
      const month = Number(r[MES_COL]) || 0
      if (!month) continue
      const norm = normalizeRut(rut)
      out.push({
        key:                 `vaclic|${entity}|${norm}|${year}|${month}`,
        legalEntity:         entity,
        rut:                 norm,
        nombre:              String(r[NOM_COL] ?? '').trim(),
        year,
        month,
        saldoLegal:           Number(r[LEG_COL] ?? 0) || 0,
        saldoProgresivas:     Number(r[PRG_COL] ?? 0) || 0,
        saldoAdministrativos: Number(r[ADM_COL] ?? 0) || 0,
        diasLicencias:        Number(r[LIC_COL] ?? 0) || 0,
        vacacionesTomadas:    Number(r[VAC_COL] ?? 0) || 0,
      })
    }
  }
  return out
}

// ── Routes ────────────────────────────────────────────────────────────────────

const bukRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/buk/preview — lee todos los Excel y devuelve diff vs DB
  fastify.get<{ Querystring: { year?: string } }>('/preview', async (req, reply) => {
    const yearOverride = req.query.year ? Number(req.query.year) : undefined
    const sueldosRows  = parseSueldos(yearOverride)
    const dotacionRows = parseDotacion()
    const vacRows      = parseVacaciones()
    const vacLicRows   = parseVacLicencia(yearOverride)

    // ── Sueldos diff ──────────────────────────────────────────────────────
    const sueldosRuts = [...new Set(sueldosRows.map(r => r.rut))]
    const [dbEmpsSueldos, dbPayroll] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(sueldosRuts) } },
        select: { id: true, rut: true },
      }),
      fastify.prisma.payrollEntry.findMany({
        where: { employee: { rut: { in: rutVariants(sueldosRuts) } } },
        select: { legalEntity: true, year: true, month: true, grossSalary: true, liquidSalary: true, employee: { select: { rut: true } } },
      }),
    ])
    const rutSetSueldos  = new Set(dbEmpsSueldos.map(e => upRut(e.rut)))
    const existingPayroll = new Map(dbPayroll.map(e => [`${e.legalEntity}|${upRut(e.employee.rut)}|${e.year}|${e.month}`, e]))

    const sueldosNuevos: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; grossSalary: number; liquidSalary: number }> = []
    const sueldosCambios: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; antes: { grossSalary: number; liquidSalary: number }; despues: { grossSalary: number; liquidSalary: number } }> = []
    const sueldosSincronizados: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; grossSalary: number; liquidSalary: number }> = []
    const sueldosSinEmpleado: string[] = []

    for (const row of sueldosRows) {
      if (!rutSetSueldos.has(row.rut)) { sueldosSinEmpleado.push(row.rut); continue }
      const existing = existingPayroll.get(row.key)
      if (!existing) {
        sueldosNuevos.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: row.grossSalary, liquidSalary: row.liquidSalary })
      } else if (existing.grossSalary !== row.grossSalary || existing.liquidSalary !== row.liquidSalary) {
        sueldosCambios.push({
          key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month,
          antes:   { grossSalary: existing.grossSalary, liquidSalary: existing.liquidSalary },
          despues: { grossSalary: row.grossSalary,      liquidSalary: row.liquidSalary      },
        })
      } else {
        sueldosSincronizados.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: row.grossSalary, liquidSalary: row.liquidSalary })
      }
    }

    // ── Dotación diff ─────────────────────────────────────────────────────
    const dotRuts = [...new Set(dotacionRows.map(r => r.rut))]
    const [dbEmpsDot, dbContracts] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(dotRuts) } },
        select: {
          id: true, rut: true, status: true, afp: true, isapre: true,
          jobTitle: true, jobFamily: true, supervisorName: true, supervisorTitle: true,
          city: true, commune: true, address: true, email: true, personalEmail: true,
          birthDate: true, gender: true, nationality: true, phone: true, workSchedule: true,
        },
      }),
      fastify.prisma.contract.findMany({
        where: { employee: { rut: { in: rutVariants(dotRuts) } }, isActive: true, deletedAt: null },
        select: { employeeId: true, type: true, endDate: true, employee: { select: { rut: true } } },
        orderBy: { startDate: 'desc' },
      }),
    ])
    const rutToEmpDot    = new Map(dbEmpsDot.map(e => [upRut(e.rut), e]))
    const rutToContract  = new Map<string, typeof dbContracts[0]>()
    for (const c of dbContracts) if (!rutToContract.has(upRut(c.employee.rut))) rutToContract.set(upRut(c.employee.rut), c)

    const dotNuevos:  Array<{ rut: string; nombre: string; legalEntity: LegalEntityKey; estado: string; cargo: string | null; afp: string | null; isapre: string | null; tipoContrato: string | null; fechaIngreso: string | null; supervisorNombre: string | null; jornada: string | null }> = []
    const dotCambios: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; campos: Array<{ campo: string; antes: string | null; despues: string | null }> }> = []
    const seenDotRuts = new Set<string>()

    for (const row of dotacionRows) {
      if (seenDotRuts.has(row.rut)) continue
      seenDotRuts.add(row.rut)
      const dbEmp = rutToEmpDot.get(row.rut)
      if (!dbEmp) {
        dotNuevos.push({
          rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, estado: row.estado,
          cargo:           row.cargo            || null,
          afp:             row.afp              || null,
          isapre:          row.isapre           || null,
          tipoContrato:    row.tipoContrato     || null,
          fechaIngreso:    row.fechaIngreso ? row.fechaIngreso.toISOString().slice(0, 10) : null,
          supervisorNombre:row.supervisorNombre || null,
          jornada:         row.jornada          || null,
        })
        continue
      }

      const campos: Array<{ campo: string; antes: string | null; despues: string | null }> = []
      const addCampo = (campo: string, antes: string | null | undefined, despues: string) => {
        const a = (antes ?? '').trim().toLowerCase()
        const d = despues.trim().toLowerCase()
        if (d && a !== d) campos.push({ campo, antes: antes ?? null, despues })
      }
      const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
      if (dbEmp.status !== excelStatus) campos.push({ campo: 'Estado', antes: dbEmp.status, despues: excelStatus })
      addCampo('AFP',            dbEmp.afp,            row.afp)
      addCampo('Isapre',         dbEmp.isapre,          row.isapre)
      addCampo('Cargo',          dbEmp.jobTitle,        row.cargo)
      addCampo('Familia',        dbEmp.jobFamily,       row.familaCargo)
      addCampo('Supervisor',     dbEmp.supervisorName,  row.supervisorNombre)
      addCampo('Ciudad',         dbEmp.city,            row.city)
      addCampo('Comuna',         dbEmp.commune,         row.commune)
      addCampo('Dirección',      dbEmp.address,         row.address)
      addCampo('Email Personal', dbEmp.personalEmail,   row.personalEmail)
      addCampo('Género',         dbEmp.gender,          row.gender)
      addCampo('Nacionalidad',   dbEmp.nationality,     row.nationality)
      addCampo('Teléfono',       dbEmp.phone,           row.phone)
      addCampo('Jornada',        dbEmp.workSchedule,    row.jornada)
      if (row.excelEmail && dbEmp.email.endsWith('@buk.import'))
        addCampo('Email', dbEmp.email, row.excelEmail)
      const excelBirth = row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null
      const dbBirth    = dbEmp.birthDate ? dbEmp.birthDate.toISOString().slice(0, 10) : null
      if (excelBirth && excelBirth !== dbBirth) campos.push({ campo: 'Fecha nacimiento', antes: dbBirth, despues: excelBirth })

      const contract = rutToContract.get(row.rut)
      if (contract) {
        const excelType = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        if (contract.type !== excelType) campos.push({ campo: 'Tipo contrato', antes: contract.type, despues: excelType })
        const excelEnd = row.fechaVencimiento ? row.fechaVencimiento.toISOString().slice(0, 10) : null
        const dbEnd    = contract.endDate    ? contract.endDate.toISOString().slice(0, 10)    : null
        if (dbEnd !== excelEnd) campos.push({ campo: 'Venc. contrato', antes: dbEnd, despues: excelEnd })
      }
      if (campos.length > 0) dotCambios.push({ key: `dotacion|${row.rut}`, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, campos })
    }

    // ── Vacaciones diff ───────────────────────────────────────────────────
    const vacRuts = [...new Set(vacRows.map(r => r.rut))]
    const [dbEmpsVac, dbLeaves] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(vacRuts) } },
        select: { id: true, rut: true },
      }),
      fastify.prisma.leave.findMany({
        where: { type: 'VACACIONES' as any, employee: { rut: { in: rutVariants(vacRuts) } } },
        select: { startDate: true, employee: { select: { rut: true } } },
      }),
    ])
    const rutSetVac      = new Set(dbEmpsVac.map(e => upRut(e.rut)))
    const existingLeaves = new Set(dbLeaves.map(l => `vac|${upRut(l.employee.rut)}|${l.startDate.toISOString().slice(0, 10)}`))

    const vacNuevas: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; startDate: string; endDate: string; days: number }> = []
    const vacSinEmpleado: string[] = []

    for (const row of vacRows) {
      if (!rutSetVac.has(row.rut)) { vacSinEmpleado.push(row.rut); continue }
      if (!existingLeaves.has(row.key))
        vacNuevas.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate.toISOString().slice(0, 10), days: row.days })
    }

    // ── Vacaciones y licencia diff ─────────────────────────────────────────
    const vacLicRuts = [...new Set(vacLicRows.map(r => r.rut))]
    const dbEmpsVacLic = await fastify.prisma.employee.findMany({
      where: { rut: { in: rutVariants(vacLicRuts) } },
      select: { id: true, rut: true },
    })
    const rutToIdVacLic   = new Map(dbEmpsVacLic.map(e => [upRut(e.rut), e.id]))
    const rutSetVacLic    = new Set(dbEmpsVacLic.map(e => upRut(e.rut)))
    const empIdsVacLic    = dbEmpsVacLic.map(e => e.id)
    const dbVacBalances   = await fastify.prisma.vacationBalance.findMany({
      where: { employeeId: { in: empIdsVacLic } },
      select: { employeeId: true, legalEntity: true, year: true, month: true,
                saldoLegal: true, saldoProgresivas: true, saldoAdministrativos: true,
                diasLicencias: true, vacacionesTomadas: true },
    })
    const existingVacBal  = new Map(
      dbVacBalances.map(b => [`${b.employeeId}|${b.legalEntity}|${b.year}|${b.month}`, b])
    )

    type VacLicItem = { key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; saldoLegal: number; saldoProgresivas: number; saldoAdministrativos: number; diasLicencias: number; vacacionesTomadas: number }
    const vacLicNuevos:        VacLicItem[] = []
    const vacLicCambios:       VacLicItem[] = []
    const vacLicSincronizados: VacLicItem[] = []

    for (const r of vacLicRows) {
      if (!rutSetVacLic.has(r.rut)) continue
      const empId = rutToIdVacLic.get(r.rut)
      if (!empId) continue
      const item: VacLicItem = {
        key: r.key, rut: r.rut, nombre: r.nombre, legalEntity: r.legalEntity,
        year: r.year, month: r.month,
        saldoLegal: r.saldoLegal, saldoProgresivas: r.saldoProgresivas,
        saldoAdministrativos: r.saldoAdministrativos, diasLicencias: r.diasLicencias,
        vacacionesTomadas: r.vacacionesTomadas,
      }
      const dbKey = `${empId}|${r.legalEntity}|${r.year}|${r.month}`
      const existing = existingVacBal.get(dbKey)
      if (!existing) {
        vacLicNuevos.push(item)
      } else if (
        existing.saldoLegal           !== r.saldoLegal  ||
        existing.saldoProgresivas     !== r.saldoProgresivas ||
        existing.saldoAdministrativos !== r.saldoAdministrativos ||
        existing.diasLicencias        !== r.diasLicencias ||
        existing.vacacionesTomadas    !== r.vacacionesTomadas
      ) {
        vacLicCambios.push(item)
      } else {
        vacLicSincronizados.push(item)
      }
    }
    const vacLicSinEmpleado = [...new Set(vacLicRows.filter(r => !rutSetVacLic.has(r.rut)).map(r => r.rut))]

    return reply.send({
      _debug: { reportesDir: REPORTES_DIR, exists: fs.existsSync(REPORTES_DIR), sueldosRowsCount: sueldosRows.length },
      data: {
        sueldos:    { nuevos: sueldosNuevos, cambios: sueldosCambios, sincronizados: sueldosSincronizados, sinEmpleado: [...new Set(sueldosSinEmpleado)] },
        dotacion:   { nuevos: dotNuevos,     cambios: dotCambios },
        vacaciones: { nuevas: vacNuevas,     sinEmpleado: [...new Set(vacSinEmpleado)] },
        vacLicencia:{ nuevos: vacLicNuevos, cambios: vacLicCambios, sincronizados: vacLicSincronizados, sinEmpleado: vacLicSinEmpleado },
      },
    })
  })

  // POST /api/buk/apply — aplica los cambios aprobados
  fastify.post<{
    Body: {
      year?: number
      sueldos?:    {
        nuevosKeys?: string[]; cambiosKeys?: string[]; sincronizadosKeys?: string[]
        overrides?: Record<string, { grossSalary?: number; liquidSalary?: number }>
      }
      dotacion?:    { cambiosKeys?: string[]; nuevosKeys?: string[] }
      vacaciones?:  { nuevasKeys?: string[] }
      vacLicencia?: { keys?: string[] }
    }
  }>('/apply', { bodyLimit: 1_000_000, preHandler: requireRole('ADMIN', 'RRHH_MANAGER') }, async (req, reply) => {
    const { sueldos, dotacion, vacaciones, vacLicencia, year: yearOverride } = req.body
    const sueldosAllKeys = new Set([
      ...(sueldos?.nuevosKeys       ?? []),
      ...(sueldos?.cambiosKeys      ?? []),
      ...(sueldos?.sincronizadosKeys ?? []),
    ])
    const dotCambiosKeys  = new Set(dotacion?.cambiosKeys ?? [])
    const dotNuevosKeys   = new Set(dotacion?.nuevosKeys  ?? [])
    const vacNuevasKeys   = new Set(vacaciones?.nuevasKeys ?? [])
    const vacLicKeys   = new Set(vacLicencia?.keys ?? [])
    const applied = { sueldos: 0, dotacion: 0, vacaciones: 0, vacLicencia: 0 }

    // ── Sueldos (batch con $transaction) ─────────────────────────────────
    if (sueldosAllKeys.size > 0) {
      const rows = parseSueldos(yearOverride).filter(r => sueldosAllKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const ops = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        const ov = sueldos?.overrides?.[row.key]
        const validOverride = (v: number | undefined) => Number.isFinite(v) && (v as number) >= 0
        const gross  = validOverride(ov?.grossSalary)  ? (ov!.grossSalary as number)  : row.grossSalary
        const liquid = validOverride(ov?.liquidSalary) ? (ov!.liquidSalary as number) : row.liquidSalary
        return [fastify.prisma.payrollEntry.upsert({
          where: { employeeId_legalEntity_year_month: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month } },
          create: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: gross, liquidSalary: liquid, items: row.items as any },
          update: { grossSalary: gross, liquidSalary: liquid, items: row.items as any },
        })]
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops)
        applied.sueldos = ops.length
      }
    }

    // ── Dotación cambios (batch con $transaction) ─────────────────────────
    if (dotCambiosKeys.size > 0) {
      const relevantRuts = [...dotCambiosKeys].map(k => k.replace('dotacion|', ''))
      const rows = parseDotacion().filter(r => relevantRuts.includes(r.rut))
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: relevantRuts } }, select: { id: true, rut: true, email: true } })
      const contracts = await fastify.prisma.contract.findMany({
        where: { employeeId: { in: emps.map(e => e.id) }, isActive: true, deletedAt: null },
        select: { id: true, employeeId: true },
        orderBy: { startDate: 'desc' },
      })
      const empByRut        = new Map(emps.map(e => [upRut(e.rut), e]))
      const contractByEmpId = new Map<string, string>()
      for (const c of contracts) if (!contractByEmpId.has(c.employeeId)) contractByEmpId.set(c.employeeId, c.id)

      const emailUpdates: Array<{ id: string; email: string }> = []
      const ops = rows.flatMap(row => {
        const emp = empByRut.get(row.rut)
        if (!emp) return []
        const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
        const excelType   = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        if (row.excelEmail && emp.email.endsWith('@buk.import'))
          emailUpdates.push({ id: emp.id, email: row.excelEmail })
        const updates = [fastify.prisma.employee.update({
          where: { id: emp.id },
          data: {
            status:          excelStatus as any,
            afp:             row.afp              || undefined,
            isapre:          row.isapre           || undefined,
            jobTitle:        row.cargo            || undefined,
            jobFamily:       row.familaCargo      || undefined,
            supervisorName:  row.supervisorNombre || undefined,
            supervisorTitle: row.supervisorCargo  || undefined,
            workSchedule:    row.jornada          || undefined,
            city:            row.city             || undefined,
            commune:         row.commune          || undefined,
            address:         row.address          || undefined,
            personalEmail:   row.personalEmail    || undefined,
            gender:          row.gender           || undefined,
            nationality:     row.nationality      || undefined,
            phone:           row.phone            || undefined,
            birthDate:       row.birthDate        ?? undefined,
          },
        })]
        const contractId = contractByEmpId.get(emp.id)
        if (contractId) updates.push(fastify.prisma.contract.update({
          where: { id: contractId },
          data: { type: excelType as any, endDate: row.fechaVencimiento ?? null },
        }) as any)
        return updates
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops as any[])
        applied.dotacion += rows.filter(r => empByRut.has(r.rut)).length
      }
      // Email updates fuera de la transacción para evitar fallo por uniqueness
      for (const eu of emailUpdates) {
        try {
          await fastify.prisma.employee.update({ where: { id: eu.id }, data: { email: eu.email } })
        } catch (err: any) {
          if (err?.code !== 'P2002') fastify.log.error({ err, employeeId: eu.id }, 'Error al actualizar email desde BUK')
          // P2002 = email ya en uso por otro colaborador, se ignora intencionalmente
        }
      }
    }

    // ── Dotación nuevos → createMany + contratos (3 queries en total) ────
    if (dotNuevosKeys.size > 0) {
      const nuevosRuts = [...dotNuevosKeys].map(k => k.replace('dot-nuevo|', ''))
      const rows = parseDotacion().filter(r => nuevosRuts.includes(r.rut))
      await fastify.prisma.employee.createMany({
        data: rows.map(row => {
          const parts     = row.nombre.trim().split(/\s+/)
          const firstName = parts.length > 2 ? parts.slice(2).join(' ') : parts[0] ?? row.nombre
          const lastName  = parts.length > 2 ? parts.slice(0, 2).join(' ') : parts.slice(1).join(' ') || '-'
          const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
          return {
            rut:             row.rut,
            firstName,
            lastName,
            email:           row.excelEmail || `${row.rut.replace(/[^0-9]/g, '')}@buk.import`,
            status:          excelStatus as any,
            startDate:       row.fechaIngreso ?? new Date(),
            afp:             row.afp              || undefined,
            isapre:          row.isapre           || undefined,
            jobTitle:        row.cargo            || undefined,
            jobFamily:       row.familaCargo      || undefined,
            supervisorName:  row.supervisorNombre || undefined,
            supervisorTitle: row.supervisorCargo  || undefined,
            workSchedule:    row.jornada          || undefined,
            city:            row.city             || undefined,
            commune:         row.commune          || undefined,
            address:         row.address          || undefined,
            personalEmail:   row.personalEmail    || undefined,
            gender:          row.gender           || undefined,
            nationality:     row.nationality      || undefined,
            phone:           row.phone            || undefined,
            birthDate:       row.birthDate        ?? undefined,
          }
        }),
        skipDuplicates: true,
      })
      const createdEmps = await fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(rows.map(r => r.rut)) } },
        select: { id: true, rut: true },
      })
      const rutToId = new Map(createdEmps.map(e => [upRut(e.rut), e.id]))
      const contractData = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        const excelType = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        return [{ employeeId: empId, type: excelType as any, startDate: row.fechaIngreso ?? new Date(), endDate: row.fechaVencimiento ?? null, salary: 0, legalEntity: row.legalEntity as any }]
      })
      if (contractData.length > 0) {
        await fastify.prisma.contract.createMany({ data: contractData, skipDuplicates: true })
      }
      applied.dotacion += rows.length
    }

    // ── Vacaciones (createMany — las keys ya vienen filtradas como nuevas) ──
    if (vacNuevasKeys.size > 0) {
      const rows = parseVacaciones().filter(r => vacNuevasKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const leaveData = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        return [{ employeeId: empId, type: 'VACACIONES' as any, startDate: row.startDate, endDate: row.endDate, days: row.days, status: 'APPROVED' as any, reason: 'Importado desde BUK' }]
      })
      if (leaveData.length > 0) {
        await fastify.prisma.leave.createMany({ data: leaveData, skipDuplicates: true })
        applied.vacaciones = leaveData.length
      }
    }

    // ── Vacaciones y licencia (upsert batch) ──────────────────────────────
    if (vacLicKeys.size > 0) {
      const rows = parseVacLicencia(yearOverride).filter(r => vacLicKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const ops = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        return [fastify.prisma.vacationBalance.upsert({
          where: { employeeId_legalEntity_year_month: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month } },
          create: {
            employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month,
            saldoLegal: row.saldoLegal, saldoProgresivas: row.saldoProgresivas,
            saldoAdministrativos: row.saldoAdministrativos, diasLicencias: row.diasLicencias,
            vacacionesTomadas: row.vacacionesTomadas,
          },
          update: {
            saldoLegal: row.saldoLegal, saldoProgresivas: row.saldoProgresivas,
            saldoAdministrativos: row.saldoAdministrativos, diasLicencias: row.diasLicencias,
            vacacionesTomadas: row.vacacionesTomadas,
          },
        })]
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops)
        applied.vacLicencia = ops.length
      }
    }

    return reply.send({ ok: true, applied })
  })
}

export default bukRoutes
