import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Profile } from '@/types'

export const AREAS = [
  { value: 'BUK',           label: 'BUK' },
  { value: 'SMART',         label: 'Smart' },
  { value: 'ADMINISTRACION',label: 'Administración' },
  { value: 'ACREDITACION',  label: 'Acreditación' },
  { value: 'INGRESANTE',    label: 'Ingresante' },
  { value: 'JEFATURA',      label: 'Jefatura' },
  { value: 'MENTORIA',      label: 'Mentoría' },
  { value: 'CHECKPOINTS',   label: 'Checkpoints' },
  { value: 'GENERAL',       label: 'General (todos)' },
]

export const ROLE_TYPES = [
  { value: 'ENVIA_CORREOS',      label: 'Envía correos' },
  { value: 'RECIBE_CORREOS',     label: 'Recibe correos' },
  { value: 'COPIA_CORREOS',      label: 'Copia de correos' },
  { value: 'PREPARA_ADM_FISICA', label: 'Prepara adm. física' },
  { value: 'RESPONSABLE_HITO',   label: 'Responsable del hito' },
]

type ProfileBody = {
  name: string
  position: string
  email: string
  phone?: string
  notes?: string
  roles?: { area: string; roleType: string }[]
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await api.get<Profile[]>('/profiles')
      return data
    },
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ProfileBody) => {
      const { data } = await api.post<Profile>('/profiles', body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<ProfileBody>) => {
      const { data } = await api.patch<Profile>(`/profiles/${id}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/profiles/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
