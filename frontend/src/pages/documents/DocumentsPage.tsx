import { useSearchParams } from 'react-router-dom'
import { FileText, ShieldAlert } from 'lucide-react'
import { useEmployees } from '@/hooks/useDotacion'
import { useAuthStore } from '@/store/auth'
import EmployeeDocuments from './EmployeeDocuments'
import EmployeePicker from './EmployeePicker'
import DocumentSearch from './DocumentSearch'

const VIEWS = [
  { value: 'colaborador', label: 'Por colaborador' },
  { value: 'buscar',      label: 'Buscar documento' },
] as const
type View = typeof VIEWS[number]['value']

export default function DocumentsPage() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [params, setParams] = useSearchParams()
  const view: View  = params.get('vista') === 'buscar' ? 'buscar' : 'colaborador'
  const selectedId  = params.get('colaborador')

  // Lista completa (cacheada) solo para mostrar el colaborador seleccionado en el selector
  const { data } = useEmployees({})
  const selected = data?.data.find(e => e.id === selectedId)

  const openEmployee = (id: string) => setParams({ vista: 'colaborador', colaborador: id })

  if (!isAdmin) return (
    <div className="p-6 py-24 text-center">
      <ShieldAlert size={28} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Solo los administradores pueden ver los documentos de BUK.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Documentos de cada colaborador en BUK (Comunicaciones y Consultoría), consultados en vivo.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => setParams(v.value === 'buscar' ? { vista: 'buscar' } : selectedId ? { colaborador: selectedId } : {})}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'buscar' ? (
        <DocumentSearch onOpenEmployee={openEmployee} />
      ) : (
        <div className="space-y-4">
          <EmployeePicker selected={selected} onSelect={emp => openEmployee(emp.id)} />
          {selectedId ? (
            <EmployeeDocuments key={selectedId} employeeId={selectedId} />
          ) : (
            <div className="py-24 text-center">
              <FileText size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Selecciona un colaborador para ver sus documentos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
