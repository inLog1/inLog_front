import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { ScrollArea } from '../../../shared/ui/scroll-area'

interface AdminSectionShellProps {
  title: string
  description: string
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
  toolbar,
  footer,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  children,
}: AdminSectionShellProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {toolbar}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
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
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="min-w-max">{children}</div>
            </ScrollArea>
          )}

          {footer}
        </CardContent>
      </Card>
    </div>
  )
}
