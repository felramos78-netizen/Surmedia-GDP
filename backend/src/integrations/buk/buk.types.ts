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
  status?: string           // 'activo' | 'inactivo' (español)
  active_since?: string
  start_date?: string
  end_date?: string | null
  gender?: string
  birthday?: string
  nationality?: string
  address?: string
  phone?: string
  city?: string
  district?: string         // comuna
  termination_reason?: string | null

  // Cargo/rol — en BUK viene como campo raíz separado de current_job
  role?: {
    id: number
    code?: string
    name: string            // título del cargo (e.g. "Realizador Audiovisual")
    description?: string
    role_family?: {
      id: number
      name: string          // familia de cargo (e.g. "Audiovisual")
    }
  }

  current_job?: {
    id: number
    contract_type?: string
    start_date?: string
    end_date?: string | null
    active_until?: string | null
    area_id?: number
    area_name?: string
    working_schedule_type?: string  // e.g. "ordinaria_art_22"
    base_wage?: number
    cost_center?: string            // string simple (e.g. "Otros", "Santiago")
    project?: string | null
    boss?: {
      id: number
      document_type?: string
      document_number?: string
      rut?: string
    }
    days?: string[]
    periodicity?: string
    frequency?: string
  }

  department?: {
    id: number
    name: string
  }

  contract_type?: string
  exclusive?: boolean
  afp?: string | { id: number; name: string }
  health_institution?: string | { id: number; name: string }
  health_company?: string         // también puede venir como string directo

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
