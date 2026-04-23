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

export type LeaveType = 'VACACIONES' | 'PERMISO' | 'LICENCIA_MEDICA' | 'LICENCIA_MATERNIDAD' | 'LICENCIA_PATERNIDAD' | 'OTRO'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Leave {
  id: string
  employeeId: string
  employee?: { id: string; firstName: string; lastName: string; rut: string; position?: { title: string } | null }
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  status: LeaveStatus
  approvedBy?: string | null
  approvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  activeEmployees: number
  pendingLeaves: number
  expiringContracts: Array<{ id: string; type: ContractType; endDate: string; employee: { id: string; firstName: string; lastName: string; rut: string } }>
  birthdaysThisMonth: Array<{ id: string; name: string; position: string | null; birthDate: string; day: number }>
  recentSyncs: SyncLog[]
  byDepartment: Array<{ id: string; name: string; count: number }>
  byContractType: Array<{ type: ContractType; count: number }>
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
