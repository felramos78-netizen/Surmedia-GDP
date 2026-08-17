import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/components/ui/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import AuthCallback from '@/pages/auth/AuthCallback'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import FormPublicPage from '@/pages/onboarding/FormPublicPage'
import ProfilesPage from '@/pages/profiles/ProfilesPage'
import WorkCentersPage from '@/pages/workCenters/WorkCentersPage'
import ImportablesPage from '@/pages/buk/BukPage'
import ColaboradoresPage from '@/pages/colaboradores/ColaboradoresPage'
import ColaboradorDetallePage from '@/pages/colaboradores/ColaboradorDetallePage'
import CalendarioPage from '@/pages/calendario/CalendarioPage'
import ProveedoresPage from '@/pages/proveedores/ProveedoresPage'
import PresupuestoPage from '@/pages/budget/PresupuestoPage'
import ReportesPage from '@/pages/reportes/ReportesPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/auth/callback"  element={<AuthCallback />} />
          <Route path="/forms/:token"   element={<FormPublicPage />} />

          {/* Rutas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/colaboradores"       element={<ColaboradoresPage />} />
              <Route path="/colaboradores/:id"   element={<ColaboradorDetallePage />} />
              <Route path="/onboarding"          element={<OnboardingPage />} />
              <Route path="/perfiles"            element={<ProfilesPage />} />
              <Route path="/centros-trabajo"     element={<WorkCentersPage />} />
              <Route path="/buk"                 element={<ImportablesPage />} />
              <Route path="/calendario"          element={<CalendarioPage />} />
              <Route path="/proveedores"         element={<ProveedoresPage />} />
              <Route path="/presupuesto"         element={<PresupuestoPage />} />
              <Route path="/reportes"            element={<ReportesPage />} />
              <Route path="/" element={<Navigate to="/centros-trabajo" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
