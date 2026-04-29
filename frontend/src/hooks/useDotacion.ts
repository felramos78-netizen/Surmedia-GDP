import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Employee, EmployeeStats, PayrollEntry, PayrollRawEntry, SyncLog, SyncPreviewResult, ApiResponse } from '@/types'

export interface DotacionFilters {
  search?: string
  status?: string[]
  legalEntity?: string[]
  contractType?: string[]
  departmentId?: string
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
      if (filters.search)              params.set('search',       filters.search)
      if (filters.status?.length)      params.set('status',       filters.status.join(','))
      if (filters.legalEntity?.length) params.set('legalEntity',  filters.legalEntity.join(','))
      if (filters.contractType?.length)params.set('contractType', filters.contractType.join(','))
      if (filters.departmentId)        params.set('departmentId', filters.departmentId)

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

export function usePreviewSync() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ ok: boolean; results: SyncPreviewResult[] }>('/sync/buk/preview')
      return data
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

export function useSyncBuk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (legalEntity?: string) => {
      const path = legalEntity ? `/sync/buk/${legalEntity}` : '/sync/buk'
      const { data } = await api.post(path)
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employeeStats'] })
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] })
    },
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

export function useSyncPayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { startDate: string; endDate: string }) => {
      const { data } = await api.post('/sync/buk/payroll', params)
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollTable'] })
      queryClient.invalidateQueries({ queryKey: ['payrollYears'] })
    },
  })
}

export function useSyncLogs() {
  return useQuery({
    queryKey: ['syncLogs'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SyncLog[]>>('/sync/logs')
      return data.data
    },
    refetchInterval: 10_000,
  })
}
