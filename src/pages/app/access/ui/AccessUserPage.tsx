import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { accessManagementMode } from '../../../../entities/access'
import { UserAccess } from '../../../../features/access-management/ui/UserAccess'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useEnsureOrgProjectParams, useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'

const mode = accessManagementMode(import.meta.env.VITE_API_MODE)

export function AccessUserPage() {
  if (mode === 'unavailable') return <AccessUserUnavailable />
  return <MockAccessUserPage />
}

function AccessUserUnavailable() {
  const { t } = useTranslation()
  return (
    <WorkPage width="form">
      <PageHeader title={t('access.unavailable-title')} description={t('access.unavailable-body')} />
    </WorkPage>
  )
}

function MockAccessUserPage() {
  const { t } = useTranslation()
  const params = useParams()
  const userId = params.userId && /^[1-9]\d*$/.test(params.userId) ? Number(params.userId) : null
  const workspace = useEnsureOrgProjectParams('organization')
  const href = useWorkspaceHref()
  if (workspace.status === 'loading' || workspace.status === 'error' || workspace.status === 'forbidden' || workspace.status === 'not-found') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }
  if (workspace.status !== 'ready') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }
  if (userId == null) {
    return (
      <WorkPage>
        <PageState kind="empty" title={t('access.user-missing-title')} description={t('access.errors.not-found')} />
      </WorkPage>
    )
  }
  const back = href(routes.settings.access(), 'organization')
  const backHref = `${back}${back.includes('?') ? '&' : '?'}tab=users`
  return <UserAccess key={userId} userId={userId} backHref={backHref} />
}
