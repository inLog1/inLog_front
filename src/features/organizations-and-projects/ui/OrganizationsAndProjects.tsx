import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Building2, FolderOpen, Loader2, MapPin, Pencil, Plus } from 'lucide-react'
import { useGetOrganizationDirectoryQuery, useGetOrganizationsQuery } from '../../../entities/organization/model/organizationSlice'
import type { DirectoryOrganization, DirectoryProject, OrganizationDirectory } from '../../../entities/organization/model/directory'
import { useGetProjectsQuery } from '../../../entities/project/model/projectSlice'
import { getApiMode } from '../../../shared/config/runtime'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { cn } from '../../../shared/lib/utils'
import { CreateOrganizationDialog } from './CreateOrganizationDialog'
import { CreateProjectDialog } from './CreateProjectDialog'
import { EditOrganizationDialog } from './EditOrganizationDialog'
import { EditProjectDialog } from './EditProjectDialog'
import { DIRECTORY_FOCUS_PARAM, resolveDirectoryFocus } from '../model/directory-focus'

function initials(name?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? []
  if (!parts.length) return '—'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function OrganizationsAndProjects() {
  const mock = getApiMode() === 'mock'
  if (mock) return <MockDirectory />
  return <LiveDirectory />
}

function MockDirectory() {
  const { t } = useTranslation()
  const directory = useGetOrganizationDirectoryQuery()
  const view = directory.currentData
  if (directory.isLoading && !view) {
    return <LoadingState label={t('workspace.loading')} />
  }
  if (directory.isError || !view) {
    return <ErrorState onRetry={() => void directory.refetch()} />
  }
  return <DirectoryView directory={view} />
}

function DirectoryView({ directory }: { directory: OrganizationDirectory }) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [createOrg, setCreateOrg] = useState(false)
  const [createProjectFor, setCreateProjectFor] = useState<number | null>(null)
  const [editOrganization, setEditOrganization] = useState<DirectoryOrganization | null>(null)
  const [editProject, setEditProject] = useState<DirectoryProject | null>(null)
  const allowedIds = useMemo(() => {
    const ids = new Set<number>()
    for (const organization of directory.organizations) ids.add(organization.id)
    for (const target of directory.projectCreateTargets) ids.add(target.id)
    for (const project of directory.projects) ids.add(project.organizationId)
    return [...ids]
  }, [directory])
  const focus = resolveDirectoryFocus(searchParams.get(DIRECTORY_FOCUS_PARAM), allowedIds)
  const needle = query.trim().toLowerCase()
  const organizations = directory.organizations.filter((organization) =>
    !needle || organization.fullName.toLowerCase().includes(needle) || organization.shortName.toLowerCase().includes(needle),
  )
  const selected = focus.status === 'open'
    ? directory.organizations.find((organization) => organization.id === focus.organizationId) ?? null
    : null
  const selectedTarget = focus.status === 'open'
    ? directory.projectCreateTargets.find((target) => target.id === focus.organizationId) ?? null
    : null
  const selectedProjects = focus.status === 'open'
    ? directory.projects.filter((project) => project.organizationId === focus.organizationId && (
      !needle || project.name.toLowerCase().includes(needle)
    ))
    : []
  const projectsConcealed = focus.status === 'open' && directory.projectsConcealedOrganizationIds.includes(focus.organizationId)
  const canCreateProject = focus.status === 'open' && directory.projectCreateTargets.some((target) => target.id === focus.organizationId)
  const choose = (organizationId: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set(DIRECTORY_FOCUS_PARAM, String(organizationId))
      return next
    }, { replace: true })
  }

  if (directory.corporationEmpty) {
    return (
      <EmptyPanel
        title={t('settings-page.owner-empty-title')}
        action={directory.createOrganization ? (
          <Button onClick={() => setCreateOrg(true)}>
            <Plus className="h-4 w-4" />
            {t('settings-page.owner-empty-action')}
          </Button>
        ) : null}
        dialog={(
          <CreateOrganizationDialog
            open={createOrg}
            onOpenChange={setCreateOrg}
            onCreated={(organizationId) => choose(organizationId)}
          />
        )}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:flex-row">
      <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-border bg-muted/30 md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm font-semibold">{t('settings-page.organizations')}</p>
          {directory.createOrganization ? (
            <Button size="icon" className="h-8 w-8" aria-label={t('settings-page.new-organization')} onClick={() => setCreateOrg(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="px-3 pb-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('settings-page.search')}
            aria-label={t('settings-page.search')}
          />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
          {organizations.map((organization) => (
            <OrganizationRow
              key={organization.id}
              active={focus.status === 'open' && focus.organizationId === organization.id}
              title={organization.fullName}
              subtitle={organization.shortName}
              onChoose={() => choose(organization.id)}
            />
          ))}
          {directory.organizations.length === 0 && directory.organizationsHidden ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {directory.createOrganization ? t('settings-page.hidden-organizations') : t('settings-page.no-accessible-organizations')}
            </p>
          ) : null}
          {directory.projectCreateTargets
            .filter((target) => !directory.organizations.some((organization) => organization.id === target.id))
            .filter((target) => !needle || target.shortName.toLowerCase().includes(needle))
            .map((target) => (
              <OrganizationRow
                key={target.id}
                active={focus.status === 'open' && focus.organizationId === target.id}
                title={target.shortName}
                subtitle={t('settings-page.create-project')}
                onChoose={() => choose(target.id)}
              />
            ))}
          {directory.projects
            .filter((project) => !directory.organizations.some((organization) => organization.id === project.organizationId))
            .filter((project) => !directory.projectCreateTargets.some((target) => target.id === project.organizationId))
            .filter((project, index, list) => list.findIndex((item) => item.organizationId === project.organizationId) === index)
            .map((project) => (
              <OrganizationRow
                key={project.organizationId}
                active={focus.status === 'open' && focus.organizationId === project.organizationId}
                title={project.organization.shortName}
                subtitle={t('settings-page.projects')}
                onChoose={() => choose(project.organizationId)}
              />
            ))}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {focus.status === 'rejected' ? (
          <p className="p-6 text-sm text-muted-foreground">{t('settings-page.focus-unavailable')}</p>
        ) : null}
        {focus.status === 'open' && selected ? (
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('settings-page.organization')}</p>
              <h2 className="mt-1 break-words text-xl font-semibold">{selected.fullName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{selected.shortName}</span>
                <span>{selected.kind === 'customer' ? t('settings-page.kind-customer') : t('settings-page.kind-laboratory')}</span>
                {selected.address ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {selected.address}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.canUpdate ? (
                <Button variant="outline" onClick={() => setEditOrganization(selected)}>
                  <Pencil className="h-4 w-4" />
                  {t('settings-page.edit-organization')}
                </Button>
              ) : null}
              {canCreateProject ? (
                <Button onClick={() => setCreateProjectFor(selected.id)}>
                  <Plus className="h-4 w-4" />
                  {t('settings-page.new-project')}
                </Button>
              ) : null}
            </div>
          </header>
        ) : null}
        {focus.status === 'open' && !selected && !selectedTarget ? (
          <header className="border-b border-border px-4 py-5 sm:px-6">
            <h2 className="break-words text-xl font-semibold">
              {selectedProjects[0]?.organization.shortName || directory.projects.find((project) => project.organizationId === focus.organizationId)?.organization.shortName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('settings-page.project-context')}</p>
          </header>
        ) : null}
        {focus.status === 'open' && !selected && selectedTarget ? (
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-5 sm:px-6">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold">{selectedTarget.shortName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('settings-page.context-minimum')}</p>
            </div>
            <Button onClick={() => setCreateProjectFor(selectedTarget.id)}>
              <Plus className="h-4 w-4" />
              {t('settings-page.new-project')}
            </Button>
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {focus.status === 'open' ? (
            <ProjectList
              projects={selectedProjects}
              concealed={projectsConcealed}
              canCreate={canCreateProject}
              onCreate={() => setCreateProjectFor(focus.organizationId)}
              onEdit={setEditProject}
            />
          ) : focus.status === 'all' ? (
            <p className="text-sm text-muted-foreground">{t('settings-page.select-organization-first')}</p>
          ) : null}
        </div>
      </section>
      <CreateOrganizationDialog open={createOrg} onOpenChange={setCreateOrg} onCreated={choose} />
      <CreateProjectDialog
        open={createProjectFor != null}
        onOpenChange={(open) => { if (!open) setCreateProjectFor(null) }}
        organizationId={createProjectFor}
      />
      <EditOrganizationDialog
        key={editOrganization?.id ?? 'organization'}
        organization={editOrganization}
        open={editOrganization != null}
        onOpenChange={(open) => { if (!open) setEditOrganization(null) }}
      />
      <EditProjectDialog
        key={editProject?.id ?? 'project'}
        project={editProject}
        open={editProject != null}
        onOpenChange={(open) => { if (!open) setEditProject(null) }}
      />
    </div>
  )
}

function ProjectList({
  projects,
  concealed,
  canCreate,
  onCreate,
  onEdit,
}: {
  projects: DirectoryProject[]
  concealed: boolean
  canCreate: boolean
  onCreate: () => void
  onEdit: (project: DirectoryProject) => void
}) {
  const { t } = useTranslation()
  if (projects.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center">
        <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {concealed ? t('settings-page.projects-not-listed') : t('settings-page.empty-projects-hint')}
        </p>
        {canCreate ? (
          <Button variant="outline" className="mt-5" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {t('settings-page.create-first-project')}
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {projects.map((project) => (
        <article key={project.id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{project.name}</p>
              {project.reservoir ? <p className="mt-1 text-sm text-muted-foreground">{project.reservoir}</p> : null}
            </div>
            {project.canUpdate ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('settings-page.edit-project')} onClick={() => onEdit(project)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

function OrganizationRow({
  active,
  title,
  subtitle,
  onChoose,
}: {
  active: boolean
  title: string
  subtitle: string
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left',
        active ? 'border-border bg-background' : 'border-transparent hover:bg-background/70',
      )}
    >
      <span className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
        active ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground ring-1 ring-border',
      )}>
        {initials(title)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

function LiveDirectory() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOrg, setCreateOrg] = useState(false)
  const [createProjectFor, setCreateProjectFor] = useState<number | null>(null)
  const organizations = useGetOrganizationsQuery()
  const rows = organizations.currentData ?? []
  const focus = resolveDirectoryFocus(searchParams.get(DIRECTORY_FOCUS_PARAM), rows.map((item) => item.id))
  const selectedId = focus.status === 'open' ? focus.organizationId : null
  const projects = useGetProjectsQuery(
    { organization: selectedId ?? 0 },
    { skip: selectedId == null },
  )
  const projectRows = projects.originalArgs?.organization === selectedId ? (projects.currentData ?? []) : []
  const choose = (organizationId: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set(DIRECTORY_FOCUS_PARAM, String(organizationId))
      return next
    }, { replace: true })
  }
  if (organizations.isLoading && !organizations.currentData) return <LoadingState label={t('workspace.loading')} />
  if (organizations.isError) return <ErrorState onRetry={() => void organizations.refetch()} />
  if (rows.length === 0) {
    return (
      <EmptyPanel
        title={t('settings-page.no-accessible-organizations')}
        action={(
          <Button onClick={() => setCreateOrg(true)}>
            <Plus className="h-4 w-4" />
            {t('settings-page.owner-empty-action')}
          </Button>
        )}
        dialog={<CreateOrganizationDialog open={createOrg} onOpenChange={setCreateOrg} onCreated={choose} />}
      />
    )
  }
  const selected = rows.find((item) => item.id === selectedId) ?? null
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex-row">
      <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-border md:max-h-none md:w-72 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <p className="text-sm font-semibold">{t('settings-page.organizations')}</p>
          <Button size="icon" className="h-8 w-8" aria-label={t('settings-page.new-organization')} onClick={() => setCreateOrg(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
          {rows.map((organization) => (
            <OrganizationRow
              key={organization.id}
              active={organization.id === selectedId}
              title={organization.fullName ?? organization.shortName ?? String(organization.id)}
              subtitle={organization.shortName ?? ''}
              onChoose={() => choose(organization.id)}
            />
          ))}
        </div>
      </aside>
      <section className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {focus.status === 'rejected' ? <p className="text-sm text-muted-foreground">{t('settings-page.focus-unavailable')}</p> : null}
        {selected ? (
          <div>
            <h2 className="break-words text-xl font-semibold">{selected.fullName}</h2>
            <Button className="mt-4" onClick={() => setCreateProjectFor(selected.id)}>
              <Plus className="h-4 w-4" />
              {t('settings-page.new-project')}
            </Button>
            {projects.isFetching && projectRows.length === 0 ? <LoadingState label={t('workspace.loading')} /> : null}
            <ul className="mt-4 space-y-2">
              {projectRows.map((project) => (
                <li key={project.id} className="rounded-xl border border-border px-3 py-2 text-sm">{project.name}</li>
              ))}
            </ul>
          </div>
        ) : focus.status === 'all' ? (
          <p className="text-sm text-muted-foreground">{t('settings-page.select-organization-first')}</p>
        ) : null}
      </section>
      <CreateOrganizationDialog open={createOrg} onOpenChange={setCreateOrg} onCreated={choose} />
      <CreateProjectDialog
        open={createProjectFor != null}
        onOpenChange={(open) => { if (!open) setCreateProjectFor(null) }}
        organizationId={createProjectFor}
      />
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-sm">{t('settings-page.directory-error')}</p>
      <Button type="button" variant="outline" onClick={onRetry}>{t('workspace.retry')}</Button>
    </div>
  )
}

function EmptyPanel({
  title,
  action,
  dialog,
}: {
  title: string
  action: ReactNode
  dialog: ReactNode
}) {
  return (
    <div className="flex h-full min-h-[28rem] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card">
      <div className="max-w-sm px-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-6 flex justify-center">{action}</div>
      </div>
      {dialog}
    </div>
  )
}

export default OrganizationsAndProjects
