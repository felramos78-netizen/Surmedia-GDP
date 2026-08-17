import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface HonorarioReportRow {
  diaPago:              string | null
  reembolsable:         string
  contrato:             string
  clasificacionInterna: string
  razonSocialInterna:   string
  fechaEmision:         string | null
  razonSocial:          string
  rut:                  string
  folio:                string
  montoTotal:           number
  pagado:               string
  glosa:                string
}

export interface HonorarioReportMeta {
  year:       number
  month:      number
  total:      number
  montoTotal: number
  pendientes: {
    sinContrato:      number
    sinClasificacion: number
    sinReembolsable:  number
  }
}

export function useHonorariosReport(filters: { year: number; month: number; legalEntity?: string }) {
  return useQuery({
    queryKey: ['honorariosReport', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        year:  String(filters.year),
        month: String(filters.month),
      })
      if (filters.legalEntity) params.set('legalEntity', filters.legalEntity)
      const { data } = await api.get<{ data: HonorarioReportRow[]; meta: HonorarioReportMeta }>(
        `/reports/honorarios?${params}`
      )
      return data
    },
    enabled: !!filters.year && !!filters.month,
  })
}

export interface HonorarioPeriodo {
  year:  number
  month: number
  count: number
}

export function useHonorariosPeriodos() {
  return useQuery({
    queryKey: ['honorariosPeriodos'],
    queryFn: async () => {
      const { data } = await api.get<{ data: HonorarioPeriodo[] }>('/reports/honorarios/periodos')
      return data.data
    },
  })
}
