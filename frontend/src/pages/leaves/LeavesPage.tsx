import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X, Calendar } from 'lucide-react'
import { leavesApi, employeesApi, type CreateLeaveInput } from '@/lib/api'
import { formatDate, leaveTypeLabel, statusLabel, fullName } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const LEAVE_TYPES = ['VACACIONES', 'PERMISO', 'LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD', 'OTRO'] as const

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Selecciona un colaborador'),
  type: z.enum(LEAVE_TYPES),
  startDate: z.string().min(1, 'Requerido'),
  endDate: z.string().min(1, 'Requerido'),
  days: z.number().min(1, 'Mínimo 1 día'),
  reason: z.string().optional(),
})

type LeaveFormData = z.infer<typeof leaveSchema>

function LeaveModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: empData } = useQuery({
    queryKey: ['employees', '', ''],
    queryFn: () => employeesApi.list({ status: 'ACTIVE', limit: 200 }),
  })
  const employees = empData?.data ?? []

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: 'VACACIONES', days: 1 },
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')

  function calcDays(start: string, end: string) {
    if (!start || !end) return
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24) + 1
    if (diff > 0) setValue('days', Math.round(diff))
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  async function onSubmit(data: LeaveFormData) {
    const payload: CreateLeaveInput = { ...data, reason: data.reason || undefined }
    await leavesApi.create(payload)
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Nueva solicitud</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Colaborador</label>
            <select {...register('employeeId')} className={inputClass}>
              <option value="">Seleccionar colaborador...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{fullName(e)}</option>
              ))}
            </select>
            {errors.employeeId && <p className="text-xs text-red-500 mt-1">{errors.employeeId.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
            <select {...register('type')} className={inputClass}>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{leaveTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
              <input
                {...register('startDate')}
                type="date"
                className={inputClass}
                onChange={(e) => { register('startDate').onChange(e); calcDays(e.target.value, endDate) }}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
              <input
                {...register('endDate')}
                type="date"
                className={inputClass}
                onChange={(e) => { register('endDate').onChange(e); calcDays(startDate, e.target.value) }}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Días hábiles</label>
            <input {...register('days', { valueAsNumber: true })} type="number" min={1} className={inputClass} />
            {errors.days && <p className="text-xs text-red-500 mt-1">{errors.days.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea {...register('reason')} rows={2} className={`${inputClass} resize-none`} placeholder="Describe el motivo..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Enviando...' : 'Crear solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeavesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('PENDING')

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leaves', statusFilter],
    queryFn: () => leavesApi.list({ status: statusFilter || undefined }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' | 'CANCELLED' }) =>
      leavesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['leaves'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vacaciones y Permisos</h2>
          <p className="text-gray-500 mt-1">
            {pendingCount > 0 ? `${pendingCount} solicitud(es) pendiente(s) de aprobación` : 'Sin solicitudes pendientes'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nueva solicitud
        </button>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 mb-6">
        {(['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s === '' ? 'Todos' : statusLabel(s)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay solicitudes con este filtro.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Período</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Días</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {leave.employee ? (
                      <div>
                        <p className="font-medium text-gray-900">{fullName(leave.employee)}</p>
                        <p className="text-xs text-gray-400">{leave.employee.department?.name ?? 'Sin área'}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{leaveTypeLabel(leave.type)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-semibold">{leave.days}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[leave.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabel(leave.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {leave.status === 'PENDING' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => statusMutation.mutate({ id: leave.id, status: 'APPROVED' })}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Check size={12} />
                          Aprobar
                        </button>
                        <button
                          onClick={() => statusMutation.mutate({ id: leave.id, status: 'REJECTED' })}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <X size={12} />
                          Rechazar
                        </button>
                      </div>
                    )}
                    {leave.status === 'APPROVED' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: leave.id, status: 'CANCELLED' })}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <LeaveModal onClose={() => setShowModal(false)} onSuccess={handleSuccess} />
      )}
    </div>
  )
}
