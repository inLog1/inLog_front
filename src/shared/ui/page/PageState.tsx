import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function PageState({
  kind,
  title,
  description,
  action,
}: {
  kind: 'loading' | 'empty' | 'error'
  title?: string
  description: string
  action?: ReactNode
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card px-4 py-5"
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
    >
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      <p className={cn('text-sm text-foreground', title && 'mt-1')}>{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
