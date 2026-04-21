import { Users, FileText, UserPlus, Calendar } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const stats = [
  { label: 'Colaboradores activos', value: '—', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { label: 'Contratos por vencer', value: '—', icon: FileText, color: 'text-amber-600 bg-amber-50' },
  { label: 'Procesos activos', value: '—', icon: UserPlus, color: 'text-green-600 bg-green-50' },
  { label: 'Solicitudes pendientes', value: '—', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
]

export default function DashboardPage() {
  const { user } = useAuthStore()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Bienvenido/a, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Actividad reciente</h3>
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Sin actividad reciente
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Próximos cumpleaños</h3>
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Sin datos disponibles
          </div>
        </div>
      </div>
    </div>
  )
}
