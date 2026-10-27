import { useTranslation } from 'react-i18next'
import { FormRenderer, type FormRecordResponse } from '../../../entities/form'
import { PageHeader, WorkPage } from '../../../shared/ui/page'

export function FormRecordView({ record }: { record: FormRecordResponse }) {
  const { t, i18n } = useTranslation()
  const when = formatWhen(record.createdAt, i18n.language)
  return (
    <WorkPage width="form">
      <PageHeader
        title={record.title}
        description={record.description || undefined}
      />
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.record-date')}</dt><dd className="text-foreground">{when}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.record-author')}</dt><dd className="text-foreground">{record.authorName}</dd></div>
        <div className="flex gap-2"><dt className="text-muted-foreground">{t('forms.record-version', { number: record.versionNumber })}</dt><dd /></div>
      </dl>
      <FormRenderer schema={record.schema} values={record.values} presentation />
    </WorkPage>
  )
}

function formatWhen(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
