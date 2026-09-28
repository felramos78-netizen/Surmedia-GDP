import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BudgetCategory, BudgetRendicion, ApiResponse } from '@/types'

export function useBudget() {
  return useQuery<BudgetCategory[]>({
    queryKey: ['budget'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BudgetCategory[]>>('/budget')
      return data.data
    },
  })
}

// Segmentos (subáreas) que muestra la página del presupuesto: solo la sección PARTIDAS
// (BENEFICIOS es un resto de la plantilla inicial que no se muestra) y sin la fila
// virtual de gastos sin partida.
export function useBudgetSegments(): BudgetCategory[] {
  const { data } = useBudget()
  return useMemo(
    () => (data ?? []).filter(c => c.section === 'PARTIDAS' && !c.id.startsWith('virtual')),
    [data],
  )
}

// Nombre de cada partida del Presupuesto DPDO por id (para mostrar la partida de un documento o proveedor).
export function useBudgetItemNameById(): Map<string, string> {
  const segments = useBudgetSegments()
  return useMemo(() => new Map(segments.flatMap(c => c.items.map(i => [i.id, i.name] as const))), [segments])
}

// ── Rendiciones ──────────────────────────────────────────────────────────────

function useInvalidateBudgetSpend() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['budget'] })
    qc.invalidateQueries({ queryKey: ['budget-rendiciones'] })
  }
}

export function useRendiciones() {
  return useQuery<BudgetRendicion[]>({
    queryKey: ['budget-rendiciones'],
    queryFn: async () => (await api.get<ApiResponse<BudgetRendicion[]>>('/budget/rendiciones')).data.data,
  })
}

export type RendicionInput = { itemId: string; description: string; amount: number; date: string; notes?: string | null }

export function useSaveRendicion() {
  const inv = useInvalidateBudgetSpend()
  return useMutation({
    mutationFn: ({ id, ...body }: RendicionInput & { id?: string }) =>
      id ? api.patch(`/budget/rendiciones/${id}`, body) : api.post('/budget/rendiciones', body),
    onSuccess: inv,
  })
}

export function useDeleteRendicion() {
  const inv = useInvalidateBudgetSpend()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budget/rendiciones/${id}`),
    onSuccess: inv,
  })
}
