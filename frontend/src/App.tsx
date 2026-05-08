import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/layouts/AppLayout'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import FormPublicPage from '@/pages/onboarding/FormPublicPage'
import ProfilesPage from '@/pages/profiles/ProfilesPage'
import WorkCentersPage from '@/pages/workCenters/WorkCentersPage'
import ImportablesPage from '@/pages/buk/BukPage'
import ColaboradoresPage from '@/pages/colaboradores/ColaboradoresPage'
import ColaboradorDetallePage from '@/pages/colaboradores/ColaboradorDetallePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/employees"           element={<EmployeesPage />} />
            <Route path="/colaboradores"       element={<ColaboradoresPage />} />
            <Route path="/colaboradores/:id"   element={<ColaboradorDetallePage />} />
            <Route path="/onboarding"          element={<OnboardingPage />} />
            <Route path="/perfiles"            element={<ProfilesPage />} />
            <Route path="/centros-trabajo"     element={<WorkCentersPage />} />
            <Route path="/buk"                 element={<ImportablesPage />} />
            <Route path="/" element={<Navigate to="/employees" replace />} />
          </Route>
          {/* Ruta pública — sin AppLayout ni autenticación */}
          <Route path="/forms/:token" element={<FormPublicPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
