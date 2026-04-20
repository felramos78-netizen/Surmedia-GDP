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
  position?: Position
  department?: Department
  contractType?: 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
  startDate: string
  endDate?: string
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
  afp?: string
  isapre?: string
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  code: string
  managerId?: string
  parentId?: string
}

export interface Position {
  id: string
  title: string
  departmentId: string
  level?: string
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
