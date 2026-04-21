import { Users, FileText, Calendar, Loader2, Cake } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDashboardStats } from '@/hooks/useDashboard'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: stats, isLoading } = useDashboardStats()

  const cards = [
    {
      label: 'Colaboradores activos',
      value: stats?.activeEmployees ?? '—',
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Contratos por vencer (30 días)',
      value: stats?.expiringContracts ?? '—',
      icon: FileText,
      color: stats?.expiringContracts ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Solicitudes pendientes',
      value: stats?.pendingLeaves ?? '—',
      icon: Calendar,
      color: stats?.pendingLeaves ? 'text-purple-600 bg-purple-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Próximos cumpleaños (mes)',
      value: stats?.upcomingBirthdays.filter((b) => b.daysUntil <= 30).length ?? '—',
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Próximos contratos por vencer */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Alertas</h3>
              {(stats?.expiringContracts ?? 0) > 0 ? (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <FileText size={18} className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">
                    <strong>{stats?.expiringContracts}</strong> contrato{stats?.expiringContracts !== 1 ? 's' : ''} vence{stats?.expiringContracts !== 1 ? 'n' : ''} en los próximos 30 días.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  Sin alertas pendientes
                </div>
              )}
              {(stats?.pendingLeaves ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 mt-3">
                  <Calendar size={18} className="text-purple-600 shrink-0" />
                  <p className="text-sm text-purple-700">
                    <strong>{stats?.pendingLeaves}</strong> solicitud{stats?.pendingLeaves !== 1 ? 'es' : ''} de permiso/vacación pendiente{stats?.pendingLeaves !== 1 ? 's' : ''} de aprobación.
                  </p>
                </div>
              )}
            </div>

            {/* Próximos cumpleaños */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Próximos cumpleaños</h3>
              {stats?.upcomingBirthdays.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
                  Sin cumpleaños próximos
                </div>
              ) : (
                <ul className="space-y-3">
                  {stats?.upcomingBirthdays.map((b) => (
                    <li key={b.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 text-xs font-semibold">
                          {b.firstName.charAt(0)}{b.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {b.firstName} {b.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{b.position?.title ?? 'Sin cargo'}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        b.daysUntil === 0
                          ? 'bg-pink-100 text-pink-700'
                          : b.daysUntil <= 7
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {b.daysUntil === 0 ? '¡Hoy!' : `en ${b.daysUntil} días`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
