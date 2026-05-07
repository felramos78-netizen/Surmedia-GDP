import { useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Users, FileText, UserPlus,
  Settings, Building2, Contact, Landmark, FileSpreadsheet, UserCircle2,
  RefreshCw, CheckCircle2, AlertTriangle, X,
} from 'lucide-react'
import { useImportStore } from '@/store/importStore'

const navItems = [
  { to: '/employees',        icon: Users,            label: 'Dotación' },
  { to: '/colaboradores',    icon: UserCircle2,      label: 'Colaboradores' },
  { to: '/centros-trabajo',  icon: Landmark,         label: 'Centros de Trabajo' },
  { to: '/recruitment',      icon: UserPlus,         label: 'Reclutamiento' },
  { to: '/onboarding',       icon: Building2,        label: 'Onboarding' },
  { to: '/perfiles',         icon: Contact,          label: 'Perfiles' },
  { to: '/buk',              icon: FileSpreadsheet,  label: 'Importables Excel' },
  { to: '/documents',        icon: FileText,         label: 'Documentos' },
]

function ImportToast() {
  const { status, label, detail, dismiss } = useImportStore()
  const qc = useQueryClient()

  useEffect(() => {
    if (status === 'success') {
      qc.invalidateQueries({ queryKey: ['payrollTable'] })
      qc.invalidateQueries({ queryKey: ['payrollYears'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employeeStats'] })
      const t = setTimeout(dismiss, 6000)
      return () => clearTimeout(t)
    }
  }, [status])

  if (status === 'idle') return null

  const configs = {
    running: { bg: 'bg-blue-600',   icon: <RefreshCw size={15} className="animate-spin flex-shrink-0" />, canClose: false },
    success: { bg: 'bg-emerald-600', icon: <CheckCircle2 size={15} className="flex-shrink-0" />,          canClose: true  },
    error:   { bg: 'bg-red-600',     icon: <AlertTriangle size={15} className="flex-shrink-0" />,          canClose: true  },
  }
  const { bg, icon, canClose } = configs[status]

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm min-w-72 max-w-md ${bg}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-tight">{label}</p>
        {detail && <p className="text-xs opacity-80 mt-0.5 truncate">{detail}</p>}
      </div>
      {canClose && (
        <button onClick={dismiss} className="opacity-70 hover:opacity-100 flex-shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">GDP Surmedia</h1>
          <p className="text-xs text-gray-500 mt-1">Gestión de Personas</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {}}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Settings size={14} />
            Configuración
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <ImportToast />
    </div>
  )
}
