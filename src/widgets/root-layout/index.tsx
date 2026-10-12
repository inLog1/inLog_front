import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAccessToken } from '../../shared/api/auth-session'
import { deniedSectionRedirect } from '../../shared/lib/available-features'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
import { cn } from '../../shared/lib/utils'
import { isPlatformAdmin, isSuperAdmin } from '../../shared/types/platform-role'
import { Header } from '../header'
import { Sidebar } from '../sidebar'
import { useGetMeQuery } from '../../entities/user/model/userSlice'
import { useGetOrganizationsQuery } from '../../entities/organization/model/organizationSlice'
import { useGetProjectsQuery } from '../../entities/project/model/projectSlice'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

const SIDEBAR_STORAGE_KEY = 'inlog.sidebar-collapsed'
const MOBILE_SHELL_QUERY = '(max-width: 1023px)'

function isMobileShell() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_SHELL_QUERY).matches
}

function readStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function readSidebarCollapsed() {
  if (isMobileShell()) return true
  return readStoredSidebarCollapsed()
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
  const previousPath = useRef(location.pathname)

  useEffect(() => {
    if (isMobileShell()) return
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed))
    } catch {
      // Приватный режим или переполненное хранилище не должны ломать интерфейс.
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const media = window.matchMedia(MOBILE_SHELL_QUERY)
    const onChange = () => {
      setSidebarCollapsed(media.matches ? true : readStoredSidebarCollapsed())
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    if (isMobileShell()) setSidebarCollapsed(true)
  }, [location.pathname])

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

  const sectionRedirect = user ? deniedSectionRedirect(user, location.pathname) : null

  if (isUserLoading || isOrgsLoading || isProjectsLoading || lockedToAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div data-shell={shell} className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {!sidebarCollapsed && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label={t('sidebar.collapse')}
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <div
        id="app-sidebar"
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        inert={sidebarCollapsed}
        aria-hidden={sidebarCollapsed}
        className={cn(
          'h-full min-w-0 shrink-0 overflow-hidden motion-reduce:transition-none',
          'transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-60 max-lg:shadow-2xl',
          sidebarCollapsed ? 'w-0 max-lg:-translate-x-full' : 'w-60 max-lg:translate-x-0',
        )}
      >
        <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onExpandSidebar={() => setSidebarCollapsed(false)}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {sectionRedirect ? <Navigate to={sectionRedirect} replace /> : <Outlet />}
        </main>
      </div>
      </div>
    </div>
  )
}