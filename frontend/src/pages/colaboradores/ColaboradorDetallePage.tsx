import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Building2,
  Briefcase, CreditCard, User, Clock, ChevronDown, Pencil, X, Check, Trash2, Plus,
} from 'lucide-react'
import { useEmployee, useEmployeePayroll, useUpdateEmployee, useDeleteEmployee, type EmployeePatch } from '@/hooks/useDotacion'
import { useWorkCenters, useAssignWorkCenter, useUnassignWorkCenter } from '@/hooks/useWorkCenters'
import { formatDate, formatCLP } from '@/lib/utils'
import type { Contract, LegalEntity, PayrollItem, Leave, Employee, VacationBalance, EmployeeWorkCenter } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido', PLAZO_FIJO: 'Plazo fijo', HONORARIOS: 'Honorarios', PRACTICA: 'Práctica',
}
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  INACTIVE:  { label: 'Inactivo',    color: 'bg-gray-100 text-gray-500' },
  ON_LEAVE:  { label: 'Con permiso', color: 'bg-amber-100 text-amber-700' },
  DUPLICATE: { label: 'Duplicado',   color: 'bg-orange-100 text-orange-600' },
}
const LEAVE_LABEL: Record<string, string> = {
  VACACIONES: 'Vacaciones', PERMISO: 'Permiso', LICENCIA_MEDICA: 'Licencia médica',
  LICENCIA_MATERNIDAD: 'Lic. maternidad', LICENCIA_PATERNIDAD: 'Lic. paternidad', OTRO: 'Otro',
}
const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700', APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',   CANCELLED: 'bg-gray-100 text-gray-500',
}
const LEAVE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', CANCELLED: 'Cancelada',
}
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const TABS = ['Datos', 'Contratos', 'Remuneraciones', 'Ausencias', 'Centros'] as const
type Tab = typeof TABS[number]

// ─── Formulario de edición ────────────────────────────────────────────────────

type FormData = Omit<EmployeePatch, 'id'>

function empToForm(emp: Employee): FormData {
  return {
    firstName: emp.firstName, lastName: emp.lastName,
    email: emp.email, personalEmail: emp.personalEmail ?? '',
    phone: emp.phone ?? '', birthDate: emp.birthDate ? emp.birthDate.slice(0, 10) : '',
    address: emp.address ?? '', city: emp.city ?? '', commune: emp.commune ?? '',
    nationality: emp.nationality ?? '', gender: emp.gender ?? '',
    afp: emp.afp ?? '', isapre: emp.isapre ?? '',
    jobTitle: emp.jobTitle ?? '', jobFamily: emp.jobFamily ?? '',
    costCenter: emp.costCenter ?? '',
    supervisorName: emp.supervisorName ?? '', supervisorTitle: emp.supervisorTitle ?? '',
    workSchedule: emp.workSchedule ?? '',
    startDate: emp.startDate ? emp.startDate.slice(0, 10) : '',
    endDate: emp.endDate ? emp.endDate.slice(0, 10) : '',
    status: emp.status,
    vinculo: emp.vinculo ?? '', reemplazaA: emp.reemplazaA ?? '',
    exclusive: emp.exclusive ?? null,
  }
}

// ─── Componentes de campo ─────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
const labelCls = 'block text-xs text-gray-400 mb-1'

function DisplayField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  )
}

function TextField({ label, field, form, setForm }: {
  label: string; field: keyof FormData
  form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={(form[field] as string) ?? ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value || null }))}
        className={inputCls}
      />
    </div>
  )
}

function DateField({ label, field, form, setForm }: {
  label: string; field: keyof FormData
  form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="date"
        value={(form[field] as string) ?? ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value || null }))}
        className={inputCls}
      />
    </div>
  )
}

function SelectField({ label, field, form, setForm, options }: {
  label: string; field: keyof FormData
  form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        value={(form[field] as string) ?? ''}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value || null }))}
        className={inputCls}
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ─── Tabs de datos en modo lectura y edición ──────────────────────────────────

