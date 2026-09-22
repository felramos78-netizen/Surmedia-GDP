import { useSearchParams } from 'react-router-dom'
import { FileText, ShieldAlert } from 'lucide-react'
import { useEmployees } from '@/hooks/useDotacion'
import { useAuthStore } from '@/store/auth'
import EmployeeDocuments from './EmployeeDocuments'
import EmployeePicker from './EmployeePicker'
import DocumentSearch from './DocumentSearch'
import DocumentDashboard from './DocumentDashboard'

const VIEWS = [
  { value: 'resumen',     label: 'Resumen' },
  { value: 'colaborador', label: 'Por colaborador' },
  { value: 'buscar',      label: 'Buscar documento' },
] as const
type View = typeof VIEWS[number]['value']

export default function DocumentsPage() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista')
  const view: View = vista === 'buscar' || vista === 'colaborador' ? vista : 'resumen'
  const selectedId = params.get('colaborador')
  const categoryId = params.get('categoria') ?? ''

  // Lista completa (cacheada) solo para mostrar el colaborador seleccionado en el selector
  const { data } = useEmployees({})
  const selected = data?.data.find(e => e.id === selectedId)

  const openEmployee = (id: string) => setParams({ vista: 'colaborador', colaborador: id })
  const searchCategory = (id: string) => setParams(id ? { vista: 'buscar', categoria: id } : { vista: 'buscar' })

  function goTo(v: View) {
    if (v === 'buscar')      setParams(categoryId ? { vista: 'buscar', categoria: categoryId } : { vista: 'buscar' })
    else if (v === 'colaborador') setParams(selectedId ? { vista: 'colaborador', colaborador: selectedId } : { vista: 'colaborador' })
    else setParams({})
  }

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
          Documentos de cada colaborador en BUK (Comunicaciones y Consultoría), registrados en GDP y agrupados por tipo.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => goTo(v.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'resumen' && (
        <DocumentDashboard onSearchCategory={searchCategory} onOpenEmployee={openEmployee} />
      )}

      {view === 'buscar' && (
        <DocumentSearch categoryId={categoryId} onCategoryChange={searchCategory} onOpenEmployee={openEmployee} />
      )}

      {view === 'colaborador' && (
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
