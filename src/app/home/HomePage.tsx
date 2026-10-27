import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useGetSessionAccessQuery } from '../../entities/access'
import { selectUser } from '../../entities/user/model/selectors'
import { useEnsureOrgProjectParams } from '../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { workspaceHref, type WorkspaceLinkScope } from '../../features/org-project-selector/model/workspace-context'
import { requestCreateTask } from '../../features/tasks/model/compose-task'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'
import {
  homeCards,
  shouldLoadProjectTasks,
  showRequestsNotice,
  visibleQuickActions,
  type AppSection,
  type NavigationInput,
  type QuickActionId,
} from '../navigation/catalog'
import { HomeProjectTasks } from './HomeProjectTasks'

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

function linkScope(section: AppSection): WorkspaceLinkScope {
  if (section.context === 'project') return 'project'
  if (section.context === 'organization') return 'organization'
  return 'app'
}

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSelector(selectUser)
  const workspace = useEnsureOrgProjectParams('all')
  const access = useGetSessionAccessQuery(undefined, { skip: !mockMode })
  const ready = access.data?.accessState === 'ready'
  const navigation: NavigationInput = {
    enforceGrants: mockMode,
    grantsPending: mockMode && !access.isError && !ready,
    grants: ready && access.data ? access.data.effectiveGrants : [],
    systemCapabilities: ready && access.data ? access.data.systemCapabilities : [],
    organizationId: workspace.currentOrgId,
    projectId: workspace.currentProjectId,
  }
  const explicitProject = workspace.currentProjectId != null
    && workspace.searchParams.get('project') === String(workspace.currentProjectId)
  const href = (pathname: string, scope: WorkspaceLinkScope) => workspaceHref(pathname, scope, {
    organizationId: workspace.currentOrgId,
    projectId: workspace.currentProjectId,
  }, explicitProject)
  const organization = workspace.organizations.find((item) => item.id === workspace.currentOrgId)
  const project = workspace.projects.find((item) => item.id === workspace.currentProjectId)
  const name = user?.name?.trim()
  const actions = visibleQuickActions(navigation)
  const cards = homeCards(navigation)
  const loadTasks = shouldLoadProjectTasks(navigation)

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t('home.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {name ? t('home.greeting', { name }) : t('home.greeting-plain')}
        </p>
        <ContextLine
          status={workspace.status}
          reason={workspace.reason}
          organization={organization?.fullName}
          project={project?.name}
          organizationReady={workspace.currentOrgId != null}
          projectReady={workspace.currentProjectId != null}
        />
      </header>

      {mockMode && access.isError && (
        <div className="rounded-xl border border-border bg-card p-4" role="alert">
          <p className="text-sm text-muted-foreground">{t('workspace.access-error')}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void access.refetch()}>
            {t('workspace.retry')}
          </Button>
        </div>
      )}

      {actions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t('home.quick')}</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                type="button"
                onClick={() => openAction(action, href, navigate)}
              >
                {t(actionLabel(action))}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">{t('home.sections')}</h3>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('home.no-sections')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((section) => (
              <Link
                key={section.id}
                to={href(section.path, linkScope(section))}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="font-medium">{t(section.labelKey)}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t(section.descriptionKey)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showRequestsNotice(navigation) && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">{t('home.requests-title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('home.requests-body')}</p>
        </section>
      )}

      {loadTasks && workspace.currentOrgId != null && workspace.currentProjectId != null && (
        <HomeProjectTasks
          key={`${workspace.currentOrgId}:${workspace.currentProjectId}`}
          organizationId={workspace.currentOrgId}
          projectId={workspace.currentProjectId}
        />
      )}
    </div>
  )
}

function ContextLine({
  status,
  reason,
  organization,
  project,
  organizationReady,
  projectReady,
}: {
  status: string
  reason: string | null
  organization?: string
  project?: string
  organizationReady: boolean
  projectReady: boolean
}) {
  const { t } = useTranslation()
  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">{t('workspace.loading')}</p>
  }
  if (status === 'empty' && reason) {
    const key = reason === 'organizations-empty'
      ? 'workspace.empty-organizations'
      : reason === 'projects-empty'
        ? 'workspace.empty-projects'
        : `workspace.${reason}`
    return <p className="text-sm text-foreground">{t(key)}</p>
  }
  if (status === 'error' || status === 'forbidden' || status === 'not-found') {
    const key = reason ? `workspace.${reason}` : 'workspace.access-error'
    return <p className="text-sm text-foreground">{t(key)}</p>
  }
  if (!organizationReady || !organization) {
    return <p className="text-sm text-foreground">{t('home.choose-organization')}</p>
  }
  return (
    <p className="text-sm text-foreground">
      <span className="text-muted-foreground">{t('home.organization')}: </span>
      {organization}
      {projectReady && project ? (
        <>
          <span className="text-muted-foreground"> · {t('home.project')}: </span>
          {project}
        </>
      ) : (
        <span className="text-muted-foreground"> · {t('home.choose-project')}</span>
      )}
    </p>
  )
}

function actionLabel(action: QuickActionId): string {
  if (action === 'create-task') return 'home.create-task'
  if (action === 'open-constructor') return 'home.open-constructor'
  return 'home.build-report'
}

function openAction(
  action: QuickActionId,
  href: (pathname: string, scope: WorkspaceLinkScope) => string,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (action === 'create-task') {
    requestCreateTask()
    navigate(href(routes.scheduler.tasks(), 'project'))
    return
  }
  if (action === 'open-constructor') {
    navigate(href(routes.admin.constructor(), 'organization'))
    return
  }
  navigate(href(routes.admin.reports(), 'organization'))
}
