import type { ReactNode } from 'react'
import { AuthLangPanel } from '../../../features/auth/ui/AuthLangPanel'
import { AuthThemeMenu } from '../../../features/auth/ui/AuthThemeMenu'
import { AppLogo } from '../../../shared/ui/app-logo'

type AuthTopBarProps = {
  end?: ReactNode
  /** Как шапка авторизованной зоны (белая app-header), иначе тёмная полоса shell. */
  variant?: 'shell' | 'workspace'
}

export function AuthTopBar({ end, variant = 'shell' }: AuthTopBarProps) {
  const workspace = variant === 'workspace'

  return (
    <header
      className={
        workspace
          ? 'app-header flex h-16 items-center justify-between gap-4 px-4 sm:px-8'
          : 'flex items-center justify-between gap-4 bg-shell px-4 py-3 text-shell-foreground sm:px-8'
      }
    >
      <AppLogo className={workspace ? 'text-shell-header-foreground' : undefined} />
      <div className="flex items-center gap-2">
        {end}
        <AuthThemeMenu variant={variant} />
        <AuthLangPanel tone={workspace ? 'light' : 'overlay'} />
      </div>
    </header>
  )
}
