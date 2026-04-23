export type UserRole = 'ADMIN' | 'RRHH_MANAGER' | 'RRHH_ANALYST' | 'MANAGER' | 'EMPLOYEE'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
export type LegalEntity = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'
export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'ERROR'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  employeeId?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Department {
  id: string
  name: string
  code: string
  parentId?: string
}

export interface Position {
  id: string
  title: string
  departmentId: string
  level?: string
}

export interface Contract {
  id: string
  employeeId: string
  type: ContractType
  startDate: string
  endDate?: string | null
  salary: number
  grossSalary?: number | null
  currency: string
  isActive: boolean
  legalEntity?: LegalEntity | null
  bukEmployeeId?: number | null
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  rut: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  birthDate?: string | null
  address?: string | null
  nationality?: string | null
  gender?: string | null
  position?: Position | null
  positionId?: string | null
  department?: Department | null
  departmentId?: string | null
  status: EmployeeStatus
  startDate: string
  endDate?: string | null
  afp?: string | null
  isapre?: string | null
  contracts?: Contract[]
  createdAt: string
  updatedAt: string
}

export interface SyncLog {
  id: string
  source: string
  legalEntity: LegalEntity
  status: SyncStatus
  startedAt: string
  completedAt?: string | null
  employeesTotal: number
  employeesCreated: number
  employeesUpdated: number
  contractsUpserted: number
  duplicatesSkipped: number
  errorMessage?: string | null
}

export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  expiring: number
  inBoth: number
}

export interface SyncPreviewEntry {
  rut: string
  firstName: string
  lastName: string
  department?: string
  position?: string
  startDate?: string | null
  endDate?: string | null
}

export interface SyncPreviewResult {
  legalEntity: string
  employeesTotal: number
  toCreate: number
  toUpdate: number
  duplicatesSkipped: number
  newEntries: SyncPreviewEntry[]
  dateRange: { min: string | null; max: string | null }
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
