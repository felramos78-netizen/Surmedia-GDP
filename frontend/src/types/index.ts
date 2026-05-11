export type UserRole = 'ADMIN' | 'RRHH_MANAGER' | 'RRHH_ANALYST' | 'MANAGER' | 'EMPLOYEE'

export type CostType = 'DIRECTO' | 'INDIRECTO'

export interface WorkCenterIngreso {
  id: string
  name: string
  amount: number
  createdAt: string
}

export interface WorkCenter {
  id: string
  name: string
  costType: CostType
  presupuesto?: number | null
  ubicacion?: string | null
  totalPersonnel?: number
  positions?: { title: string; count: number }[]
  employeeIds?: string[]
  ingresos: WorkCenterIngreso[]
  totalIngresos: number
  createdAt: string
  updatedAt: string
}

export interface EmployeeWorkCenter {
  id: string
  workCenterId: string
  legalEntity: LegalEntity
  startYear: number
  startMonth: number
  endYear?: number | null
  endMonth?: number | null
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

export type LeaveType = 'VACACIONES' | 'PERMISO' | 'LICENCIA_MEDICA' | 'LICENCIA_MATERNIDAD' | 'LICENCIA_PATERNIDAD' | 'OTRO'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Leave {
  id: string
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  status: LeaveStatus
  createdAt: string
}

export interface VacationBalance {
  id: string
  legalEntity: LegalEntity
  year: number
  month: number
  saldoLegal: number
  saldoProgresivas: number
  saldoAdministrativos: number
  diasLicencias: number
  vacacionesTomadas: number
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
  vinculo?: string | null
  reemplazaA?: string | null
  contracts?: Contract[]
  workCenters?: EmployeeWorkCenter[]
  leaves?: Leave[]
  vacationBalances?: VacationBalance[]
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
    jobTitle?: string | null
    costCenter?: string | null
    endDate?: string | null
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

export interface SubTaskInstance {
  id:                  string
  name:                string
  responsableProfileId?: string | null
  tool?:               string | null
  plantilla?:          string | null
  sortOrder:           number
  completedAt:         string | null
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
  subTasks?:        SubTaskInstance[]
  assignments?:     TaskAssignment[]
}

export interface OnboardingProcess {
  id:                   string
  collaboratorRut?:           string | null
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

export interface OnboardingSheetTemplate {
  id:             string
  key:            string
  name:           string
  url:            string
  rutColumn:      string
  columnMappings: Record<string, string>
  sheetName?:     string | null
  description?:   string | null
  isActive:       boolean
  createdAt:      string
  updatedAt:      string
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

// ─── Onboarding: Email Templates ─────────────────────────────────────────────

export interface EmailTemplateVariable {
  name:    string
  example: string
}

export interface EmailTemplate {
  id:        string
  key:       string
  name:      string
  subject:   string
  bodyHtml:  string
  variables: EmailTemplateVariable[]
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

export interface EmailLog {
  id:          string
  processId?:  string | null
  taskId?:     string | null
  toEmail:     string
  subject:     string
  status:      'SENT' | 'SKIPPED' | 'FAILED'
  error?:      string | null
  templateKey?: string | null
  sentAt:      string
}

// ─── Onboarding: Template Tasks ──────────────────────────────────────────────

export interface OnboardingTemplateSubTask {
  id:                  string
  templateTaskId:      string
  name:                string
  responsableProfileId?: string | null
  responsable?:        { id: string; name: string } | null
  tool?:               string | null
  plantilla?:          string | null
  sortOrder:           number
}

export interface OnboardingDbTemplateTask {
  id:              string
  key:             string
  period:          OnboardingPeriod
  name:            string
  tool?:           string | null
  automationType:  TaskAutomationType
  automationConfig: Record<string, any> | null
  appliesWhen?:    string | null
  sortOrder:       number
  isActive:        boolean
  taskType:        string
  responsableProfileId?: string | null
  responsable?:    { id: string; name: string; position?: string } | null
  appliesTo:       string[]
  subTasks:        OnboardingTemplateSubTask[]
  createdAt:       string
  updatedAt:       string
}

// ─── Onboarding: Forms ───────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'date' | 'select' | 'radio' | 'checkbox'

export interface FormField {
  id:          string
  label:       string
  type:        FormFieldType
  required:    boolean
  options?:    string[]
  placeholder?: string
}

export interface OnboardingForm {
  id:        string
  processId: string
  process?:  { id: string; collaboratorName: string }
  title:     string
  fields:    FormField[]
  token:     string
  isActive:  boolean
  responses?: FormResponse[]
  _count?:   { responses: number }
  createdAt: string
  updatedAt: string
}

export interface FormResponse {
  id:              string
  formId:          string
  respondentName?:  string | null
  respondentEmail?: string | null
  data:            Record<string, unknown>
  submittedAt:     string
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
