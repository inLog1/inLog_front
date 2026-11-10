import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { accessManagementMode } from '../../../../entities/access'
import { accessRoleHref, readAccessDeskScope } from '../../../../features/access-management/model/access-address'
import { useAccessOrganizationFilter } from '../../../../features/access-management/model/useAccessOrganizationFilter'
import { AccessDesk } from '../../../../features/access-management/ui/AccessDesk'
import { routes } from '../../../../shared/lib/routes'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'

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
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const deskScope = readAccessDeskScope(searchParams)
  const filter = useAccessOrganizationFilter()

  if (filter.loading) {
    return <WorkPage><PageState kind="loading" description={t('access.loading')} /></WorkPage>
  }
  if (filter.error) {
    return (
      <WorkPage>
        <PageState
          kind="error"
          description={t('workspace.organizations-error')}
          action={<button type="button" className="text-sm underline" onClick={filter.refetch}>{t('workspace.retry')}</button>}
        />
      </WorkPage>
    )
  }
  if (deskScope === 'organization' && filter.organizations.length === 0) {
    return (
      <WorkPage>
        <PageState kind="empty" description={t('access.choose-organization')} />
      </WorkPage>
    )
  }

  const organizationOptions = filter.organizations.map((item) => ({
    id: item.id,
    shortName: item.fullName?.trim() || item.shortName?.trim() || `#${item.id}`,
  }))

  return (
    <AccessDesk
      deskScope={deskScope}
      organizationId={filter.organizationId}
      organizationOptions={organizationOptions}
      onOrganizationChange={filter.selectOrganization}
      roleHref={(roleId) => accessRoleHref(roleId, deskScope)}
      userHref={(userId) => routes.settings.accessUser(userId)}
    />
  )
}
