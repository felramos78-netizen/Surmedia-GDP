import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BudgetCategory, ApiResponse } from '@/types'

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

// Nombres de las partidas del Presupuesto DPDO, en el orden del presupuesto.
// Son las categorías válidas para el gasto del área Personas.
export function useBudgetItemNames(): string[] {
  const segments = useBudgetSegments()
  return useMemo(() => segments.flatMap(c => c.items.map(i => i.name)), [segments])
}

export function useCreateBudgetItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { categoryId: string; name: string; annualAmount?: number }) =>
      api.post('/budget/items', { annualAmount: 0, ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })
}
