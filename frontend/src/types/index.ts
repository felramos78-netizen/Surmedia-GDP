export type UserRole = 'ADMIN' | 'RRHH_MANAGER' | 'RRHH_ANALYST' | 'MANAGER' | 'EMPLOYEE'

export type CostType = 'DIRECTO' | 'INDIRECTO'

export interface WorkCenter {
  id: string
  name: string
  costType: CostType
  totalPersonnel?: number
  positions?: { title: string; count: number }[]
  createdAt: string
  updatedAt: string
}

export interface EmployeeWorkCenter {
  id: string
  workCenterId: string
  legalEntity: LegalEntity
  workCenter: { id: string; name: string; costType: CostType }
}
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'DUPLICATE'
export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
export type LegalEntity = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'

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
  jobTitle?: string | null
  costCenter?: string | null
  exclusive?: boolean | null
  contracts?: Contract[]
  workCenters?: EmployeeWorkCenter[]
  createdAt: string
  updatedAt: string
}


export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  duplicate: number
  expiring: number
  inBoth: number
  activeComunicaciones: number
  inactiveComunicaciones: number
  activeConsultoria: number
  inactiveConsultoria: number
}

export interface PayrollRawEntry {
  id: string
  employeeId: string
  legalEntity: string
  year: number
  month: number
  grossSalary: number
  liquidSalary: number
  items: PayrollItem[]
  employee: {
    id: string; firstName: string; lastName: string; rut: string; status: EmployeeStatus
    workCenters?: { legalEntity: string; workCenter: { name: string } }[]
  }
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
export type TaskAutomationType  = 'MANUAL' | 'EMAIL' | 'CALENDAR' | 'BUK_CHECK' | 'EXTERNAL' | 'SHEET_VERIFY'
export type AutomationStatus    = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'

export interface TaskAssignment {
  id:        string
  taskId:    string
  profileId: string
  profile:   { id: string; name: string; position: string; email: string }
  roleType:  string
  createdAt: string
}

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
  assignments?:     TaskAssignment[]
}

export interface OnboardingProcess {
  id:                   string
  collaboratorName:           string
  collaboratorEmail?:         string | null
  collaboratorPersonalEmail?: string | null
  collaboratorPosition?:      string | null
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

export interface ProfileRole {
  id:       string
  area:     string
  roleType: string
}

export interface Profile {
  id:        string
  name:      string
  position:  string
  email:     string
  phone?:    string | null
  notes?:    string | null
  roles:     ProfileRole[]
  createdAt: string
  updatedAt: string
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
