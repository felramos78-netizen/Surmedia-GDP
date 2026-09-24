import type { LegalEntity } from '@prisma/client'
import { BUK_ENTITIES, bukGetAll, bukGetJson } from './bukApi.service'
import {
  normalizeRut,
  type DotacionRow, type SueldosRow, type VacRow, type VacLicRow, type VacAprobadaRaw,
} from './bukExcelImport.service'

// Sincronización de /api/buk desde la API de BUK. Produce las mismas filas que
// los lectores de Excel (bukExcelImport.service.ts), así el diff contra la DB y
// la UI de /buk no dependen de la fuente.

interface ApiJob {
  periodicity?:               string | null
  contract_type?:             string | null
  contract_finishing_date_1?: string | null
  contract_finishing_date_2?: string | null
  boss?:                      { id: number } | null
  role?:                      { name?: string; role_family?: { name?: string } | null } | null
}

interface ApiEmployee {
  id:              number
  rut:             string
  full_name?:      string
  first_name?:     string
  surname?:        string
  second_surname?: string | null
  email?:          string | null
  personal_email?: string | null
  address?:        string | null
  city?:           string | null
  district?:       string | null
  phone?:          string | null
  gender?:         string | null
  birthday?:       string | null
  nationality?:    string | null
  active_since?:   string | null
  active_until?:   string | null
  status:          string
  health_company?: string | null
  pension_fund?:   string | null
  current_job?:    ApiJob | null
}

interface ApiVacation {
  employee_id:    number
  working_days:   number
  start_date:     string
  end_date:       string
  approved_at:    string | null
  type:           string
  status:         string
}

interface ApiLicence {
  employee_id: number
  start_date:  string
  end_date:    string
  status:      string
}

interface ApiPayroll {
  rut:          string
  employee_id:  number
  month:        number
  year:         number
  income_gross: number
  income_net:   number   // = "Sueldo Líquido" del Excel (liquid_reach no descuenta anticipos)
  lines_settlement?: { type: string; name: string; amount: number; imponible: boolean }[]
}

export interface BukApiSnapshot {
  at:               number
  year:             number
  sueldos:          SueldosRow[]
  dotacion:         DotacionRow[]
  vacaciones:       VacRow[]
  vacLicencia:      VacLicRow[]
  vacacionAprobada: VacAprobadaRaw[]
}

const DAY_MS = 86_400_000

const toDate = (s: string | null | undefined) => (s ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null)

// Fecha de hoy en Chile (YYYY-MM-DD)
const chileToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })

// Mismo formato que "Nombre Completo" del Excel BUK: "Apellido1 Apellido2 Nombres"
const bukName = (e: ApiEmployee) => [e.surname, e.second_surname, e.first_name].filter(Boolean).join(' ').trim()

const VACATION_TYPE: Record<string, string> = {
  legales: 'Legales', dias_administrativos: 'Administrativos', progresivas: 'Progresivas',
}

// Ejecuta fn sobre items con concurrencia acotada (la API de BUK limita la tasa)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]) }
  }))
  return out
}

// Días de [start, end] que caen dentro de [from, to] (fechas YYYY-MM-DD, inclusivas)
function overlapDays(start: string, end: string, from: string, to: string): number {
  const a = Math.max(Date.parse(start), Date.parse(from))
  const b = Math.min(Date.parse(end), Date.parse(to))
  return b < a ? 0 : Math.round((b - a) / DAY_MS) + 1
}

// De las fichas BUK de un RUT, la vigente (activa) o, si no hay, la última en terminar
function pickFicha(fichas: ApiEmployee[]): ApiEmployee {
  return fichas.find(f => f.status === 'activo')
    ?? [...fichas].sort((a, b) => (b.active_until ?? '').localeCompare(a.active_until ?? ''))[0]
}

