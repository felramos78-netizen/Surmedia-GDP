import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Leave, LeaveStatus, ApiResponse } from '@/types'

export function useLeaves(filters?: { employeeId?: string; status?: LeaveStatus }) {
  return useQuery({
    queryKey: ['leaves', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.employeeId) params.set('employeeId', filters.employeeId)
      if (filters?.status) params.set('status', filters.status)
      const res = await api.get<ApiResponse<Leave[]>>(`/leaves?${params}`)
      return res.data.data
    },
  })
}

export function useCreateLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Leave>) => {
      const res = await api.post<ApiResponse<Leave>>('/leaves', data)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  })
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      const res = await api.put<ApiResponse<Leave>>(`/leaves/${id}/status`, { status })
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leaves/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  })
}
