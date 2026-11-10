import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../../../shared/ui/card'
import { Label } from '../../../../../shared/ui/label'

export function DraftSection({
  id,
  index,
  title,
  description,
  action,
  children,
}: {
  id: string
  index: number
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">{index}</span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5">{children}</div>
    </Card>
  )
}

export function DraftField({
  label,
  hint,
  required = false,
  field,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  field?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="relative min-w-0 space-y-2" data-field={field}>
      <Label>
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> {t('requests.draft.required')}</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
