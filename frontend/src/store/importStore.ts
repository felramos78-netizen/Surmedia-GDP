import { create } from 'zustand'
import api from '@/lib/api'
import type { BukApplyPayload } from '@/hooks/useBuk'

export type ImportStatus = 'idle' | 'running' | 'success' | 'error'

interface ImportResult { sueldos: number; dotacion: number; vacaciones: number; vacLicencia: number }

interface ImportStore {
  status: ImportStatus
  label: string      // "Importando 541 registros…"
  detail: string     // "320 sueldos · 115 dotación · 106 vacaciones"
  result: ImportResult | null
  startImport: (payload: BukApplyPayload, label: string) => void
  dismiss: () => void
}

export const useImportStore = create<ImportStore>()((set) => ({
  status: 'idle',
  label: '',
  detail: '',
  result: null,

  startImport: (payload, label) => {
    set({ status: 'running', label, detail: '', result: null })
    api.post<{ ok: boolean; applied: ImportResult }>('/buk/apply', payload)
      .then(({ data }) => {
        const r = data.applied
        const detail = [
          r.sueldos      > 0 ? `${r.sueldos} sueldos`       : '',
          r.dotacion     > 0 ? `${r.dotacion} dotación`     : '',
          r.vacaciones   > 0 ? `${r.vacaciones} vacaciones`  : '',
          r.vacLicencia  > 0 ? `${r.vacLicencia} saldos vac.` : '',
        ].filter(Boolean).join(' · ')
        set({ status: 'success', label: 'Importación completada', detail, result: r })
      })
      .catch((e: any) => {
        const detail = e?.response?.data?.message ?? e?.message ?? 'Error desconocido'
        set({ status: 'error', label: 'Error en importación', detail, result: null })
      })
  },

  dismiss: () => set({ status: 'idle', label: '', detail: '', result: null }),
}))
