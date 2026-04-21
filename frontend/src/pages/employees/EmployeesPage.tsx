import { useState } from 'react'
import { Search, Plus, Filter, Pencil, Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from '@/hooks/useEmployees'
import { useDepartments } from '@/hooks/useDepartments'
import { usePositions } from '@/hooks/usePositions'
import { formatRutOnInput, validateRut, formatRut } from '@/lib/rut'
import type { Employee } from '@/types'

const STATUS_LABEL: Record<Employee['status'], string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Con permiso',
}

const STATUS_COLOR: Record<Employee['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  ON_LEAVE: 'bg-amber-100 text-amber-700',
}

interface FormState {
  rut: string
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  address: string
  gender: string
  departmentId: string
  positionId: string
  startDate: string
  afp: string
  isapre: string
}

const emptyForm: FormState = {
  rut: '', firstName: '', lastName: '', email: '', phone: '',
  birthDate: '', address: '', gender: '', departmentId: '',
  positionId: '', startDate: '', afp: '', isapre: '',
}

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [rutError, setRutError] = useState('')

  const { data: employees = [], isLoading } = useEmployees()
  const { data: departments = [] } = useDepartments()
  const { data: positions = [] } = usePositions()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deleteEmployee = useDeleteEmployee()

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.rut.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.position?.title?.toLowerCase().includes(q) ||
      e.department?.name?.toLowerCase().includes(q)
    )
  })

  const filteredPositions = form.departmentId
    ? positions.filter((p) => p.departmentId === form.departmentId)
    : positions

  function openCreate() {
    setForm(emptyForm)
    setEditTarget(null)
    setRutError('')
    setShowForm(true)
  }

  function openEdit(emp: Employee) {
    setForm({
      rut: emp.rut,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone ?? '',
      birthDate: emp.birthDate ? emp.birthDate.slice(0, 10) : '',
      address: emp.address ?? '',
      gender: emp.gender ?? '',
      departmentId: emp.departmentId ?? '',
      positionId: emp.positionId ?? '',
      startDate: emp.startDate.slice(0, 10),
      afp: emp.afp ?? '',
      isapre: emp.isapre ?? '',
    })
    setEditTarget(emp)
    setRutError('')
    setShowForm(true)
  }

  function handleRutChange(v: string) {
    const formatted = formatRutOnInput(v)
    setForm((f) => ({ ...f, rut: formatted }))
    if (formatted.includes('-') && !validateRut(formatted)) {
      setRutError('RUT inválido')
    } else {
      setRutError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateRut(form.rut)) { setRutError('RUT inválido'); return }

    const payload = {
      ...form,
      rut: formatRut(form.rut),
      phone: form.phone || undefined,
      birthDate: form.birthDate || undefined,
      address: form.address || undefined,
      gender: form.gender || undefined,
      departmentId: form.departmentId || undefined,
      positionId: form.positionId || undefined,
      afp: form.afp || undefined,
      isapre: form.isapre || undefined,
    }

    if (editTarget) {
      await updateEmployee.mutateAsync({ id: editTarget.id, data: payload })
    } else {
      await createEmployee.mutateAsync(payload)
    }
    setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteEmployee.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const isSaving = createEmployee.isPending || updateEmployee.isPending

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dotación</h2>
          <p className="text-gray-500 mt-1">
            {isLoading ? '...' : `${employees.filter(e => e.status === 'ACTIVE').length} colaboradores activos`}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo colaborador
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, RUT, cargo o área..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter size={16} />
            Filtros
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm">{search ? 'Sin resultados para la búsqueda.' : 'No hay colaboradores registrados.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">RUT</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Área</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Ingreso</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-gray-400">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.rut}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.position?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[emp.status]}`}>
                      {STATUS_LABEL[emp.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(emp.startDate).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editTarget ? 'Editar colaborador' : 'Nuevo colaborador'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={(e) => handleRutChange(e.target.value)}
                    placeholder="12.345.678-9"
                    required
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${rutError ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+56 9 1234 5678"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin especificar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="No binario">No binario</option>
                    <option value="Prefiero no indicar">Prefiero no indicar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, positionId: '' }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin área asignada</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <select
                    value={form.positionId}
                    onChange={(e) => setForm((f) => ({ ...f, positionId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin cargo asignado</option>
                    {filteredPositions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AFP</label>
                  <select
                    value={form.afp}
                    onChange={(e) => setForm((f) => ({ ...f, afp: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin AFP</option>
                    <option value="Capital">Capital</option>
                    <option value="Cuprum">Cuprum</option>
                    <option value="Habitat">Habitat</option>
                    <option value="Modelo">Modelo</option>
                    <option value="PlanVital">PlanVital</option>
                    <option value="ProVida">ProVida</option>
                    <option value="Uno">Uno</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salud</label>
                  <select
                    value={form.isapre}
                    onChange={(e) => setForm((f) => ({ ...f, isapre: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin especificar</option>
                    <option value="Fonasa">Fonasa</option>
                    <option value="Banmédica">Banmédica</option>
                    <option value="Colmena">Colmena</option>
                    <option value="Cruz Blanca">Cruz Blanca</option>
                    <option value="Esencial">Esencial</option>
                    <option value="Vida Tres">Vida Tres</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(createEmployee.isError || updateEmployee.isError) && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  Error al guardar. Verifica los datos e intenta nuevamente.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !!rutError}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editTarget ? 'Guardar cambios' : 'Crear colaborador'}
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
                <h3 className="font-semibold text-gray-900">Eliminar colaborador</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              ¿Confirmas que deseas eliminar a <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> ({deleteTarget.rut})?
              El registro quedará inactivo.
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
                disabled={deleteEmployee.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteEmployee.isPending && <Loader2 size={14} className="animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
