import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiResponse, Department, Position } from '@/types'

interface DeptWithPositions extends Department {
  positions: Position[]
  _count: { employees: number }
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DeptWithPositions[]>>('/departments')
      return data.data
    },
    staleTime: 1000 * 60 * 10,
  })
}
