export type BukLegalEntity = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'

export interface BukCompanyConfig {
  legalEntity: BukLegalEntity
  name: string
  baseUrl: string
  apiKey: string
  asistenciaKey: string
  editorKey: string
}

// ─── Respuesta paginada genérica ──────────────────────────────────────────────

export interface BukPaginatedResponse<T> {
  data?: T[]
  pagination?: {
    next: string | null
    previous: string | null
    count: number
    total_pages: number
  }
}

// ─── Colaborador en BUK ───────────────────────────────────────────────────────

export interface BukEmployee {
  id: number
  person_id?: number
  rut: string
  first_name: string
  surname: string
  second_surname?: string
  full_name?: string
  email?: string
  personal_email?: string
  active: boolean
  status?: string           // 'active' | 'inactive' | 'pending'
  start_date?: string
  end_date?: string | null
  gender?: string
  birthday?: string
  nationality?: string
  address?: string
  phone?: string
  city?: string
  district?: string         // comuna

  current_job?: {
    id: number
    name: string
    contract_type?: string
    start_date?: string
    end_date?: string | null
    area_id?: number
    area_name?: string
    working_schedule?: string
    base_wage?: number
  }
  department?: {
    id: number
    name: string
  }
  cost_center?: {
    id: number
    name: string
  }

  contract_type?: string
  afp?: string | { id: number; name: string }
  health_institution?: string | { id: number; name: string }

  gross_salary?: number | null
  liquid_salary?: number | null
}

// ─── Período de proceso de remuneraciones ─────────────────────────────────────

export interface BukProcessPeriod {
  id: number
  name?: string
  start_date: string
  end_date: string
  year?: number
  month?: number
  closed?: boolean
}

// ─── Item de liquidación (haber o descuento) ──────────────────────────────────

export interface BukPayrollItem {
  name: string
  amount: number
  taxable?: boolean
  category?: string
  type?: string
}

// ─── Liquidación de un colaborador en un período ──────────────────────────────

export interface BukEmployeeSettlement {
  employee_id: number
  process_period_id?: number
  gross_salary?: number
  liquid_salary?: number
  total_haberes?: number
  total_descuentos?: number
  items?: BukPayrollItem[]
  payment_items?: BukPayrollItem[]
}

// ─── Contrato en BUK ──────────────────────────────────────────────────────────

export interface BukContract {
  id: number
  employee_id: number
  type: string
  start_date: string
  end_date?: string | null
  gross_salary: number
  liquid_salary?: number | null
  active: boolean
}

// ─── Resultados internos ──────────────────────────────────────────────────────

export interface BukDeduplicationResult {
  rut: string
  bukEmployee: BukEmployee
  legalEntity: BukLegalEntity
  isDuplicate: boolean
}

export interface BukSyncEmployeeResult {
  rut: string
  action: 'created' | 'updated' | 'skipped'
  employeeId?: string
}
