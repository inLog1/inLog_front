import { useTranslation } from 'react-i18next'
import type { RequestStatus } from '../../../../entities/request'
import { cn } from '../../../../shared/lib/utils'

const STATUS_TONE: Record<RequestStatus, { chip: string; text: string }> = {
  draft: {
    chip: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
  },
  sent: {
    chip: 'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-primary',
    text: 'text-primary',
  },
  in_review: {
    chip: 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[color-mix(in_srgb,var(--primary)_78%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--primary)_78%,var(--foreground))]',
  },
  rework: {
    chip: 'bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
  },
  program_approval: {
    chip: 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
  },
  approved: {
    chip: 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]',
  },
  rejected: {
    chip: 'bg-[color-mix(in_srgb,var(--destructive)_16%,transparent)] text-destructive',
    text: 'text-destructive',
  },
  withdrawn: {
    chip: 'bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-destructive',
    text: 'text-destructive',
  },
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-left text-xs font-medium', STATUS_TONE[status].chip)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      <span className="min-w-0">{t(`requests.status.${status}`)}</span>
    </span>
  )
}

export function RequestStatusText({ status }: { status: RequestStatus }) {
  const { t } = useTranslation()
  return <span className={cn('font-medium', STATUS_TONE[status].text)}>{t(`requests.status.${status}`)}</span>
}
