import { useTranslation } from 'react-i18next'
import { Badge } from '../../../shared/ui/badge'
import { cn } from '../../../shared/lib/utils'
import type { PlatformRole } from '../../../shared/types/platform-role'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../shared/ui/tooltip'

const roleStyles: Record<PlatformRole, string> = {
  member: 'bg-muted text-muted-foreground border-transparent',
  admin: 'bg-primary/15 text-primary border-primary/20',
  super_admin: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
}

interface PlatformRoleBadgeProps {
  role: string
  className?: string
  showSuperAdminHint?: boolean
}

export function PlatformRoleBadge({
  role,
  className,
  showSuperAdminHint = false,
}: PlatformRoleBadgeProps) {
  const { t } = useTranslation()
  const normalized = (role in roleStyles ? role : 'member') as PlatformRole

  const badge = (
    <Badge variant="outline" className={cn('font-medium', roleStyles[normalized], className)}>
      {t(`admin-page.platform-roles.${normalized}`, { defaultValue: role })}
    </Badge>
  )

  if (normalized === 'super_admin' && showSuperAdminHint) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{t('admin-page.super-admin-code-only')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
