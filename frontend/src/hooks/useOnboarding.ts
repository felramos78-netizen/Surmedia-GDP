import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OnboardingProcess, OnboardingStats, OnboardingTemplateTask, ApiResponse } from '@/types'

export function useOnboardingTemplate() {
  return useQuery({
    queryKey: ['onboardingTemplate'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<OnboardingTemplateTask[]>>('/onboarding/template')
      return data.data
    },
    staleTime: Infinity,
  })
}

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
    mutationFn: async (body: {
      collaboratorName:     string
      collaboratorEmail?:   string
      collaboratorPosition?: string
      collaboratorPhone?:   string
      legalEntity?:         string
      startDate?:           string
      notes?:               string
      selectedTaskIds:      string[]
    }) => {
      const { data } = await api.post<ApiResponse<OnboardingProcess>>('/onboarding', body)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      queryClient.invalidateQueries({ queryKey: ['onboardingStats'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      processId, taskId, ...body
    }: { processId: string; taskId: string; completed?: boolean; name?: string; tool?: string; completedNote?: string }) => {
      const { data } = await api.patch(`/onboarding/${processId}/tasks/${taskId}`, body)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', vars.processId] })
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}

export function useAddTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ processId, ...body }: { processId: string; period: string; name: string; tool?: string; automationType?: string }) => {
      const { data } = await api.post(`/onboarding/${processId}/tasks`, body)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', vars.processId] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ processId, taskId }: { processId: string; taskId: string }) => {
      await api.delete(`/onboarding/${processId}/tasks/${taskId}`)
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', vars.processId] })
    },
  })
}

export function useRunAutomation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ processId, taskId }: { processId: string; taskId: string }) => {
      const { data } = await api.post(`/onboarding/${processId}/tasks/${taskId}/automate`)
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
    mutationFn: async ({ id, ...body }: { id: string; status?: string; employeeId?: string }) => {
      const { data } = await api.patch(`/onboarding/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      queryClient.invalidateQueries({ queryKey: ['onboardingStats'] })
    },
  })
}
