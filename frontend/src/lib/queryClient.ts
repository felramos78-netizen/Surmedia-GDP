import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        const status = error instanceof AxiosError ? error.response?.status : undefined
        if (status === 401 || status === 403) return false
        return failureCount < 1
      },
    },
  },
})
