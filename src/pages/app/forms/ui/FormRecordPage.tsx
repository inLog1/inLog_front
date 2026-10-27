import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useGetFormRecordQuery } from '../../../../entities/form'
import { FormRecordView } from '../../../../features/form-fill/ui/FormRecordView'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { acceptReturnTo } from '../../../../entities/section'
import { routes } from '../../../../shared/lib/routes'
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
    <div className="min-w-0">
      <div className="px-4 pt-4">
        {organizationId != null && acceptReturnTo(search.get('returnTo'), organizationId) ? (
          <Link className="mr-4 text-sm text-primary underline-offset-4 hover:underline" to={acceptReturnTo(search.get('returnTo'), organizationId) ?? ''}>{t('sections.back')}</Link>
        ) : null}
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to={href(routes.forms.records(formId), 'organization')}>{t('forms.back-records')}</Link>
      </div>
      {record.isLoading ? <p className="p-4 text-sm text-muted-foreground">{t('forms.loading')}</p> : null}
      {record.isError ? <p className="p-4 text-sm text-muted-foreground">{t('forms.not-found')}</p> : null}
      {record.data ? <FormRecordView record={record.data} /> : null}
    </div>
  )
}