async function loadEntity(entity: LegalEntity, year: number) {
  const today      = chileToday()
  const yearStart  = `${year}-01-01`
  const [curY, curM] = today.split('-').map(Number)
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEnd   = new Date(Date.UTC(curY, curM, 0)).toISOString().slice(0, 10)

  const [employees, vacations, licences, periods] = await Promise.all([
    bukGetAll<ApiEmployee>(entity, '/employees'),
    bukGetAll<ApiVacation>(entity, '/vacations'),
    bukGetAll<ApiLicence>(entity, '/absences/licence'),
    bukGetAll<{ month: string; status: string }>(entity, '/process_periods'),
  ])
  const byId = new Map(employees.map(e => [e.id, e]))

  // ── Dotación: una fila por RUT; fichas activas o terminadas durante el año ─
  const fichasByRut = new Map<string, ApiEmployee[]>()
  for (const e of employees) {
    const rut = normalizeRut(e.rut)
    fichasByRut.set(rut, [...(fichasByRut.get(rut) ?? []), e])
  }
  const dotacion: DotacionRow[] = []
  for (const [rut, fichas] of fichasByRut) {
    const e = pickFicha(fichas)
    if (e.status !== 'activo' && (e.active_until ?? '') < yearStart) continue
    const job  = e.current_job ?? {}
    const boss = job.boss ? byId.get(job.boss.id) : undefined
    const contract = job.contract_type === 'Fijo' ? 'Plazo fijo' : (job.contract_type ?? '')
    dotacion.push({
      legalEntity:      entity,
      rut,
      nombre:           bukName(e),
      estado:           e.status === 'activo' ? 'Activo' : 'Inactivo',
      afp:              (e.pension_fund ?? '').toLowerCase(),
      isapre:           (e.health_company ?? '').toLowerCase(),
      cargo:            job.role?.name ?? '',
      familaCargo:      job.role?.role_family?.name ?? '',
      supervisorNombre: boss?.full_name?.trim() ?? '',   // mismo formato que el Excel
      supervisorCargo:  boss?.current_job?.role?.name ?? '',
      jornada:          job.periodicity ?? '',
      tipoContrato:     contract,
      fechaIngreso:     toDate(e.active_since),
      fechaVencimiento: toDate(job.contract_finishing_date_2 ?? job.contract_finishing_date_1),
      city:             e.city ?? '',
      commune:          e.district ?? '',
      address:          e.address ?? '',
      excelEmail:       e.email ?? '',
      personalEmail:    e.personal_email ?? '',
      birthDate:        toDate(e.birthday),
      gender:           e.gender ?? '',
      nationality:      e.nationality ?? '',
      phone:            e.phone ?? '',
    })
  }

  // ── Sueldos: liquidaciones de los períodos cerrados del año ─────────────
  const closedMonths = periods
    .filter(p => p.status === 'cerrado' && p.month.startsWith(`${year}-`))
    .map(p => Number(p.month.slice(5, 7)))
  const payrolls = (await mapLimit(closedMonths, 3, m =>
    bukGetAll<ApiPayroll>(entity, `/payroll_detail/month?date=01-${String(m).padStart(2, '0')}-${year}`))).flat()
  const sueldos: SueldosRow[] = []
  for (const p of payrolls) {
    const rut = normalizeRut(p.rut)
    const grossSalary  = Math.round(p.income_gross ?? 0)
    const liquidSalary = Math.round(p.income_net ?? 0)
    if (!grossSalary && !liquidSalary) continue
    const emp = byId.get(p.employee_id)
    const items = (p.lines_settlement ?? [])
      .filter(l => l.type === 'haber' && l.amount)
      .map(l => ({ name: l.name, amount: Math.round(l.amount), taxable: l.imponible }))
    sueldos.push({
      key: `${entity}|${rut}|${p.year}|${p.month}`, legalEntity: entity, rut,
      nombre: emp ? bukName(emp) : '', year: p.year, month: p.month, grossSalary, liquidSalary, items,
    })
  }

  // ── Vacaciones aprobadas: las del año ya iniciadas y todas las futuras ──
  const vacaciones: VacRow[] = []
  const vacacionAprobada: VacAprobadaRaw[] = []
  for (const v of vacations) {
    if (v.status !== 'approved' || v.start_date < yearStart) continue
    const emp = byId.get(v.employee_id)
    if (!emp) continue
    const rut      = normalizeRut(emp.rut)
    const tipo     = VACATION_TYPE[v.type] ?? v.type
    const startDate = toDate(v.start_date)!, endDate = toDate(v.end_date)!
    const common = {
      legalEntity: entity, startDate, endDate, days: v.working_days, tipo,
      // approved_by_id es un usuario BUK, no un id de ficha: no se puede resolver a nombre
      aprobadoPor: '', fechaAprobacion: toDate(v.approved_at),
    }
    if (v.start_date > today) {
      vacacionAprobada.push({ ...common, rut, apellido: emp.surname ?? '', nombre: emp.first_name ?? '', periodo: '' })
    } else {
      vacaciones.push({ ...common, key: `vac|${rut}|${v.start_date}`, rut, nombre: bukName(emp) })
    }
  }

  // ── Saldos de vacaciones del mes en curso (fichas activas) ──────────────
  const active = employees.filter(e => e.status === 'activo')
  const stocks = await mapLimit(active, 4, e =>
    bukGetJson<{ vacations?: { name: string; stock: number }[] }>(entity, `/employees/${e.id}/vacations_available`))
  const vacLicencia: VacLicRow[] = active.map((e, i) => {
    const stock = Object.fromEntries((stocks[i].vacations ?? []).map(s => [s.name, s.stock]))
    const rut   = normalizeRut(e.rut)
    const diasLicencias = licences
      .filter(l => l.employee_id === e.id && l.status === 'approved')
      .reduce((n, l) => n + overlapDays(l.start_date, l.end_date, monthStart, monthEnd), 0)
    const vacacionesTomadas = vacations
      .filter(v => v.employee_id === e.id && v.status === 'approved' && v.start_date >= monthStart && v.start_date <= monthEnd)
      .reduce((n, v) => n + v.working_days, 0)
    return {
      key: `vaclic|${entity}|${rut}|${curY}|${curM}`, legalEntity: entity, rut, nombre: bukName(e),
      year: curY, month: curM,
      saldoLegal:           stock.legales ?? 0,
      saldoProgresivas:     stock.progresivas ?? 0,
      saldoAdministrativos: stock.dias_administrativos ?? 0,
      diasLicencias, vacacionesTomadas,
      source: 'API',
    }
  })

  return { dotacion, sueldos, vacaciones, vacLicencia, vacacionAprobada }
}

export async function loadBukApiSnapshot(year: number): Promise<BukApiSnapshot> {
  const parts = await Promise.all(BUK_ENTITIES.map(e => loadEntity(e, year)))
  const vacKeys = new Set<string>()
  return {
    at:   Date.now(),
    year,
    sueldos:  parts.flatMap(p => p.sueldos),
    // Fichas activas primero: si un RUT está en ambas razones sociales, manda la vigente
    dotacion: parts.flatMap(p => p.dotacion).sort((a, b) => Number(b.estado === 'Activo') - Number(a.estado === 'Activo')),
    vacaciones: parts.flatMap(p => p.vacaciones).filter(v => !vacKeys.has(v.key) && vacKeys.add(v.key)),
    vacLicencia:      parts.flatMap(p => p.vacLicencia),
    vacacionAprobada: parts.flatMap(p => p.vacacionAprobada),
  }
}
