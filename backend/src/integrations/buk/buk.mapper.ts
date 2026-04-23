import { ContractType, EmployeeStatus, LegalEntity } from '@prisma/client'
import type { BukEmployee, BukLegalEntity } from './buk.types'

// ─── Normalización de RUT ─────────────────────────────────────────────────────

// BUK puede devolver RUT con o sin puntos: "12.345.678-9" o "12345678-9"
// GDP guarda el formato estándar con puntos: "12.345.678-9"
export function normalizeRut(raw: string): string {
  const clean = raw.replace(/\./g, '').trim()
  const [body, dv] = clean.split('-')
  if (!body || !dv) return raw  // devolver tal cual si el formato es inesperado

  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv.toUpperCase()}`
}

// ─── Mapeo de tipo de contrato ────────────────────────────────────────────────

const CONTRACT_TYPE_MAP: Record<string, ContractType> = {
  indefinido:   ContractType.INDEFINIDO,
  plazo_fijo:   ContractType.PLAZO_FIJO,
  honorarios:   ContractType.HONORARIOS,
  practica:     ContractType.PRACTICA,
  // variantes adicionales que BUK podría enviar
  'plazo fijo': ContractType.PLAZO_FIJO,
  'a honorarios': ContractType.HONORARIOS,
  práctica:     ContractType.PRACTICA,
}

export function mapContractType(bukType?: string): ContractType {
  if (!bukType) return ContractType.INDEFINIDO
  return CONTRACT_TYPE_MAP[bukType.toLowerCase()] ?? ContractType.INDEFINIDO
}

// ─── Extracción de nombre de AFP/Isapre ──────────────────────────────────────

function extractName(value: string | { id: number; name: string } | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.name
}

// ─── Lógica de deduplicación ─────────────────────────────────────────────────
// Regla: si sueldo líquido es 0 o null → el registro es duplicado en esa empresa.
// El original está en la otra razón social.

export function isDuplicateEmployee(emp: BukEmployee): boolean {
  const liquid = emp.liquid_salary
  return liquid === null || liquid === undefined || liquid === 0
}

// ─── Mapeo BukEmployee → datos para upsert de Employee ───────────────────────

export function mapEmployeeUpsert(emp: BukEmployee) {
  const fullLastName = [emp.surname, emp.second_surname]
    .filter(Boolean)
    .join(' ')

  const rawStartDate = emp.start_date ?? emp.current_job?.start_date
  const startDate = rawStartDate ? new Date(rawStartDate) : new Date()

  return {
    rut:         normalizeRut(emp.rut),
    firstName:   emp.first_name,
    lastName:    fullLastName,
    email:       emp.email ?? `${emp.id}@buk.surmedia.cl`,
    phone:       emp.phone ?? null,
    birthDate:   emp.birthday ? new Date(emp.birthday) : null,
    address:     emp.address ?? null,
    nationality: emp.nationality ?? 'Chilena',
    gender:      emp.gender ?? null,
    startDate,
    endDate:     emp.end_date ? new Date(emp.end_date) : null,
    status:      (emp.current_job != null && !emp.end_date) ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE,
    afp:         extractName(emp.afp) ?? null,
    isapre:      extractName(emp.health_institution) ?? null,
  }
}

// ─── Mapeo BukEmployee → datos para upsert de Contract ───────────────────────

export function mapContractUpsert(emp: BukEmployee, legalEntity: BukLegalEntity) {
  const rawStartDate = emp.start_date ?? emp.current_job?.start_date
  const startDate = rawStartDate ? new Date(rawStartDate) : new Date()
  const contractType = emp.contract_type ?? emp.current_job?.contract_type
  return {
    type:          mapContractType(contractType),
    startDate,
    endDate:       emp.end_date ? new Date(emp.end_date) : null,
    salary:        emp.liquid_salary ?? 0,
    grossSalary:   emp.gross_salary ?? null,
    currency:      'CLP',
    isActive:      emp.current_job != null && !emp.end_date,
    legalEntity:   legalEntity as LegalEntity,
    bukEmployeeId: emp.id,
  }
}

// ─── Deduplicación cross-empresa ─────────────────────────────────────────────
// Recibe empleados de ambas empresas y determina cuáles son duplicados.
// Retorna un Set de (rut + legalEntity) que deben saltearse.

export function buildDuplicateSet(
  empleadosPorEmpresa: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }>
): Set<string> {
  // Mapa: rut → [{ legalEntity, liquid_salary }]
  const rutMap = new Map<string, Array<{ legalEntity: BukLegalEntity; liquid: number | null }>>()

  for (const { legalEntity, employees } of empleadosPorEmpresa) {
    for (const emp of employees) {
      const rut = normalizeRut(emp.rut)
      if (!rutMap.has(rut)) rutMap.set(rut, [])
      rutMap.get(rut)!.push({ legalEntity, liquid: emp.liquid_salary ?? null })
    }
  }

  const duplicates = new Set<string>()

  for (const [rut, entries] of rutMap) {
    if (entries.length < 2) continue  // solo aparece en una empresa → no hay duplicado

    // Aparece en ambas empresas
    const withSalary    = entries.filter(e => e.liquid !== null && e.liquid > 0)
    const withoutSalary = entries.filter(e => !e.liquid || e.liquid === 0)

    if (withSalary.length === 2) {
      // Dos contratos activos con sueldo → persona válida en ambas empresas, ninguno es duplicado
      continue
    }

    // El que no tiene sueldo es el duplicado
    for (const dup of withoutSalary) {
      duplicates.add(`${rut}::${dup.legalEntity}`)
    }
  }

  return duplicates
}
