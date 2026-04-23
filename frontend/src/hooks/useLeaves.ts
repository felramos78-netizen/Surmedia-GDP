import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Leave, ApiResponse, PaginatedResponse } from '@/types'

export interface LeaveFilters {
  employeeId?: string
  status?: string
  type?: string
  page?: number
  limit?: number
}

export function useLeaves(filters: LeaveFilters = {}) {
  return useQuery({
    queryKey: ['leaves', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.employeeId) params.set('employeeId', filters.employeeId)
      if (filters.status)     params.set('status',     filters.status)
      if (filters.type)       params.set('type',       filters.type)
      if (filters.page)       params.set('page',       String(filters.page))
      if (filters.limit)      params.set('limit',      String(filters.limit))
      const { data } = await api.get<PaginatedResponse<Leave>>(`/leaves?${params}`)
      return data
    },
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Leave>) => {
      const { data } = await api.post<ApiResponse<Leave>>('/leaves', body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useUpdateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Leave> & { id: string }) => {
      const { data } = await api.put<ApiResponse<Leave>>(`/leaves/${id}`, body)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leaves/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
    },
  })
}
