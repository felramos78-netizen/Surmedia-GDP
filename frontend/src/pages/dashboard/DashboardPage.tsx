import { useQuery } from '@tanstack/react-query'
import { Users, FileText, Calendar, Cake, Clock, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { statsApi } from '@/lib/api'
import { formatDate, fullName } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
  })

  const statCards = [
    {
      label: 'Colaboradores activos',
      value: stats?.activeEmployees ?? '—',
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Contratos por vencer (30d)',
      value: stats?.expiringContracts ?? '—',
      icon: FileText,
      color: stats?.expiringContracts ? 'text-amber-600 bg-amber-50' : 'text-gray-400 bg-gray-50',
    },
    {
      label: 'Solicitudes pendientes',
      value: stats?.pendingLeaves ?? '—',
      icon: Calendar,
      color: stats?.pendingLeaves ? 'text-purple-600 bg-purple-50' : 'text-gray-400 bg-gray-50',
    },
    {
      label: 'Cumpleaños este mes',
      value: stats?.upcomingBirthdays?.length ?? '—',
      icon: Cake,
      color: 'text-pink-600 bg-pink-50',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Bienvenido/a, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('es-CL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? <span className="inline-block w-8 h-7 bg-gray-100 rounded animate-pulse" /> : value}
            </p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad reciente */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            Incorporaciones recientes
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : stats?.recentActivity?.length ? (
            <ul className="space-y-3">
              {stats.recentActivity.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{fullName(emp)}</p>
                      <p className="text-gray-400 text-xs">{emp.department?.name ?? 'Sin área'}</p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">{formatDate(emp.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              Sin actividad reciente
            </div>
          )}
        </div>

        {/* Próximos cumpleaños */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Cake size={16} className="text-gray-400" />
            Próximos cumpleaños
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : stats?.upcomingBirthdays?.length ? (
            <ul className="space-y-3">
              {stats.upcomingBirthdays.map((emp) => (
                <li key={emp.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                      <Cake size={14} />
                    </div>
                    <span className="font-medium text-gray-900">{emp.name}</span>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {emp.birthDate
                      ? new Date(emp.birthDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              Sin cumpleaños próximos
            </div>
          )}
        </div>

        {/* Alerta de contratos por vencer */}
        {(stats?.expiringContracts ?? 0) > 0 && (
          <div className="lg:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <UserCheck size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {stats!.expiringContracts} contrato(s) vencen en los próximos 30 días
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Revisa el módulo de contratos para gestionar renovaciones o finiquitos.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
