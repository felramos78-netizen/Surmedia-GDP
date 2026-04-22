// Tipos que reflejan la respuesta real de la API BUK v2
// Ajustar nombres de campos si difieren al inspeccionar la respuesta real

export type BukLegalEntity = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'

export interface BukCompanyConfig {
  legalEntity: BukLegalEntity
  name: string
  baseUrl: string
  apiKey: string
  asistenciaKey: string
  editorKey: string
}

// ─── Respuesta paginada genérica de BUK ───────────────────────────────────────

export interface BukPaginatedResponse<T> {
  data?: T[]
  employees?: T[]   // BUK usa a veces "employees" como root key
  meta?: {
    current_page: number
    total_pages: number
    total_count: number
    per_page: number
  }
  // BUK también puede devolver paginación en headers: x-total, x-page
}

// ─── Colaborador en BUK ───────────────────────────────────────────────────────

export interface BukEmployee {
  id: number
  rut: string                    // ej: "12.345.678-9" o "12345678-9"
  first_name: string
  first_last_name: string
  second_last_name?: string
  email?: string
  personal_email?: string
  active: boolean
  entry_date: string             // ISO "2022-03-01"
  exit_date?: string | null
  gender?: 'male' | 'female' | 'other' | string
  birthday?: string
  nationality?: string
  address?: string
  phone?: string

  job?: {
    id: number
    name: string
  }
  department?: {
    id: number
    name: string
  }
  cost_center?: {
    id: number
    name: string
  }

  contract_type?: string         // "indefinido" | "plazo_fijo" | "honorarios" | "practica"
  afp?: string | { id: number; name: string }
  health_institution?: string | { id: number; name: string }

  // Remuneraciones — clave para la lógica de deduplicación
  gross_salary?: number | null   // sueldo bruto en CLP
  liquid_salary?: number | null  // sueldo líquido: si es 0/null → registro duplicado
}

// ─── Contrato en BUK (endpoint /contracts si existe por separado) ─────────────

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

// ─── Resultado del proceso de deduplicación ──────────────────────────────────

export interface BukDeduplicationResult {
  rut: string
  bukEmployee: BukEmployee
  legalEntity: BukLegalEntity
  isDuplicate: boolean  // true → existe en la otra empresa con salary > 0
}

// ─── Resultado del proceso de sync de un colaborador ─────────────────────────

export interface BukSyncEmployeeResult {
  rut: string
  action: 'created' | 'updated' | 'skipped'
  employeeId?: string
}
