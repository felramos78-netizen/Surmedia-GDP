import { useState, useMemo } from 'react'
import { Search, RefreshCw, ChevronDown, Building2, Users, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react'
import { useEmployees, useSyncBuk, useSyncLogs, type DotacionFilters } from '@/hooks/useDotacion'
import { formatDate } from '@/lib/utils'
import type { Employee, Contract, LegalEntity } from '@/types'
import EmployeeDrawer from './EmployeeDrawer'
import EmployeeForm from './EmployeeForm'

// ─── Helpers de presentación ──────────────────────────────────────────────────

const LEGAL_ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

const LEGAL_ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Activo',
  INACTIVE:  'Inactivo',
  ON_LEAVE:  'Con permiso',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  ON_LEAVE: 'bg-amber-100 text-amber-700',
}

const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  HONORARIOS: 'Honorarios',
  PRACTICA:   'Práctica',
}

function primaryContract(contracts?: Contract[]): Contract | undefined {
  if (!contracts?.length) return undefined
  return contracts.find(c => c.isActive && c.salary > 0) ?? contracts[0]
}

function tenureLabel(startDate: string): string {
  const months = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (months < 12) return `${months}m`
  const years = Math.floor(months / 12)
  const rem   = months % 12
  return rem > 0 ? `${years}a ${rem}m` : `${years}a`
}

function initials(emp: Employee) {
  return `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`.toUpperCase()
}

// ─── Componente de stats ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Selector de filtro ───────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Botón de sincronización ──────────────────────────────────────────────────

type SyncLine = { ok: boolean; label: string; msg: string }

