import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { isPlatformConsolePath } from '../../shared/lib/routes'
import { Header } from '../header'
import { Sidebar } from '../sidebar'

const SIDEBAR_STORAGE_KEY = 'inlog.sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function RootLayout() {
  const location = useLocation()
  const shell = isPlatformConsolePath(location.pathname) ? 'platform' : 'user'

  useLayoutEffect(() => {
    document.documentElement.dataset.shell = shell
  }, [shell])
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
