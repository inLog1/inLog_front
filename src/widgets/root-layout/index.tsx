import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAccessToken } from '../../shared/api/auth-session'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
import { isPlatformAdmin, isSuperAdmin } from '../../shared/types/platform-role'
import { Header } from '../header'
import { Sidebar } from '../sidebar'
import { useGetMeQuery } from '../../entities/user/model/userSlice'
import { useGetOrganizationsQuery } from '../../entities/organization/model/organizationSlice'
import { useGetProjectsQuery } from '../../entities/project/model/projectSlice'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

const SIDEBAR_STORAGE_KEY = 'inlog.sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function RootLayout() {
  const { t} = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const shell = isPlatformConsolePath(location.pathname) ? 'platform' : 'user'

  useLayoutEffect(() => {
    document.documentElement.dataset.shell = shell
  }, [shell])
  const accessToken = useAccessToken()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed))
    } catch {
      // Приватный режим или переполненное хранилище не должны ломать интерфейс.
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '\\' || event.altKey || !(event.metaKey || event.ctrlKey)) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      event.preventDefault()
      setSidebarCollapsed((collapsed) => !collapsed)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data: user, isLoading: isUserLoading, error: userError} = useGetMeQuery(undefined, {
    skip: !accessToken,
    refetchOnMountOrArgChange: true,
  })

  const lockedToAdmin =
    !!user && isPlatformAdmin(user.role) && !isSuperAdmin(user.role) && shell !== 'platform'

  useEffect(() => {
    if (lockedToAdmin) {
      navigate(routes.admin.list(), { replace: true })
    }
  }, [lockedToAdmin, navigate])

  const isAuth = !!user

  const { data: organizations, isLoading: isOrgsLoading } = useGetOrganizationsQuery(undefined, {
    skip: !isAuth || !user,
  })

  const firstOrgId = organizations?.[0]?.id

  const { data: projects, isLoading: isProjectsLoading } = useGetProjectsQuery(
    { organization: firstOrgId! },
    { skip: !isAuth || !firstOrgId }
  )

  const verifyAndRedirect = useCallback(() => {
    if (isUserLoading || isOrgsLoading || isProjectsLoading || !accessToken) return

    if (userError) {
      toast.error(t('errors.error-loading-user'))
      navigate(routes.login())
      return
    }

  }, [accessToken, isUserLoading, isOrgsLoading, isProjectsLoading, userError, organizations, projects, navigate])

  useEffect(() => {
    verifyAndRedirect()
  }, [verifyAndRedirect])

  if (isUserLoading || isOrgsLoading || isProjectsLoading || lockedToAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div data-shell={shell} className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <div
        id="app-sidebar"
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        inert={sidebarCollapsed}
        aria-hidden={sidebarCollapsed}
        className="sidebar-shell h-full shrink-0 overflow-hidden"
      >
        <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onExpandSidebar={() => setSidebarCollapsed(false)}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  )
}