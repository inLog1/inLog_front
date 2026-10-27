import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { accessManagementMode } from '../../../../entities/access'
import { RoleEditor } from '../../../../features/access-management/ui/RoleEditor'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useEnsureOrgProjectParams, useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'

const mode = accessManagementMode(import.meta.env.VITE_API_MODE)

export function RoleEditorPage() {
  const { t } = useTranslation()
  if (mode === 'unavailable') {
    return (
      <div className="mx-auto max-w-xl p-6" role="status">
        <h2 className="text-lg font-semibold">{t('access.unavailable-title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.unavailable-body')}</p>
      </div>
    )
  }
  return <MockRoleEditor />
}

function MockRoleEditor() {
  const params = useParams()
  const [search] = useSearchParams()
  const workspace = useEnsureOrgProjectParams('organization')
  const href = useWorkspaceHref()
  const owner = search.get('owner') === 'corporation' ? 'corporation' : 'organization'
  const roleId = params.roleId ?? null
  const backHref = href(routes.settings.access(), 'organization')

  if (owner === 'organization' && workspace.status !== 'ready') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }

  return (
    <RoleEditor
      roleId={roleId}
      owner={owner}
      organizationId={workspace.currentOrgId}
      backHref={owner === 'corporation' ? `${backHref}${backHref.includes('?') ? '&' : '?'}owner=corporation` : backHref}
    />
  )
}
