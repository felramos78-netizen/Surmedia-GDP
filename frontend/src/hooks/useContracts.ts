import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Contract, ApiResponse } from '@/types'

export function useContracts(employeeId?: string) {
  return useQuery({
    queryKey: ['contracts', employeeId],
    queryFn: async () => {
      const params = employeeId ? `?employeeId=${employeeId}` : ''
      const res = await api.get<ApiResponse<Contract[]>>(`/contracts${params}`)
      return res.data.data
    },
  })
}

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Contract>) => {
      const res = await api.post<ApiResponse<Contract>>('/contracts', data)
      return res.data.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['employees', data.employeeId] })
    },
  })
}

export function useDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contracts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}
