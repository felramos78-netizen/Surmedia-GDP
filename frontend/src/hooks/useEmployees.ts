import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Employee, ApiResponse } from '@/types'

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Employee[]>>('/employees')
      return res.data.data
    },
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const res = await api.post<ApiResponse<Employee>>('/employees', data)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
      const res = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data)
      return res.data.data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employees', id] })
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}
