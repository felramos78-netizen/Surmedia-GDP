import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

// Lectura de los reportes Excel exportados manualmente desde BUK (reportes/).
// Respaldo de la sincronización por API (services/bukApiImport.service.ts):
// ambas fuentes producen las mismas filas, así el diff de /api/buk no cambia.

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
export const REPORTES_DIR = resolveReportesDir()

const FOLDERS = [
  { dir: 'Comunicaciones', entity: 'COMUNICACIONES_SURMEDIA' as const },
  { dir: 'Consultoría',    entity: 'SURMEDIA_CONSULTORIA'    as const },
]
export type LegalEntityKey = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function normalizeRut(raw: unknown): string {
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

// Fecha texto "DD/MM/YYYY" (o serial de Excel) → JS Date (UTC medianoche)
function parseFlexDate(val: unknown): Date | null {
  if (!val) return null
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  return serialToDate(val)
}

// "5,00" → 5 (números con coma decimal, formato chileno)
function parseComaNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').trim().replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// Incluye variantes mayús/minús del dígito verificador para queries case-sensitive
export function rutVariants(ruts: string[]): string[] {
  const set = new Set<string>()
  for (const r of ruts) { set.add(r); set.add(r.toLowerCase()); set.add(r.toUpperCase()) }
  return [...set]
}
// Normaliza RUT de DB a mayúsculas para comparar con normalizeRut()
export const upRut = (r: string) => r.replace(/-([a-z])$/, (_, dv: string) => `-${dv.toUpperCase()}`)

function latestFile(folder: string, keyword: string): string | null {
  if (!fs.existsSync(folder)) return null
  const f = fs.readdirSync(folder).filter(n => n.includes(keyword)).sort().reverse()[0]
  return f ? path.join(folder, f) : null
}

// ── Sueldos parser ────────────────────────────────────────────────────────────

export interface SueldosRow {
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

export function parseSueldos(yearOverride?: number): SueldosRow[] {
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

export interface DotacionRow {
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

export function parseDotacion(): DotacionRow[] {
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

export interface VacRow {
  key: string
  legalEntity: LegalEntityKey
  rut: string
  nombre: string
  startDate: Date
  endDate: Date
  days: number
  tipo?: string            // solo API: Legales / Administrativos / Progresivas
  aprobadoPor?: string
  fechaAprobacion?: Date | null
}

export function parseVacaciones(): VacRow[] {
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

export interface VacLicRow {
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
  // API: el saldo ya descuenta las vacaciones aprobadas a futuro; EXCEL: no
  source:               'API' | 'EXCEL'
}

export function parseVacLicencia(yearOverride?: number): VacLicRow[] {
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
        source:               'EXCEL',
      })
    }
  }
  return out
}

// ── Vacación (libro de solicitudes aprobadas) parser ──────────────────────────
// A diferencia de "Vacaciones tomadas", este libro no trae RUT — solo
// "Apellido, Nombres" — y cubre TODO el historial (pasado y futuro), no solo
// el mes en curso. El match contra Employee se hace por nombre en la ruta.

export interface VacAprobadaRaw {
  legalEntity: LegalEntityKey
  rut?: string             // solo API; el libro Excel no trae RUT (match por nombre)
  apellido: string
  nombre: string
  startDate: Date
  endDate: Date
  days: number
  tipo: string
  aprobadoPor: string
  fechaAprobacion: Date | null
  periodo: string
}

export function parseVacacionAprobada(): VacAprobadaRaw[] {
  const out: VacAprobadaRaw[] = []
  for (const { dir, entity } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), 'Vacación')
    if (!fp) continue
    const wb  = XLSX.readFile(fp)
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][]
    const hdrIdx = raw.findIndex(r => r.some((c: any) => String(c).toLowerCase().includes('empleado')) &&
      r.some((c: any) => String(c).toLowerCase().includes('inicio')))
    if (hdrIdx === -1) continue

    const headers = raw[hdrIdx].map((h: any) => String(h).trim())
    const cc = (t: string) => headers.findIndex(h => h.toLowerCase().includes(t.toLowerCase()))
    const EMP_COL = cc('empleado'), INI_COL = cc('inicio'), TER_COL = cc('término')
    const DIA_COL = cc('días solicitados'), TIP_COL = cc('tipo de vacación')
    const APR_COL = cc('aprobado por'), FAP_COL = cc('fecha de aprobación'), PER_COL = cc('período')
    if (EMP_COL === -1 || INI_COL === -1 || TER_COL === -1) continue

    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i]
      const empleado = String(r[EMP_COL] ?? '').trim()
      if (!empleado) continue
      const [apellido, nombre] = empleado.split(',').map(s => s?.trim() ?? '')
      if (!apellido || !nombre) continue
      const sd = parseFlexDate(r[INI_COL]), ed = parseFlexDate(r[TER_COL])
      if (!sd || !ed) continue
      out.push({
        legalEntity: entity,
        apellido, nombre,
        startDate: sd, endDate: ed,
        days: Math.round(parseComaNum(r[DIA_COL])) || (Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1),
        tipo: String(r[TIP_COL] ?? '').trim() || 'Legales',
        aprobadoPor: String(r[APR_COL] ?? '').trim(),
        fechaAprobacion: FAP_COL !== -1 ? parseFlexDate(r[FAP_COL]) : null,
        periodo: String(r[PER_COL] ?? '').trim(),
      })
    }
  }
  return out
}
