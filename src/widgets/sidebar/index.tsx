import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { LogOut, PanelLeftClose } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { selectUser, selectUserFullName } from '../../entities/user/model/selectors'
import { requestLogout } from '../../shared/api/session-events'
import { cn } from '../../shared/lib/utils'
import { AppLogo } from '../../shared/ui/app-logo'
import { Button } from '../../shared/ui/button'
import { toast } from 'sonner'
import { ThemeMenu } from './ThemeMenu'

export type SidebarLinkModel = {
  id: string
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export type SidebarGroupModel = {
  id: string
  label: string
  items: SidebarLinkModel[]
}

type SidebarProps = {
  homeTo: string
  groups: SidebarGroupModel[]
  profileTo: string
  accountNote?: string
  onNavigate?: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

export function Sidebar({ homeTo, groups, profileTo, accountNote, onNavigate }: SidebarProps) {
  const { t } = useTranslation()
  const user = useSelector(selectUser)
  const userName = useSelector(selectUserFullName) || user?.email

  return (
    <aside className="flex h-full w-60 min-w-60 flex-col border-r border-shell-line bg-shell text-shell-foreground">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-shell-line px-3">
        <NavLink
          to={homeTo}
          onClick={onNavigate}
          className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('home.title')}
        >
          <AppLogo />
        </NavLink>
        {onNavigate && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-shell-foreground hover:bg-shell-subtle hover:text-shell-foreground md:hidden"
            onClick={onNavigate}
            aria-label={t('shell.close-menu')}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3" aria-label={t('shell.navigation')}>
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {group.id !== 'primary' && (
              <div className="px-3 pb-1 text-xs font-medium text-shell-muted">{group.label}</div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-shell-foreground transition-colors hover:bg-shell-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'bg-shell-accent font-medium text-shell-accent-foreground hover:bg-shell-accent',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 leading-tight">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-shell-line p-3">
        <NavLink
          to={profileTo}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 hover:bg-shell-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shell-accent text-xs font-medium text-shell-accent-foreground" aria-hidden>
            {initials(userName || '')}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-shell-foreground">{userName}</span>
            <span className="block truncate text-xs text-shell-muted">{accountNote || user?.position || t('nav.profile')}</span>
          </span>
        </NavLink>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 min-w-0 flex-1 justify-start px-2 text-shell-foreground hover:bg-shell-subtle hover:text-shell-foreground"
            onClick={() => {
              onNavigate?.()
              void requestLogout({ reason: 'user', callApi: true }).then(() => {
                toast.success(t('notice-list.log-out-success'))
              })
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('header.logout')}
          </Button>
          <ThemeMenu />
        </div>
      </div>
    </aside>
  )
}

export function SidebarDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    panel?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open, panel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t('shell.close-menu')}
        onClick={onClose}
      />
      <div ref={setPanel} id="app-sidebar" role="dialog" aria-modal="true" aria-label={t('shell.navigation')} className="absolute inset-y-0 left-0 max-w-full shadow-xl">
        {children}
      </div>
    </div>
  )
}
