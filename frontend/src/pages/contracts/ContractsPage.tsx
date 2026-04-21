import { useState } from 'react'
import { Plus, X, Loader2, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import { useContracts, useCreateContract, useDeleteContract } from '@/hooks/useContracts'
import { useEmployees } from '@/hooks/useEmployees'
import type { Contract } from '@/types'

const TYPE_LABEL: Record<Contract['type'], string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  HONORARIOS: 'Honorarios',
  PRACTICA: 'Práctica',
}

const TYPE_COLOR: Record<Contract['type'], string> = {
  INDEFINIDO: 'bg-green-100 text-green-700',
  PLAZO_FIJO: 'bg-amber-100 text-amber-700',
  HONORARIOS: 'bg-blue-100 text-blue-700',
  PRACTICA: 'bg-purple-100 text-purple-700',
}

interface FormState {
  employeeId: string
  type: Contract['type']
  startDate: string
  endDate: string
  salary: string
  fileUrl: string
}

const emptyForm: FormState = {
  employeeId: '', type: 'INDEFINIDO', startDate: '', endDate: '', salary: '', fileUrl: '',
}

function daysUntilExpiry(endDate?: string): number | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function ContractsPage() {
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [filterEmployee, setFilterEmployee] = useState('')

  const { data: contracts = [], isLoading } = useContracts()
  const { data: employees = [] } = useEmployees()
  const createContract = useCreateContract()
  const deleteContract = useDeleteContract()

  const filtered = contracts.filter((c) => {
    if (!filterEmployee) return true
    const fullName = `${c.employee?.firstName} ${c.employee?.lastName}`.toLowerCase()
    return fullName.includes(filterEmployee.toLowerCase()) ||
      c.employee?.rut?.toLowerCase().includes(filterEmployee.toLowerCase())
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createContract.mutateAsync({
      employeeId: form.employeeId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      salary: Number(form.salary),
      fileUrl: form.fileUrl || undefined,
    })
    setShowForm(false)
    setForm(emptyForm)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteContract.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contratos</h2>
          <p className="text-gray-500 mt-1">{contracts.filter((c) => c.isActive).length} contratos activos</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo contrato
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            placeholder="Filtrar por colaborador o RUT..."
            className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay contratos registrados.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Inicio</th>
                <th className="px-4 py-3 font-medium">Término</th>
                <th className="px-4 py-3 font-medium">Renta (CLP)</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const days = daysUntilExpiry(c.endDate)
                const isExpiringSoon = days !== null && days <= 30 && days >= 0
                const isExpired = days !== null && days < 0
                return (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isExpiringSoon ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {c.employee?.firstName} {c.employee?.lastName}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{c.employee?.rut}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[c.type]}`}>
                        {TYPE_LABEL[c.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(c.startDate).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.endDate ? (
                        <span className={isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600 font-medium' : ''}>
                          {new Date(c.endDate).toLocaleDateString('es-CL')}
                          {isExpiringSoon && <span className="ml-1 text-xs">({days}d)</span>}
                          {isExpired && <span className="ml-1 text-xs">(vencido)</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.salary.toLocaleString('es-CL')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo contrato */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo contrato</h3>
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
                  {employees
                    .filter((e) => e.status === 'ACTIVE')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} — {e.rut}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Contract['type'] }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INDEFINIDO">Indefinido</option>
                    <option value="PLAZO_FIJO">Plazo fijo</option>
                    <option value="HONORARIOS">Honorarios</option>
                    <option value="PRACTICA">Práctica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renta bruta (CLP) *</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                    required
                    min={0}
                    placeholder="Ej: 1200000"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha término {form.type !== 'INDEFINIDO' && '*'}
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required={form.type !== 'INDEFINIDO'}
                    disabled={form.type === 'INDEFINIDO'}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del documento (opcional)</label>
                <input
                  type="url"
                  value={form.fileUrl}
                  onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  disabled={createContract.isPending}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {createContract.isPending && <Loader2 size={14} className="animate-spin" />}
                  Crear contrato
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
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar contrato</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              ¿Confirmas la eliminación del contrato de{' '}
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
                disabled={deleteContract.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteContract.isPending && <Loader2 size={14} className="animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
