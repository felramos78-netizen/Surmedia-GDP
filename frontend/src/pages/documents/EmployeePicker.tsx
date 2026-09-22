import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useEmployees } from '@/hooks/useDotacion'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { Employee } from '@/types'

const STATUS_FILTERS = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: '',       label: 'Todos' },
]

// Selector desplegable de colaborador con búsqueda por nombre o RUT
export default function EmployeePicker({ selected, onSelect }: {
  selected: Employee | undefined
  onSelect: (emp: Employee) => void
}) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useEscapeKey(close)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    status: status ? [status] : undefined,
  })
  const employees = [...(data?.data ?? [])].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'))

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-left"
      >
        <span className="flex-1 min-w-0">
          {selected ? (
            <>
              <span className="block text-sm font-medium text-gray-800 truncate">{selected.firstName} {selected.lastName}</span>
              <span className="block text-xs text-gray-400">{selected.rut}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">Selecciona un colaborador…</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
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
                className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors ${
                  status === f.value ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {isLoading && <li className="px-3 py-2 text-sm text-gray-400">Cargando…</li>}
            {!isLoading && employees.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>}
            {employees.map(emp => (
              <li key={emp.id} role="option" aria-selected={emp.id === selected?.id}>
                <button
                  onClick={() => { onSelect(emp); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    emp.id === selected?.id ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm truncate ${emp.id === selected?.id ? 'text-brand-700 font-medium' : 'text-gray-800'}`}>
                    {emp.lastName} {emp.firstName}
                  </p>
                  <p className="text-xs text-gray-400">{emp.rut}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
