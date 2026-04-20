import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    const userEncoded = searchParams.get('user')

    if (token && userEncoded) {
      try {
        const user = JSON.parse(atob(userEncoded))
        setAuth(user, token)
        navigate('/dashboard')
      } catch {
        navigate('/login?error=invalid_callback')
      }
    } else {
      navigate('/login?error=missing_token')
    }
  }, [searchParams, setAuth, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Iniciando sesión...</p>
      </div>
    </div>
  )
}
