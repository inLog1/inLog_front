import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { LogoIcon } from './icons/LogoIcon'

export function AppLogo({ subtitle, className }: { subtitle?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2 text-shell-foreground', className)}>
      <LogoIcon className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-none">inLog</div>
        {subtitle}
      </div>
    </div>
  )
}
