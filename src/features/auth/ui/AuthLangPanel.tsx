import { ChevronDown, Globe } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import type { LanguageType } from '../../../shared/types/enums'

export function AuthLangPanel({ tone = 'overlay' }: { tone?: 'overlay' | 'light' }) {
  const { i18n } = useTranslation()

  const [open, setOpen] = useState(false)
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'ru').slice(0, 2)

  const changeLanguage = async (lang: LanguageType) => {
    await i18n.changeLanguage(lang)
    setOpen(false)
  }

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={tone === 'light'
          ? 'flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--auth-muted)] hover:bg-white'
          : 'cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'}
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{currentLang.toUpperCase()}</span>

        <ChevronDown className="h-4 w-4" />

      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onClick={() => changeLanguage('ru')}
          className={currentLang === 'ru' ? 'bg-accent' : ''}
        >
          Русский
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className={currentLang === 'en' ? 'bg-accent' : ''}
        >
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}