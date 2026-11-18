import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/button'

interface AdminPaginationProps {
  count: number
  offset: number
  limit: number
  onChange: (offset: number) => void
  isLoading?: boolean
}

export function AdminPagination({
  count,
  offset,
  limit,
  onChange,
  isLoading = false,
}: AdminPaginationProps) {
  const { t } = useTranslation()
  const from = count === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, count)
  const canPrev = offset > 0
  const canNext = offset + limit < count

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t('admin-page.pagination.showing', { from, to, count })}
      </p>
      <div className="flex items-center gap-2">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrev || isLoading}
          onClick={() => onChange(Math.max(offset - limit, 0))}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('admin-page.pagination.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canNext || isLoading}
          onClick={() => onChange(offset + limit)}
        >
          {t('admin-page.pagination.next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
