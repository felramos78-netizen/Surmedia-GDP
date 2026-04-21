import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()

  function hasRole(...roles: UserRole[]): boolean {
    if (!user) return false
    return roles.includes(user.role)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return { user, isAuthenticated, hasRole, logout: handleLogout }
}
