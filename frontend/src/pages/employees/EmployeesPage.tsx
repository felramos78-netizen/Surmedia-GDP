import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, ChevronRight, X } from 'lucide-react'
import { employeesApi, departmentsApi, positionsApi, type CreateEmployeeInput } from '@/lib/api'
import { formatDate, fullName, statusLabel } from '@/lib/utils'
import type { Employee } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  ON_LEAVE: 'bg-amber-100 text-amber-700',
}

const employeeSchema = z.object({
  rut: z.string().min(7, 'RUT inválido'),
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  startDate: z.string().min(1, 'Requerido'),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  afp: z.string().optional(),
  isapre: z.string().optional(),
})

type EmployeeFormData = z.infer<typeof employeeSchema>

interface EmployeeModalProps {
  employee?: Employee
  onClose: () => void
  onSuccess: () => void
}

function EmployeeModal({ employee, onClose, onSuccess }: EmployeeModalProps) {
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list })
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => positionsApi.list() })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee
      ? {
          rut: employee.rut,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone ?? '',
          startDate: employee.startDate?.slice(0, 10),
          departmentId: employee.departmentId ?? '',
          positionId: employee.positionId ?? '',
          afp: employee.afp ?? '',
          isapre: employee.isapre ?? '',
        }
      : {},
  })

  async function onSubmit(data: EmployeeFormData) {
    const payload: CreateEmployeeInput = {
      ...data,
      phone: data.phone || undefined,
      departmentId: data.departmentId || undefined,
      positionId: data.positionId || undefined,
      afp: data.afp || undefined,
      isapre: data.isapre || undefined,
    }

    if (employee) {
      await employeesApi.update(employee.id, payload)
    } else {
      await employeesApi.create(payload)
    }
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {employee ? 'Editar colaborador' : 'Nuevo colaborador'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre" error={errors.firstName?.message}>
              <input {...register('firstName')} className={inputClass} placeholder="Felipe" />
            </Field>
            <Field label="Apellido" error={errors.lastName?.message}>
              <input {...register('lastName')} className={inputClass} placeholder="Ramos" />
            </Field>
          </div>

          <Field label="RUT" error={errors.rut?.message}>
            <input {...register('rut')} className={inputClass} placeholder="12.345.678-9" />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" className={inputClass} placeholder="framos@surmedia.cl" />
          </Field>

          <Field label="Teléfono" error={errors.phone?.message}>
            <input {...register('phone')} className={inputClass} placeholder="+56 9 XXXX XXXX" />
          </Field>

          <Field label="Fecha de ingreso" error={errors.startDate?.message}>
            <input {...register('startDate')} type="date" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Área" error={errors.departmentId?.message}>
              <select {...register('departmentId')} className={inputClass}>
                <option value="">Sin área</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Cargo" error={errors.positionId?.message}>
              <select {...register('positionId')} className={inputClass}>
                <option value="">Sin cargo</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="AFP" error={errors.afp?.message}>
              <select {...register('afp')} className={inputClass}>
                <option value="">Seleccionar</option>
                {['Capital', 'Cuprum', 'Habitat', 'Modelo', 'PlanVital', 'ProVida', 'Uno'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Salud" error={errors.isapre?.message}>
              <select {...register('isapre')} className={inputClass}>
                <option value="">Seleccionar</option>
                {['Fonasa', 'Banmédica', 'Colmena', 'Consalud', 'Cruz Blanca', 'Esencial', 'Vida Tres'].map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Guardando...' : employee ? 'Guardar cambios' : 'Crear colaborador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

// ─── Main page ────────────────────────────────────────────────

export default function EmployeesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, statusFilter],
    queryFn: () => employeesApi.list({ search: search || undefined, status: statusFilter || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: employeesApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })

  const employees = data?.data ?? []
  const total = data?.total ?? 0

  function handleEdit(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation()
    setEditEmployee(emp)
    setShowModal(true)
  }

  function handleDelete(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`¿Eliminar a ${fullName(emp)}? Esta acción es irreversible.`)) {
      deleteMutation.mutate(emp.id)
      if (selectedEmployee?.id === emp.id) setSelectedEmployee(null)
    }
  }

  function handleModalSuccess() {
    queryClient.invalidateQueries({ queryKey: ['employees'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  function openNew() {
    setEditEmployee(undefined)
    setShowModal(true)
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className={`flex flex-col ${selectedEmployee ? 'w-1/2' : 'flex-1'} transition-all`}>
        <div className="p-8 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dotación</h2>
              <p className="text-gray-500 mt-1">
                {isLoading ? 'Cargando...' : `${total} colaborador${total !== 1 ? 'es' : ''}`}
              </p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Nuevo colaborador
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, RUT o email..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
              <option value="ON_LEAVE">Con licencia</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-8 pb-8">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="w-10 h-10 mx-auto mb-3 opacity-30">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <p className="text-sm">
                  {search ? `Sin resultados para "${search}"` : 'No hay colaboradores registrados aún.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">RUT</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Área</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingreso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(selectedEmployee?.id === emp.id ? null : emp)}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedEmployee?.id === emp.id ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{fullName(emp)}</p>
                            <p className="text-xs text-gray-400">{emp.position?.title ?? 'Sin cargo'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.rut}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.department?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {statusLabel(emp.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(emp.startDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={(e) => handleEdit(emp, e)} className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(e) => handleDelete(emp, e)} className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className={`text-gray-300 ml-1 transition-transform ${selectedEmployee?.id === emp.id ? 'rotate-90' : ''}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedEmployee && (
        <div className="w-1/2 border-l border-gray-200 bg-white overflow-auto">
          <EmployeeDetail
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            onEdit={() => { setEditEmployee(selectedEmployee); setShowModal(true) }}
          />
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={editEmployee}
          onClose={() => { setShowModal(false); setEditEmployee(undefined) }}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}

function EmployeeDetail({ employee, onClose, onEdit }: { employee: Employee; onClose: () => void; onEdit: () => void }) {
  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee', employee.id],
    queryFn: () => employeesApi.get(employee.id),
  })

  const data = emp ?? employee

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
            {data.firstName[0]}{data.lastName[0]}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{fullName(data)}</h3>
            <p className="text-sm text-gray-500">{data.position?.title ?? 'Sin cargo'}</p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_COLORS[data.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel(data.status)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Editar
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Información personal">
            <Row label="RUT" value={<span className="font-mono">{data.rut}</span>} />
            <Row label="Email" value={data.email} />
            <Row label="Teléfono" value={data.phone ?? '—'} />
            <Row label="Área" value={data.department?.name ?? '—'} />
          </Section>

          <Section title="Datos contractuales">
            <Row label="Ingreso" value={formatDate(data.startDate)} />
            {data.endDate && <Row label="Término" value={formatDate(data.endDate)} />}
            {data.contracts && data.contracts.length > 0 && (
              <Row label="Tipo contrato" value={data.contracts[0].type.replace('_', ' ')} />
            )}
          </Section>

          <Section title="Previsión">
            <Row label="AFP" value={data.afp ?? '—'} />
            <Row label="Salud" value={data.isapre ?? '—'} />
          </Section>

          {data.leaves && data.leaves.length > 0 && (
            <Section title="Últimas solicitudes">
              {data.leaves.slice(0, 3).map((l) => (
                <div key={l.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">{l.type.replace('_', ' ')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'APPROVED' ? 'bg-green-100 text-green-700' : l.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel(l.status)}
                  </span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="bg-gray-50 rounded-lg px-4 py-1 space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}
