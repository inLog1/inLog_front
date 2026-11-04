import { useTranslation } from 'react-i18next'
import { accessManagementMode } from '../../../../entities/access'
import { AccessDesk } from '../../../../features/access-management/ui/AccessDesk'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useEnsureOrgProjectParams } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { PageHeader, WorkPage } from '../../../../shared/ui/page'

const mode = accessManagementMode(import.meta.env.VITE_API_MODE)

export function AccessPage() {
  if (mode === 'unavailable') return <AccessUnavailable />
  return <MockAccessPage />
}

function AccessUnavailable() {
  const { t } = useTranslation()
  return (
    <WorkPage width="form">
      <PageHeader title={t('access.unavailable-title')} description={t('access.unavailable-body')} />
    </WorkPage>
  )
}

function MockAccessPage() {
  const workspace = useEnsureOrgProjectParams('organization')
  const href = useWorkspaceHref()
  if (workspace.status === 'loading' || workspace.status === 'error' || workspace.status === 'forbidden' || workspace.status === 'not-found') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }
  if (workspace.status !== 'ready') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }

  return (
    <AccessDesk
      organizationId={workspace.currentOrgId}
      roleHref={(roleId) => roleLink(href, roleId)}
      userHref={(userId) => href(routes.settings.accessUser(userId), 'organization')}
    />
  )
}

function roleLink(href: (path: string, scope: 'organization') => string, roleId: string | 'new'): string {
  const path = roleId === 'new' ? routes.settings.accessRoleNew() : routes.settings.accessRole(roleId)
  return href(path, 'organization')
}
