import { useEffect } from 'react'
import { X, Mail, Phone, MapPin, Calendar, Building2, Briefcase, CreditCard } from 'lucide-react'
import { useEmployee } from '@/hooks/useDotacion'
import { formatDate, formatCLP } from '@/lib/utils'
import type { Contract, LegalEntity } from '@/types'

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

function DataRow({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value?: string | null
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
        <div>
          <span className="text-gray-400">Inicio: </span>
          {formatDate(contract.startDate)}
        </div>
        {contract.endDate && (
          <div className={isExpiringSoon ? 'text-amber-600 font-medium' : ''}>
            <span className={isExpiringSoon ? 'text-amber-500' : 'text-gray-400'}>Vence: </span>
            {formatDate(contract.endDate)}
            {isExpiringSoon && ' ⚠️'}
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

interface Props {
  employeeId: string | null
  onClose: () => void
}

export default function EmployeeDrawer({ employeeId, onClose }: Props) {
  const { data: employee, isLoading } = useEmployee(employeeId)

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isOpen = !!employeeId
  const status = employee ? STATUS_CONFIG[employee.status] : null
  const activeContracts  = employee?.contracts?.filter(c => c.isActive) ?? []
  const inactiveContracts = employee?.contracts?.filter(c => !c.isActive) ?? []

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Ficha del colaborador</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Contenido scrolleable */}
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
                  <p className="text-sm text-gray-500">{employee.position?.title ?? 'Sin cargo asignado'}</p>
                  {status && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Datos de contacto */}
              <section className="space-y-3">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos personales</h5>
                <div className="space-y-2.5">
                  <DataRow icon={CreditCard}  label="RUT"           value={employee.rut} />
                  <DataRow icon={Mail}        label="Correo"        value={employee.email} />
                  <DataRow icon={Phone}       label="Teléfono"      value={employee.phone} />
                  <DataRow icon={MapPin}      label="Dirección"     value={employee.address} />
                  <DataRow icon={Calendar}    label="Fecha de nac." value={employee.birthDate ? formatDate(employee.birthDate) : null} />
                  <DataRow icon={Briefcase}   label="Departamento"  value={employee.department?.name} />
                  <DataRow icon={Calendar}    label="Ingreso"       value={formatDate(employee.startDate)} />
                  <DataRow icon={Building2}   label="AFP"           value={employee.afp} />
                  <DataRow icon={Building2}   label="Isapre/Fonasa" value={employee.isapre} />
                </div>
              </section>

              {/* Contratos activos */}
              {activeContracts.length > 0 && (
                <section className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Contratos vigentes
                    {activeContracts.length > 1 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs normal-case font-medium">
                        {activeContracts.length} contratos activos
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
                <p className="text-sm text-gray-400 text-center py-4">Sin contratos registrados</p>
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
