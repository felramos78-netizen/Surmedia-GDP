import { useMutation, useQueryClient } from '@tanstack/react-query'
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
export interface BukDotacionNuevo { rut: string; nombre: string; legalEntity: string; estado: string }
export interface BukDotacionCambio {
  key: string; rut: string; nombre: string; legalEntity: string
  campos: Array<{ campo: string; antes: string | null; despues: string | null }>
}
export interface BukVacNueva {
  key: string; rut: string; nombre: string; legalEntity: string
  startDate: string; endDate: string; days: number
}
export interface BukPreviewData {
  sueldos:   { nuevos: BukSueldoNuevo[]; cambios: BukSueldoCambio[]; sincronizados: BukSueldoNuevo[]; sinEmpleado: string[] }
  dotacion:  { nuevos: BukDotacionNuevo[]; cambios: BukDotacionCambio[] }
  vacaciones:{ nuevas: BukVacNueva[];  sinEmpleado: string[] }
}
export interface BukApplyPayload {
  sueldos?:    {
    nuevosKeys?: string[]; cambiosKeys?: string[]; sincronizadosKeys?: string[]
    overrides?: Record<string, { grossSalary?: number; liquidSalary?: number }>
  }
  dotacion?:   { cambiosKeys?: string[]; nuevosKeys?: string[] }
  vacaciones?: { nuevasKeys?: string[] }
}

export async function fetchBukPreview(): Promise<BukPreviewData & { _debug?: unknown }> {
  const { data } = await api.get<{ data: BukPreviewData; _debug?: unknown }>('/buk/preview')
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
