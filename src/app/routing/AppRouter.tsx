import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import { preserveLocationSearch } from '../../features/org-project-selector/model/workspace-context'
import AdminPage from '../../pages/admin'
import { AdminConstructorPage } from '../../pages/admin/admin-constructor'
import CheckEmailPage from '../../pages/auth/check-email'
import EmailConfirmationPage from '../../pages/auth/email-confirmation'
import LoginPage from '../../pages/auth/login'
import PasswordRecoveryPage from '../../pages/auth/password-recovery'
import RecoveryMessagePage from '../../pages/auth/recovery-message'
import RegisterPage from '../../pages/auth/register'
import { HomePage } from '../home/HomePage'
import { AccessPage, AccessUserPage, RoleEditorPage } from '../../pages/app/access'
import { FormEditorPage, FormFillPage, FormRecordPage, FormRecordsPage, FormViewCreatePage, FormViewEditPage, FormViewPage, FormViewsPage, FormsPage } from '../../pages/app/forms'
import { SectionCreatePage, SectionEditorPage, SectionListPage, SectionPreviewPage, SectionWorkPage } from '../../pages/app/sections'
import GeoMechanicsPage from '../../pages/dashboard/geo-mechanics'
import SchedulerPage from '../../pages/dashboard/scheduler'
import TasksPage from '../../pages/dashboard/scheduler/tasks'
import TemplatesPage from '../../pages/dashboard/scheduler/templates'
import SettingsPage from '../../pages/dashboard/settings'
import OrganizationsAndProjectsPage from '../../pages/dashboard/settings/ogranizations-and-projects'
import ProfilePage from '../../pages/dashboard/settings/profile'
import { routes } from '../../shared/lib/routes'
import { AppShell } from '../shell/AppShell'
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

function RedirectKeepingSearch({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={preserveLocationSearch(to, location.search)} replace />
}

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
            <Route path={routes.dashboard()} element={<AppShell />} >
              <Route index element={<HomePage />} />
              <Route path={routes.scheduler.list()} element={<SchedulerPage />} >
                <Route index element={<RedirectKeepingSearch to={routes.scheduler.tasks()} />} />
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
                  <Route index element={<RedirectKeepingSearch to={routes.admin.users()} />} />
                  <Route path={routes.admin.users()} element={<AdminUsersPage />} />
                  <Route path={routes.admin.members()} element={<AdminMembersPage />} />
                  <Route path={routes.admin.organizationsAndProjects()} element={<AdminOrganizationsPage />} />
                  <Route path={routes.admin.organizations()} element={<RedirectKeepingSearch to={routes.admin.organizationsAndProjects()} />} />
                  <Route path={routes.admin.projects()} element={<RedirectKeepingSearch to={routes.admin.organizationsAndProjects()} />} />
                  <Route path={routes.admin.tasks()} element={<AdminTasksPage />} />
                </Route>
              </Route>
              <Route path="/workspace/sections/:sectionId" element={<SectionWorkPage />} />
              <Route path="/settings/sections/new" element={<SectionCreatePage />} />
              <Route path="/settings/sections/:sectionId/preview" element={<SectionPreviewPage />} />
              <Route path="/settings/sections/:sectionId" element={<SectionEditorPage />} />
              <Route path={routes.settings.sections()} element={<SectionListPage />} />
              <Route path="/forms/:formId/views/new" element={<FormViewCreatePage />} />
              <Route path="/forms/:formId/views/:viewId/edit" element={<FormViewEditPage />} />
              <Route path="/forms/:formId/views/:viewId" element={<FormViewPage />} />
              <Route path="/forms/:formId/views" element={<FormViewsPage />} />
              <Route path="/forms/:formId/records/:recordId" element={<FormRecordPage />} />
              <Route path="/forms/:formId/records" element={<FormRecordsPage />} />
              <Route path="/forms/:formId/fill" element={<FormFillPage />} />
              <Route path="/forms/:formId" element={<FormEditorPage />} />
              <Route path={routes.forms.list()} element={<FormsPage />} />
              <Route path={routes.settings.profile()} element={<ProfilePage />} />
              <Route path={routes.settings.access()} element={<AccessPage />} />
              <Route path="/settings/access/users/:userId" element={<AccessUserPage />} />
              <Route path={routes.settings.accessRoleNew()} element={<RoleEditorPage />} />
              <Route path="/settings/access/roles/:roleId" element={<RoleEditorPage />} />
              <Route path={routes.settings.organizationsAndProjects()} element={<OrganizationsAndProjectsPage />} />
              <Route path={routes.settings.list()} element={<SettingsPage />}>
                <Route index element={<RedirectKeepingSearch to={routes.settings.notifications()} />} />
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
