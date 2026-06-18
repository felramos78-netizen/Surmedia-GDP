// Página principal de Onboarding. El modal de creación, los helpers, las
// constantes y la vista de calendario viven en archivos sibling:
// NewProcessModal y onboardingPageShared.
import { useState } from 'react'
import { Plus, Rocket, CheckCircle2, AlertTriangle, X, ChevronRight } from 'lucide-react'
import { useOnboardingProcesses, useOnboardingStats } from '@/hooks/useOnboarding'
import OnboardingDrawer from './OnboardingDrawer'
import HitosTab from './tabs/HitosTab'
import AutomatizacionTab from './tabs/AutomatizacionTab'
import { NewProcessModal } from './NewProcessModal'
import { calcProgress, daysIn, fmt, initials, STATUS_BADGE, ENTITY_LABEL } from './onboardingPageShared'

export default function OnboardingPage() {
  const [tab, setTab]                         = useState<'procesos' | 'hitos' | 'automatizacion'>('procesos')
  const [drawerProcessId, setDrawerProcessId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal]       = useState(false)
  const [filterStatus, setFilterStatus]       = useState<string>('IN_PROGRESS')

  const { data: processes, isLoading, isError } = useOnboardingProcesses()
  const { data: stats } = useOnboardingStats()

  const filtered = (processes ?? []).filter(p =>
    filterStatus === 'ALL' ? true : p.status === filterStatus
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de ingreso — primeros 90 días</p>
        </div>
        {tab === 'procesos' && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus size={16} />
            Nuevo proceso
          </button>
        )}
      </div>

      {/* Tabs principales */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          ['procesos',      'Procesos'],
          ['hitos',         'Hitos'],
          ['automatizacion','Automatización'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Hitos ── */}
      {tab === 'hitos' && <HitosTab />}

      {/* ── Tab: Automatización ── */}
      {tab === 'automatizacion' && <AutomatizacionTab />}

      {/* ── Tab: Procesos ── */}
      {tab === 'procesos' && <>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'En proceso',    value: stats?.inProgress    ?? '—', icon: <Rocket size={18} />,        color: 'text-brand-600',  bg: 'bg-brand-50' },
          { label: 'Completados',   value: stats?.completed     ?? '—', icon: <CheckCircle2 size={18} />,  color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Por finalizar', value: stats?.finalizingSoon ?? '—', icon: <AlertTriangle size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cancelados',    value: stats?.cancelled     ?? '—', icon: <X size={18} />,             color: 'text-gray-500',  bg: 'bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { value: 'IN_PROGRESS', label: 'En proceso' },
          { value: 'COMPLETED',   label: 'Completados' },
          { value: 'CANCELLED',   label: 'Cancelados' },
          { value: 'ALL',         label: 'Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterStatus === f.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <AlertTriangle size={32} />
            <p className="text-sm">Error cargando datos. Intenta nuevamente.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Rocket size={40} className="opacity-30" />
            <p className="text-sm font-medium">
              No hay procesos {filterStatus === 'IN_PROGRESS' ? 'activos' : 'en esta categoría'}
            </p>
            {filterStatus === 'IN_PROGRESS' && (
              <button onClick={() => setShowNewModal(true)} className="text-sm text-brand-600 hover:underline">
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Ingreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Día</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Progreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(process => {
                const progress   = calcProgress(process)
                const days       = daysIn(process.startDate)
                const shortName  = ENTITY_LABEL[process.legalEntity ?? ''] ?? '—'
                const avatarText = initials(process.collaboratorName)

                return (
                  <tr
                    key={process.id}
                    onClick={() => setDrawerProcessId(process.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0 uppercase">
                          {avatarText}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{process.collaboratorName}</p>
                          <p className="text-xs text-gray-400">{process.collaboratorPosition ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{shortName}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell whitespace-nowrap">
                      {fmt(process.startDate)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${days > 90 ? 'text-amber-600' : 'text-gray-600'}`}>
                        Día {days}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#3b82f6' }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{STATUS_BADGE[process.status]}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawerProcessId && (
        <OnboardingDrawer processId={drawerProcessId} onClose={() => setDrawerProcessId(null)} />
      )}
      {showNewModal && (
        <NewProcessModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setDrawerProcessId(id); setShowNewModal(false) }}
          processes={processes ?? []}
        />
      )}
      </>}
    </div>
  )
}
