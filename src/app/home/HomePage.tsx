import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { ArrowRight, Building2, FileText, Folder, ListTodo, PieChart, Plus, Shield, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useGetSessionAccessQuery } from '../../entities/access'
import { selectUser, selectUserIsLoading } from '../../entities/user/model/selectors'
import { useEnsureOrgProjectParams } from '../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { workspaceHref, type WorkspaceLinkScope } from '../../features/org-project-selector/model/workspace-context'
import { requestCreateTask } from '../../features/tasks/model/compose-task'
import { sectionPath } from '../../entities/section'
import { sectionIcon } from '../../features/section-builder/ui/icons'
import { routes } from '../../shared/lib/routes'
import { cn } from '../../shared/lib/utils'
import { Button } from '../../shared/ui/button'
import { PageState } from '../../shared/ui/page'
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
import './home.css'

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

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg)]'

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

function tileClass(id: string): string {
  if (id === 'reports' || id === 'sections' || id === 'constructor') return 'home-tile-violet'
  if (id === 'tasks' || id === 'forms' || id === 'access') return 'home-tile-blue'
  return 'home-tile-neutral'
}

function focusContext() {
  document.getElementById('workspace-context')?.querySelector<HTMLElement>('button')?.focus()
}

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useSelector(selectUser)
  const userPending = useSelector(selectUserIsLoading)
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
  const sectionsPending = navigation.grantsPending || published.pending
  const hasWork = work.length > 0 || published.items.length > 0
  const greeting = name ? t('home.greeting', { name }) : t('home.greeting-plain')
  const organizationReady = workspace.currentOrgId != null
  const contextKind = welcomeContextKind(workspace.status, workspace.reason, organizationReady, Boolean(organization?.fullName))
  const workShowsChoose = !sectionsPending && !hasWork && contextKind === 'choose'

  return (
    <div className="home-refresh flex min-h-full w-full min-w-0 max-w-[1600px] flex-col gap-5 px-4 py-4 md:gap-6 md:px-6 md:py-6 xl:px-8">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">{t('home.title')}</h1>
        {owner ? (
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--home-border)] bg-[var(--home-card)] px-3 py-1.5 text-sm shadow-[0_1px_2px_rgb(20_35_60/0.05)]" role="status">
            <Shield className="h-4 w-4 text-primary" aria-hidden />
            {t('home.owner-badge')}
          </p>
        ) : null}
      </div>

      <section className="home-welcome" aria-label={t('home.workspace')}>
        <div className="home-welcome-art" aria-hidden />
        <div className="relative z-[1] flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:min-h-[168px] lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:py-7">
          <div className="min-w-0 flex-1 lg:max-w-[62%]">
            <h2 className="break-words text-[1.5rem] font-semibold leading-[1.2] sm:text-[1.75rem] lg:text-[2rem]">
              {greeting}
            </h2>
            <p className="mt-1 text-sm text-[#D7E6FA] sm:text-base">{t('home.workspace')}</p>
            {userPending && !name ? (
              <span className="mt-3 block h-3 w-40 rounded-full bg-white/25" role="status" aria-label={t('workspace.loading')} />
            ) : null}
            <WelcomeContext
              status={workspace.status}
              reason={workspace.reason}
              organization={organization?.fullName}
              project={project?.name}
              organizationReady={organizationReady}
              projectReady={workspace.currentProjectId != null}
              showChooseAction={contextKind === 'choose' && !workShowsChoose}
            />
          </div>
          {owner ? (
            <p className="max-w-xs text-sm leading-snug text-[#D7E6FA] lg:border-l lg:border-white/40 lg:pl-5">
              {t('home.full-access')}
            </p>
          ) : null}
        </div>
      </section>

      {mockMode && access.isError ? (
        <PageState
          kind="error"
          description={t('workspace.access-error')}
          action={<Button type="button" variant="outline" size="sm" onClick={() => void access.refetch()}>{t('workspace.retry')}</Button>}
        />
      ) : null}

      <div className={cn(
        'grid min-w-0 items-start gap-4',
        actions.length > 0 && 'min-[1200px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
      )}>
        <section className="min-w-0">
          <h2 className="text-base font-semibold">{t('home.work-sections')}</h2>
          <div className="mt-3">
          {sectionsPending ? (
            <div className="home-surface p-4" role="status">
              <p className="text-sm text-[var(--home-secondary)]">{t('workspace.loading')}</p>
            </div>
          ) : hasWork ? (
            <ul className={cn('grid gap-3', (published.items.length + work.length) > 1 && 'min-[900px]:grid-cols-2')}>
              {published.items.map((section) => (
                <li key={section.id} className="min-w-0">
                  <WorkCard
                    to={href(sectionPath(section.id), 'organization')}
                    icon={sectionIcon(section.iconKey)}
                    tile="home-tile-neutral"
                    title={section.title}
                    description={section.description}
                    action={t('home.open')}
                  />
                </li>
              ))}
              {work.map((section) => (
                <li key={section.id} className="min-w-0">
                  <WorkCard
                    to={href(section.path, linkScope(section))}
                    icon={CARD_ICONS[section.id] ?? ListTodo}
                    tile={tileClass(section.id)}
                    title={t(section.labelKey)}
                    description={t(section.descriptionKey)}
                    action={t('home.open')}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="home-surface p-4">
              <p className="text-sm">{workspace.currentOrgId == null ? t('home.choose-organization') : t('home.no-work')}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={focusContext}>{t('home.choose-context')}</Button>
            </div>
          )}
          </div>
        </section>

        {actions.length > 0 ? (
          <section className="home-surface min-w-0 self-start p-4 min-[1200px]:mt-9">
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
                    className={cn(
                      'h-auto min-h-11 w-full justify-between whitespace-normal rounded-xl px-3.5 py-2.5 text-left',
                      !main && 'border-[var(--home-border)] bg-[var(--home-card)] text-[var(--home-title)] hover:bg-[var(--home-bg)] hover:text-[var(--home-title)]',
                    )}
                    onClick={() => openAction(action, href, navigate)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="break-words">{t(actionLabel(action))}</span>
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>

      {showRequestsNotice(navigation) ? (
        <section className="home-surface p-4">
          <h2 className="font-medium">{t('home.requests-title')}</h2>
          <p className="mt-1 text-sm text-[var(--home-secondary)]">{t('home.requests-body')}</p>
        </section>
      ) : null}

      {loadTasks && workspace.currentOrgId != null && workspace.currentProjectId != null ? (
        <HomeProjectTasks
          key={`${workspace.currentOrgId}:${workspace.currentProjectId}`}
          organizationId={workspace.currentOrgId}
          projectId={workspace.currentProjectId}
          projectName={project?.name}
          tasksTo={href(routes.scheduler.tasks(), 'project')}
        />
      ) : null}

      {setup.length > 0 ? (
        <section className="min-w-0">
          <h2 className="text-base font-semibold">{t('home.setup-tools')}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {setup.map((section) => {
              const Icon = CARD_ICONS[section.id] ?? Wrench
              return (
                <li key={section.id} className="min-w-0">
                  <Link
                    to={href(section.path, linkScope(section))}
                    className={cn('home-surface flex min-w-0 items-start gap-3 p-3.5 no-underline', focusRing)}
                  >
                    <span className={cn('home-tile home-tile-sm', tileClass(section.id))}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="break-words font-medium leading-snug">{t(section.labelKey)}</span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--home-secondary)]" aria-hidden />
                      </span>
                      <span className="mt-1 block break-words text-sm leading-snug text-[var(--home-secondary)]">{t(section.descriptionKey)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function WorkCard({
  to,
  icon: Icon,
  tile,
  title,
  description,
  action,
}: {
  to: string
  icon: LucideIcon
  tile: string
  title: string
  description?: string
  action: string
}) {
  return (
    <Link to={to} className={cn('home-surface flex h-full min-w-0 flex-col p-4 no-underline', focusRing)}>
      <span className="flex min-w-0 items-start gap-3">
        <span className={cn('home-tile', tile)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-base font-semibold leading-snug">{title}</span>
          {description ? <span className="mt-1 block break-words text-sm leading-snug text-[var(--home-secondary)]">{description}</span> : null}
        </span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
        {action}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  )
}

function welcomeContextKind(
  status: string,
  reason: string | null,
  organizationReady: boolean,
  hasOrganizationName: boolean,
): 'message' | 'choose' | 'ready' {
  if (status === 'loading') return 'message'
  if (status === 'empty' && reason) return 'message'
  if (status === 'error' || status === 'forbidden' || status === 'not-found') return 'message'
  if (!organizationReady || !hasOrganizationName) return 'choose'
  return 'ready'
}

function WelcomeContext({
  status,
  reason,
  organization,
  project,
  organizationReady,
  projectReady,
  showChooseAction,
}: {
  status: string
  reason: string | null
  organization?: string
  project?: string
  organizationReady: boolean
  projectReady: boolean
  showChooseAction: boolean
}) {
  const { t } = useTranslation()
  const message = contextMessage(status, reason, t)
  if (message) {
    return <p className="mt-4 max-w-2xl break-words text-sm leading-relaxed text-white">{message}</p>
  }
  if (!organizationReady || !organization) {
    return (
      <div className="mt-4">
        <p className="max-w-2xl break-words text-sm leading-relaxed text-white">{t('home.choose-organization')}</p>
        {showChooseAction ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-white/50 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white"
            onClick={focusContext}
          >
            {t('home.choose-context')}
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white ring-1 ring-inset ring-white/25">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="break-words">{organization}</span>
      </span>
      {projectReady && project ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white ring-1 ring-inset ring-white/25">
          <Folder className="h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">{project}</span>
        </span>
      ) : (
        <span className="inline-flex max-w-full items-center rounded-full bg-white/10 px-3 py-1.5 text-sm text-[#D7E6FA] ring-1 ring-inset ring-white/20">
          {t('home.choose-project')}
        </span>
      )}
    </div>
  )
}

function contextMessage(
  status: string,
  reason: string | null,
  t: (key: string) => string,
): string | null {
  if (status === 'loading') return t('workspace.loading')
  if (status === 'empty' && reason) {
    const key = reason === 'organizations-empty'
      ? 'workspace.empty-organizations'
      : reason === 'projects-empty'
        ? 'workspace.empty-projects'
        : `workspace.${reason}`
    return t(key)
  }
  if (status === 'error' || status === 'forbidden' || status === 'not-found') {
    return t(reason ? `workspace.${reason}` : 'workspace.access-error')
  }
  return null
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
