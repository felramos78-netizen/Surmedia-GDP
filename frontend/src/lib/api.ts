import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { queryClient } from '@/lib/queryClient'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gdp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      queryClient.clear()
    }
    return Promise.reject(error)
  },
)

export default api
