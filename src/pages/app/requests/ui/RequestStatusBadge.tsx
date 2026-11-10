import { useTranslation } from 'react-i18next'
import type { RequestStatus } from '../../../../entities/request'
import { Badge } from '../../../../shared/ui/badge'

function variant(status: RequestStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'rejected' || status === 'cancelled' || status === 'withdrawn') return 'destructive'
  if (status === 'completed' || status === 'in_review' || status === 'approved') return 'default'
  if (status === 'draft' || status === 'rework') return 'secondary'
  return 'outline'
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return (
    <Badge variant={variant(status)} className="px-2 py-0 text-xs font-medium shadow-none">
      {t(`requests.status.${status}`)}
    </Badge>
  )
}
