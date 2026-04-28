import { ContractType, EmployeeStatus, LegalEntity } from '@prisma/client'
import type { BukEmployee, BukLegalEntity } from './buk.types'

// ─── Normalización de RUT ─────────────────────────────────────────────────────

export function normalizeRut(raw: string): string {
  const clean = raw.replace(/\./g, '').trim()
  const [body, dv] = clean.split('-')
  if (!body || !dv) return raw
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv.toUpperCase()}`
}

// ─── Mapeo de tipo de contrato ────────────────────────────────────────────────

const CONTRACT_TYPE_MAP: Record<string, ContractType> = {
  indefinido:      ContractType.INDEFINIDO,
  plazo_fijo:      ContractType.PLAZO_FIJO,
  honorarios:      ContractType.HONORARIOS,
  practica:        ContractType.PRACTICA,
  'plazo fijo':    ContractType.PLAZO_FIJO,
  'a honorarios':  ContractType.HONORARIOS,
  práctica:        ContractType.PRACTICA,
}

export function mapContractType(bukType?: string): ContractType {
  if (!bukType) return ContractType.INDEFINIDO
  return CONTRACT_TYPE_MAP[bukType.toLowerCase()] ?? ContractType.INDEFINIDO
}

// ─── Extracción de nombre AFP/Isapre ─────────────────────────────────────────

function extractName(value: string | { id: number; name: string } | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.name
}

// ─── Lógica de activo/inactivo ────────────────────────────────────────────────
// Regla: si end_date existe Y es PASADA → INACTIVO. Cualquier otro caso → ACTIVO.
// Cubre: sin end_date (indefinido activo), end_date futura (plazo fijo vigente),
//        end_date pasada (contrato terminado = inactivo).

export function resolveEmployeeStatus(emp: BukEmployee): EmployeeStatus {
  const s = emp.status?.toLowerCase().trim()
  if (s === 'activo')   return EmployeeStatus.ACTIVE
  if (s === 'inactivo') return EmployeeStatus.INACTIVE
  // Sin status explícito: usar end_date como fallback
  if (!emp.end_date) return EmployeeStatus.ACTIVE
  return new Date(emp.end_date) > new Date() ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE
}

// ─── Lógica de deduplicación ──────────────────────────────────────────────────

export function isDuplicateEmployee(emp: BukEmployee): boolean {
  const liquid = emp.liquid_salary
  return liquid === null || liquid === undefined || liquid === 0
}

// ─── Mapeo BukEmployee → datos para upsert de Employee ───────────────────────

export function mapEmployeeUpsert(emp: BukEmployee) {
  const fullLastName = [emp.surname, emp.second_surname].filter(Boolean).join(' ')
  const rawStartDate = emp.start_date ?? emp.current_job?.start_date
  const startDate    = rawStartDate ? new Date(rawStartDate) : new Date()
  const endDate      = emp.end_date ? new Date(emp.end_date) : null
  const status       = resolveEmployeeStatus(emp)

  return {
    rut:            normalizeRut(emp.rut),
    firstName:      emp.first_name,
    lastName:       fullLastName,
    email:          emp.email ?? `${emp.id}@buk.surmedia.cl`,
    phone:          emp.phone ?? null,
    birthDate:      emp.birthday ? new Date(emp.birthday) : null,
    address:        emp.address ?? null,
    nationality:    emp.nationality ?? 'Chilena',
    gender:         emp.gender ?? null,
    startDate,
    endDate,
    status,
    afp:            extractName(emp.afp) ?? null,
    isapre:         extractName(emp.health_institution) ?? null,
    // Campos extendidos
    city:            emp.city ?? null,
    commune:         emp.district ?? null,
    personalEmail:   emp.personal_email ?? null,
    workSchedule:    emp.current_job?.working_schedule_type ?? null,
    jobFamily:       emp.role?.role_family?.name ?? emp.department?.name ?? null,
    jobTitle:        emp.role?.name ?? null,
    costCenter:      emp.current_job?.cost_center ?? null,
    exclusive:       emp.exclusive ?? null,
    // Supervisor: BUK solo expone el RUT del jefe en current_job.boss
    supervisorName:  emp.current_job?.boss?.rut ?? null,
    supervisorTitle: null,
  }
}

// ─── Mapeo BukEmployee → datos para upsert de Contract ───────────────────────

export function mapContractUpsert(emp: BukEmployee, legalEntity: BukLegalEntity) {
  const rawStartDate = emp.start_date ?? emp.current_job?.start_date
  const startDate    = rawStartDate ? new Date(rawStartDate) : new Date()
  const endDate      = emp.end_date ? new Date(emp.end_date) : null
  const contractType = emp.current_job?.contract_type ?? emp.contract_type

  return {
    type:          mapContractType(contractType),
    startDate,
    endDate,
    salary:        emp.liquid_salary ?? 0,
    grossSalary:   emp.gross_salary ?? null,
    currency:      'CLP',
    isActive:      !endDate || endDate > new Date(),
    legalEntity:   legalEntity as LegalEntity,
    bukEmployeeId: emp.id,
  }
}

// ─── Deduplicación cross-empresa ─────────────────────────────────────────────

export interface DuplicateSetResult {
  skipSet:       Set<string> // rut::legalEntity a omitir completamente
  duplicateRuts: Set<string> // ruts a sincronizar pero marcados como DUPLICATE
}

export function buildDuplicateSet(
  empleadosPorEmpresa: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }>
): DuplicateSetResult {
  const rutMap = new Map<string, Array<{ legalEntity: BukLegalEntity; liquid: number | null }>>()

  for (const { legalEntity, employees } of empleadosPorEmpresa) {
    for (const emp of employees) {
      const rut = normalizeRut(emp.rut)
      if (!rutMap.has(rut)) rutMap.set(rut, [])
      rutMap.get(rut)!.push({ legalEntity, liquid: emp.liquid_salary ?? null })
    }
  }

  const skipSet       = new Set<string>()
  const duplicateRuts = new Set<string>()

  for (const [rut, entries] of rutMap) {
    if (entries.length < 2) continue

    const withSalary    = entries.filter(e => e.liquid !== null && e.liquid > 0)
    const withoutSalary = entries.filter(e => !e.liquid || e.liquid === 0)

    if (withoutSalary.length === 0) continue // todos tienen sueldo → legítimos

    if (withSalary.length === 0) {
      // Nadie tiene sueldo → aparecen en ambas empresas como phantoms → sincronizar como DUPLICATE
      duplicateRuts.add(rut)
      continue
    }

    // Uno tiene sueldo, el otro no → omitir el de sueldo 0
    for (const dup of withoutSalary) {
      skipSet.add(`${rut}::${dup.legalEntity}`)
    }
  }

  return { skipSet, duplicateRuts }
}
