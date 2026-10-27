import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  FolderKanban,
  Folders,
  LayoutDashboard,
  Monitor,
  Moon,
  PanelLeftClose,
  PieChart,
  Settings,
  ShieldPlus,
  Sun,
  TowerControl,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { selectIsPlatformAdmin, selectUser, selectUserFullName, selectUserRole } from '../../entities/user/model/selectors'
import { useWorkspaceHref } from '../../features/org-project-selector/model/useEnsureOrgProjectParams'
import type { WorkspaceLinkScope } from '../../features/org-project-selector/model/workspace-context'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
import { cn } from '../../shared/lib/utils'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { AppLogo } from '../../shared/ui/app-logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../shared/ui/tooltip'
import { UserMenu } from '../header/ui/UserMenu'

interface SidebarProps {
  onCollapse: () => void
}

export function Sidebar({ onCollapse }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isPlatformAdmin = useSelector(selectIsPlatformAdmin)
  const user = useSelector(selectUser)
  const userName = useSelector(selectUserFullName) || user?.email
  const userRole = useSelector(selectUserRole)
  const roleLabel = userRole
    ? t(`admin-page.platform-roles.${userRole}`, { defaultValue: userRole })
    : null

  const isPlatform = isPlatformConsolePath(location.pathname)
  const href = useWorkspaceHref()

  const clientItems: { label: string; path: string; scope: WorkspaceLinkScope; icon: typeof LayoutDashboard; end: boolean }[] = [
    { label: t('sidebar.dashboard'), path: routes.dashboard(), scope: 'app', icon: LayoutDashboard, end: true },
    { label: t('admin-page.constructor'), path: routes.admin.constructor(), scope: 'organization', icon: Wrench, end: false },
    { label: t('admin-page.reports'), path: routes.admin.reports(), scope: 'organization', icon: PieChart, end: false },
    { label: t('sidebar.organizations-and-projects'), path: routes.settings.organizationsAndProjects(), scope: 'app', icon: Folders, end: false },
    { label: t('sidebar.scheduler'), path: routes.scheduler.list(), scope: 'project', icon: FolderKanban, end: false },
    { label: t('sidebar.geo-mechanics'), path: routes.geoMechanics.list(), scope: 'app', icon: TowerControl, end: false },
    { label: t('sidebar.settings'), path: routes.settings.notifications(), scope: 'app', icon: Settings, end: false },
  ]

  const platformItems: { label: string; path: string; scope: WorkspaceLinkScope; icon: typeof Users }[] = [
    { label: t('admin-page.users'), path: routes.admin.users(), scope: 'app', icon: Users },
    { label: t('admin-page.members'), path: routes.admin.members(), scope: 'app', icon: UserCheck },
    { label: t('sidebar.organizations-and-projects'), path: routes.admin.organizationsAndProjects(), scope: 'app', icon: Folders },
    { label: t('admin-page.tasks'), path: routes.admin.tasks(), scope: 'app', icon: CheckSquare },
  ]

  const itemClass = (active: boolean) =>
    cn(
      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-shell-foreground transition-colors hover:bg-shell-subtle',
      active && 'bg-shell-accent text-shell-accent-foreground hover:bg-shell-accent',
    )

  return (
    <aside className="relative flex h-full w-60 min-w-60 flex-col bg-shell text-shell-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('sidebar.collapse')}
            aria-controls="app-sidebar"
            aria-expanded
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-shell-subtle text-shell-foreground transition-colors hover:bg-shell-subtle-hover"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t('sidebar.collapse')}</TooltipContent>
      </Tooltip>

      <div className="border-b border-shell-line px-3 py-3">
        <AppLogo
          className="px-1"
          subtitle={isPlatformAdmin ? (
            <div className="mt-1 text-xs leading-tight text-shell-muted">
              {isPlatform ? t('sidebar.platform-console') : t('sidebar.user-area')}
            </div>
          ) : null}
        />

        {isPlatformAdmin && (
          <button
            type="button"
            onClick={() => navigate(href(isPlatform ? routes.dashboard() : routes.admin.list(), 'app'))}
            className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-lg bg-shell-subtle px-3 py-2 text-left text-sm hover:bg-shell-subtle-hover"
          >
            {isPlatform ? (
              <ArrowLeft className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldPlus className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {isPlatform ? t('sidebar.user-area') : t('sidebar.platform-console')}
            </span>
            {!isPlatform && <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {isPlatform
          ? platformItems.map((item) => (
              <NavLink
                key={item.path}
                to={href(item.path, item.scope)}
                className={({ isActive }) => itemClass(isActive)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="leading-tight">{item.label}</span>
              </NavLink>
            ))
          : clientItems.map((item) => (
              <NavLink
                key={item.path}
                to={href(item.path, item.scope)}
                end={item.end}
                className={({ isActive }) => itemClass(isActive)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="leading-tight">{item.label}</span>
              </NavLink>
            ))}
      </nav>

      <div className="border-t border-shell-line p-3">
        <div className="flex items-center gap-2">
          <UserMenu />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm leading-tight text-shell-foreground">{userName}</div>
            {roleLabel && (
              <div className="mt-0.5 truncate text-xs leading-tight text-shell-muted">{roleLabel}</div>
            )}
          </div>
          <ThemeMenu />
        </div>
      </div>
    </aside>
  )
}

function ThemeMenu() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-shell-foreground hover:bg-shell-subtle hover:text-shell-foreground">
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : theme === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4" />
          {t('sidebar.light-mode')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4" />
          {t('sidebar.dark-mode')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="h-4 w-4" />
          {t('sidebar.system-mode')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