function DatosTab({ emp, editing, form, setForm }: {
  emp: Employee; editing: boolean
  form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const gender = emp.gender === 'M' || emp.gender === 'male' ? 'Masculino'
               : emp.gender === 'F' || emp.gender === 'female' ? 'Femenino'
               : (emp.gender ?? null)

  if (!editing) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Datos personales</h3>
        <DisplayField icon={CreditCard} label="RUT"               value={emp.rut} />
        <DisplayField icon={Mail}       label="Correo corporativo" value={emp.email} />
        <DisplayField icon={Mail}       label="Correo personal"    value={emp.personalEmail} />
        <DisplayField icon={Phone}      label="Teléfono"           value={emp.phone} />
        <DisplayField icon={MapPin}     label="Dirección"          value={emp.address} />
        <DisplayField icon={MapPin}     label="Ciudad / Comuna"    value={[emp.city, emp.commune].filter(Boolean).join(', ') || null} />
        <DisplayField icon={Calendar}   label="Fecha de nac."      value={emp.birthDate ? formatDate(emp.birthDate) : null} />
        <DisplayField icon={User}       label="Género"             value={gender} />
        <DisplayField icon={User}       label="Nacionalidad"       value={emp.nationality} />
        <DisplayField icon={Building2}  label="AFP"                value={emp.afp} />
        <DisplayField icon={Building2}  label="Isapre / Fonasa"    value={emp.isapre} />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Datos laborales</h3>
        <DisplayField icon={Briefcase}  label="Cargo BUK"          value={emp.jobTitle} />
        <DisplayField icon={Briefcase}  label="Familia de cargo"    value={emp.jobFamily} />
        <DisplayField icon={Building2}  label="Centro de costos"    value={emp.costCenter} />
        <DisplayField icon={Calendar}   label="Fecha de ingreso"    value={formatDate(emp.startDate)} />
        {emp.endDate && <DisplayField icon={Calendar} label="Fecha de salida" value={formatDate(emp.endDate)} />}
        <DisplayField icon={User}       label="Supervisor"          value={emp.supervisorName} />
        <DisplayField icon={Briefcase}  label="Cargo supervisor"    value={emp.supervisorTitle} />
        <DisplayField icon={User}       label="Vínculo"             value={emp.vinculo} />
        {emp.reemplazaA && <DisplayField icon={User} label="Reemplaza a" value={emp.reemplazaA} />}
        {emp.exclusive !== null && emp.exclusive !== undefined && (
          <DisplayField icon={User} label="Exclusividad" value={emp.exclusive ? 'Exclusivo' : 'No exclusivo'} />
        )}
        {emp.workSchedule && (
          <div className="flex items-start gap-3">
            <Clock size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Jornada laboral</p>
              <p className="text-sm text-gray-700 leading-relaxed">{emp.workSchedule}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Modo edición
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Datos personales */}
      <div className="bg-white rounded-xl border border-blue-100 p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Datos personales</h3>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nombre(s)"  field="firstName"    form={form} setForm={setForm} />
          <TextField label="Apellido(s)" field="lastName"     form={form} setForm={setForm} />
        </div>
        <TextField  label="Correo corporativo" field="email"         form={form} setForm={setForm} />
        <TextField  label="Correo personal"    field="personalEmail" form={form} setForm={setForm} />
        <TextField  label="Teléfono"           field="phone"         form={form} setForm={setForm} />
        <TextField  label="Dirección"          field="address"       form={form} setForm={setForm} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ciudad"   field="city"    form={form} setForm={setForm} />
          <TextField label="Comuna"   field="commune" form={form} setForm={setForm} />
        </div>
        <TextField  label="Nacionalidad" field="nationality" form={form} setForm={setForm} />
        <DateField  label="Fecha de nac." field="birthDate"  form={form} setForm={setForm} />
        <SelectField label="Género" field="gender" form={form} setForm={setForm} options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Femenino' },
        ]} />
        <TextField label="AFP"            field="afp"    form={form} setForm={setForm} />
        <TextField label="Isapre / Fonasa" field="isapre" form={form} setForm={setForm} />
      </div>

      {/* Datos laborales */}
      <div className="bg-white rounded-xl border border-blue-100 p-5 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Datos laborales</h3>
        <SelectField label="Estado" field="status" form={form} setForm={setForm} options={[
          { value: 'ACTIVE',    label: 'Activo' },
          { value: 'INACTIVE',  label: 'Inactivo' },
          { value: 'ON_LEAVE',  label: 'Con permiso' },
          { value: 'DUPLICATE', label: 'Duplicado' },
        ]} />
        <TextField  label="Cargo BUK"        field="jobTitle"        form={form} setForm={setForm} />
        <TextField  label="Familia de cargo"  field="jobFamily"       form={form} setForm={setForm} />
        <TextField  label="Centro de costos"  field="costCenter"      form={form} setForm={setForm} />
        <DateField  label="Fecha de ingreso"  field="startDate"       form={form} setForm={setForm} />
        <DateField  label="Fecha de salida"   field="endDate"         form={form} setForm={setForm} />
        <TextField  label="Supervisor"        field="supervisorName"  form={form} setForm={setForm} />
        <TextField  label="Cargo supervisor"  field="supervisorTitle" form={form} setForm={setForm} />
        <TextField  label="Jornada laboral"   field="workSchedule"    form={form} setForm={setForm} />
        <SelectField label="Vínculo" field="vinculo" form={form} setForm={setForm} options={[
          { value: 'Planta',    label: 'Planta' },
          { value: 'Reemplazo', label: 'Reemplazo' },
        ]} />
        {(form.vinculo === 'Reemplazo') && (
          <TextField label="Reemplaza a" field="reemplazaA" form={form} setForm={setForm} />
        )}
        <SelectField label="Exclusividad" field="exclusive" form={form} setForm={setForm} options={[
          { value: 'true',  label: 'Exclusivo' },
          { value: 'false', label: 'No exclusivo' },
        ]} />
      </div>
    </div>
  )
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: Contract }) {
  const days = contract.endDate
    ? (new Date(contract.endDate).getTime() - Date.now()) / 86400000
    : null
  const expiringSoon = days !== null && days >= 0 && days <= 30

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${expiringSoon ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium text-gray-800">{CONTRACT_LABEL[contract.type] ?? contract.type}</span>
        <div className="flex gap-2">
          {contract.legalEntity && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_COLOR[contract.legalEntity]}`}>
              {ENTITY_LABEL[contract.legalEntity]}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contract.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {contract.isActive ? 'Vigente' : 'Finalizado'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400">Inicio</p>
          <p className="text-gray-700">{formatDate(contract.startDate)}</p>
        </div>
        {contract.endDate && (
          <div>
            <p className={`text-xs ${expiringSoon ? 'text-amber-500' : 'text-gray-400'}`}>
              Vencimiento{expiringSoon ? ' ⚠️' : ''}
            </p>
            <p className={expiringSoon ? 'text-amber-600 font-medium' : 'text-gray-700'}>
              {formatDate(contract.endDate)}
            </p>
          </div>
        )}
      </div>
      {(contract.salary > 0 || (contract.grossSalary && contract.grossSalary > 0)) && (
        <div className="border-t border-gray-100 pt-3 text-sm text-gray-600">
          {contract.salary > 0 && <span>Líquido: <strong className="text-gray-800">{formatCLP(contract.salary)}</strong></span>}
          {contract.grossSalary && contract.grossSalary > 0 && (
            <span className="text-gray-400 ml-3">Bruto: {formatCLP(contract.grossSalary)}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Remuneraciones ───────────────────────────────────────────────────────────

function isOvertime(item: PayrollItem) {
  const n = (item.name ?? '').toLowerCase()
  const t = (item.type ?? item.category ?? '').toLowerCase()
  return t.includes('hora_extra') || t.includes('overtime') ||
         n.includes('hora extra') || n.includes('horas extra') || n.startsWith('he ')
}
function isBonus(item: PayrollItem) {
  if (isOvertime(item) || item.amount <= 0) return false
  const n = (item.name ?? '').toLowerCase()
  if (n.includes('sueldo base') || n === 'sueldo' || n.includes('gratificaci')) return false
  return item.taxable ?? (item.type ?? item.category ?? '').toLowerCase().includes('imponible')
}

function PayrollMonthCard({ entry }: {
  entry: { id: string; year: number; month: number; legalEntity: string; grossSalary: number; liquidSalary: number; items: PayrollItem[] }
}) {
  const [open, setOpen] = useState(false)
  const bonusItems    = entry.items.filter(isBonus)
  const overtimeItems = entry.items.filter(isOvertime)
  const totalBonuses  = bonusItems.reduce((s, i) => s + i.amount, 0)
  const totalOvertime = overtimeItems.reduce((s, i) => s + i.amount, 0)
  const entityColor: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
    SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
  }
  const entityShort: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'Comun.',
    SURMEDIA_CONSULTORIA:    'Consult.',
  }
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{MONTH_NAMES[entry.month - 1]} {entry.year}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${entityColor[entry.legalEntity] ?? 'bg-gray-100 text-gray-600'}`}>
              {entityShort[entry.legalEntity] ?? entry.legalEntity}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{formatCLP(entry.liquidSalary)}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-gray-400">
          <span>Bruto: {formatCLP(entry.grossSalary)}</span>
          {totalBonuses  > 0 && <span className="text-blue-500">Bonos: +{formatCLP(totalBonuses)}</span>}
          {totalOvertime > 0 && <span className="text-amber-500">HH.EE.: +{formatCLP(totalOvertime)}</span>}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/60">
          {/* Resumen sueldo */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-[11px] text-gray-400">Sueldo líquido</p>
              <p className="text-sm font-bold text-gray-900">{formatCLP(entry.liquidSalary)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-[11px] text-gray-400">Sueldo bruto</p>
              <p className="text-sm font-bold text-gray-700">{formatCLP(entry.grossSalary)}</p>
            </div>
          </div>
          {bonusItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-2">Bonos — {formatCLP(totalBonuses)}</p>
              <div className="space-y-1">
                {bonusItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600 truncate mr-2">{item.name}</span>
                    <span className="text-gray-800 font-medium flex-shrink-0">{formatCLP(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {overtimeItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 mb-2">Horas extras — {formatCLP(totalOvertime)}</p>
              <div className="space-y-1">
                {overtimeItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600 truncate mr-2">{item.name}</span>
                    <span className="text-gray-800 font-medium flex-shrink-0">{formatCLP(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bonusItems.length === 0 && overtimeItems.length === 0 && (
            <p className="text-xs text-gray-400">
              {entry.items.length === 0 ? 'Sin detalle de ítems.' : 'Sin bonos ni horas extras este mes.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab Centros de trabajo ───────────────────────────────────────────────────

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function CentrosTab({ emp }: { emp: Employee }) {
  const { data: allCenters = [] } = useWorkCenters()
  const assign   = useAssignWorkCenter()
  const unassign = useUnassignWorkCenter()

  const [addingFor, setAddingFor]       = useState<LegalEntity | null>(null)
  const [selectedCenter, setSelectedCenter] = useState('')

  const contractEntities = Array.from(
    new Set((emp.contracts ?? []).filter(c => c.isActive && c.legalEntity).map(c => c.legalEntity as LegalEntity))
  )
  const wcEntities = Array.from(new Set((emp.workCenters ?? []).map(wc => wc.legalEntity)))
  const entities   = Array.from(new Set([...contractEntities, ...wcEntities])) as LegalEntity[]

  const all: LegalEntity[] = entities.length > 0
    ? entities
    : ['COMUNICACIONES_SURMEDIA', 'SURMEDIA_CONSULTORIA']

  function assignedFor(entity: LegalEntity) {
    return (emp.workCenters ?? []).filter(wc => wc.legalEntity === entity)
  }
  function availableFor(entity: LegalEntity) {
    const ids = new Set(assignedFor(entity).map(a => a.workCenterId))
    return allCenters.filter(c => !ids.has(c.id))
  }

  async function handleAssign(entity: LegalEntity) {
    if (!selectedCenter) return
    await assign.mutateAsync({ workCenterId: selectedCenter, employeeId: emp.id, legalEntity: entity })
    setSelectedCenter('')
    setAddingFor(null)
  }

  async function handleUnassign(wc: EmployeeWorkCenter) {
    await unassign.mutateAsync({ workCenterId: wc.workCenterId, employeeId: emp.id, legalEntity: wc.legalEntity })
  }

  return (
    <div className="space-y-4">
      {all.map(entity => {
        const assigned  = assignedFor(entity)
        const available = availableFor(entity)
        const isAdding  = addingFor === entity

        return (
          <div key={entity} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[entity]}`}>
                  {ENTITY_LABEL[entity]}
                </span>
                <span className="text-sm font-semibold text-gray-700">Centros de trabajo</span>
              </div>
              {!isAdding && available.length > 0 && (
                <button
                  onClick={() => { setAddingFor(entity); setSelectedCenter('') }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  <Plus size={13} />Agregar
                </button>
              )}
            </div>

            {assigned.length === 0 && !isAdding && (
              <p className="text-xs text-gray-400 italic">Sin centros asignados.</p>
            )}

            <div className="divide-y divide-gray-50">
              {assigned.map(wc => (
                <div key={wc.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{wc.workCenter.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {wc.workCenter.costType === 'DIRECTO' ? 'Directo' : 'Indirecto'}
                      {' · '}desde {MONTH_SHORT[wc.startMonth - 1]} {wc.startYear}
                      {wc.endYear != null && ` → ${MONTH_SHORT[(wc.endMonth ?? 12) - 1]} ${wc.endYear}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnassign(wc)}
                    disabled={unassign.isPending}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Quitar"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>

            {isAdding && (
              <div className="flex gap-2 mt-3">
                <select
                  autoFocus
                  value={selectedCenter}
                  onChange={e => setSelectedCenter(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar centro…</option>
                  {available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  onClick={() => handleAssign(entity)}
                  disabled={!selectedCenter || assign.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => { setAddingFor(null); setSelectedCenter('') }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 text-gray-400 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ColaboradorDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab,     setTab]     = useState<Tab>('Datos')
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState<FormData>({})

  const [confirmDelete, setConfirmDelete] = useState(false)
  const { data: emp, isLoading } = useEmployee(id ?? null)
  const { data: payroll = [] }   = useEmployeePayroll(id ?? null)
  const update = useUpdateEmployee()
  const remove = useDeleteEmployee()

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!emp) return <div className="p-8 text-center text-gray-400">Colaborador no encontrado.</div>

  const status          = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.INACTIVE
  const activeContracts = emp.contracts?.filter(c => c.isActive)  ?? []
  const oldContracts    = emp.contracts?.filter(c => !c.isActive) ?? []
  const leaves          = emp.leaves ?? []
  const initials        = `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase()

  const tabCounts: Partial<Record<Tab, number>> = {
    Contratos:      emp.contracts?.length,
    Remuneraciones: payroll.length || undefined,
    Ausencias:      leaves.length || undefined,
    Centros:        emp.workCenters?.length || undefined,
  }

  function startEdit() {
    setForm(empToForm(emp!))
    setEditing(true)
    setTab('Datos')
  }
  function cancelEdit() {
    setEditing(false)
    setForm({})
  }
  async function saveEdit() {
    if (!id) return
    // Convert exclusive string back to boolean
    const payload: EmployeePatch = { id, ...form }
    if (typeof (form as any).exclusive === 'string') {
      payload.exclusive = (form as any).exclusive === 'true' ? true
                        : (form as any).exclusive === 'false' ? false
                        : null
    }
    await update.mutateAsync(payload)
    setEditing(false)
    setForm({})
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Cabecera */}
      <div className={`bg-white border-b sticky top-0 z-10 transition-colors ${editing ? 'border-blue-200' : 'border-gray-200'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <button
            onClick={() => navigate('/colaboradores')}
            className="flex items-center gap-1.5 py-3 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={15} />
            Colaboradores
          </button>

          <div className="flex items-center gap-5 pb-5">
            <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">
                  {editing
                    ? `${form.firstName ?? emp.firstName} ${form.lastName ?? emp.lastName}`
                    : `${emp.firstName} ${emp.lastName}`
                  }
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  editing
                    ? (STATUS_CONFIG[form.status as string]?.color ?? status.color)
                    : status.color
                }`}>
                  {editing ? (STATUS_CONFIG[form.status as string]?.label ?? status.label) : status.label}
                </span>
                {editing && <span className="text-xs text-blue-600 font-medium">Modo edición</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {editing ? (form.jobTitle || '—') : (emp.jobTitle ?? emp.jobFamily ?? 'Sin cargo asignado')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{emp.rut}</p>
            </div>

            {/* Botones acción */}
            <div className="flex gap-2 flex-shrink-0">
              {!editing && emp.contracts?.filter(c => c.isActive && c.legalEntity).map(c => (
                <span key={c.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ENTITY_COLOR[c.legalEntity!]}`}>
                  {ENTITY_LABEL[c.legalEntity!]}
                </span>
              ))}
              {!editing ? (
                <>
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">¿Eliminar colaborador?</span>
                      <button
                        onClick={async () => { await remove.mutateAsync(id!); navigate('/colaboradores') }}
                        disabled={remove.isPending}
                        className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {remove.isPending ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    <X size={14} />
                    Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={update.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} />
                    {update.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t !== 'Datos') setEditing(false) }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
                {tabCounts[t] ? <span className="ml-1.5 text-xs text-gray-400">({tabCounts[t]})</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">

        {tab === 'Datos' && (
          <DatosTab emp={emp} editing={editing} form={form} setForm={setForm} />
        )}

        {tab === 'Contratos' && (
          <div className="space-y-5">
            {activeContracts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Vigentes</h3>
                {activeContracts.map(c => <ContractCard key={c.id} contract={c} />)}
              </div>
            )}
            {oldContracts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-400">Historial</h3>
                {oldContracts.map(c => <ContractCard key={c.id} contract={c} />)}
              </div>
            )}
            {!emp.contracts?.length && (
              <p className="text-center text-gray-400 py-12">Sin contratos registrados.</p>
            )}
          </div>
        )}

        {tab === 'Remuneraciones' && (() => {
          // Centros activos en un período dado
          function centersForPeriod(year: number, month: number) {
            return (emp.workCenters ?? []).filter(wc => {
              const afterStart = wc.startYear < year || (wc.startYear === year && wc.startMonth <= month)
              const beforeEnd  = wc.endYear == null || wc.endYear > year || (wc.endYear === year && (wc.endMonth ?? 12) >= month)
              return afterStart && beforeEnd
            })
          }

          // Último mes con liquidación por entidad
          const latestByEntity = new Map<string, typeof payroll[0]>()
          for (const entry of payroll) {
            const ex = latestByEntity.get(entry.legalEntity)
            if (!ex || entry.year > ex.year || (entry.year === ex.year && entry.month > ex.month))
              latestByEntity.set(entry.legalEntity, entry)
          }

          // Centros vigentes usando el último mes de liquidación de cada entidad
          const centersByEntity = new Map<string, typeof emp.workCenters>()
          for (const [entity, latest] of latestByEntity.entries()) {
            const active = centersForPeriod(latest.year, latest.month)
              .filter(wc => wc.legalEntity === entity)
            if (active.length > 0) centersByEntity.set(entity, active)
          }
          // Entidades sin liquidación pero con centros vigentes
          for (const wc of (emp.workCenters ?? [])) {
            if (!centersByEntity.has(wc.legalEntity) && wc.endYear == null) {
              if (!centersByEntity.has(wc.legalEntity)) centersByEntity.set(wc.legalEntity, [])
              if (!centersByEntity.get(wc.legalEntity)!.find(x => x.id === wc.id))
                centersByEntity.get(wc.legalEntity)!.push(wc)
            }
          }
          const hasCentros = centersByEntity.size > 0

          // Totales año en curso y último mes
          const currentYear  = new Date().getFullYear()
          const ytdTotal     = payroll.filter(e => e.year === currentYear).reduce((s, e) => s + e.liquidSalary, 0)
          const latestMonth  = payroll.reduce<typeof payroll[0] | null>((best, e) =>
            !best || e.year > best.year || (e.year === best.year && e.month > best.month) ? e : best, null)
          const monthTotal   = latestMonth
            ? payroll.filter(e => e.year === latestMonth.year && e.month === latestMonth.month)
                     .reduce((s, e) => s + e.liquidSalary, 0)
            : 0

          return (
            <div className="space-y-6">
              {/* Totales resumen */}
              {payroll.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">
                      Total {latestMonth ? `${MONTH_NAMES[latestMonth.month - 1]} ${latestMonth.year}` : 'último mes'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{formatCLP(monthTotal)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">líquido total</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Acumulado {currentYear}</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCLP(ytdTotal)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {payroll.filter(e => e.year === currentYear).length} mes{payroll.filter(e => e.year === currentYear).length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                </div>
              )}

              {hasCentros && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Centros — sueldo ponderado
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[...centersByEntity.entries()].flatMap(([entity, centers]) => {
                      const latest  = latestByEntity.get(entity)
                      const share   = latest ? Math.round(latest.liquidSalary / centers.length) : null
                      const monthLbl = latest ? `${MONTH_NAMES[latest.month - 1]} ${latest.year}` : null
                      return centers.map(wc => (
                        <div key={wc.id} className="bg-white border border-gray-100 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{wc.workCenter.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {wc.workCenter.costType === 'DIRECTO' ? 'Directo' : 'Indirecto'}
                                {wc.endYear == null
                                  ? ` · desde ${MONTH_NAMES[wc.startMonth - 1]} ${wc.startYear}`
                                  : ` · ${MONTH_NAMES[wc.startMonth - 1]} ${wc.startYear} → ${MONTH_NAMES[(wc.endMonth ?? 12) - 1]} ${wc.endYear}`
                                }
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ENTITY_COLOR[wc.legalEntity]}`}>
                              {ENTITY_LABEL[wc.legalEntity]}
                            </span>
                          </div>
                          {share !== null ? (
                            <>
                              <p className="text-xl font-bold text-gray-900">{formatCLP(share)}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {monthLbl}
                                {centers.length > 1 && ` · 1/${centers.length} del líquido`}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">Sin remuneración registrada</p>
                          )}
                        </div>
                      ))
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {hasCentros && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Liquidaciones</p>}
                {payroll.length === 0
                  ? <p className="text-center text-gray-400 py-12">Sin liquidaciones registradas.</p>
                  : payroll.map(entry => <PayrollMonthCard key={entry.id} entry={entry} />)
                }
              </div>
            </div>
          )
        })()}

        {tab === 'Ausencias' && (
          <div className="space-y-4">
            {/* Saldo de vacaciones — último mes importado por entidad */}
            {emp.vacationBalances && emp.vacationBalances.length > 0 && (() => {
              // Tomar el saldo más reciente por entidad legal
              const byEntity = new Map<string, VacationBalance>()
              for (const vb of emp.vacationBalances) {
                const existing = byEntity.get(vb.legalEntity)
                if (!existing || vb.year > existing.year || (vb.year === existing.year && vb.month > existing.month)) {
                  byEntity.set(vb.legalEntity, vb)
                }
              }
              const balances = [...byEntity.values()]
              const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
              return (
                <div className="space-y-3">
                  {balances.map(vb => (
                    <div key={vb.id} className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">Saldo de vacaciones</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_COLOR[vb.legalEntity as LegalEntity] ?? 'bg-gray-100 text-gray-500'}`}>
                            {ENTITY_LABEL[vb.legalEntity as LegalEntity] ?? vb.legalEntity}
                          </span>
                          <span className="text-xs text-gray-400">{MONTH_NAMES_SHORT[vb.month - 1]} {vb.year}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        {[
                          { label: 'Legales', value: vb.saldoLegal, color: 'text-blue-600' },
                          { label: 'Progresivas', value: vb.saldoProgresivas, color: 'text-indigo-600' },
                          { label: 'Administrativos', value: vb.saldoAdministrativos, color: 'text-purple-600' },
                          { label: 'Total saldo', value: vb.saldoLegal + vb.saldoProgresivas + vb.saldoAdministrativos, color: 'text-gray-900' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center">
                            <p className={`text-2xl font-bold ${color}`}>{value.toFixed(1)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                      {vb.diasLicencias > 0 && (
                        <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">
                          Días de licencia en el período: <strong>{vb.diasLicencias}</strong>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Ausencias individuales */}
            {leaves.length === 0
              ? (!(emp.vacationBalances?.length) && <p className="text-center text-gray-400 py-8">Sin ausencias registradas.</p>)
              : (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-600">Vacaciones tomadas</h3>
                  {leaves.map((l: Leave) => (
                    <div key={l.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800 text-sm">{LEAVE_LABEL[l.type] ?? l.type}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_STATUS_COLOR[l.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {LEAVE_STATUS_LABEL[l.status] ?? l.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(l.startDate)} → {formatDate(l.endDate)}
                          <span className="ml-2 font-medium text-gray-500">{l.days} día{l.days !== 1 ? 's' : ''}</span>
                        </p>
                        {l.reason && <p className="text-xs text-gray-400 mt-0.5">{l.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {tab === 'Centros' && (
          <CentrosTab emp={emp} />
        )}

      </div>
    </div>
  )
}
