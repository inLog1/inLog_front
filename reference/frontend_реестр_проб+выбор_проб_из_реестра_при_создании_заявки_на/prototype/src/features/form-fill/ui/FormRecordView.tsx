import { useTranslation } from 'react-i18next'
import { FormRenderer, hasInputFields, type FormRecordResponse } from '../../../entities/form'
import { PageState } from '../../../shared/ui/page'

export function FormRecordView({ record }: { record: FormRecordResponse }) {
  const { t, i18n } = useTranslation()
  const when = formatWhen(record.createdAt, i18n.language)
  const empty = !hasInputFields(record.schema)
  return (
    <article className="flex min-w-0 flex-col gap-4">
      <header className="min-w-0 space-y-2">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-foreground">{record.title}</h1>
        {record.description ? <p className="max-w-3xl whitespace-pre-wrap break-words text-sm text-muted-foreground">{record.description}</p> : null}
        <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('forms.record-date')}</dt>
            <dd className="text-foreground">{when}</dd>
          </div>
          <div className="flex min-w-0 gap-2">
            <dt className="text-muted-foreground">{t('forms.record-author')}</dt>
            <dd className="min-w-0 break-words text-foreground">{record.authorName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">{t('forms.column-version')}</dt>
            <dd>
              <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t('forms.version', { number: record.versionNumber })}
              </span>
            </dd>
          </div>
        </dl>
      </header>
      {empty ? <PageState kind="empty" description={t('forms.record-no-fields')} /> : (
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
          <FormRenderer schema={record.schema} values={record.values} presentation />
        </div>
      )}
    </article>
  )
}

function formatWhen(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
