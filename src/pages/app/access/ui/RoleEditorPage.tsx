import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { accessManagementMode } from '../../../../entities/access'
import {
  accessListHref,
  readAccessDeskScope,
  readStoredAccessOrganizationId,
} from '../../../../features/access-management/model/access-address'
import { RoleEditor } from '../../../../features/access-management/ui/RoleEditor'
import { PageState, WorkPage } from '../../../../shared/ui/page'

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
  const { t } = useTranslation()
  const params = useParams()
  const [search] = useSearchParams()
  const owner = readAccessDeskScope(search) === 'corporation' ? 'corporation' : 'organization'
  const organizationId = readStoredAccessOrganizationId()
  const roleId = params.roleId ?? null
  const listHref = accessListHref(owner === 'corporation' ? { owner: 'corporation' } : {})
  const usersHref = accessListHref(owner === 'corporation' ? { owner: 'corporation', tab: 'users' } : { tab: 'users' })

  if (owner === 'organization' && organizationId == null) {
    return (
      <WorkPage>
        <PageState kind="empty" description={t('access.choose-organization')} />
      </WorkPage>
    )
  }

  return (
    <RoleEditor
      roleId={roleId}
      owner={owner}
      organizationId={organizationId}
      listHref={listHref}
      usersHref={usersHref}
    />
  )
}
