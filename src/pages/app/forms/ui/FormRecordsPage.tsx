import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useGetFormRecordsQuery } from '../../../../entities/form'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { FormsBoundary } from './FormsBoundary'

export function FormRecordsPage() {
  return (
    <FormsBoundary>
      <RecordsGate />
    </FormsBoundary>
  )
}

function RecordsGate() {
  const { t, i18n } = useTranslation()
  const { formId = '' } = useParams()
  const href = useWorkspaceHref()
  const section = useWorkspaceSection('organization', { resource: 'form-records', action: 'read' })
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const records = useGetFormRecordsQuery(
    { organizationId: organizationId ?? 0, formId },
    { skip: organizationId == null || formId === '' },
  )
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.refetch}
      />
    )
  }
  return (
    <WorkPage width="form">
      <PageHeader
        title={t('forms.records-title')}
        breadcrumbs={[{ label: t('nav.forms'), to: href(routes.forms.list(), 'organization') }, { label: t('forms.records-title') }]}
      />
      {records.isLoading ? <PageState kind="loading" description={t('forms.loading')} /> : null}
      {records.isError ? <PageState kind="error" description={t('forms.not-found')} /> : null}
      {records.data && records.data.records.length === 0 ? <PageState kind="empty" description={t('forms.records-empty')} /> : null}
      {records.data && records.data.records.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {records.data.records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>{formatWhen(record.createdAt, i18n.language)}</span>
              <span>{record.authorName}</span>
              <span>{t('forms.record-version', { number: record.versionNumber })}</span>
              <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.record(formId, record.id), 'organization')}>{t('forms.open-record')}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </WorkPage>
  )
}

function formatWhen(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
