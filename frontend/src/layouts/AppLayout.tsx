import { Outlet, NavLink } from 'react-router-dom'
import {
  Users, FileText, UserPlus, Calendar, BarChart3,
  Settings, Building2, Contact, Landmark,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',        icon: BarChart3,  label: 'Dashboard' },
  { to: '/employees',        icon: Users,      label: 'Dotación' },
  { to: '/centros-trabajo',  icon: Landmark,   label: 'Centros de Trabajo' },
  { to: '/recruitment',      icon: UserPlus,   label: 'Reclutamiento' },
  { to: '/onboarding',       icon: Building2,  label: 'Onboarding' },
  { to: '/perfiles',         icon: Contact,    label: 'Perfiles' },
  { to: '/leave',            icon: Calendar,   label: 'Vacaciones' },
  { to: '/documents',        icon: FileText,   label: 'Documentos' },
]

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
    </div>
  )
}
