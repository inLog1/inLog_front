import { createElement } from 'react'
import { PanelsTopLeft, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { sectionIcon } from './icons'

/** Decorative sample of the current buffer. It does not load rows or follow links. */
export function SectionAppearancePreview({
  title,
  description,
  iconKey,
  showCreate,
  createLabel,
}: {
  title: string
  description: string
  iconKey: string
  showCreate: boolean
  createLabel: string
}) {
  const { t } = useTranslation()
  const displayTitle = title.trim() ? title : t('sections.appearance-placeholder')
  const displayLabel = createLabel.trim() ? createLabel : t('sections.add-record')
  return (
    <aside className="min-w-0 rounded-[14px] border border-border bg-card p-4 text-card-foreground sm:p-5" aria-label={t('sections.appearance')}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
          <PanelsTopLeft className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t('sections.appearance')}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('sections.appearance-hint')}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-3" aria-hidden="true">
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">{t('sections.appearance-group')}</p>
        <div className="flex min-w-0 items-center gap-2 rounded-md border-l-2 border-primary bg-primary/10 px-2 py-2">
          {createElement(sectionIcon(iconKey), { className: 'size-4 shrink-0 text-primary' })}
          <span className="min-w-0 break-words text-sm font-medium text-foreground">{displayTitle}</span>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              {createElement(sectionIcon(iconKey), { className: 'size-4' })}
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-foreground">{displayTitle}</p>
              {description.trim() ? <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {showCreate ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-1 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary">
              <Plus className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{displayLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t('sections.appearance-note')}</p>
    </aside>
  )
}
