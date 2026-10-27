import { useTranslation } from 'react-i18next'
import { FormRenderer, type FormRecordResponse } from '../../../entities/form'

export function FormRecordView({ record }: { record: FormRecordResponse }) {
  const { t, i18n } = useTranslation()
  const when = formatWhen(record.createdAt, i18n.language)
  return (
    <article className="mx-auto flex min-w-0 max-w-2xl flex-col gap-4 p-4">
      <header>
        <h2 className="text-lg font-semibold">{record.title}</h2>
        {record.description ? <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{record.description}</p> : null}
        <dl className="mt-3 grid gap-1 text-sm">
          <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.record-date')}</dt><dd>{when}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.record-author')}</dt><dd>{record.authorName}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.version', { number: record.versionNumber })}</dt><dd /></div>
        </dl>
      </header>
      <FormRenderer schema={record.schema} values={record.values} readOnly />
    </article>
  )
}

function formatWhen(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
