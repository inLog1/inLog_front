import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { ArrowRight, FileText, ListTodo, PieChart, Plus, Shield, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useGetSessionAccessQuery } from '../../entities/access'
import { selectUser } from '../../entities/user/model/selectors'
import { useEnsureOrgProjectParams } from '../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { workspaceHref, type WorkspaceLinkScope } from '../../features/org-project-selector/model/workspace-context'
import { requestCreateTask } from '../../features/tasks/model/compose-task'
import { sectionPath } from '../../entities/section'
import { sectionIcon } from '../../features/section-builder/ui/icons'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../shared/ui/page'
import {
  homeSetupCards,
  homeWorkCards,
  shouldLoadProjectTasks,
  showRequestsNotice,
  visibleQuickActions,
  type AppSection,
  type NavigationInput,
  type QuickActionId,
} from '../navigation/catalog'
import { useOrganizationSectionLinks } from '../navigation/use-section-navigation'
import { HomeProjectTasks } from './HomeProjectTasks'

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

const ACTION_ICONS: Record<QuickActionId, LucideIcon> = {
  'create-task': Plus,
  'open-constructor': Wrench,
  'build-report': PieChart,
}

const CARD_ICONS: Record<string, LucideIcon> = {
  tasks: ListTodo,
  reports: PieChart,
  forms: FileText,
  sections: FileText,
  access: Shield,
  constructor: Wrench,
}

function linkScope(section: AppSection): WorkspaceLinkScope {
  if (section.context === 'project') return 'project'
  if (section.context === 'organization') return 'organization'
  return 'app'
}

function primaryAction(actions: QuickActionId[]): QuickActionId | null {
  if (actions.includes('create-task')) return 'create-task'
  if (actions.includes('build-report')) return 'build-report'
  return actions[0] ?? null
}

function focusContext() {
  document.getElementById('workspace-context')?.querySelector<HTMLElement>('button')?.focus()
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
  const primary = primaryAction(actions)
  const work = homeWorkCards(navigation)
  const setup = homeSetupCards(navigation)
  const published = useOrganizationSectionLinks(navigation.organizationId, navigation.grants, navigation.enforceGrants)
  const loadTasks = shouldLoadProjectTasks(navigation)
  const owner = mockMode && ready && access.data?.systemCapabilities.includes('corporate_superadmin')
  const hasWork = work.length > 0 || published.items.length > 0
  const greeting = name ? t('home.greeting', { name }) : t('home.greeting-plain')

  return (
    <WorkPage>
      <PageHeader title={t('home.title')} description={greeting} />
      <ContextLine
        status={workspace.status}
        reason={workspace.reason}
        organization={organization?.fullName}
        project={project?.name}
        organizationReady={workspace.currentOrgId != null}
        projectReady={workspace.currentProjectId != null}
      />
      {owner ? (
        <p className="w-fit rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" role="status">
          {t('home.full-access')}
        </p>
      ) : null}
      {mockMode && access.isError ? (
        <PageState
          kind="error"
          description={t('workspace.access-error')}
          action={<Button type="button" variant="outline" size="sm" onClick={() => void access.refetch()}>{t('workspace.retry')}</Button>}
        />
      ) : null}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">{t('home.work-sections')}</h2>
          {navigation.grantsPending || published.pending ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('workspace.loading')}</p>
          ) : hasWork ? (
            <ul className="mt-3 flex flex-col gap-2">
              {published.items.map((section) => {
                const Icon = sectionIcon(section.iconKey)
                return (
                  <li key={section.id}>
                    <Link to={href(sectionPath(section.id), 'organization')} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{section.title}</span>
                        {section.description ? <span className="block truncate text-xs text-muted-foreground">{section.description}</span> : null}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary">{t('home.open')}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
                    </Link>
                  </li>
                )
              })}
              {work.map((section) => {
                const Icon = CARD_ICONS[section.id] ?? ListTodo
                return (
                  <li key={section.id}>
                    <Link to={href(section.path, linkScope(section))} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t(section.labelKey)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t(section.descriptionKey)}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary">{t('home.open')}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-foreground">{workspace.currentOrgId == null ? t('home.choose-organization') : t('home.no-work')}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={focusContext}>{t('home.choose-context')}</Button>
            </div>
          )}
        </section>

        {actions.length > 0 ? (
          <section className="min-w-0 rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold">{t('home.quick')}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {actions.map((action) => {
                const Icon = ACTION_ICONS[action]
                const main = action === primary
                return (
                  <Button
                    key={action}
                    type="button"
                    variant={main ? 'default' : 'outline'}
                    className="h-10 justify-start"
                    onClick={() => openAction(action, href, navigate)}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t(actionLabel(action))}
                  </Button>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>

      {showRequestsNotice(navigation) ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">{t('home.requests-title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('home.requests-body')}</p>
        </section>
      ) : null}

      {loadTasks && workspace.currentOrgId != null && workspace.currentProjectId != null ? (
        <HomeProjectTasks
          key={`${workspace.currentOrgId}:${workspace.currentProjectId}`}
          organizationId={workspace.currentOrgId}
          projectId={workspace.currentProjectId}
          tasksTo={href(routes.scheduler.tasks(), 'project')}
        />
      ) : null}

      {setup.length > 0 ? (
        <section className="min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground">{t('home.setup-tools')}</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {setup.map((section) => {
              const Icon = CARD_ICONS[section.id] ?? Wrench
              return (
                <li key={section.id}>
                  <Link to={href(section.path, linkScope(section))} className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{t(section.labelKey)}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </WorkPage>
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
  if (status === 'loading') return <p className="text-sm text-muted-foreground">{t('workspace.loading')}</p>
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
  if (!organizationReady || !organization) return null
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
