import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { accessManagementMode } from '../../../../entities/access'
import { accessUserBackHref } from '../../../../features/access-management/model/access-address'
import { UserAccess } from '../../../../features/access-management/ui/UserAccess'
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
  if (userId == null) {
    return (
      <WorkPage>
        <PageState kind="empty" title={t('access.user-missing-title')} description={t('access.errors.not-found')} />
      </WorkPage>
    )
  }
  return <UserAccess key={userId} userId={userId} backHref={accessUserBackHref()} />
}
