import { Users, FileText, UserPlus, Calendar, RefreshCw, AlertTriangle, Cake, CheckCircle2, Clock } from 'lucide-react'
import { useStats } from '@/hooks/useStats'
import { useSyncLogs } from '@/hooks/useDotacion'
import { formatDate } from '@/lib/utils'
import type { ContractType, SyncStatus } from '@/types'

const CONTRACT_LABEL: Record<ContractType, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  HONORARIOS: 'Honorarios',
  PRACTICA:   'Práctica',
}

const SYNC_STATUS_ICON: Record<SyncStatus, React.ReactNode> = {
  SUCCESS: <CheckCircle2 size={14} className="text-green-500" />,
  ERROR:   <AlertTriangle size={14} className="text-red-400" />,
  RUNNING: <RefreshCw size={14} className="animate-spin text-blue-400" />,
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats()
  const { data: logs } = useSyncLogs()

  const today = new Date()
  const monthName = today.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1 capitalize">
          {today.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-lg mb-4" />
              <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Colaboradores activos" value={stats?.activeEmployees ?? 0} icon={Users}     color="text-blue-600 bg-blue-50" />
          <StatCard label="Contratos por vencer"  value={stats?.expiringContracts.length ?? 0} icon={FileText}  color="text-amber-600 bg-amber-50"  sub="próximos 30 días" />
          <StatCard label="Vacaciones pendientes" value={stats?.pendingLeaves ?? 0}             icon={Calendar}  color="text-purple-600 bg-purple-50" sub="requieren aprobación" />
          <StatCard label="Cumpleaños este mes"   value={stats?.birthdaysThisMonth.length ?? 0} icon={Cake}     color="text-pink-600 bg-pink-50"     sub={`en ${monthName}`} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contratos por vencer */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900">Contratos por vencer</h3>
          </div>
          {!stats?.expiringContracts.length ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin contratos por vencer</p>
          ) : (
            <div className="space-y-3">
              {stats.expiringContracts.map((c) => {
                const days = daysUntil(c.endDate)
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.employee.firstName} {c.employee.lastName}</p>
                      <p className="text-xs text-gray-400">{CONTRACT_LABEL[c.type]} · vence {formatDate(c.endDate)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${days <= 7 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {days}d
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cumpleaños del mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cake size={16} className="text-pink-500" />
            <h3 className="font-semibold text-gray-900">Cumpleaños de {monthName}</h3>
          </div>
          {!stats?.birthdaysThisMonth.length ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin cumpleaños este mes</p>
          ) : (
            <div className="space-y-3">
              {stats.birthdaysThisMonth.map((b) => {
                const isToday = b.day === today.getDate()
                return (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isToday ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600'}`}>
                      {b.day}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isToday ? 'text-pink-700' : 'text-gray-800'}`}>
                        {b.name} {isToday && '🎂'}
                      </p>
                      {b.position && <p className="text-xs text-gray-400">{b.position}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dotación por contrato + Última actividad */}
        <div className="space-y-6">
          {/* Distribución por tipo de contrato */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={16} className="text-blue-500" />
              <h3 className="font-semibold text-gray-900">Tipos de contrato</h3>
            </div>
            {!stats?.byContractType.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {stats.byContractType.map((c) => (
                  <div key={c.type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{CONTRACT_LABEL[c.type]}</span>
                    <span className="font-semibold text-gray-900">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Última sincronización */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Última actividad BUK</h3>
            </div>
            {!logs?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin sincronizaciones</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-gray-500">
                    {SYNC_STATUS_ICON[s.status]}
                    <span>{s.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : 'Consultoría'}</span>
                    <span className="text-gray-300">·</span>
                    <span>{formatDate(s.completedAt ?? s.startedAt)}</span>
                    {s.status === 'SUCCESS' && (
                      <span className="text-green-500">{(s.employeesCreated + s.employeesUpdated)} sync</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
