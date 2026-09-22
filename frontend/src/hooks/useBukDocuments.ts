import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { LegalEntity } from '@/types'

// Documentos BUK: GDP guarda la metadata sincronizada desde BUK y los archivos
// se descargan vía el backend (proxy).

export interface DocCategoryRef { id: string; name: string }

export interface BukFile {
  fileId:    number
  filename:  string
  folder:    string
  createdAt: string | null
  category:  DocCategoryRef | null
}

export interface BukEntityDocs {
  legalEntity:   LegalEntity
  bukEmployeeId: number
  bukStatus:     string
  files:         BukFile[]
}

export interface BukDocumentsResponse {
  rut:      string
  syncedAt: string | null
  entities: BukEntityDocs[]
}

export interface SyncProgress { scope: string; done: number; total: number }

// ── Por colaborador ───────────────────────────────────────────────────────────

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

export function useSyncEmployeeDocuments(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<BukDocumentsResponse>(`/documents/employee/${employeeId}/sync`, {})
      return data
    },
    onSuccess: data => {
      qc.setQueryData(['bukDocuments', employeeId], data)
      qc.invalidateQueries({ queryKey: ['docSummary'] })
      qc.invalidateQueries({ queryKey: ['bukDocSearch'] })
    },
  })
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────

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
  syncing:     SyncProgress | null
  lastSyncAt:  string | null
  statuses:    string[]
  scopePeople: number
  totalPeople: number
  totalFiles:  number
  people:      BukDocSearchPerson[]
}

export interface DocSearchFilters { q: string; categoryId?: string; legalEntity?: string; status?: string }

export function useBukDocSearch(filters: DocSearchFilters) {
  return useQuery({
    queryKey: ['bukDocSearch', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ q: filters.q })
      if (filters.categoryId)  params.set('categoryId', filters.categoryId)
      if (filters.legalEntity) params.set('legalEntity', filters.legalEntity)
      if (filters.status)      params.set('status', filters.status)
      const { data } = await api.get<BukDocSearchResponse>(`/documents/search?${params}`)
      return data
    },
    placeholderData: prev => prev,
    refetchInterval: query => (query.state.data?.syncing ? 3000 : false),
  })
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DocCategorySummary {
  id:         string
  name:       string
  group:      string
  keywords:   string[]
  required:   boolean
  sortOrder:  number
  docs:       number
  fichas:     number
  activeWith: number
}

export interface DocSummary {
  syncing:           SyncProgress | null
  lastSync:          { at: string | null; filesAdded: number; filesRemoved: number; failed: number } | null
  totalDocs:         number
  totalFichas:       number
  activeFichas:      number
  uncategorizedDocs: number
  categories:        DocCategorySummary[]
  topUncategorized:  { stem: string; docs: number; fichas: number; example: string }[]
}

export function useDocSummary() {
  return useQuery({
    queryKey: ['docSummary'],
    queryFn: async () => {
      const { data } = await api.get<DocSummary>('/documents/summary')
      return data
    },
    refetchInterval: query => (query.state.data?.syncing ? 3000 : false),
  })
}

export function useStartDocSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { await api.post('/documents/sync', {}) },
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['docSummary'] })
      qc.invalidateQueries({ queryKey: ['bukDocSearch'] })
    },
  })
}

export interface MissingFicha {
  legalEntity:   LegalEntity
  bukEmployeeId: number
  rut:           string
  fullName:      string
  employeeId:    string | null
}

export function useCategoryMissing(categoryId: string | null) {
  return useQuery({
    queryKey: ['docCategoryMissing', categoryId],
    queryFn: async () => {
      const { data } = await api.get<MissingFicha[]>(`/documents/categories/${categoryId}/missing`)
      return data
    },
    enabled: !!categoryId,
  })
}

// ── Categorías ────────────────────────────────────────────────────────────────

export interface DocCategoryInput {
  name:      string
  group:     string
  keywords:  string[]
  required:  boolean
  sortOrder: number
}

// Cualquier cambio de categorías reclasifica los documentos: se refresca todo
function useInvalidateDocs() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['docSummary'] })
    qc.invalidateQueries({ queryKey: ['bukDocSearch'] })
    qc.invalidateQueries({ queryKey: ['bukDocuments'] })
    qc.invalidateQueries({ queryKey: ['docCategoryMissing'] })
  }
}

export function useSaveDocCategory() {
  const invalidate = useInvalidateDocs()
  return useMutation({
    mutationFn: async ({ id, ...input }: DocCategoryInput & { id?: string }) => {
      const { data } = id
        ? await api.patch<{ reclassified: number }>(`/documents/categories/${id}`, input)
        : await api.post<{ reclassified: number }>('/documents/categories', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteDocCategory() {
  const invalidate = useInvalidateDocs()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/documents/categories/${id}`) },
    onSuccess: invalidate,
  })
}

// ── Archivos ──────────────────────────────────────────────────────────────────

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
