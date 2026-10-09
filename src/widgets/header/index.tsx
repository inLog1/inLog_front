import { ChevronDown, Languages, PanelLeftOpen } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { routes } from '../../shared/lib/routes'
import { useUpdateUserSettingsMutation } from '../../entities/user/model/userSlice'
import { errorsHandler } from '../../shared/lib/errors-handler'
import { cn } from '../../shared/lib/utils'
import type { LanguageType } from '../../shared/types/enums'
import { Button } from '../../shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../shared/ui/tooltip'
import { NotificationsMenu } from './ui/NotificationsMenu'

interface HeaderProps {
  sidebarCollapsed: boolean
  onExpandSidebar: () => void
}

export function Header({ sidebarCollapsed, onExpandSidebar }: HeaderProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const expandRef = useRef<HTMLButtonElement>(null)
  const wasCollapsed = useRef(sidebarCollapsed)

  useEffect(() => {
    if (sidebarCollapsed && !wasCollapsed.current) {
      expandRef.current?.focus({ preventScroll: true })
    }
    wasCollapsed.current = sidebarCollapsed
  }, [sidebarCollapsed])

  const getPageTitle = () => {
    const pathname = location.pathname

    if (pathname.includes('scheduler')) {
      return t('scheduler-page.title')
    }
    const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
    if (matches(routes.settings.organizations()) || matches(routes.admin.organizations())) {
      return t('sidebar.organizations')
    }
    if (matches(routes.settings.projects()) || matches(routes.admin.projects())) {
      return t('sidebar.projects')
    }
    if (pathname.includes('/settings/profile')) {
      return t('header.profile')
    }
    if (pathname.includes('settings')) {
      return t('settings-page.title')
    }
    if (pathname.includes('constructor')) {
      return t('admin-page.constructor')
    }
    if (pathname.includes('reports')) {
      return t('admin-page.reports')
    }
    if (pathname.includes('admin')) {
      return t('sidebar.platform-console')
    }
    if (pathname.includes('geo-mechanics')) {
      return t('geo-mechanics-page.geo-mechanics')
    }
    return t('header.dashboard')
   
  }

  return (
    <header className="app-header sticky top-0 z-30 flex h-16 items-center justify-between px-6">
      <div className="flex min-w-0 items-center">
        <div
          data-collapsed={sidebarCollapsed ? 'true' : 'false'}
          inert={!sidebarCollapsed}
          className="sidebar-reveal overflow-hidden"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={expandRef}
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-shell-header-foreground hover:bg-white/70 hover:text-shell-header-foreground focus-visible:ring-inset"
                aria-label={t('sidebar.expand')}
                aria-controls="app-sidebar"
                aria-expanded={false}
                onClick={onExpandSidebar}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('sidebar.expand')}</TooltipContent>
          </Tooltip>
        </div>
        <h1 className="truncate text-xl font-semibold tracking-tight text-shell-header-foreground">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center rounded-full border border-shell-toolbar-border bg-shell-toolbar p-1 text-shell-toolbar-foreground shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
        <LanguageSwitcher />
        <div className="mx-0.5 h-5 w-px bg-shell-divider" aria-hidden />
        <NotificationsMenu triggerClassName="h-8 w-8 rounded-full text-shell-toolbar-foreground hover:bg-shell-chip hover:text-shell-chip-foreground" />
      </div>
    </header>
  )
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [updateUserSettings] = useUpdateUserSettingsMutation()

  const currentLanguage = i18n.language === 'en' ? 'EN' : 'RU'

  const changeLanguage = async (lang: string) => {
    try {
      await updateUserSettings({ language: lang as LanguageType }).unwrap()
      i18n.changeLanguage(lang)
    } catch (error) {
      errorsHandler(error, t)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 gap-1.5 rounded-full bg-shell-chip px-2.5 text-sm font-semibold text-shell-chip-foreground shadow-none hover:bg-shell-chip-hover hover:text-shell-chip-foreground"
        >
          <Languages className="text-shell-chip-icon" />
          {currentLanguage}
          <ChevronDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem
          className={cn(currentLanguage === 'RU' && 'bg-shell-chip font-medium text-shell-chip-foreground focus:bg-shell-chip-hover focus:text-shell-chip-foreground')}
          onClick={() => changeLanguage('ru')}
        >
          <span className="w-7 text-xs font-semibold tracking-wide">RU</span>
          Русский
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(currentLanguage === 'EN' && 'bg-shell-chip font-medium text-shell-chip-foreground focus:bg-shell-chip-hover focus:text-shell-chip-foreground')}
          onClick={() => changeLanguage('en')}
        >
          <span className="w-7 text-xs font-semibold tracking-wide">EN</span>
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}