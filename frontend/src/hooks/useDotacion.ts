import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Employee, EmployeeStats, PayrollEntry, PayrollRawEntry, ApiResponse } from '@/types'

export interface DotacionFilters {
  search?: string
  status?: string[]
  legalEntity?: string[]
  contractType?: string[]
  departmentId?: string
  activeYear?: string
  activeMonth?: string
}

interface EmployeeListResponse {
  data: Employee[]
  total: number
  page: number
  limit: number
}

export function useEmployees(filters: DotacionFilters = {}) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', '1000')
      if (filters.search)               params.set('search',       filters.search)
      if (filters.status?.length)       params.set('status',       filters.status.join(','))
      if (filters.legalEntity?.length)  params.set('legalEntity',  filters.legalEntity.join(','))
      if (filters.contractType?.length) params.set('contractType', filters.contractType.join(','))
      if (filters.departmentId)         params.set('departmentId', filters.departmentId)
      if (filters.activeYear)  {        params.set('activeYear',   filters.activeYear)
        if (filters.activeMonth)        params.set('activeMonth',  filters.activeMonth)
      }

      const { data } = await api.get<EmployeeListResponse>(`/employees?${params}`)
      return data
    },
  })
}

export function useEmployeeStats() {
  return useQuery({
    queryKey: ['employeeStats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<EmployeeStats>>('/employees/stats')
      return data.data
    },
  })
}

export function useEmployeePayroll(id: string | null) {
  return useQuery({
    queryKey: ['employeePayroll', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PayrollEntry[]>>(`/employees/${id}/payroll`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function usePayrollTable(filters: { year: string; month?: string; legalEntity?: string[] }) {
  return useQuery({
    queryKey: ['payrollTable', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ year: filters.year })
      if (filters.month)              params.set('month',       filters.month)
      if (filters.legalEntity?.length)params.set('legalEntity', filters.legalEntity.join(','))
      const { data } = await api.get<ApiResponse<PayrollRawEntry[]>>(`/payroll?${params}`)
      return data.data
    },
    enabled: !!filters.year,
  })
}

export function usePayrollYears() {
  return useQuery({
    queryKey: ['payrollYears'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<number[]>>('/payroll/years')
      return data.data
    },
  })
}

export function useImportPayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { legalEntity: string; rows: unknown[] }) => {
      const { data } = await api.post<{ ok: boolean; upserted: number; skipped: number; skippedSample: string[]; errors: string[] }>('/payroll/import', payload)
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollTable'] })
      queryClient.invalidateQueries({ queryKey: ['payrollYears'] })
    },
  })
}

export function useMovements(filters: { year: string; month?: string; legalEntity?: string }) {
  return useQuery({
    queryKey: ['movements', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ year: filters.year })
      if (filters.month)       params.set('month',       filters.month)
      if (filters.legalEntity) params.set('legalEntity', filters.legalEntity)
      const { data } = await api.get<ApiResponse<{ ingresos: any[]; salidas: any[]; vacaciones: any[]; licencias: any[]; reemplazos: any[] }>>(`/employees/movements?${params}`)
      return data.data
    },
    enabled: !!filters.year,
  })
}

export function useExpiringContracts() {
  return useQuery({
    queryKey: ['expiringContracts'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<any[]>>('/employees/expiring-contracts')
      return data.data
    },
  })
}

export interface EmployeePatch {
  id: string
  firstName?: string; lastName?: string
  email?: string; personalEmail?: string | null
  phone?: string | null; birthDate?: string | null
  address?: string | null; city?: string | null; commune?: string | null
  nationality?: string | null; gender?: string | null
  afp?: string | null; isapre?: string | null
  jobTitle?: string | null; jobFamily?: string | null
  costCenter?: string | null; supervisorName?: string | null; supervisorTitle?: string | null
  workSchedule?: string | null; startDate?: string; endDate?: string | null
  status?: string; vinculo?: string | null; reemplazaA?: string | null
  exclusive?: boolean | null
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: EmployeePatch) => api.patch(`/employees/${id}`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee', vars.id] })
    },
  })
}

export function useJobTitles() {
  return useQuery({
    queryKey: ['jobTitles'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<string[]>>('/employees/job-titles')
      return data.data
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employeeStats'] })
    },
  })
}
