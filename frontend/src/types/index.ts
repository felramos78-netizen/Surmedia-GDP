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
  // Campos extendidos
  city?: string | null
  commune?: string | null
  personalEmail?: string | null
  workSchedule?: string | null
  supervisorName?: string | null
  supervisorTitle?: string | null
  jobFamily?: string | null
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

export interface PayrollItem {
  name: string
  amount: number
  taxable?: boolean
  category?: string
  type?: string
}

export interface PayrollEntry {
  id: string
  year: number
  month: number
  legalEntity: string
  grossSalary: number
  liquidSalary: number
  items: PayrollItem[]
}

export type OnboardingPeriod    = 'PRE_INGRESO' | 'DIA_1' | 'SEMANA_1' | 'MES_1' | 'EVALUACION'
export type OnboardingStatus    = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TaskAutomationType  = 'MANUAL' | 'EMAIL' | 'CALENDAR' | 'BUK_CHECK' | 'EXTERNAL'
export type AutomationStatus    = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'

export interface OnboardingTask {
  id:               string
  processId:        string
  templateId?:      string | null
  period:           OnboardingPeriod
  name:             string
  tool?:            string | null
  appliesWhen?:     string | null
  sortOrder:        number
  automationType:   TaskAutomationType
  automationConfig: Record<string, any> | null
  automationStatus: AutomationStatus | null
  automationResult: Record<string, any> | null
  automatedAt?:     string | null
  completedAt?:     string | null
  completedBy?:     string | null
  completedNote?:   string | null
}

export interface OnboardingProcess {
  id:                   string
  collaboratorName:     string
  collaboratorEmail?:   string | null
  collaboratorPosition?: string | null
  collaboratorPhone?:   string | null
  legalEntity?:         string | null
  notes?:               string | null
  employeeId?:          string | null
  employee?:            Employee | null
  status:               OnboardingStatus
  startDate:            string
  expectedEndDate:      string
  completedAt?:         string | null
  tasks:                OnboardingTask[]
  createdAt:            string
  updatedAt:            string
}

export interface OnboardingTemplateTask {
  id:              string
  period:          OnboardingPeriod
  name:            string
  tool:            string
  automationType:  TaskAutomationType
  automationConfig: Record<string, any> | null
  appliesWhen:     string | null
  sortOrder:       number
}

export interface OnboardingStats {
  inProgress:      number
  completed:       number
  cancelled:       number
  finalizingSoon:  number
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
