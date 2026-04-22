import axios from 'axios'
import type { Employee, Contract, Leave, Department, Position, DashboardStats, ApiResponse, PaginatedResponse } from '@/types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gdp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gdp_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// ─── Stats ────────────────────────────────────────────────────

export const statsApi = {
  get: () => api.get<ApiResponse<DashboardStats>>('/stats').then((r) => r.data.data),
}

// ─── Employees ────────────────────────────────────────────────

export interface EmployeeFilters {
  search?: string
  departmentId?: string
  status?: string
  page?: number
  limit?: number
}

export interface CreateEmployeeInput {
  rut: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  birthDate?: string
  positionId?: string
  departmentId?: string
  startDate: string
  afp?: string
  isapre?: string
}

export const employeesApi = {
  list: (filters?: EmployeeFilters) =>
    api.get<PaginatedResponse<Employee>>('/employees', { params: filters }).then((r) => r.data),
  get: (id: string) =>
    api.get<ApiResponse<Employee>>(`/employees/${id}`).then((r) => r.data.data),
  create: (data: CreateEmployeeInput) =>
    api.post<ApiResponse<Employee>>('/employees', data).then((r) => r.data.data),
  update: (id: string, data: Partial<CreateEmployeeInput> & { status?: string }) =>
    api.put<ApiResponse<Employee>>(`/employees/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/employees/${id}`),
}

// ─── Departments ──────────────────────────────────────────────

export const departmentsApi = {
  list: () => api.get<ApiResponse<Department[]>>('/departments').then((r) => r.data.data),
  create: (data: { name: string; code: string; parentId?: string }) =>
    api.post<ApiResponse<Department>>('/departments', data).then((r) => r.data.data),
  update: (id: string, data: Partial<{ name: string; code: string }>) =>
    api.put<ApiResponse<Department>>(`/departments/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/departments/${id}`),
}

// ─── Positions ────────────────────────────────────────────────

export const positionsApi = {
  list: (departmentId?: string) =>
    api.get<ApiResponse<Position[]>>('/positions', { params: { departmentId } }).then((r) => r.data.data),
  create: (data: { title: string; departmentId: string; level?: string }) =>
    api.post<ApiResponse<Position>>('/positions', data).then((r) => r.data.data),
  update: (id: string, data: Partial<{ title: string; level: string }>) =>
    api.put<ApiResponse<Position>>(`/positions/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/positions/${id}`),
}

// ─── Contracts ────────────────────────────────────────────────

export interface CreateContractInput {
  employeeId: string
  type: 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS' | 'PRACTICA'
  startDate: string
  endDate?: string
  salary: number
}

export const contractsApi = {
  list: (params?: { employeeId?: string; expiringSoon?: boolean }) =>
    api.get<ApiResponse<Contract[]>>('/contracts', { params }).then((r) => r.data.data),
  create: (data: CreateContractInput) =>
    api.post<ApiResponse<Contract>>('/contracts', data).then((r) => r.data.data),
  update: (id: string, data: Partial<CreateContractInput>) =>
    api.put<ApiResponse<Contract>>(`/contracts/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/contracts/${id}`),
}

// ─── Leaves ───────────────────────────────────────────────────

export interface CreateLeaveInput {
  employeeId: string
  type: Leave['type']
  startDate: string
  endDate: string
  days: number
  reason?: string
}

export const leavesApi = {
  list: (params?: { employeeId?: string; status?: string }) =>
    api.get<ApiResponse<Leave[]>>('/leaves', { params }).then((r) => r.data.data),
  create: (data: CreateLeaveInput) =>
    api.post<ApiResponse<Leave>>('/leaves', data).then((r) => r.data.data),
  updateStatus: (id: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED') =>
    api.put<ApiResponse<Leave>>(`/leaves/${id}/status`, { status }).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/leaves/${id}`),
}

export default api
