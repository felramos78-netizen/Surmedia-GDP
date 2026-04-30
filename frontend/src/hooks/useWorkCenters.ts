import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { WorkCenter, WorkCenterIngreso, CostType, ApiResponse } from '@/types'

export function useWorkCenters() {
  return useQuery({
    queryKey: ['workCenters'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WorkCenter[]>>('/work-centers')
      return data.data
    },
  })
}

export function useCreateWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; costType: CostType; presupuesto?: number | null }) => {
      const { data } = await api.post<ApiResponse<WorkCenter>>('/work-centers', body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useUpdateWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; costType?: CostType; presupuesto?: number | null; ubicacion?: string | null }) => {
      const { data } = await api.patch<ApiResponse<WorkCenter>>(`/work-centers/${id}`, body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useDeleteWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work-centers/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useAddIngreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workCenterId, name, amount }: { workCenterId: string; name: string; amount: number }) => {
      const { data } = await api.post<ApiResponse<WorkCenterIngreso>>(`/work-centers/${workCenterId}/ingresos`, { name, amount })
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useUpdateIngreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workCenterId, ingresoId, name, amount }: { workCenterId: string; ingresoId: string; name: string; amount: number }) => {
      const { data } = await api.patch<ApiResponse<WorkCenterIngreso>>(`/work-centers/${workCenterId}/ingresos/${ingresoId}`, { name, amount })
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useDeleteIngreso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workCenterId, ingresoId }: { workCenterId: string; ingresoId: string }) => {
      await api.delete(`/work-centers/${workCenterId}/ingresos/${ingresoId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workCenters'] }),
  })
}

export function useAssignWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workCenterId, employeeId, legalEntity }: { workCenterId: string; employeeId: string; legalEntity: string }) => {
      await api.post(`/work-centers/${workCenterId}/assign`, { employeeId, legalEntity })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['workCenters'] })
    },
  })
}

export function useUnassignWorkCenter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workCenterId, employeeId, legalEntity }: { workCenterId: string; employeeId: string; legalEntity: string }) => {
      await api.delete(`/work-centers/${workCenterId}/assign`, { data: { employeeId, legalEntity } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['workCenters'] })
    },
  })
}
