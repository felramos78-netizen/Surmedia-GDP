import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateEmployee, useUpdateEmployee } from '@/hooks/useDotacion'
import { useDepartments } from '@/hooks/useDepartments'
import type { Employee, EmployeeStatus } from '@/types'

interface Props {
  employee?: Employee | null
  onClose: () => void
  onSuccess?: (employee: Employee) => void
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
}

function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

type FormData = {
  rut: string
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  address: string
  nationality: string
  gender: string
  departmentId: string
  positionId: string
  status: string
  startDate: string
  afp: string
  isapre: string
}

const EMPTY: FormData = {
  rut: '', firstName: '', lastName: '', email: '', phone: '',
  birthDate: '', address: '', nationality: 'Chilena', gender: '',
  departmentId: '', positionId: '', status: 'ACTIVE', startDate: '',
  afp: '', isapre: '',
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return ''
  try { return new Date(val).toISOString().split('T')[0] } catch { return '' }
}

export default function EmployeeForm({ employee, onClose, onSuccess }: Props) {
  const isEdit = !!employee
  const { data: departments } = useDepartments()

  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const create = useCreateEmployee()
  const update = useUpdateEmployee()
  const isPending = create.isPending || update.isPending

  useEffect(() => {
    if (employee) {
      setForm({
        rut:          employee.rut ?? '',
        firstName:    employee.firstName ?? '',
        lastName:     employee.lastName ?? '',
        email:        employee.email ?? '',
        phone:        employee.phone ?? '',
        birthDate:    toDateInput(employee.birthDate),
        address:      employee.address ?? '',
        nationality:  employee.nationality ?? 'Chilena',
        gender:       employee.gender ?? '',
        departmentId: employee.departmentId ?? '',
        positionId:   employee.positionId ?? '',
        status:       employee.status ?? 'ACTIVE',
        startDate:    toDateInput(employee.startDate),
        afp:          employee.afp ?? '',
        isapre:       employee.isapre ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [employee])

  const selectedDept = departments?.find(d => d.id === form.departmentId)
  const positions = selectedDept?.positions ?? []

  function set(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
    if (key === 'departmentId') setForm(prev => ({ ...prev, departmentId: value, positionId: '' }))
  }

  function validate(): boolean {
    const e: Partial<FormData> = {}
    if (!form.rut.trim())       e.rut       = 'RUT es obligatorio'
    if (!form.firstName.trim()) e.firstName = 'Nombre es obligatorio'
    if (!form.lastName.trim())  e.lastName  = 'Apellido es obligatorio'
    if (!form.email.trim())     e.email     = 'Correo es obligatorio'
    if (!form.startDate)        e.startDate = 'Fecha de ingreso es obligatoria'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: Partial<Employee> = {
      rut:          form.rut,
      firstName:    form.firstName,
      lastName:     form.lastName,
      email:        form.email,
      nationality:  form.nationality,
      startDate:    form.startDate,
      status:       form.status as EmployeeStatus,
      phone:        form.phone || null,
      birthDate:    form.birthDate || null,
      address:      form.address || null,
      gender:       form.gender || null,
      departmentId: form.departmentId || null,
      positionId:   form.positionId || null,
      afp:          form.afp || null,
      isapre:       form.isapre || null,
    }

    try {
      if (isEdit && employee) {
        const updated = await update.mutateAsync({ id: employee.id, ...payload })
        onSuccess?.(updated)
      } else {
        const created = await create.mutateAsync(payload)
        onSuccess?.(created)
      }
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al guardar'
      setErrors({ rut: msg })
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Editar colaborador' : 'Nuevo colaborador'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <Field label="RUT *" error={errors.rut}>
              <Input
                value={form.rut}
                onChange={e => set('rut', e.target.value)}
                placeholder="12.345.678-9"
                disabled={isEdit}
              />
            </Field>
            <Field label="Estado">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ON_LEAVE">Con permiso</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *" error={errors.firstName}>
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="María" />
            </Field>
            <Field label="Apellido *" error={errors.lastName}>
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="González" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Correo *" error={errors.email}>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="maria@surmedia.cl" />
            </Field>
            <Field label="Teléfono">
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 1234 5678" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha de ingreso *" error={errors.startDate}>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Departamento">
              <Select value={form.departmentId} onChange={e => { set('departmentId', e.target.value); setForm(p => ({ ...p, departmentId: e.target.value, positionId: '' })) }}>
                <option value="">Sin departamento</option>
                {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Cargo">
              <Select value={form.positionId} onChange={e => set('positionId', e.target.value)} disabled={!form.departmentId}>
                <option value="">Sin cargo</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Dirección">
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Av. Providencia 1234, Santiago" />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Género">
              <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">No especificado</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="NB">No binario</option>
              </Select>
            </Field>
            <Field label="AFP">
              <Input value={form.afp} onChange={e => set('afp', e.target.value)} placeholder="Habitat" />
            </Field>
            <Field label="Isapre / Fonasa">
              <Input value={form.isapre} onChange={e => set('isapre', e.target.value)} placeholder="Fonasa" />
            </Field>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear colaborador'}
          </button>
        </div>
      </div>
    </div>
  )
}
