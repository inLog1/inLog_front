import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../../../shared/ui/card'

interface AdminSectionShellProps {
  title: string
  description: string
  actions?: ReactNode
  banner?: ReactNode
  toolbar?: ReactNode
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
  footer,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  children,
}: AdminSectionShellProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto sm:gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="shrink-0 [&_button]:w-full sm:[&_button]:w-auto">{actions}</div>}
      </div>

      {banner}

      {toolbar}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
    </div>
  )
}
