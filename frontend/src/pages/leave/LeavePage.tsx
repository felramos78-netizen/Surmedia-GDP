import { useState } from 'react'
import { Plus, X, Loader2, Calendar, Check, XCircle, AlertTriangle } from 'lucide-react'
import { useLeaves, useCreateLeave, useUpdateLeaveStatus, useDeleteLeave } from '@/hooks/useLeaves'
import { useEmployees } from '@/hooks/useEmployees'
import { useAuthStore } from '@/store/auth'
import type { Leave, LeaveType, LeaveStatus } from '@/types'

const TYPE_LABEL: Record<LeaveType, string> = {
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  LICENCIA_MEDICA: 'Licencia médica',
  LICENCIA_MATERNIDAD: 'Lic. maternidad',
  LICENCIA_PATERNIDAD: 'Lic. paternidad',
  OTRO: 'Otro',
}

const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

interface FormState {
  employeeId: string
  type: LeaveType
  startDate: string
  endDate: string
  days: string
  reason: string
}

const emptyForm: FormState = {
  employeeId: '', type: 'VACACIONES', startDate: '', endDate: '', days: '', reason: '',
}

const canManage = (role: string) =>
  ['ADMIN', 'RRHH_MANAGER', 'RRHH_ANALYST', 'MANAGER'].includes(role)

export default function LeavePage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Leave | null>(null)

  const [form, setForm] = useState<FormState>(emptyForm)

  const filters = activeTab === 'pending' ? { status: 'PENDING' as LeaveStatus } : undefined
  const { data: leaves = [], isLoading } = useLeaves(filters)
  const { data: employees = [] } = useEmployees()
  const createLeave = useCreateLeave()
  const updateStatus = useUpdateLeaveStatus()
  const deleteLeave = useDeleteLeave()

  const isManager = user ? canManage(user.role) : false

  function calcDays() {
    if (!form.startDate || !form.endDate) return
    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    const diff = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    setForm((f) => ({ ...f, days: String(diff) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createLeave.mutateAsync({
      employeeId: form.employeeId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days: Number(form.days),
      reason: form.reason || undefined,
    })
    setShowForm(false)
    setForm(emptyForm)
  }

  async function handleStatusChange(id: string, status: LeaveStatus) {
    await updateStatus.mutateAsync({ id, status })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteLeave.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vacaciones y Permisos</h2>
          <p className="text-gray-500 mt-1">
            {pendingCount > 0 ? (
              <span className="text-amber-600 font-medium">{pendingCount} solicitud{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
            ) : 'Sin solicitudes pendientes'}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => { setForm(emptyForm); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nueva solicitud
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Todas
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Pendientes
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">{pendingCount}</span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay solicitudes{activeTab === 'pending' ? ' pendientes' : ''}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Días</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                {isManager && <th className="px-4 py-3 font-medium w-28">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {leave.employee?.firstName} {leave.employee?.lastName}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{leave.employee?.rut}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{TYPE_LABEL[leave.type]}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(leave.startDate).toLocaleDateString('es-CL')} – {new Date(leave.endDate).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{leave.days}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{leave.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[leave.status]}`}>
                      {STATUS_LABEL[leave.status]}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3">
                      {leave.status === 'PENDING' ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStatusChange(leave.id, 'APPROVED')}
                            disabled={updateStatus.isPending}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Aprobar"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => handleStatusChange(leave.id, 'REJECTED')}
                            disabled={updateStatus.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Rechazar"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(leave)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva solicitud */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nueva solicitud</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar colaborador...</option>
                  {employees.filter((e) => e.status === 'ACTIVE').map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LeaveType }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    onBlur={calcDays}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    onBlur={calcDays}
                    required
                    min={form.startDate}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días hábiles *</label>
                <input
                  type="number"
                  value={form.days}
                  onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
                  required
                  min={1}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Se calcula automáticamente al seleccionar fechas.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Observaciones</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLeave.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {createLeave.isPending && <Loader2 size={14} className="animate-spin" />}
                  Crear solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Eliminar solicitud</h3>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              ¿Confirmas la eliminación de la solicitud de{' '}
              <strong>{TYPE_LABEL[deleteTarget.type].toLowerCase()}</strong> de{' '}
              <strong>{deleteTarget.employee?.firstName} {deleteTarget.employee?.lastName}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLeave.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLeave.isPending && <Loader2 size={14} className="animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
