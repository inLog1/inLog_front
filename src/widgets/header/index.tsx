import { ChevronDown, Languages, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUpdateUserSettingsMutation } from '../../entities/user/model/userSlice'
import { OrgProjectSelector } from '../../features/org-project-selector'
import { errorsHandler } from '../../shared/lib/errors-handler'
import { cn } from '../../shared/lib/utils'
import type { LanguageType } from '../../shared/types/enums'
import { Button } from '../../shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../shared/ui/dropdown-menu'
import { UserMenu } from './ui/UserMenu'
import { NotificationsMenu } from './ui/NotificationsMenu'

type HeaderProps = {
  title: string
  showProject: boolean
  menuOpen: boolean
  onOpenMenu: () => void
}

export function Header({ title, showProject, menuOpen, onOpenMenu }: HeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="app-header z-30 flex min-h-14 w-full min-w-0 flex-wrap items-center gap-2 px-3 py-2 md:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-shell-header-foreground hover:bg-white/70 hover:text-shell-header-foreground md:hidden"
          aria-label={t('shell.open-menu')}
          aria-controls="app-sidebar"
          aria-expanded={menuOpen}
          onClick={onOpenMenu}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold tracking-tight text-shell-header-foreground">{title}</h1>
      </div>

      <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-end gap-2">
        <OrgProjectSelector
          appearance="toolbar"
          persist={false}
          type={showProject ? 'all' : 'organization'}
        />
        <div className="flex shrink-0 items-center rounded-full border border-shell-toolbar-border bg-shell-toolbar p-1 text-shell-toolbar-foreground">
          <LanguageSwitcher />
          <div className="mx-0.5 h-5 w-px bg-shell-divider" aria-hidden />
          <NotificationsMenu triggerClassName="h-8 w-8 rounded-full text-shell-toolbar-foreground hover:bg-shell-chip hover:text-shell-chip-foreground" />
        </div>
        <UserMenu />
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
          aria-label={t('shell.language')}
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
