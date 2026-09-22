import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { LegalEntity } from '@/types'

export interface BukFile {
  fileId:    number
  filename:  string
  folder:    string
  createdAt: string | null
}

export interface BukEntityDocs {
  legalEntity:   LegalEntity
  bukEmployeeId: number | null
  bukStatus?:    string
  files:         BukFile[]
  error?:        string
}

export interface BukDocumentsResponse {
  rut:      string
  entities: BukEntityDocs[]
}

// Documentos del colaborador leídos en vivo desde BUK (ambas razones sociales)
export function useBukDocuments(employeeId: string | null) {
  return useQuery({
    queryKey: ['bukDocuments', employeeId],
    queryFn: async () => {
      const { data } = await api.get<BukDocumentsResponse>(`/documents/employee/${employeeId}`)
      return data
    },
    enabled: !!employeeId,
  })
}

export interface BukDocSearchPerson {
  legalEntity:   LegalEntity
  bukEmployeeId: number
  rut:           string
  fullName:      string
  bukStatus:     string
  employeeId:    string | null
  files:         BukFile[]
}

export interface BukDocSearchResponse {
  ready:        boolean
  building:     { done: number; total: number } | null
  builtAt:      string | null
  failed:       number
  error:        string | null
  statuses:     string[]
  scopePeople?: number
  totalPeople:  number
  totalFiles:   number
  people:       BukDocSearchPerson[]
}

// Búsqueda de documentos por nombre en todas las fichas BUK. Mientras el índice
// del backend se construye, se reconsulta cada 2 s para mostrar el progreso.
export function useBukDocSearch(filters: { q: string; legalEntity?: string; status?: string }) {
  return useQuery({
    queryKey: ['bukDocSearch', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ q: filters.q })
      if (filters.legalEntity) params.set('legalEntity', filters.legalEntity)
      if (filters.status)      params.set('status', filters.status)
      const { data } = await api.get<BukDocSearchResponse>(`/documents/search?${params}`)
      return data
    },
    placeholderData: prev => prev,
    refetchInterval: query => (query.state.data?.building ? 2000 : false),
  })
}

export function useRefreshBukDocIndex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { await api.post('/documents/index/refresh') },
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['bukDocSearch'] }),
  })
}

function fileUrl(entity: LegalEntity, bukEmployeeId: number, file: BukFile, download: boolean) {
  const params = new URLSearchParams({ filename: file.filename })
  if (download) params.set('download', '1')
  return `/documents/file/${entity}/${bukEmployeeId}/${file.fileId}?${params}`
}

// El archivo pasa por el backend (requiere JWT), así que se descarga como blob
async function fetchBlob(entity: LegalEntity, bukEmployeeId: number, file: BukFile, download: boolean) {
  const { data } = await api.get<Blob>(fileUrl(entity, bukEmployeeId, file, download), { responseType: 'blob' })
  return URL.createObjectURL(data)
}

export async function openBukFile(entity: LegalEntity, bukEmployeeId: number, file: BukFile) {
  // Se abre la pestaña antes del await para que el navegador no la bloquee como popup
  const win = window.open('', '_blank')
  try {
    const url = await fetchBlob(entity, bukEmployeeId, file, false)
    if (win) win.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    win?.close()
    throw err
  }
}

export async function downloadBukFile(entity: LegalEntity, bukEmployeeId: number, file: BukFile) {
  const url = await fetchBlob(entity, bukEmployeeId, file, true)
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
