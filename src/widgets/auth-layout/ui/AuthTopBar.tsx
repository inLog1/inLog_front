import type { ReactNode } from 'react'
import { AuthLangPanel } from '../../../features/auth/ui/AuthLangPanel'
import { AuthThemeMenu } from '../../../features/auth/ui/AuthThemeMenu'
import { AppLogo } from '../../../shared/ui/app-logo'

export function AuthTopBar({ end }: { end?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 bg-shell px-4 py-3 text-shell-foreground sm:px-8">
      <AppLogo />
      <div className="flex items-center gap-2">
        {end}
        <AuthThemeMenu />
        <AuthLangPanel tone="overlay" />
      </div>
    </header>
  )
}
