import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Department, ApiResponse } from '@/types'

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Department[]>>('/departments')
      return res.data.data
    },
  })
}
