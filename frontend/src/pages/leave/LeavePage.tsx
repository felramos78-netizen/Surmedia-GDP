import { useState } from 'react'
import { Calendar, Plus, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react'
import { useLeaves, useCreateLeave, useUpdateLeave, useDeleteLeave, type LeaveFilters } from '@/hooks/useLeaves'
import { useEmployees } from '@/hooks/useDotacion'
import { formatDate } from '@/lib/utils'
import type { Leave, LeaveStatus, LeaveType } from '@/types'

const TYPE_LABEL: Record<LeaveType, string> = {
  VACACIONES:           'Vacaciones',
  PERMISO:              'Permiso',
  LICENCIA_MEDICA:      'Licencia médica',
  LICENCIA_MATERNIDAD:  'Licencia maternidad',
  LICENCIA_PATERNIDAD:  'Licencia paternidad',
  OTRO:                 'Otro',
}

const STATUS_CONFIG: Record<LeaveStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700',  icon: <Clock size={13} /> },
  APPROVED:  { label: 'Aprobado',   color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={13} /> },
  REJECTED:  { label: 'Rechazado',  color: 'bg-red-100 text-red-600',      icon: <XCircle size={13} /> },
  CANCELLED: { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500',    icon: <XCircle size={13} /> },
}

// ─── Modal de solicitud ────────────────────────────────────────────────────────

function LeaveRequestModal({ onClose }: { onClose: () => void }) {
  const { data: empData } = useEmployees()
  const employees = empData?.data ?? []
  const create = useCreateLeave()

  const [form, setForm] = useState({
    employeeId: '',
    type: 'VACACIONES' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [error, setError] = useState('')

  function calcDays(): number {
    if (!form.startDate || !form.endDate) return 0
    const diff = (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.ceil(diff) + 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.employeeId) return setError('Selecciona un colaborador')
    if (!form.startDate || !form.endDate) return setError('Completa las fechas')
    if (new Date(form.endDate) < new Date(form.startDate)) return setError('La fecha de término debe ser posterior al inicio')

    try {
      await create.mutateAsync({
        employeeId: form.employeeId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: calcDays(),
        reason: form.reason || undefined,
      } as any)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al crear solicitud')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Nueva solicitud</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Colaborador *</label>
            <select
              value={form.employeeId}
              onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Seleccionar colaborador</option>
              {employees.filter(e => e.status === 'ACTIVE').map(e => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position?.title ?? 'Sin cargo'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de solicitud *</label>
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as LeaveType }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Desde *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hasta *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {calcDays() > 0 && (
            <p className="text-sm text-blue-600 font-medium">{calcDays()} día{calcDays() !== 1 ? 's' : ''}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / observaciones</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              rows={2}
              placeholder="Opcional…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" disabled={create.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {create.isPending && <RefreshCw size={14} className="animate-spin" />}
              Crear solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Fila de solicitud ────────────────────────────────────────────────────────

function LeaveRow({ leave, onApprove, onReject, onDelete }: {
  leave: Leave
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const s = STATUS_CONFIG[leave.status]
  const emp = leave.employee

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{emp?.firstName} {emp?.lastName}</p>
          <p className="text-xs text-gray-400">{emp?.position?.title ?? '—'}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{TYPE_LABEL[leave.type]}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-700 text-center">{leave.days}d</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
          {s.icon} {s.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{leave.reason ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {leave.status === 'PENDING' && (
            <>
              <button onClick={onApprove} title="Aprobar"
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                <CheckCircle2 size={15} />
              </button>
              <button onClick={onReject} title="Rechazar"
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                <XCircle size={15} />
              </button>
              <button onClick={onDelete} title="Eliminar"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                ×
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Filtro select ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function LeavePage() {
  const [filters, setFilters] = useState<LeaveFilters>({})
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError } = useLeaves(filters)
  const updateLeave = useUpdateLeave()
  const deleteLeave = useDeleteLeave()

  const leaves = data?.data ?? []

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length

  function setFilter(key: keyof LeaveFilters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  function approve(id: string) { updateLeave.mutate({ id, status: 'APPROVED' } as any) }
  function reject(id: string)  { updateLeave.mutate({ id, status: 'REJECTED' } as any) }
  function remove(id: string)  {
    if (window.confirm('¿Eliminar esta solicitud?')) deleteLeave.mutate(id)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {showForm && <LeaveRequestModal onClose={() => setShowForm(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vacaciones y permisos</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {data?.total !== undefined ? `${data.total} solicitudes` : 'Cargando…'}
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                <Clock size={13} /> {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nueva solicitud
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filtros */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <FilterSelect
            value={filters.status ?? ''}
            onChange={v => setFilter('status', v)}
            placeholder="Todos los estados"
            options={[
              { value: 'PENDING',   label: 'Pendientes' },
              { value: 'APPROVED',  label: 'Aprobados' },
              { value: 'REJECTED',  label: 'Rechazados' },
              { value: 'CANCELLED', label: 'Cancelados' },
            ]}
          />
          <FilterSelect
            value={filters.type ?? ''}
            onChange={v => setFilter('type', v)}
            placeholder="Todos los tipos"
            options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          {(filters.status || filters.type) && (
            <button onClick={() => setFilters({})} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2">
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Cargando solicitudes…</p>
          </div>
        ) : isError ? (
          <div className="p-16 text-center">
            <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Error cargando datos.</p>
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-16 text-center">
            <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay solicitudes.</p>
            <p className="text-xs text-gray-400 mt-1">Crea una nueva solicitud para comenzar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Colaborador</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Período</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Días</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Motivo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map(l => (
                  <LeaveRow
                    key={l.id}
                    leave={l}
                    onApprove={() => approve(l.id)}
                    onReject={() => reject(l.id)}
                    onDelete={() => remove(l.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {leaves.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {leaves.length} solicitudes{data?.total && data.total > leaves.length ? ` de ${data.total}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
