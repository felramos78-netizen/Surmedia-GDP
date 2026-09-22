import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, FileText, ShieldAlert } from 'lucide-react'
import { useEmployees } from '@/hooks/useDotacion'
import { useAuthStore } from '@/store/auth'
import EmployeeDocuments from './EmployeeDocuments'

const STATUS_FILTERS = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: '',       label: 'Todos' },
]

export default function DocumentsPage() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('colaborador')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ACTIVE')

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    status: status ? [status] : undefined,
  })
  const employees = [...(data?.data ?? [])].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'))
  const selected = employees.find(e => e.id === selectedId)

  if (!isAdmin) return (
    <div className="p-6 py-24 text-center">
      <ShieldAlert size={28} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Solo los administradores pueden ver los documentos de BUK.</p>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-5 h-full min-h-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Documentos de cada colaborador en BUK (Comunicaciones y Consultoría), consultados en vivo.
        </p>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Selector de colaborador */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nombre o RUT…"
              aria-label="Buscar colaborador"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                  status === f.value ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
            {isLoading && <li className="p-4 text-sm text-gray-400">Cargando…</li>}
            {!isLoading && employees.length === 0 && <li className="p-4 text-sm text-gray-400">Sin resultados</li>}
            {employees.map(emp => (
              <li key={emp.id}>
                <button
                  onClick={() => setParams({ colaborador: emp.id })}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${
                    emp.id === selectedId ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm truncate ${emp.id === selectedId ? 'text-brand-700 font-medium' : 'text-gray-800'}`}>
                    {emp.lastName} {emp.firstName}
                  </p>
                  <p className="text-xs text-gray-400">{emp.rut}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Documentos del seleccionado */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedId ? (
            <>
              {selected && (
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  {selected.firstName} {selected.lastName} <span className="font-normal text-gray-400">· {selected.rut}</span>
                </p>
              )}
              <EmployeeDocuments key={selectedId} employeeId={selectedId} />
            </>
          ) : (
            <div className="py-24 text-center">
              <FileText size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Selecciona un colaborador para ver sus documentos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
