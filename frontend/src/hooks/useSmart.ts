import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SmartDocument, SmartPreviewData } from '@/types'

export async function fetchSmartPreview(): Promise<SmartPreviewData> {
  const { data } = await api.get<SmartPreviewData>('/smart/preview')
  return data
}

type SmartDocParams = {
  legalEntity?: string
  periodo?: string
  clasificacion?: string
  search?: string
  pagado?: boolean
  area?: string
  categoria?: string
}

function buildSmartQ(params: SmartDocParams) {
  const q = new URLSearchParams()
  if (params.legalEntity)   q.set('legalEntity',  params.legalEntity)
  if (params.periodo)       q.set('periodo',       params.periodo)
  if (params.clasificacion) q.set('clasificacion', params.clasificacion)
  if (params.search)        q.set('search',        params.search)
  if (params.area)          q.set('area',          params.area)
  if (params.categoria)     q.set('categoria',     params.categoria)
  if (params.pagado !== undefined) q.set('pagado', String(params.pagado))
  return q
}

export function useSmartHonorarios(params: SmartDocParams = {}) {
  const q = buildSmartQ(params)
  return useQuery<SmartDocument[]>({
    queryKey: ['smart-honorarios', params],
    queryFn:  async () => {
      const { data } = await api.get<SmartDocument[]>(`/smart/honorarios?${q}`)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSmartCompras(params: SmartDocParams = {}) {
  const q = buildSmartQ(params)
  return useQuery<SmartDocument[]>({
    queryKey: ['smart-compras', params],
    queryFn:  async () => {
      const { data } = await api.get<SmartDocument[]>(`/smart/compras?${q}`)
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSmartPeriodos() {
  return useQuery<string[]>({
    queryKey: ['smart-periodos'],
    queryFn:  async () => {
      const { data } = await api.get<string[]>('/smart/periodos')
      return data
    },
    staleTime: 10 * 60 * 1000,
  })
}

export function useSmartApply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { honorariosKeys?: string[]; comprasKeys?: string[] }) => {
      const { data } = await api.post<{ applied: number }>('/smart/apply', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smart-honorarios'] })
      qc.invalidateQueries({ queryKey: ['smart-compras'] })
      qc.invalidateQueries({ queryKey: ['smart-periodos'] })
      qc.invalidateQueries({ queryKey: ['smart-proveedores'] })
    },
  })
}

export function useSmartProveedores(params: { search?: string; area?: string; categoria?: string } = {}) {
  const q = new URLSearchParams()
  if (params.search)    q.set('search',    params.search)
  if (params.area)      q.set('area',      params.area)
  if (params.categoria) q.set('categoria', params.categoria)

  return useQuery({
    queryKey: ['smart-proveedores', params],
    queryFn:  async () => {
      const { data } = await api.get(`/smart/proveedores?${q}`)
      return data as import('@/types').SmartProveedor[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSmartProveedor(id: string) {
  return useQuery({
    queryKey: ['smart-proveedor', id],
    queryFn:  async () => {
      const { data } = await api.get(`/smart/proveedores/${id}`)
      return data as import('@/types').SmartProveedor
    },
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePatchProveedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      area?: string | null
      categoria?: string | null
      workCenterId?: string | null
      notes?: string | null
      clasificacion?: string | null
    }) => {
      const { data } = await api.patch(`/smart/proveedores/${id}`, body)
      return data as import('@/types').SmartProveedor
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['smart-honorarios'] })
      qc.invalidateQueries({ queryKey: ['smart-compras'] })
      qc.invalidateQueries({ queryKey: ['smart-proveedores'] })
      qc.invalidateQueries({ queryKey: ['smart-proveedor', vars.id] })
    },
  })
}

export function useBulkClassify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { rut: string; folio: string; area: string; categoria: string }[]) => {
      const { data } = await api.post<{ updated: number; notFound: number; total: number }>(
        '/smart/bulk-classify',
        { items },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smart-honorarios'] })
      qc.invalidateQueries({ queryKey: ['smart-compras'] })
      qc.invalidateQueries({ queryKey: ['smart-proveedores'] })
    },
  })
}
