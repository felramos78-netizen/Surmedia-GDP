import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Employee, EmployeeStats, SyncLog, SyncPreviewResult, ApiResponse } from '@/types'

export interface DotacionFilters {
  search?: string
  status?: string
  legalEntity?: string
  contractType?: string
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
      if (filters.search)       params.set('search',       filters.search)
      if (filters.status)       params.set('status',       filters.status)
      if (filters.legalEntity)  params.set('legalEntity',  filters.legalEntity)
      if (filters.contractType) params.set('contractType', filters.contractType)
      if (filters.departmentId) params.set('departmentId', filters.departmentId)

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
