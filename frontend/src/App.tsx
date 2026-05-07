import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/layouts/AppLayout'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import OnboardingPage from '@/pages/onboarding/OnboardingPage'
import ProfilesPage from '@/pages/profiles/ProfilesPage'
import WorkCentersPage from '@/pages/workCenters/WorkCentersPage'
import ImportablesPage from '@/pages/buk/BukPage'

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
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/perfiles"         element={<ProfilesPage />} />
            <Route path="/centros-trabajo"  element={<WorkCentersPage />} />
            <Route path="/buk"             element={<ImportablesPage />} />
            <Route path="/" element={<Navigate to="/employees" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
