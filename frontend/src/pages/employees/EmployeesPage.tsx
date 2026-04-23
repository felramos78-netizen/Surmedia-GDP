import { useState } from 'react'
import { Search, RefreshCw, ChevronDown, Users, UserX, GitMerge, AlertTriangle, CheckCircle2, X, Eye, Save, Calendar } from 'lucide-react'
import { useEmployees, useEmployeeStats, useSyncBuk, useSyncLogs, usePreviewSync, type DotacionFilters } from '@/hooks/useDotacion'
import { formatDate } from '@/lib/utils'
import type { Employee, Contract, LegalEntity, SyncPreviewResult } from '@/types'
import EmployeeDrawer from './EmployeeDrawer'

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

// ─── Stat card ────────────────────────────────────────────────────────────────

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

// ─── Modal de vista previa ────────────────────────────────────────────────────

function PreviewModal({ results, onConfirm, onCancel, isSaving }: {
  results: SyncPreviewResult[]
  onConfirm: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const totalNew    = results.reduce((s, r) => s + r.toCreate, 0)
  const totalUpdate = results.reduce((s, r) => s + r.toUpdate, 0)
  const totalDups   = results.reduce((s, r) => s + r.duplicatesSkipped, 0)

  const ENTITY_LABEL: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'Comunicaciones',
    SURMEDIA_CONSULTORIA:    'Consultoría',
  }
  const ENTITY_COLOR: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'bg-blue-100 text-blue-700',
    SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Vista previa — Sincronización BUK</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Resumen global */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{totalNew}</p>
            <p className="text-xs text-gray-500">Colaboradores nuevos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalUpdate}</p>
            <p className="text-xs text-gray-500">Actualizaciones</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-400">{totalDups}</p>
            <p className="text-xs text-gray-500">Duplicados omitidos</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {results.map(r => {
            const label = ENTITY_LABEL[r.legalEntity] ?? r.legalEntity
            const isExpanded = expanded[r.legalEntity] ?? false

            return (
              <div key={r.legalEntity} className="border border-gray-100 rounded-xl overflow-hidden">
                {/* Empresa header */}
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[r.legalEntity] ?? 'bg-gray-100 text-gray-700'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-gray-500">{r.employeesTotal} en BUK</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {r.toCreate > 0 && (
                      <span className="text-green-600 font-medium">+{r.toCreate} nuevos</span>
                    )}
                    {r.toUpdate > 0 && (
                      <span className="text-blue-600">{r.toUpdate} actualiz.</span>
                    )}
                    {r.duplicatesSkipped > 0 && (
                      <span className="text-gray-400">{r.duplicatesSkipped} omitidos</span>
                    )}
                  </div>
                </div>

                {/* Rango de fechas */}
                {(r.dateRange.min || r.dateRange.max) && (
                  <div className="px-4 py-2 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                    <span>
                      Ingresos: {r.dateRange.min ? formatDate(r.dateRange.min) : '—'}
                      {r.dateRange.max && r.dateRange.max !== r.dateRange.min && (
                        <> — {formatDate(r.dateRange.max)}</>
                      )}
                    </span>
                  </div>
                )}

                {/* Lista de nuevos */}
                {r.newEntries.length > 0 && (
                  <div className="border-t border-gray-50">
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [r.legalEntity]: !isExpanded }))}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{r.newEntries.length} colaboradores nuevos a agregar</span>
                      <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {r.newEntries.map(entry => (
                          <div key={entry.rut} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {`${entry.firstName[0] ?? ''}${entry.lastName[0] ?? ''}`.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {entry.firstName} {entry.lastName}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {[entry.position, entry.department].filter(Boolean).join(' · ') || entry.rut}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {entry.startDate && (
                                <p className="text-xs text-gray-400">
                                  Ingreso: {formatDate(entry.startDate)}
                                </p>
                              )}
                              {entry.endDate && (
                                <p className="text-xs text-amber-500">
                                  Salida: {formatDate(entry.endDate)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {r.newEntries.length === 0 && r.toUpdate > 0 && (
                  <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                    Sin colaboradores nuevos — se actualizarán {r.toUpdate} registros existentes.
                  </div>
                )}

                {r.newEntries.length === 0 && r.toUpdate === 0 && (
                  <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                    Sin cambios detectados.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Save size={14} className={isSaving ? 'animate-pulse' : ''} />
            {isSaving ? 'Guardando…' : 'Guardar en base de datos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Botón de sincronización con preview ─────────────────────────────────────

type SyncLine = { ok: boolean; label: string; msg: string }

function SyncButton({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase]       = useState<'idle' | 'previewing' | 'modal' | 'saving'>('idle')
  const [preview, setPreview]   = useState<SyncPreviewResult[] | null>(null)
  const [lines, setLines]       = useState<SyncLine[] | null>(null)

  const { data: logs } = useSyncLogs()
  const lastSync = logs?.[0]

  const { mutate: doPreview } = usePreviewSync()
  const { mutate: doSync }    = useSyncBuk()

  const ENTITY_LABEL: Record<string, string> = {
    COMUNICACIONES_SURMEDIA: 'Comunicaciones',
    SURMEDIA_CONSULTORIA:    'Consultoría',
  }

  function handleClickSync() {
    setLines(null)
    setPhase('previewing')
    doPreview(undefined, {
      onSuccess: (data: any) => {
        setPreview(data.results ?? [])
        setPhase('modal')
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Error al consultar BUK'
        setLines([{ ok: false, label: '', msg }])
        setPhase('idle')
      },
    })
  }

  function handleConfirm() {
    setPhase('saving')
    doSync(undefined, {
      onSuccess: (data: any) => {
        const parsed: SyncLine[] = (data?.results ?? []).map((r: any) => {
          const label = ENTITY_LABEL[r.legalEntity] ?? r.legalEntity
          const fatalError = r.errors?.find((e: any) => e.rut === '*')?.error
          if (fatalError) return { ok: false, label, msg: fatalError }
          const synced = (r.employeesCreated ?? 0) + (r.employeesUpdated ?? 0)
          return { ok: true, label, msg: `${synced} sincronizados` }
        })
        setLines(parsed.length ? parsed : [{ ok: true, label: '', msg: 'Sin cambios' }])
        setPhase('idle')
        setPreview(null)
        onSaved()
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Error al sincronizar'
        setLines([{ ok: false, label: '', msg }])
        setPhase('idle')
        setPreview(null)
      },
    })
  }

  function handleCancel() {
    setPhase('idle')
    setPreview(null)
  }

  const isPreviewing = phase === 'previewing'
  const isSaving     = phase === 'saving'
  const showModal    = phase === 'modal' || phase === 'saving'

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          {lastSync && !lines && phase === 'idle' && (
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
            onClick={handleClickSync}
            disabled={isPreviewing || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={15} className={(isPreviewing || isSaving) ? 'animate-spin' : ''} />
            {isPreviewing ? 'Consultando BUK…' : 'Sincronizar BUK'}
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

      {showModal && preview && (
        <PreviewModal
          results={preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
    </>
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

      {/* Empresa */}
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

      {/* Ingreso */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {formatDate(emp.startDate)}
      </td>

      {/* Salida */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {emp.endDate
          ? <span className="text-amber-600">{formatDate(emp.endDate)}</span>
          : <span className="text-gray-300">—</span>
        }
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
  const [filters, setFilters]   = useState<DotacionFilters>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useEmployees(filters)
  const { data: stats, refetch: refetchStats } = useEmployeeStats()
  const employees = data?.data ?? []

  function setFilter(key: keyof DotacionFilters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value || undefined }))
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dotación</h2>
          <p className="text-gray-500 mt-1 text-sm">
            {stats !== undefined ? `${stats.total} colaboradores en base de datos` : 'Cargando…'}
          </p>
        </div>
        <SyncButton onSaved={refetchStats} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Activos"
          value={stats?.active ?? '—'}
          icon={Users}
          color="text-green-600 bg-green-50"
        />
        <StatCard
          label="Inactivos"
          value={stats?.inactive ?? '—'}
          icon={UserX}
          color="text-gray-500 bg-gray-100"
        />
        <StatCard
          label="En ambas empresas"
          value={stats?.inBoth ?? '—'}
          icon={GitMerge}
          color="text-indigo-600 bg-indigo-50"
          sub="Comunicaciones y Consultoría"
        />
        <StatCard
          label="Contratos por vencer"
          value={stats?.expiring ?? '—'}
          icon={AlertTriangle}
          color="text-amber-600 bg-amber-50"
          sub="próximos 30 días"
        />
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
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingreso</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Salida</th>
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
            {employees.length} colaboradores mostrados{data?.total && data.total > employees.length ? ` de ${data.total} en total` : ''}
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
