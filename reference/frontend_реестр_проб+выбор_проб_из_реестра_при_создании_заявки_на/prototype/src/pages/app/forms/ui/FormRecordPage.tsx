import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { readFormError, useGetFormRecordQuery } from '../../../../entities/form'
import { FormRecordView } from '../../../../features/form-fill/ui/FormRecordView'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { acceptReturnTo } from '../../../../entities/section'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { PageState, WorkPage } from '../../../../shared/ui/page'
import { FormsBoundary } from './FormsBoundary'

export function FormRecordPage() {
  return (
    <FormsBoundary>
      <RecordGate />
    </FormsBoundary>
  )
}

function RecordGate() {
  const { t } = useTranslation()
  const { formId = '', recordId = '' } = useParams()
  const href = useWorkspaceHref()
  const [search] = useSearchParams()
  const section = useWorkspaceSection('organization', { resource: 'form-records', action: 'read' })
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const record = useGetFormRecordQuery(
    { organizationId: organizationId ?? 0, formId, recordId },
    { skip: organizationId == null || formId === '' || recordId === '' },
  )
  const recordData = record.currentData && record.currentData.organizationId === organizationId && record.currentData.formId === formId && record.currentData.id === recordId
    ? record.currentData
    : null
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.refetch}
      />
    )
  }
  const sectionBack = acceptReturnTo(search.get('returnTo'), organizationId)
  const errorCode = readFormError(record.error).code
  return (
    <WorkPage width="form">
      <nav className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {sectionBack ? (
          <Link className="text-sm text-primary underline-offset-4 hover:underline" to={sectionBack}>{t('sections.back')}</Link>
        ) : null}
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to={href(routes.forms.records(formId), 'organization')}>{t('forms.back-records')}</Link>
      </nav>
      {record.isLoading && !recordData ? <PageState kind="loading" description={t('forms.loading')} /> : null}
      {record.isError && !recordData ? (
        <PageState
          kind="error"
          description={t(`forms.errors.${errorCode ?? 'not_found'}`, { defaultValue: t('forms.not-found') })}
          action={<Button type="button" variant="outline" onClick={() => void record.refetch()}>{t('forms.retry')}</Button>}
        />
      ) : null}
      {recordData ? <FormRecordView record={recordData} /> : null}
    </WorkPage>
  )
}
