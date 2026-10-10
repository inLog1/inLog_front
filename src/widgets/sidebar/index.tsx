import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Building2,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  Monitor,
  Moon,
  Bell,
  PanelLeftClose,
  PieChart,
  ShieldPlus,
  Sun,
  TowerControl,
  Table2,
  Users,
  Wrench,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { selectIsSuperAdmin, selectUser, selectUserFullName, selectUserRole } from '../../entities/user/model/selectors'
import { canAccessSection, type AppSection } from '../../shared/lib/available-features'
import { isPlatformConsolePath, routes } from '../../shared/lib/routes'
import { cn } from '../../shared/lib/utils'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { LogoIcon } from '../../shared/ui/icons/LogoIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../shared/ui/tooltip'
import { UserMenu } from '../header/ui/UserMenu'

interface SidebarProps {
  onCollapse: () => void
}

export function Sidebar({ onCollapse }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isSuperAdmin = useSelector(selectIsSuperAdmin)
  const user = useSelector(selectUser)
  const userName = useSelector(selectUserFullName) || user?.email
  const userRole = useSelector(selectUserRole)
  const roleLabel = userRole
    ? t(`admin-page.platform-roles.${userRole}`, { defaultValue: userRole })
    : null

  const isPlatform = isPlatformConsolePath(location.pathname)

  const clientItems = [
    { label: t('sidebar.dashboard'), href: routes.dashboard(), icon: LayoutDashboard, end: true },
    { label: t('admin-page.reports'), href: routes.admin.reports(), icon: PieChart, end: false },
    { label: t('sidebar.organizations'), href: routes.settings.organizations(), icon: Building2, end: false, section: 'organizations' as const },
    { label: t('sidebar.projects'), href: routes.settings.projects(), icon: FolderOpen, end: false, section: 'projects' as const },
    { label: t('sidebar.scheduler'), href: routes.scheduler.list(), icon: FolderKanban, end: false, section: 'scheduler' as const },
    { label: t('sidebar.geo-mechanics'), href: routes.geoMechanics.list(), icon: TowerControl, end: false },
    { label: t('header.notifications'), href: routes.settings.notifications(), icon: Bell, end: false, section: 'notifications' as const },
  ].filter((item) => isSectionVisible(user, item.section))

  const platformItems = [
    { label: t('admin-page.users'), href: routes.admin.users(), icon: Users, section: 'users' as const },
    { label: t('sidebar.organizations'), href: routes.admin.organizations(), icon: Building2, section: 'organizations' as const },
    { label: t('sidebar.projects'), href: routes.admin.projects(), icon: FolderOpen, section: 'projects' as const },
    { label: t('admin-page.tasks'), href: routes.admin.tasks(), icon: CheckSquare, section: 'tasks' as const },
    { label: t('admin-page.constructor'), href: routes.admin.constructor(), icon: Wrench, section: 'constructor' as const },
    { label: t('admin-page.catalog'), href: routes.admin.catalog(), icon: Table2 },
  ].filter((item) => isSectionVisible(user, item.section))

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
        <div className="flex items-center gap-2 px-1">
          <LogoIcon className="h-8 w-8 shrink-0 text-shell-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-none">inLog</div>
            {isSuperAdmin && (
              <div className="mt-1 text-xs leading-tight text-shell-muted">
                {isPlatform ? t('sidebar.platform-console') : t('sidebar.user-area')}
              </div>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => navigate(isPlatform ? routes.dashboard() : routes.admin.list())}
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
                key={item.href}
                to={item.href}
                className={({ isActive }) => itemClass(isActive)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="leading-tight">{item.label}</span>
              </NavLink>
            ))
          : clientItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
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

function isSectionVisible(
  user: Parameters<typeof canAccessSection>[0],
  section?: AppSection,
) {
  return !section || canAccessSection(user, section)
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
