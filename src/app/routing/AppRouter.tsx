import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import AdminPage from '../../pages/admin'
import { AdminConstructorPage } from '../../pages/admin/admin-constructor'
import CheckEmailPage from '../../pages/auth/check-email'
import EmailConfirmationPage from '../../pages/auth/email-confirmation'
import LoginPage from '../../pages/auth/login'
import PasswordRecoveryPage from '../../pages/auth/password-recovery'
import RecoveryMessagePage from '../../pages/auth/recovery-message'
import RegisterPage from '../../pages/auth/register'
import DashboardPage from '../../pages/dashboard'
import GeoMechanicsPage from '../../pages/dashboard/geo-mechanics'
import SchedulerPage from '../../pages/dashboard/scheduler'
import TasksPage from '../../pages/dashboard/scheduler/tasks'
import TemplatesPage from '../../pages/dashboard/scheduler/templates'
import SettingsPage from '../../pages/dashboard/settings'
import OrganizationsAndProjectsPage from '../../pages/dashboard/settings/ogranizations-and-projects'
import ProfilePage from '../../pages/dashboard/settings/profile'
import { routes } from '../../shared/lib/routes'
import { RootLayout } from '../../widgets/root-layout'
import { AdminReportsPage } from '../../pages/admin/admin-reports'
import { AdminUsersPage } from '../../pages/admin/admin-users'
import { AdminMembersPage } from '../../pages/admin/admin-members'
import { AdminOrganizationsPage } from '../../pages/admin/admin-organizations'
import { AdminTasksPage } from '../../pages/admin/admin-tasks'
import NotificationsPage from '../../pages/dashboard/notifications'
import { AdminRoute } from './AdminRoute'
import { RequireWorkspace } from '../session/RequireWorkspace'
import { LoginBoundary } from '../session/LoginBoundary'
import { SessionProvider } from '../session/SessionProvider'

const mockBuild = import.meta.env.VITE_API_MODE === 'mock'
const MockProviderPage = mockBuild
  ? lazy(() => import('../../pages/auth/mock-provider'))
  : null
const MockTestPanel = mockBuild
  ? lazy(() => import('../../features/dev-testing/ui/MockTestPanel'))
  : null

export function AppRouter() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path={routes.login()} element={<LoginBoundary><LoginPage /></LoginBoundary>} />
          <Route path={routes.register()} element={<RegisterPage />} />
          <Route path={routes.checkEmail()} element={<CheckEmailPage />} />
          <Route path={routes.emailConfirmation()} element={<EmailConfirmationPage />} />
          <Route path={routes.passwordRecovery()} element={<PasswordRecoveryPage />} />
          <Route path={routes.recoveryMessage()} element={<RecoveryMessagePage />} />
          {MockProviderPage ? (
            <Route path={routes.mockProvider()} element={<Suspense fallback={null}><MockProviderPage /></Suspense>} />
          ) : null}

          <Route element={<RequireWorkspace />}>
            <Route path={routes.dashboard()} element={<RootLayout />} >
              <Route index element={<DashboardPage />} />
              <Route path={routes.scheduler.list()} element={<SchedulerPage />} >
                <Route index element={<Navigate to={routes.scheduler.tasks()} replace />} />
                <Route path={routes.scheduler.tasks()} element={<TasksPage />} />
                <Route path={routes.scheduler.templates()} element={<TemplatesPage />} />
                <Route path={routes.scheduler.statuses()} element={<div>Statuses</div>} />
                <Route path={routes.scheduler.roadmap()} element={<div>Roadmap</div>} />
              </Route>
              <Route element={<AdminPage />}>
                <Route path={routes.admin.constructor()} element={<AdminConstructorPage />} />
                <Route path={routes.admin.reports()} element={<AdminReportsPage />} />
              </Route>
              <Route path={routes.admin.list()} element={<AdminRoute />}>
                <Route element={<AdminPage />}>
                  <Route index element={<Navigate to={routes.admin.users()} replace />} />
                  <Route path={routes.admin.users()} element={<AdminUsersPage />} />
                  <Route path={routes.admin.members()} element={<AdminMembersPage />} />
                  <Route path={routes.admin.organizationsAndProjects()} element={<AdminOrganizationsPage />} />
                  <Route path={routes.admin.organizations()} element={<Navigate to={routes.admin.organizationsAndProjects()} replace />} />
                  <Route path={routes.admin.projects()} element={<Navigate to={routes.admin.organizationsAndProjects()} replace />} />
                  <Route path={routes.admin.tasks()} element={<AdminTasksPage />} />
                </Route>
              </Route>
              <Route path={routes.settings.profile()} element={<ProfilePage />} />
              <Route path={routes.settings.organizationsAndProjects()} element={<OrganizationsAndProjectsPage />} />
              <Route path={routes.settings.list()} element={<SettingsPage />}>
                <Route index element={<Navigate to={routes.settings.notifications()} replace />} />
                <Route path={routes.settings.notifications()} element={<NotificationsPage />} />
              </Route>
              <Route path={routes.geoMechanics.list()} element={<GeoMechanicsPage />} />
            </Route>
          </Route>

          <Route path={routes.notFound()} element={<div>404</div>} />
        </Routes>
        {MockTestPanel ? (
          <Suspense fallback={null}>
            <MockTestPanel />
          </Suspense>
        ) : null}
      </SessionProvider>
    </BrowserRouter>
  )
}
