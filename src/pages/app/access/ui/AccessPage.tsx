import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { accessManagementMode, useGetSessionAccessQuery } from '../../../../entities/access'
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
  const [search, setSearch] = useSearchParams()
  const access = useGetSessionAccessQuery()
  const capable = access.data?.systemCapabilities.includes('corporate_superadmin') === true
  const area = capable && search.get('owner') === 'corporation' ? 'corporation' : 'organization'
  const setArea = (next: 'organization' | 'corporation') => {
    setSearch((prev) => {
      const copy = new URLSearchParams(prev)
      if (next === 'corporation') copy.set('owner', 'corporation')
      else copy.delete('owner')
      return copy
    }, { replace: true })
  }
  if (workspace.status === 'loading' || workspace.status === 'error' || workspace.status === 'forbidden' || workspace.status === 'not-found') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }
  if (workspace.status !== 'ready' && area !== 'corporation') {
    return <WorkspaceStatus status={workspace.status} reason={workspace.reason} onRetry={workspace.refetch} />
  }

  return (
    <AccessDesk
      area={area}
      organizationId={workspace.currentOrgId}
      canManageCorporation={capable}
      installationSuperadmin={capable}
      onArea={setArea}
      roleHref={(roleId) => roleLink(href, roleId, area)}
      userHref={(userId) => href(routes.settings.accessUser(userId), 'organization')}
    />
  )
}

function roleLink(href: (path: string, scope: 'organization') => string, roleId: string | 'new', owner: 'organization' | 'corporation'): string {
  const path = roleId === 'new' ? routes.settings.accessRoleNew() : routes.settings.accessRole(roleId)
  const base = href(path, 'organization')
  if (owner !== 'corporation') return base
  return `${base}${base.includes('?') ? '&' : '?'}owner=corporation`
}
