import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
import { ACCESS_TOKEN } from '../../shared/config/constants'
import { routes } from '../../shared/lib/routes'
import { RootLayout } from '../../widgets/root-layout'
import { AdminReportsPage } from '../../pages/admin/admin-reports'
import { AdminUsersPage } from '../../pages/admin/admin-users'
import { AdminMembersPage } from '../../pages/admin/admin-members'
import { AdminOrganizationsPage } from '../../pages/admin/admin-organizations'
import { AdminProjectsPage } from '../../pages/admin/admin-projects'
import { AdminTasksPage } from '../../pages/admin/admin-tasks'
import NotificationsPage from '../../pages/dashboard/notifications'
import { AdminRoute } from './AdminRoute'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные страницы */}
        <Route path={routes.login()} element={<LoginPage />} />
        <Route path={routes.register()} element={<RegisterPage />} />
        <Route path={routes.checkEmail()} element={<CheckEmailPage />} />
        <Route path={routes.emailConfirmation()} element={<EmailConfirmationPage />} />
        <Route path={routes.passwordRecovery()} element={<PasswordRecoveryPage />} />
        <Route path={routes.recoveryMessage()} element={<RecoveryMessagePage />} />


        <Route element={<ProtectedRoute />}>
          <Route path={routes.dashboard()} element={<RootLayout />} >
            <Route index element={<DashboardPage />} />
            <Route path={routes.scheduler.list()} element={<SchedulerPage />} >
              <Route index element={<Navigate to={routes.scheduler.tasks()} replace />} />
              <Route path={routes.scheduler.tasks()} element={<TasksPage />} />
              <Route path={routes.scheduler.templates()} element={<TemplatesPage />} />
              <Route path={routes.scheduler.statuses()} element={<div>Statuses</div>} />
              <Route path={routes.scheduler.roadmap()} element={<div>Roadmap</div>} />
            </Route>
            <Route path={routes.admin.list()} element={<AdminRoute />}>
              <Route element={<AdminPage />}>
                <Route index element={<Navigate to={routes.admin.users()} replace />} />
                <Route path={routes.admin.users()} element={<AdminUsersPage />} />
                <Route path={routes.admin.members()} element={<AdminMembersPage />} />
                <Route path={routes.admin.organizations()} element={<AdminOrganizationsPage />} />
                <Route path={routes.admin.projects()} element={<AdminProjectsPage />} />
                <Route path={routes.admin.tasks()} element={<AdminTasksPage />} />
                <Route path={routes.admin.constructor()} element={<AdminConstructorPage />} />
                <Route path={routes.admin.reports()} element={<AdminReportsPage />} />
              </Route>
            </Route>
            <Route path={routes.settings.list()} element={<SettingsPage />}  >
              <Route index element={<Navigate to={routes.settings.profile()} replace />} />
              <Route path={routes.settings.profile()} element={<ProfilePage />} />
              <Route path={routes.settings.organizationsAndProjects()} element={<OrganizationsAndProjectsPage />} />
              <Route path={routes.settings.notifications()} element={<NotificationsPage />} />
            </Route>
            <Route path={routes.geoMechanics.list()} element={<GeoMechanicsPage />} />
          </Route>
        </Route>

        <Route path={routes.notFound()} element={<div>404</div>} />
      </Routes>
    </BrowserRouter>
  )
}

const ProtectedRoute = () => {
  const token = localStorage.getItem(ACCESS_TOKEN)
  const isAuth = !!token
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuth) {
      toast.error(t('errors.session-expired'))
      navigate(routes.login())
    }
  }, [isAuth])

  return isAuth ? <Outlet /> : null
}