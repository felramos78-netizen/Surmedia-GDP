import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OnboardingProcess, OnboardingStats, ApiResponse } from '@/types'

export function useOnboardingProcesses() {
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OnboardingProcess[]>>('/onboarding')
      return data.data
    },
  })
}

export function useOnboardingStats() {
  return useQuery({
    queryKey: ['onboardingStats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OnboardingStats>>('/onboarding/stats')
      return data.data
    },
  })
}

export function useOnboardingProcess(id: string | null) {
  return useQuery({
    queryKey: ['onboarding', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OnboardingProcess>>(`/onboarding/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useCreateOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { employeeId: string; startDate?: string }) => {
      const { data } = await api.post<ApiResponse<OnboardingProcess>>('/onboarding', body)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      processId,
      taskId,
      completed,
      notes,
    }: {
      processId: string
      taskId: string
      completed: boolean
      notes?: string
    }) => {
      const { data } = await api.patch(`/onboarding/${processId}/tasks/${taskId}`, { completed, notes })
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', vars.processId] })
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}

export function useUpdateOnboardingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/onboarding/${id}`, { status })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      queryClient.invalidateQueries({ queryKey: ['onboardingStats'] })
    },
  })
}
