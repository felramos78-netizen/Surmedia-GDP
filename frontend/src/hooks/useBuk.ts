import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface BukSueldoNuevo {
  key: string; rut: string; nombre: string; legalEntity: string
  year: number; month: number; grossSalary: number; liquidSalary: number
}
export interface BukSueldoCambio {
  key: string; rut: string; nombre: string; legalEntity: string
  year: number; month: number
  antes: { grossSalary: number; liquidSalary: number }
  despues: { grossSalary: number; liquidSalary: number }
}
export interface BukDotacionNuevo {
  rut: string; nombre: string; legalEntity: string; estado: string
  cargo?: string | null; afp?: string | null; isapre?: string | null
  tipoContrato?: string | null; fechaIngreso?: string | null
  supervisorNombre?: string | null; jornada?: string | null
}
export interface BukDotacionCambio {
  key: string; rut: string; nombre: string; legalEntity: string
  campos: Array<{ campo: string; antes: string | null; despues: string | null }>
}
export interface BukVacNueva {
  key: string; rut: string; nombre: string; legalEntity: string
  startDate: string; endDate: string; days: number
}
export interface BukVacLicencia {
  key: string; rut: string; nombre: string; legalEntity: string
  year: number; month: number
  saldoLegal: number; saldoProgresivas: number; saldoAdministrativos: number
  diasLicencias: number; vacacionesTomadas: number
}
export interface BukVacAprobadaNueva {
  key: string; rut: string; nombre: string; legalEntity: string
  startDate: string; endDate: string; days: number
  tipo: string; aprobadoPor: string; fechaAprobacion: string | null; periodo: string
}
export interface BukPreviewData {
  sueldos:    { nuevos: BukSueldoNuevo[]; cambios: BukSueldoCambio[]; sincronizados: BukSueldoNuevo[]; sinEmpleado: string[] }
  dotacion:   { nuevos: BukDotacionNuevo[]; cambios: BukDotacionCambio[] }
  vacaciones: { nuevas: BukVacNueva[]; sinEmpleado: string[] }
  vacLicencia:{ nuevos: BukVacLicencia[]; cambios: BukVacLicencia[]; sincronizados: BukVacLicencia[]; sinEmpleado: string[] }
  vacacionAprobada: { nuevas: BukVacAprobadaNueva[]; sinMatch: string[] }
}
export type BukSource = 'api' | 'excel'

export interface BukApplyPayload {
  year?: number
  source?: BukSource
  sueldos?:     {
    nuevosKeys?: string[]; cambiosKeys?: string[]; sincronizadosKeys?: string[]
    overrides?: Record<string, { grossSalary?: number; liquidSalary?: number }>
  }
  dotacion?:    { cambiosKeys?: string[]; nuevosKeys?: string[] }
  vacaciones?:  { nuevasKeys?: string[] }
  vacLicencia?: { keys?: string[] }
  vacacionAprobada?: { nuevasKeys?: string[] }
}

export async function fetchBukPreview(year: string, source: BukSource): Promise<BukPreviewData & { _debug?: unknown }> {
  const params = new URLSearchParams({ source })
  if (year) params.set('year', year)
  // La lectura desde la API de BUK toma ~40 s
  const { data } = await api.get<{ data: BukPreviewData; _debug?: unknown }>(`/buk/preview?${params}`, { timeout: 180_000 })
  return { ...data.data, _debug: data._debug }
}

export function useBukApply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BukApplyPayload) => {
      const { data } = await api.post<{ ok: boolean; applied: { sueldos: number; dotacion: number; vacaciones: number } }>('/buk/apply', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrollTable'] })
      qc.invalidateQueries({ queryKey: ['payrollYears'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employeeStats'] })
    },
  })
}

export interface BukLastSync { at: string; email: string | null; source: string }

export function useBukLastSync() {
  return useQuery({
    queryKey: ['bukLastSync'],
    queryFn: async () => (await api.get<{ data: BukLastSync | null }>('/buk/last-sync')).data.data,
  })
}
