import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertTriangle, X, FileText } from 'lucide-react'
import { contractsApi, employeesApi, type CreateContractInput } from '@/lib/api'
import { formatDate, formatCLP, contractTypeLabel, fullName } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const CONTRACT_TYPES = ['INDEFINIDO', 'PLAZO_FIJO', 'HONORARIOS', 'PRACTICA'] as const

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  INDEFINIDO: 'bg-green-100 text-green-700',
  PLAZO_FIJO: 'bg-amber-100 text-amber-700',
  HONORARIOS: 'bg-blue-100 text-blue-700',
  PRACTICA: 'bg-purple-100 text-purple-700',
}

const contractSchema = z.object({
  employeeId: z.string().min(1, 'Selecciona un colaborador'),
  type: z.enum(CONTRACT_TYPES),
  startDate: z.string().min(1, 'Requerido'),
  endDate: z.string().optional(),
  salary: z.number().min(1, 'Ingresa el sueldo'),
})

type ContractFormData = z.infer<typeof contractSchema>

function ContractModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: empData } = useQuery({
    queryKey: ['employees', '', ''],
    queryFn: () => employeesApi.list({ status: 'ACTIVE', limit: 200 }),
  })

  const employees = empData?.data ?? []

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { type: 'INDEFINIDO' },
  })

  const contractType = watch('type')

  async function onSubmit(data: ContractFormData) {
    const payload: CreateContractInput = {
      ...data,
      endDate: data.endDate || undefined,
    }
    await contractsApi.create(payload)
    onSuccess()
    onClose()
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Nuevo contrato</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Colaborador</label>
            <select {...register('employeeId')} className={inputClass}>
              <option value="">Seleccionar colaborador...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{fullName(e)} — {e.rut}</option>
              ))}
            </select>
            {errors.employeeId && <p className="text-xs text-red-500 mt-1">{errors.employeeId.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de contrato</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTRACT_TYPES.map((t) => (
                <label key={t} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors text-sm ${watch('type') === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" {...register('type')} value={t} className="hidden" />
                  {contractTypeLabel(t)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inicio</label>
              <input {...register('startDate')} type="date" className={inputClass} />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Término {contractType === 'INDEFINIDO' ? '(opcional)' : ''}
              </label>
              <input
                {...register('endDate')}
                type="date"
                className={inputClass}
                required={contractType !== 'INDEFINIDO'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sueldo bruto (CLP)</label>
            <input {...register('salary', { valueAsNumber: true })} type="number" className={inputClass} placeholder="800000" min={0} />
            {errors.salary && <p className="text-xs text-red-500 mt-1">{errors.salary.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Creando...' : 'Crear contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContractsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showExpiringSoon, setShowExpiringSoon] = useState(false)

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', showExpiringSoon],
    queryFn: () => contractsApi.list(showExpiringSoon ? { expiringSoon: true } : undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: contractsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const expiringCount = contracts.filter((c) => {
    if (!c.endDate) return false
    const diff = new Date(c.endDate).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }).length

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contratos</h2>
          <p className="text-gray-500 mt-1">{contracts.length} contrato(s) registrado(s)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo contrato
        </button>
      </div>

      {/* Alerta vencimientos */}
      {expiringCount > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {expiringCount} contrato(s) vencen en los próximos 30 días
            </p>
            <p className="text-xs text-amber-600">Gestiona renovaciones o finiquitos con anticipación.</p>
          </div>
          <button
            onClick={() => setShowExpiringSoon(!showExpiringSoon)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${showExpiringSoon ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}
          >
            {showExpiringSoon ? 'Ver todos' : 'Ver solo críticos'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay contratos registrados aún.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Término</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sueldo Bruto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isExpiring = c.endDate
                  ? new Date(c.endDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 &&
                    new Date(c.endDate).getTime() > Date.now()
                  : false

                return (
                  <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isExpiring ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      {c.employee ? (
                        <div>
                          <p className="font-medium text-gray-900">{fullName(c.employee)}</p>
                          <p className="text-xs text-gray-400 font-mono">{c.employee.rut}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_TYPE_COLORS[c.type] ?? 'bg-gray-100 text-gray-500'}`}>
                        {contractTypeLabel(c.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(c.startDate)}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.endDate ? (
                        <span className={isExpiring ? 'text-amber-700 font-semibold' : 'text-gray-600'}>
                          {isExpiring && '⚠ '}{formatDate(c.endDate)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{formatCLP(c.salary)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm('¿Eliminar este contrato?')) deleteMutation.mutate(c.id) }}
                        className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ContractModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
