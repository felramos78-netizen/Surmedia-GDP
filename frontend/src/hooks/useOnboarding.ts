import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OnboardingProcess, OnboardingStats, OnboardingTemplateTask, ApiResponse } from '@/types'

const TASK_TEMPLATE: OnboardingTemplateTask[] = [
  { id: 'pre_carta_oferta',    period: 'PRE_INGRESO', name: 'Carta oferta recibida y aceptada',                              tool: 'Correo a ingresante',    automationType: 'EMAIL',     automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },                                                                                sortOrder: 1, appliesWhen: null },
  { id: 'pre_documentos',      period: 'PRE_INGRESO', name: 'Documentos personales revisados, validados y enviados al proveedor', tool: 'IA + correo',          automationType: 'EMAIL',     automationConfig: { emailTo: 'rrhh' },                                                                                                                 sortOrder: 2, appliesWhen: null },
  { id: 'pre_coordinacion',    period: 'PRE_INGRESO', name: 'Coordinación interna con administración y SSO',                tool: 'Correo interno',         automationType: 'EMAIL',     automationConfig: { emailTo: 'team' },                                                                                                                         sortOrder: 3, appliesWhen: null },
  { id: 'pre_contratos_buk',   period: 'PRE_INGRESO', name: 'Generación de documentos contractuales en BUK',               tool: 'BUK + correo proveedor', automationType: 'BUK_CHECK', automationConfig: { checkType: 'contract_signed' },                                                                                                             sortOrder: 4, appliesWhen: null },
  { id: 'pre_correo_empresa',  period: 'PRE_INGRESO', name: 'Correo empresa creado',                                        tool: 'Google Workspace',       automationType: 'EXTERNAL',  automationConfig: { system: 'google_workspace' },                                                                                                              sortOrder: 5, appliesWhen: null },
  { id: 'pre_buk_asistencia',  period: 'PRE_INGRESO', name: 'Perfil BUK marcaje asistencia creado',                        tool: 'BUK (vía proveedor)',     automationType: 'BUK_CHECK', automationConfig: { checkType: 'attendance_profile' },                                                                                                          sortOrder: 6, appliesWhen: null },
  { id: 'pre_buk_perfil',      period: 'PRE_INGRESO', name: 'Perfil BUK creado',                                           tool: 'BUK (vía proveedor)',     automationType: 'BUK_CHECK', automationConfig: { checkType: 'employee_profile' },                                                                                                            sortOrder: 7, appliesWhen: null },
  { id: 'day1_bienvenida',     period: 'DIA_1',       name: 'Correo de bienvenida',                                        tool: 'Correo interno',         automationType: 'EMAIL',     automationConfig: { emailTo: 'collaborator', template: 'bienvenida' },                                                                                        sortOrder: 1, appliesWhen: null },
  { id: 'day1_epp',            period: 'DIA_1',       name: 'Entrega de EPP y firma',                                      tool: 'SSO + BUK',              automationType: 'MANUAL',    automationConfig: null,                                                                                                                                        sortOrder: 2, appliesWhen: 'si aplica' },
  { id: 'day1_induccion_jefatura', period: 'DIA_1',   name: 'Inducción de jefatura realizada',                             tool: 'Google Calendar',        automationType: 'CALENDAR',  automationConfig: { title: 'Inducción de jefatura', daysFromStart: 0, durationMinutes: 60 },                                                                   sortOrder: 3, appliesWhen: null },
  { id: 'day1_enrolamiento',   period: 'DIA_1',       name: 'Enrolamiento de ingreso a oficina',                           tool: 'Adm. física',            automationType: 'MANUAL',    automationConfig: null,                                                                                                                                        sortOrder: 4, appliesWhen: 'si aplica' },
  { id: 'day1_kit',            period: 'DIA_1',       name: 'Entrega de kit de bienvenida',                                tool: 'Adm. física',            automationType: 'MANUAL',    automationConfig: null,                                                                                                                                        sortOrder: 5, appliesWhen: null },
  { id: 'day1_adobe',          period: 'DIA_1',       name: 'Licencia de Adobe habilitada',                                tool: 'Correo interno',         automationType: 'EMAIL',     automationConfig: { emailTo: 'rrhh' },                                                                                                                         sortOrder: 6, appliesWhen: 'solo Diseño' },
  { id: 'day1_induccion_corporativa', period: 'DIA_1', name: 'Inducción corporativa realizada',                            tool: 'Google Calendar',        automationType: 'CALENDAR',  automationConfig: { title: 'Inducción Corporativa', daysFromStart: 0, durationMinutes: 120 },                                                                  sortOrder: 7, appliesWhen: null },
  { id: 'day1_firmas',         period: 'DIA_1',       name: 'Contrato · RIOHS · IRL firmados',                            tool: 'BUK firma electrónica',  automationType: 'BUK_CHECK', automationConfig: { checkType: 'document_signing' },                                                                                                            sortOrder: 8, appliesWhen: null },
  { id: 'day1_computador',     period: 'DIA_1',       name: 'Entrega de computador y recepción firmada',                   tool: 'Adm. física + BUK',      automationType: 'BUK_CHECK', automationConfig: { checkType: 'asset_delivery' },                                                                                                              sortOrder: 9, appliesWhen: null },
  { id: 'semana_foto',         period: 'SEMANA_1',    name: 'Foto individual corporativa',                                 tool: 'Coordinación jefatura',  automationType: 'MANUAL',    automationConfig: null,                                                                                                                                        sortOrder: 1, appliesWhen: null },
  { id: 'semana_sso',          period: 'SEMANA_1',    name: 'Inducción de SSO realizada',                                  tool: 'Google Calendar',        automationType: 'CALENDAR',  automationConfig: { title: 'Inducción SSO', daysFromStart: 3, durationMinutes: 90 },                                                                           sortOrder: 2, appliesWhen: null },
  { id: 'semana_presentacion', period: 'SEMANA_1',    name: 'Presentación a la empresa y círculo de especialistas',        tool: 'WhatsApp',               automationType: 'EXTERNAL',  automationConfig: { system: 'whatsapp' },                                                                                                                       sortOrder: 3, appliesWhen: null },
  { id: 'semana_seguro',       period: 'SEMANA_1',    name: 'Formulario seguro complementario completo y enviado',         tool: 'Correo interno',         automationType: 'EMAIL',     automationConfig: { emailTo: 'collaborator', template: 'seguro_complementario' },                                                                               sortOrder: 4, appliesWhen: null },
  { id: 'semana_pluxee',       period: 'SEMANA_1',    name: 'Tarjeta Pluxee entregada',                                    tool: 'Adm. física + BUK',      automationType: 'MANUAL',    automationConfig: null,                                                                                                                                        sortOrder: 5, appliesWhen: null },
  { id: 'semana_foto_web',     period: 'SEMANA_1',    name: 'Foto individual cargada en web',                              tool: 'WordPress',              automationType: 'EXTERNAL',  automationConfig: { system: 'wordpress' },                                                                                                                      sortOrder: 6, appliesWhen: null },
  { id: 'mes_cafe',            period: 'MES_1',       name: 'Café virtual con directores',                                 tool: 'Correo + Calendar',      automationType: 'CALENDAR',  automationConfig: { title: 'Café con directores', daysFromStart: 14, durationMinutes: 30 },                                                                     sortOrder: 1, appliesWhen: null },
  { id: 'mes_mentor',          period: 'MES_1',       name: 'Mentor asignado',                                             tool: 'Correo interno',         automationType: 'EMAIL',     automationConfig: { emailTo: 'collaborator', template: 'mentor_asignado' },                                                                                    sortOrder: 2, appliesWhen: null },
  { id: 'eval_checkpoint30',   period: 'MES_1',       name: 'Checkpoint 1 · Día 30',                                      tool: 'Google Calendar',        automationType: 'CALENDAR',  automationConfig: { title: 'Checkpoint 30 días', daysFromStart: 30, durationMinutes: 60 },                                                                      sortOrder: 3, appliesWhen: null },
  { id: 'eval_checkpoint60',   period: 'EVALUACION',  name: 'Checkpoint 2 · Día 60',                                      tool: 'Google Calendar',        automationType: 'CALENDAR',  automationConfig: { title: 'Checkpoint 60 días', daysFromStart: 60, durationMinutes: 60 },                                                                      sortOrder: 1, appliesWhen: null },
  { id: 'eval_feedback90',     period: 'EVALUACION',  name: 'Feedback 3 meses · Día 90',                                  tool: 'Calendar + correo',      automationType: 'CALENDAR',  automationConfig: { title: 'Evaluación período de prueba', daysFromStart: 90, durationMinutes: 90 },                                                            sortOrder: 2, appliesWhen: null },
]

export function useOnboardingTemplate() {
  return { data: TASK_TEMPLATE, isLoading: false, isError: false, refetch: () => {} }
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

export function useUpdateOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      collaboratorName?:     string
      collaboratorEmail?:    string | null
      collaboratorPosition?: string | null
      collaboratorPhone?:    string | null
      legalEntity?:          string | null
      startDate?:            string
      notes?:                string | null
    }) => {
      const { data } = await api.patch<ApiResponse<OnboardingProcess>>(`/onboarding/${id}`, body)
      return data.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
    },
  })
}

export function useDeleteOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/onboarding/${id}/delete`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      queryClient.invalidateQueries({ queryKey: ['onboardingStats'] })
    },
  })
}