function SyncButton() {
  const [lines, setLines] = useState<SyncLine[] | null>(null)
  const { data: logs } = useSyncLogs()
  const { mutate, isPending } = useSyncBuk()

  const lastSync = logs?.[0]

  const ENTITY_LABEL: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'Comunicaciones',
    SURMEDIA_CONSULTORIA:    'Consultoría',
  }

  function handleSync() {
    setLines(null)
    mutate(undefined, {
      onSuccess: (data: any) => {
        const parsed: SyncLine[] = (data?.results ?? []).map((r: any) => {
          const label = ENTITY_LABEL[r.legalEntity] ?? r.legalEntity
          const fatalError = r.errors?.find((e: any) => e.rut === '*')?.error
          if (fatalError) return { ok: false, label, msg: fatalError }
          const synced = (r.employeesCreated ?? 0) + (r.employeesUpdated ?? 0)
          return { ok: true, label, msg: `${synced} sincronizados` }
        })
        setLines(parsed.length ? parsed : [{ ok: true, label: '', msg: 'Sin cambios' }])
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Error desconocido'
        setLines([{ ok: false, label: '', msg }])
      },
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {lastSync && !lines && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400">
            {lastSync.status === 'SUCCESS'
              ? <CheckCircle2 size={13} className="text-green-500" />
              : lastSync.status === 'ERROR'
              ? <AlertTriangle size={13} className="text-red-400" />
              : <RefreshCw size={13} className="animate-spin text-blue-400" />}
            Último sync: {formatDate(lastSync.completedAt ?? lastSync.startedAt)}
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={15} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Sincronizando…' : 'Sincronizar BUK'}
        </button>
      </div>
      {lines && (
        <div className="flex flex-col items-end gap-0.5">
          {lines.map((l, i) => (
            <p key={i} className={`text-xs ${l.ok ? 'text-green-600' : 'text-red-500'}`}>
              {l.ok ? '✓' : '✗'} {l.label ? `${l.label}: ` : ''}{l.msg}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Fila de la tabla ─────────────────────────────────────────────────────────

function EmployeeRow({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const contract = primaryContract(emp.contracts)

  return (
    <tr
      onClick={onClick}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
    >
      {/* Avatar + nombre */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initials(emp)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
            <p className="text-xs text-gray-400">{emp.email}</p>
          </div>
        </div>
      </td>

      {/* RUT */}
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{emp.rut}</td>

      {/* Cargo */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {emp.position?.title ?? <span className="text-gray-300">—</span>}
      </td>

      {/* Departamento */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {emp.department?.name ?? <span className="text-gray-300">—</span>}
      </td>

      {/* Empresa (badge por legalEntity del contrato) */}
      <td className="px-4 py-3">
        {contract?.legalEntity ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${LEGAL_ENTITY_COLOR[contract.legalEntity]}`}>
            {LEGAL_ENTITY_LABEL[contract.legalEntity]}
          </span>
        ) : (
          emp.contracts && emp.contracts.length > 1 ? (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              Ambas
            </span>
          ) : <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Tipo contrato */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {contract ? CONTRACT_LABEL[contract.type] : <span className="text-gray-300">—</span>}
      </td>

      {/* Antigüedad */}
      <td className="px-4 py-3 text-sm text-gray-500">
        {tenureLabel(emp.startDate)}
      </td>

      {/* Estado */}
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[emp.status]}`}>
          {STATUS_LABEL[emp.status]}
        </span>
      </td>
    </tr>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [filters, setFilters] = useState<DotacionFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data, isLoading, isError } = useEmployees(filters)
  const employees = data?.data ?? []

  function setFilter(key: keyof DotacionFilters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  // Stats calculados del resultado actual
  const stats = useMemo(() => {
    const active    = employees.filter(e => e.status === 'ACTIVE').length
    const comunic   = employees.filter(e => e.contracts?.some(c => c.legalEntity === 'COMUNICACIONES_SURMEDIA')).length
    const consult   = employees.filter(e => e.contracts?.some(c => c.legalEntity === 'SURMEDIA_CONSULTORIA')).length
    const expiring  = employees.filter(e => {
      const c = primaryContract(e.contracts)
      if (!c?.endDate) return false
      const daysLeft = (new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return daysLeft >= 0 && daysLeft <= 30
    }).length
    return { active, comunic, consult, expiring }
  }, [employees])

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {showCreateForm && (
        <EmployeeForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dotación</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {data?.total !== undefined ? `${data.total} colaboradores` : 'Cargando…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <UserPlus size={15} />
            Nuevo colaborador
          </button>
          <SyncButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Activos"        value={stats.active}  icon={Users}      color="text-blue-600 bg-blue-50" />
        <StatCard label="Comunicaciones" value={stats.comunic} icon={Building2}  color="text-blue-600 bg-blue-50"    sub="Comunicaciones Surmedia" />
        <StatCard label="Consultoría"    value={stats.consult} icon={Building2}  color="text-violet-600 bg-violet-50" sub="Surmedia Consultoría" />
        <StatCard label="Contratos por vencer" value={stats.expiring} icon={AlertTriangle} color="text-amber-600 bg-amber-50" sub="próximos 30 días" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200">

        {/* Barra de filtros */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Nombre, RUT, cargo o correo…"
              value={filters.search ?? ''}
              onChange={e => setFilter('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <FilterSelect
            value={filters.legalEntity ?? ''}
            onChange={v => setFilter('legalEntity', v)}
            placeholder="Todas las empresas"
            options={[
              { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
              { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
            ]}
          />

          <FilterSelect
            value={filters.status ?? ''}
            onChange={v => setFilter('status', v)}
            placeholder="Todos los estados"
            options={[
              { value: 'ACTIVE',   label: 'Activos' },
              { value: 'INACTIVE', label: 'Inactivos' },
              { value: 'ON_LEAVE', label: 'Con permiso' },
            ]}
          />

          <FilterSelect
            value={filters.contractType ?? ''}
            onChange={v => setFilter('contractType', v)}
            placeholder="Tipo de contrato"
            options={[
              { value: 'INDEFINIDO', label: 'Indefinido' },
              { value: 'PLAZO_FIJO', label: 'Plazo fijo' },
              { value: 'HONORARIOS', label: 'Honorarios' },
              { value: 'PRACTICA',   label: 'Práctica' },
            ]}
          />

          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({})}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Cargando colaboradores…</p>
          </div>
        ) : isError ? (
          <div className="p-16 text-center">
            <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Error cargando datos. Intenta nuevamente.</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No se encontraron colaboradores.</p>
            {Object.values(filters).some(Boolean) && (
              <p className="text-xs text-gray-400 mt-1">Prueba ajustando los filtros.</p>
            )}
            {!Object.values(filters).some(Boolean) && (
              <p className="text-xs text-gray-400 mt-1">Sincroniza desde BUK para importar la dotación.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Colaborador</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">RUT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Área</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contrato</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Antigüedad</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map(emp => (
                  <EmployeeRow
                    key={emp.id}
                    emp={emp}
                    onClick={() => setSelectedId(emp.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con total */}
        {employees.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {employees.length} colaboradores{data?.total && data.total > employees.length ? ` de ${data.total}` : ''}
          </div>
        )}
      </div>

      {/* Drawer de detalle */}
      <EmployeeDrawer
        employeeId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
