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

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
export type LeaveType = 'VACACIONES' | 'PERMISO' | 'LICENCIA_MEDICA' | 'LICENCIA_MATERNIDAD' | 'LICENCIA_PATERNIDAD' | 'OTRO'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Department {
  id: string
  name: string
  code: string
  parentId?: string
  _count?: { employees: number }
}

export interface Position {
  id: string
  title: string
  departmentId: string
  level?: string
  department?: { name: string }
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
  positionId?: string
  departmentId?: string
  managerId?: string
  position?: Position
  department?: Department
  status: EmployeeStatus
  startDate: string
  endDate?: string
  afp?: string
  isapre?: string
  previredCode?: string
  contracts?: Contract[]
  leaves?: Leave[]
  createdAt: string
  updatedAt: string
}

export interface Contract {
  id: string
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'rut'>
  type: ContractType
  startDate: string
  endDate?: string
  salary: number
  currency: string
  isActive: boolean
  fileUrl?: string
  createdAt: string
}

export interface Leave {
  id: string
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName'> & { department?: { name: string } }
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  reason?: string
  status: LeaveStatus
  approvedBy?: string
  approvedAt?: string
  createdAt: string
}

export interface DashboardStats {
  activeEmployees: number
  expiringContracts: number
  pendingLeaves: number
  recentActivity: Array<{
    id: string
    firstName: string
    lastName: string
    department?: { name: string }
    createdAt: string
  }>
  upcomingBirthdays: Array<{
    id: string
    name: string
    birthDate: string
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
