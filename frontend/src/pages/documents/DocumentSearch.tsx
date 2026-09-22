import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Search, UserCircle2 } from 'lucide-react'
import { useBukDocSearch, useRefreshBukDocIndex, type BukDocSearchPerson } from '@/hooks/useBukDocuments'
import { FileRow, ENTITY_LABEL, ENTITY_COLOR } from './EmployeeDocuments'

const ENTITY_FILTERS = [
  { value: '',                        label: 'Todas' },
  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
  { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
]

function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1)  return 'recién'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.round(min / 60)} h`
}

function PersonRow({ person, onOpenEmployee }: { person: BukDocSearchPerson; onOpenEmployee: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={`${open ? 'Ocultar' : 'Ver'} documentos de ${person.fullName}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-gray-800 truncate">{person.fullName}</span>
            <span className="block text-xs text-gray-400">
              {person.rut}{person.bukStatus && person.bukStatus !== 'activo' ? ` · ${person.bukStatus}` : ''}
            </span>
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[person.legalEntity]}`}>
            {ENTITY_LABEL[person.legalEntity]}
          </span>
          <span className="text-xs text-gray-500 w-20 text-right">
            {person.files.length} {person.files.length === 1 ? 'documento' : 'documentos'}
          </span>
        </button>
        {person.employeeId ? (
          <button
            onClick={() => onOpenEmployee(person.employeeId!)}
            title="Ver todos sus documentos"
            aria-label={`Ver todos los documentos de ${person.fullName}`}
            className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
          >
            <UserCircle2 size={15} />
          </button>
        ) : (
          <span className="w-7" title="No está registrado en GDP" />
        )}
      </div>
      {open && (
        <ul className="ml-9 mr-3 mb-2 border-l border-gray-100 pl-2">
          {person.files.map(f => (
            <FileRow key={f.fileId} file={f} entity={person.legalEntity} bukEmployeeId={person.bukEmployeeId} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Buscador de documentos por nombre en todas las fichas BUK: cuántos hay y quiénes los tienen
export default function DocumentSearch({ onOpenEmployee }: { onOpenEmployee: (id: string) => void }) {
  const [input,  setInput]  = useState('')
  const [q,      setQ]      = useState('')
  const [entity, setEntity] = useState('')
  const [status, setStatus] = useState('')

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  const { data, isLoading, isError, isFetching } = useBukDocSearch({ q, legalEntity: entity, status })
  const refresh = useRefreshBukDocIndex()

  const building = data?.building
  const pct = building && building.total ? Math.round((building.done / building.total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Documento o carpeta (ej. RIOHS, anexo)…"
            aria-label="Buscar documento por nombre"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {ENTITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setEntity(f.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                entity === f.value ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Estado en BUK"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos los estados BUK</option>
          {(data?.statuses ?? []).map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          {data?.builtAt && !building && <span>Índice actualizado {timeAgo(data.builtAt)}</span>}
          <button
            onClick={() => refresh.mutate()}
            disabled={!!building || refresh.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw size={12} className={building ? 'animate-spin' : ''} />
            Actualizar índice
          </button>
        </div>
      </div>

      {/* Progreso de construcción del índice */}
      {building && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600 mb-2">
            Leyendo los documentos de todas las fichas en BUK… {building.done}/{building.total || '…'}
            {data?.ready && <span className="text-gray-400"> (mientras tanto se muestran los resultados del índice anterior)</span>}
          </p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {data?.error && (
        <p className="text-sm text-red-500 flex items-center gap-2"><AlertTriangle size={14} /> No se pudo construir el índice: {data.error}</p>
      )}
      {!!data?.failed && !building && (
        <p className="text-xs text-amber-600">{data.failed} fichas no se pudieron leer desde BUK; actualiza el índice para reintentar.</p>
      )}

      {/* Resultados */}
      {isError ? (
        <div className="py-16 text-center">
          <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Error consultando el buscador de documentos.</p>
        </div>
      ) : isLoading || !data?.ready ? (
        !building && <div className="py-16 text-center text-sm text-gray-400">Preparando índice de documentos…</div>
      ) : q.length < 2 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          Escribe al menos 2 letras para buscar entre los documentos de todas las fichas BUK.
        </div>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">{data.totalFiles}</strong> documentos en{' '}
            <strong className="text-gray-900">{data.totalPeople}</strong> de {data.scopePeople ?? 0} fichas BUK
          </p>
          {data.people.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Ningún documento coincide con “{q}”.</div>
          ) : (
            <ul className="bg-white border border-gray-100 rounded-xl">
              {data.people.map(p => (
                <PersonRow key={`${p.legalEntity}-${p.bukEmployeeId}`} person={p} onOpenEmployee={onOpenEmployee} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
