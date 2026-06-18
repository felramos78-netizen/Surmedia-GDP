import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, AlertTriangle } from 'lucide-react'
import { useEmployees } from '@/hooks/useDotacion'
import type { Employee, LegalEntity } from '@/types'

const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
const ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'Con permiso', DUPLICATE: 'Duplicado',
}
const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-green-500', INACTIVE: 'bg-gray-300', ON_LEAVE: 'bg-amber-400', DUPLICATE: 'bg-orange-400',
}

function initials(e: Employee) {
  return `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase()
}

function entityFromContracts(e: Employee): LegalEntity | null {
  return (e.contracts?.find(c => c.isActive)?.legalEntity ?? e.contracts?.[0]?.legalEntity ?? null) as LegalEntity | null
}

function ColaboradorCard({ emp }: { emp: Employee }) {
  const navigate = useNavigate()
  const entity = entityFromContracts(emp)

  return (
    <button
      onClick={() => navigate(`/colaboradores/${emp.id}`)}
      className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-brand-200 hover:shadow-sm transition-all flex items-center gap-4 group"
    >
      <div className="w-10 h-10 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
        {initials(emp)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate group-hover:text-brand-700 transition-colors">
          {emp.firstName} {emp.lastName}
        </p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{emp.jobTitle ?? emp.jobFamily ?? '—'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{emp.rut}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {entity && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_COLOR[entity]}`}>
            {ENTITY_LABEL[entity]}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[emp.status] ?? 'bg-gray-300'}`} />
          <span className="text-xs text-gray-400">{STATUS_LABEL[emp.status] ?? emp.status}</span>
        </div>
      </div>
    </button>
  )
}

const ENTITY_FILTERS: Array<{ value: string; label: string }> = [
  { value: '',                       label: 'Todas' },
  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
  { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
]

export default function ColaboradoresPage() {
  const [search,   setSearch]   = useState('')
  const [entity,   setEntity]   = useState('')
  const [status,   setStatus]   = useState('')

  const { data, isLoading, isError } = useEmployees({
    search: search || undefined,
    legalEntity: entity ? [entity] : undefined,
    status:      status ? [status] : undefined,
  })

  const employees = data?.data ?? []

  return (
    <div className="p-6 space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Colaboradores</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data?.total != null ? `${data.total} colaboradores` : 'Cargando…'}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nombre o RUT…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {ENTITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setEntity(f.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                entity === f.value
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{ value: '', label: 'Todos' }, { value: 'ACTIVE', label: 'Activos' }, { value: 'INACTIVE', label: 'Inactivos' }].map(f => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                status === f.value
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grilla */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-16 text-center">
          <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Error cargando colaboradores. Intenta nuevamente.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map(emp => <ColaboradorCard key={emp.id} emp={emp} />)}
          </div>
          {employees.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">
              No se encontraron colaboradores
            </div>
          )}
        </>
      )}
    </div>
  )
}
