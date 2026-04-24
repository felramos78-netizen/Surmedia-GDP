import { useState, useEffect } from 'react'
import { X, Mail, Phone, MapPin, Calendar, Building2, Briefcase, CreditCard, User, ChevronDown, TrendingUp } from 'lucide-react'
import { useEmployee, useEmployeePayroll } from '@/hooks/useDotacion'
import { formatDate, formatCLP } from '@/lib/utils'
import type { Contract, LegalEntity, PayrollItem } from '@/types'

const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones Surmedia',
  SURMEDIA_CONSULTORIA:    'Surmedia Consultoría',
}

const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  HONORARIOS: 'Honorarios',
  PRACTICA:   'Práctica',
}

const STATUS_CONFIG = {
  ACTIVE:   { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  INACTIVE: { label: 'Inactivo',    color: 'bg-gray-100 text-gray-500' },
  ON_LEAVE: { label: 'Con permiso', color: 'bg-amber-100 text-amber-700' },
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DataRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value?: string | null
}) {
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

function ContractCard({ contract }: { contract: Contract }) {
  const isExpiringSoon = contract.endDate && (() => {
    const days = (new Date(contract.endDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  })()

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isExpiringSoon ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{CONTRACT_LABEL[contract.type]}</span>
        <div className="flex items-center gap-2">
          {contract.legalEntity && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LEGAL_ENTITY_COLOR[contract.legalEntity]}`}>
              {LEGAL_ENTITY_LABEL[contract.legalEntity]}
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${contract.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {contract.isActive ? 'Vigente' : 'Finalizado'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div><span className="text-gray-400">Inicio: </span>{formatDate(contract.startDate)}</div>
        {contract.endDate && (
          <div className={isExpiringSoon ? 'text-amber-600 font-medium' : ''}>
            <span className={isExpiringSoon ? 'text-amber-500' : 'text-gray-400'}>Vence: </span>
            {formatDate(contract.endDate)}{isExpiringSoon && ' ⚠️'}
          </div>
        )}
      </div>

      {contract.salary > 0 && (
        <div className="text-xs">
          <span className="text-gray-400">Sueldo líquido: </span>
          <span className="font-medium text-gray-700">{formatCLP(contract.salary)}</span>
          {contract.grossSalary && contract.grossSalary > 0 && (
            <span className="text-gray-400 ml-2">(bruto: {formatCLP(contract.grossSalary)})</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Clasificadores de ítems de liquidación ───────────────────────────────────

function isOvertime(item: PayrollItem): boolean {
  const n = (item.name ?? '').toLowerCase()
  const t = (item.type ?? item.category ?? '').toLowerCase()
  return t.includes('hora_extra') || t.includes('overtime') ||
         n.includes('hora extra') || n.includes('horas extra') ||
         n.includes('h.e.') || n.startsWith('he ')
}

function isBonus(item: PayrollItem): boolean {
  if (isOvertime(item)) return false
  if (item.amount <= 0) return false
  const n = (item.name ?? '').toLowerCase()
  if (n.includes('sueldo base') || n === 'sueldo') return false
  if (n.includes('gratificaci')) return false
  // Item es bono si está marcado como imponible o su tipo lo indica
  const taxable = item.taxable ?? (item.type ?? item.category ?? '').toLowerCase().includes('imponible')
  return taxable
}

// ─── Tarjeta de mes de remuneración ──────────────────────────────────────────

function PayrollMonthCard({ entry }: {
  entry: {
    id: string; year: number; month: number; legalEntity: string;
    grossSalary: number; liquidSalary: number; items: PayrollItem[]
  }
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
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {MONTH_NAMES[entry.month - 1]} {entry.year}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${entityColor[entry.legalEntity] ?? 'bg-gray-100 text-gray-600'}`}>
              {entityShort[entry.legalEntity] ?? entry.legalEntity}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{formatCLP(entry.liquidSalary)}</span>
            <ChevronDown size={13} className={`transition-transform text-gray-400 ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
          <span>Bruto: {formatCLP(entry.grossSalary)}</span>
          {totalBonuses > 0 && <span className="text-blue-500">Bonos: +{formatCLP(totalBonuses)}</span>}
          {totalOvertime > 0 && <span className="text-amber-500">HH.EE.: +{formatCLP(totalOvertime)}</span>}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">

          {bonusItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-1.5">
                Bonos — {formatCLP(totalBonuses)}
              </p>
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
              <p className="text-xs font-semibold text-amber-600 mb-1.5">
                Horas extras — {formatCLP(totalOvertime)}
              </p>
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

          {bonusItems.length === 0 && overtimeItems.length === 0 && entry.items.length === 0 && (
            <p className="text-xs text-gray-400">Sin detalle de ítems disponible.</p>
          )}

          {bonusItems.length === 0 && overtimeItems.length === 0 && entry.items.length > 0 && (
            <p className="text-xs text-gray-400">Sin bonos ni horas extras este mes.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

interface Props {
  employeeId: string | null
  onClose: () => void
}

export default function EmployeeDrawer({ employeeId, onClose }: Props) {
  const { data: employee, isLoading } = useEmployee(employeeId)
  const { data: payroll = [] }        = useEmployeePayroll(employeeId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isOpen = !!employeeId
  const status = employee ? STATUS_CONFIG[employee.status] : null
  const activeContracts   = employee?.contracts?.filter(c => c.isActive) ?? []
  const inactiveContracts = employee?.contracts?.filter(c => !c.isActive) ?? []

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Ficha del colaborador</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employee ? (
            <>
              {/* Identidad */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center flex-shrink-0">
                  {`${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase()}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{employee.firstName} {employee.lastName}</h4>
                  <p className="text-sm text-gray-500">
                    {employee.position?.title ?? employee.jobFamily ?? 'Sin cargo asignado'}
                  </p>
                  {employee.department?.name && (
                    <p className="text-xs text-gray-400">{employee.department.name}</p>
                  )}
                  {status && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Datos personales */}
              <section className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos personales</h5>
                <div className="space-y-2.5">
                  <DataRow icon={CreditCard} label="RUT"               value={employee.rut} />
                  <DataRow icon={Mail}       label="Correo corporativo" value={employee.email} />
                  <DataRow icon={Mail}       label="Correo personal"    value={employee.personalEmail} />
                  <DataRow icon={Phone}      label="Teléfono"           value={employee.phone} />
                  <DataRow icon={MapPin}     label="Dirección"          value={employee.address} />
                  <DataRow icon={MapPin}     label="Ciudad / Comuna"    value={[employee.city, employee.commune].filter(Boolean).join(', ') || null} />
                  <DataRow icon={Calendar}   label="Fecha de nac."      value={employee.birthDate ? formatDate(employee.birthDate) : null} />
                  <DataRow icon={Building2}  label="AFP"                value={employee.afp} />
                  <DataRow icon={Building2}  label="Isapre / Fonasa"    value={employee.isapre} />
                </div>
              </section>

              {/* Datos laborales */}
              <section className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos laborales</h5>
                <div className="space-y-2.5">
                  <DataRow icon={Briefcase}  label="Cargo"              value={employee.position?.title} />
                  <DataRow icon={Briefcase}  label="Familia de cargo"   value={employee.jobFamily} />
                  <DataRow icon={Building2}  label="Departamento"       value={employee.department?.name} />
                  <DataRow icon={Calendar}   label="Ingreso"            value={formatDate(employee.startDate)} />
                  {employee.endDate && (
                    <DataRow icon={Calendar} label="Salida"             value={formatDate(employee.endDate)} />
                  )}
                  <DataRow icon={User}       label="Supervisor"         value={employee.supervisorName} />
                  <DataRow icon={Briefcase}  label="Cargo supervisor"   value={employee.supervisorTitle} />
                  {employee.workSchedule && (
                    <div className="flex items-start gap-3">
                      <Calendar size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Jornada laboral</p>
                        <p className="text-sm text-gray-700 text-xs whitespace-pre-line leading-relaxed">{employee.workSchedule}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Contratos vigentes */}
              {activeContracts.length > 0 && (
                <section className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Contratos vigentes
                    {activeContracts.length > 1 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs normal-case font-medium">
                        {activeContracts.length} activos
                      </span>
                    )}
                  </h5>
                  <div className="space-y-2">
                    {activeContracts.map(c => <ContractCard key={c.id} contract={c} />)}
                  </div>
                </section>
              )}

              {/* Contratos históricos */}
              {inactiveContracts.length > 0 && (
                <section className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial de contratos</h5>
                  <div className="space-y-2">
                    {inactiveContracts.map(c => <ContractCard key={c.id} contract={c} />)}
                  </div>
                </section>
              )}

              {(!employee.contracts || employee.contracts.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">Sin contratos registrados.</p>
              )}

              {/* Remuneraciones mensuales */}
              {payroll.length > 0 && (
                <section className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp size={13} />
                    Remuneraciones por mes
                  </h5>
                  <div className="space-y-2">
                    {payroll.map(entry => (
                      <PayrollMonthCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No se encontró el colaborador.</p>
          )}
        </div>
      </aside>
    </>
  )
}
