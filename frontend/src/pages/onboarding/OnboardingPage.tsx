import { useState } from 'react'
import { Plus, Rocket, CheckCircle2, Clock, AlertTriangle, ChevronRight, Search, X } from 'lucide-react'
import { useOnboardingProcesses, useOnboardingStats, useCreateOnboarding } from '@/hooks/useOnboarding'
import { useEmployees } from '@/hooks/useDotacion'
import type { OnboardingProcess } from '@/types'
import OnboardingDrawer from './OnboardingDrawer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysIn(startDate: string) {
  return Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
}

function calcProgress(process: OnboardingProcess) {
  const total = process.tasks.length
  if (total === 0) return 0
  const done = process.tasks.filter(t => t.completedAt).length
  return Math.round((done / total) * 100)
}

const STATUS_BADGE: Record<string, JSX.Element> = {
  IN_PROGRESS: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En proceso</span>,
  COMPLETED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span>,
  CANCELLED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Cancelado</span>,
}

// ─── Modal: Nuevo proceso ──────────────────────────────────────────────────────

function NewProcessModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')

  const { data: empData } = useEmployees({ search, status: 'ACTIVE' })
  const createOnboarding  = useCreateOnboarding()

  const employees = empData?.data ?? []
  const selectedEmp = employees.find(e => e.id === selected)

  const handleSubmit = async () => {
    if (!selected) return
    try {
      const process = await createOnboarding.mutateAsync({
        employeeId: selected,
        startDate:  startDate || undefined,
      })
      onCreated(process.id)
      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al crear el proceso')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo proceso de onboarding</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Search employee */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Colaborador</label>
            {selectedEmp ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedEmp.firstName} {selectedEmp.lastName}</p>
                  <p className="text-xs text-gray-500">{selectedEmp.position?.title ?? '—'}</p>
                </div>
                <button onClick={() => { setSelected(null); setSearch('') }} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {search.length > 1 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {employees.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>
                    ) : (
                      employees.slice(0, 8).map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => { setSelected(emp.id); setSearch(''); setStartDate(emp.startDate.split('T')[0]) }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm text-gray-900">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-gray-400">{emp.position?.title ?? '—'}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Fecha de inicio <span className="font-normal text-gray-400">(por defecto: fecha de ingreso)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!selected || createOnboarding.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createOnboarding.isPending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando...</>
            ) : (
              <><Rocket size={14} /> Iniciar onboarding</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de ingreso — primeros 90 días</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo proceso
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'En proceso',       value: stats?.inProgress    ?? '—', icon: <Rocket size={18} />,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Completados',      value: stats?.completed     ?? '—', icon: <CheckCircle2 size={18} />, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Por finalizar',    value: stats?.finalizingSoon ?? '—', icon: <AlertTriangle size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cancelados',       value: stats?.cancelled     ?? '—', icon: <X size={18} />,            color: 'text-gray-500',   bg: 'bg-gray-50' },
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
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <AlertTriangle size={32} />
            <p className="text-sm">Error cargando datos. Intenta nuevamente.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Rocket size={40} className="opacity-30" />
            <p className="text-sm font-medium">No hay procesos {filterStatus === 'IN_PROGRESS' ? 'activos' : 'en esta categoría'}</p>
            {filterStatus === 'IN_PROGRESS' && (
              <button
                onClick={() => setShowNewModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
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
                const emp       = process.employee!
                const progress  = calcProgress(process)
                const days      = daysIn(process.startDate)
                const entity    = (emp as any).contracts?.[0]?.legalEntity ?? ''
                const shortName = entity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones' : entity === 'SURMEDIA_CONSULTORIA' ? 'Consultoría' : '—'

                return (
                  <tr
                    key={process.id}
                    onClick={() => setDrawerProcessId(process.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-gray-400">{emp.position?.title ?? '—'}</p>
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

      {/* Drawer */}
      {drawerProcessId && (
        <OnboardingDrawer
          processId={drawerProcessId}
          onClose={() => setDrawerProcessId(null)}
        />
      )}

      {/* New process modal */}
      {showNewModal && (
        <NewProcessModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => setDrawerProcessId(id)}
        />
      )}
    </div>
  )
}
