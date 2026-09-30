import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useVerifyTokenMutation } from '../../features/auth/model/authSlice'
import { ACCESS_TOKEN } from '../../shared/config/constants'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
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
  const [verifyToken] = useVerifyTokenMutation()
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

  const fetchVerifyToken = async (token: string) => {
    try {
       await verifyToken({ token }).unwrap()
    } catch (error) {
        toast.error(t('errors.error-loading-token'))
        localStorage.removeItem(ACCESS_TOKEN)
        navigate(routes.login())
    }
  }

  const { data: user, isLoading: isUserLoading, error: userError} = useGetMeQuery(undefined, {
    skip: !localStorage.getItem(ACCESS_TOKEN),
    refetchOnMountOrArgChange: true,
  })

  const isAuth = !!user

  const { data: organizations, isLoading: isOrgsLoading } = useGetOrganizationsQuery(undefined, {
    skip: !isAuth || !user,
  })

  const firstOrgId = organizations?.[0]?.id

  const { data: projects, isLoading: isProjectsLoading } = useGetProjectsQuery(
    { organization: firstOrgId! },
    { skip: !isAuth || !firstOrgId }
  )

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN)
    if(token) {
      fetchVerifyToken(JSON.parse(token))
    }
  }, [])

  const verifyAndRedirect = useCallback(() => {
    const token = localStorage.getItem(ACCESS_TOKEN)
    if (isUserLoading || isOrgsLoading || isProjectsLoading || !token) return

    if (userError) {
      toast.error(t('errors.error-loading-user'))
      navigate(routes.login())
      return
    }

  }, [isUserLoading, isOrgsLoading, isProjectsLoading, userError, organizations, projects, navigate])

  useEffect(() => {
    verifyAndRedirect()
  }, [verifyAndRedirect])

  if (isUserLoading || isOrgsLoading || isProjectsLoading) {
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