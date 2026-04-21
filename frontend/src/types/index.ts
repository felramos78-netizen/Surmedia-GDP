export type UserRole = 'ADMIN' | 'RRHH_MANAGER' | 'RRHH_ANALYST' | 'MANAGER' | 'EMPLOYEE'

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

export interface Employee {
  id: string
  rut: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  birthDate?: string
  address?: string
  nationality?: string
  gender?: string
  position?: Position
  positionId?: string
  department?: Department
  departmentId?: string
  managerId?: string
  startDate: string
  endDate?: string
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
  afp?: string
  isapre?: string
  previredCode?: string
  contracts?: Contract[]
  leaves?: Leave[]
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  code: string
  parentId?: string
  parent?: { id: string; name: string }
  _count?: { employees: number }
}

export interface Position {
  id: string
  title: string
  departmentId: string
  department?: { id: string; name: string }
  level?: string
  _count?: { employees: number }
}

export interface Contract {
  id: string
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'rut'>
  type: 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
  startDate: string
  endDate?: string
  salary: number
  currency: string
  isActive: boolean
  fileUrl?: string
  createdAt: string
  updatedAt: string
}

export type LeaveType =
  | 'VACACIONES'
  | 'PERMISO'
  | 'LICENCIA_MEDICA'
  | 'LICENCIA_MATERNIDAD'
  | 'LICENCIA_PATERNIDAD'
  | 'OTRO'

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Leave {
  id: string
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'rut'>
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: LeaveStatus
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  activeEmployees: number
  expiringContracts: number
  pendingLeaves: number
  upcomingBirthdays: Array<{
    id: string
    firstName: string
    lastName: string
    birthDate: string
    daysUntil: number
    nextBirthday: string
    position?: { title: string }
  }>
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
