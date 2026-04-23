import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiResponse, DashboardStats } from '@/types'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/stats')
      return data.data
    },
    refetchInterval: 60_000,
  })
}
