import {
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  ShieldPlus,
  Sun,
  TowerControl
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { userApi } from '../../entities/user/model/userSlice'
import { routes } from '../../shared/lib/routes'
import { cn } from '../../shared/lib/utils'
import { Button } from '../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu'
import { LogoIcon } from '../../shared/ui/icons/LogoIcon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../shared/ui/tooltip'
import { useCallback } from 'react'
import { selectIsPlatformAdmin } from '../../entities/user/model/selectors'


export function Sidebar() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const isPlatformAdmin = useSelector(selectIsPlatformAdmin)

  const handleLogout = async () => {
    try {
      localStorage.clear()
      dispatch(userApi.util.resetApiState());
      toast.success(t('notice-list.log-out-success'))
      navigate(routes.login())
    } catch {
      toast.error(t('errors.error-logout'))
    }
  }

  const getIsActive = useCallback((path: string) => {
    if (path.includes(routes.scheduler.list())) {
      return location.pathname.includes(routes.scheduler.list())
    }
    if (path.includes(routes.admin.list())) {
      return location.pathname.includes(routes.admin.list())
    }
    if (path.includes(routes.settings.list())) {
      return location.pathname.includes(routes.settings.list())
    }
    if (path.includes(routes.geoMechanics.list())) {
      return location.pathname.includes(routes.geoMechanics.list())
    }
    return location.pathname === path
  },[location.pathname])

  const getLinkClassName = (path: string) => {
    return cn(`p-2 h-9 w-9 flex items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground ${getIsActive(path) ? 'bg-accent' : ''}`)
  }

  return (
    <TooltipProvider>
      <aside className="w-16 bg-[#364f6b] border-r border-border flex flex-col h-screen sticky top-0 overflow-hidden">
        <div className="p-2 border-b border-border flex justify-center">
          <h1 className="text-xl font-bold text-primary">
            <LogoIcon className="text-white" />
          </h1>
        </div>

        <nav className="flex-1 flex flex-col items-center py-6 space-y-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={routes.dashboard()}
                className={getLinkClassName(routes.dashboard())}
              >
                <LayoutDashboard className={`h-7 w-7 text-white`} />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.dashboard')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={routes.scheduler.list()}
                className={getLinkClassName(routes.scheduler.list())}
              >
                <FolderKanban className="h-7 w-7 text-white" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.scheduler')}</TooltipContent>
          </Tooltip>

          {isPlatformAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to={routes.admin.list()}
                  className={getLinkClassName(routes.admin.list())}
                >
                  <ShieldPlus className="h-7 w-7 text-white" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.admin-panel')}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={routes.settings.list()}
                className={getLinkClassName(routes.settings.list())}
              >
                <Settings className="h-9 w-9 text-white" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.settings')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={routes.geoMechanics.list()}
                className={getLinkClassName(routes.geoMechanics.list())}
              >
                <TowerControl className="h-9 w-9 text-white" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.geo-mechanics')}</TooltipContent>
          </Tooltip>
        </nav>

        <div className="p-4 border-t border-border flex flex-col items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="cursor-pointer p-2 h-9 w-9 flex items-center justify-center rounded-lg">
                {theme === 'dark' ? (
                  <Moon className="h-7 w-7 text-white" />
                ) : theme === 'light' ? (
                  <Sun className="h-7 w-7 text-white" />
                ) : (
                  <Monitor className="h-7 w-7" />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="h-4 w-4 mr-2 text-white" />
                {t('sidebar.light-mode')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="h-4 w-4 mr-2 text-white" />
                {t('sidebar.dark-mode')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="h-4 w-4 mr-2 text-white" />
                {t('sidebar.system-mode')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-accent rounded-lg cursor-pointer p-2 h-7 w-7 flex items-center justify-center"
                onClick={handleLogout}
              >
                <LogOut className="h-7 w-7 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.log-out')}</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}