import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { Card, CardContent } from '../../../shared/ui/card'

interface AdminSectionShellProps {
  title: string
  description: string
  actions?: ReactNode
  banner?: ReactNode
  toolbar?: ReactNode
  below?: ReactNode
  footer?: ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
}

export function AdminSectionShell({
  title,
  description,
  actions,
  banner,
  toolbar,
  below,
  footer,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  children,
}: AdminSectionShellProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>

      {banner}

      {toolbar}

      <Card className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        below ? 'max-h-[min(28rem,46vh)] shrink-0' : 'flex-1',
      )}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {isLoading && (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('admin-page.loading')}
            </div>
          )}

          {!isLoading && isEmpty && (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
              {emptyMessage ?? t('admin-page.no-data')}
            </div>
          )}

          {!isLoading && !isEmpty && (
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto">
              {children}
            </div>
          )}

          {footer}
        </CardContent>
      </Card>

      {below}
    </div>
  )
}
