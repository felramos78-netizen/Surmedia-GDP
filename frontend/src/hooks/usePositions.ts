import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Position, ApiResponse } from '@/types'

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Position[]>>('/positions')
      return res.data.data
    },
  })
}
