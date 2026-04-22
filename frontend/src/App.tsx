import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProtectedRoute from '@/components/ui/ProtectedRoute'
import AppLayout from '@/layouts/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import AuthCallback from '@/pages/auth/AuthCallback'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import EmployeesPage from '@/pages/employees/EmployeesPage'
import ContractsPage from '@/pages/contracts/ContractsPage'
import LeavesPage from '@/pages/leaves/LeavesPage'
import OrganizationPage from '@/pages/organization/OrganizationPage'

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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/leaves" element={<LeavesPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
