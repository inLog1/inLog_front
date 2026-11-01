import { useTranslation } from 'react-i18next'
import { canOpenProjectManagement } from '../navigation/catalog'
import { useNavigationInput } from '../navigation/use-navigation'
import ProjectsPage from '../../pages/dashboard/settings/projects'
import { useGetSessionAccessQuery } from '../../entities/access'
import { Button } from '../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../shared/ui/page'

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

export function ProjectManagementRoute() {
  const { t } = useTranslation()
  const navigation = useNavigationInput()
  const access = useGetSessionAccessQuery(undefined, { skip: !mockMode })
  if (!mockMode) return <ProjectsPage />
  if (access.isError && !access.data) {
    return (
      <WorkPage>
        <PageHeader title={t('nav.projects')} />
        <PageState
          kind="error"
          description={t('workspace.access-error')}
          action={<Button type="button" variant="outline" onClick={() => void access.refetch()}>{t('workspace.retry')}</Button>}
        />
      </WorkPage>
    )
  }
  if (navigation.grantsPending || access.data?.accessState !== 'ready') {
    return (
      <WorkPage>
        <PageHeader title={t('nav.projects')} />
        <PageState kind="loading" description={t('workspace.loading')} />
      </WorkPage>
    )
  }
  if (!canOpenProjectManagement(navigation)) {
    return (
      <WorkPage>
        <PageHeader title={t('nav.projects')} />
        <PageState kind="empty" description={t('settings-page.projects-denied')} />
      </WorkPage>
    )
  }
  return <ProjectsPage />
}
