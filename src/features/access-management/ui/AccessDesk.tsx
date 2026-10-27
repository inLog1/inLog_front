import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  useCreateAccessAssignmentMutation,
  useGetAccessDirectoryQuery,
  useRevokeAccessAssignmentMutation,
  type AccessDirectory,
  type AccessScope,
} from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../shared/ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs'
import { accessErrorKey, accessFailure } from '../model/errors'
import { permissionSummary } from './permission-summary'
import { scopeLabel } from './scope-label'

type AccessDeskProps = {
  area: 'organization' | 'corporation'
  organizationId: number | null
  canManageCorporation: boolean
  installationSuperadmin: boolean
  onArea: (area: 'organization' | 'corporation') => void
  roleHref: (roleId: string | 'new') => string
}

export function AccessDesk({ area, organizationId, canManageCorporation, installationSuperadmin, onArea, roleHref }: AccessDeskProps) {
  const { t } = useTranslation()
  const skip = area === 'organization' && organizationId == null
  const directory = useGetAccessDirectoryQuery(
    area === 'corporation' ? { scope: 'corporation' } : { scope: 'organization', organizationId: organizationId ?? 0 },
    { skip },
  )

  return (
    <WorkPage>
      <PageHeader title={t('nav.access')} description={t('access.lead')} />
      {installationSuperadmin ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
          <span className="font-medium">{t('access.installation-superadmin')}</span>
          <span className="mt-1 block text-muted-foreground">{t('access.installation-superadmin-note')}</span>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('access.scope.corporation-help')}</p>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0" />
        {canManageCorporation ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={area === 'organization' ? 'default' : 'outline'} onClick={() => onArea('organization')}>
              {t('access.area.organization')}
            </Button>
            <Button type="button" variant={area === 'corporation' ? 'default' : 'outline'} onClick={() => onArea('corporation')}>
              {t('access.area.corporation')}
            </Button>
          </div>
        ) : null}
      </div>
      {area === 'organization' && organizationId == null ? (
        <p className="text-sm text-muted-foreground">{t('access.choose-organization')}</p>
      ) : null}
      {directory.isError ? <PageState kind="error" description={t(accessErrorKey(accessFailure(directory.error).code))} /> : null}
      {directory.isLoading ? <PageState kind="loading" description={t('access.loading')} /> : null}
      {directory.data ? (
        <Tabs defaultValue="roles" className="min-w-0">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="roles">{t('access.tabs.roles')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('access.tabs.assignments')}</TabsTrigger>
          </TabsList>
          <TabsContent value="roles" className="min-w-0">
            <RoleList directory={directory.data} roleHref={roleHref} />
          </TabsContent>
          <TabsContent value="assignments" className="min-w-0">
            <AssignmentDesk directory={directory.data} />
          </TabsContent>
        </Tabs>
      ) : null}
    </WorkPage>
  )
}

function RoleList({ directory, roleHref }: { directory: AccessDirectory; roleHref: (roleId: string | 'new') => string }) {
  const { t } = useTranslation()
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {directory.canCreateRole ? (
          <Button asChild>
            <Link to={roleHref('new')}>{t('access.create-role')}</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('access.create-denied')}</p>
        )}
      </div>
      {directory.roles.length === 0 ? <p className="text-sm text-muted-foreground">{t('access.roles-empty')}</p> : null}
      {directory.roles.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <div className="hidden min-w-[40rem] grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,1.4fr)_6rem] gap-3 px-3 text-xs text-muted-foreground md:grid">
            <span>{t('access.name')}</span>
            <span>{t('access.owner')}</span>
            <span>{t('access.assignments')}</span>
            <span>{t('access.summary')}</span>
            <span>{t('access.row-actions')}</span>
          </div>
          <ul className="mt-1 flex flex-col gap-2">
            {directory.roles.map((role) => {
              const scope = scopeLabel(role.ownerScope, directory.organizations, directory.projects, t)
              const summary = permissionSummary(role.operational) || t('access.no-permissions')
              return (
                <li key={role.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-col gap-2 md:grid md:min-w-[40rem] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,1.4fr)_6rem] md:items-center md:gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{role.displayName}</p>
                      {role.description ? <p className="truncate text-xs text-muted-foreground">{role.description}</p> : null}
                    </div>
                    <p className="text-sm">{scope}</p>
                    <p className="text-sm">{t('access.assignment-count', { count: role.assignmentCount })}</p>
                    <p className="text-sm text-muted-foreground">{summary}</p>
                    {role.canEdit ? (
                      <Button asChild variant="outline" size="sm" className="w-fit">
                        <Link to={roleHref(role.id)}>{t('access.edit-role')}</Link>
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">{t('access.edit-denied')}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <RecentChanges directory={directory} />
    </div>
  )
}

function AssignmentDesk({ directory }: { directory: AccessDirectory }) {
  const { t } = useTranslation()
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createAssignment, createState] = useCreateAccessAssignmentMutation()
  const [revokeAssignment, revokeState] = useRevokeAccessAssignmentMutation()
  const role = directory.roles.find((item) => item.id === roleId)

  const scope = (): AccessScope | null => {
    if (directory.scope === 'corporation') return { type: 'corporation', corporationId: directory.corporationId }
    if (directory.organizationId == null) return null
    if (projectId) {
      const project = directory.projects.find((item) => String(item.id) === projectId)
      if (!project) return null
      return {
        type: 'project',
        projectId: project.id,
        organizationId: project.organizationId,
        corporationId: directory.corporationId,
      }
    }
    return { type: 'organization', organizationId: directory.organizationId, corporationId: directory.corporationId }
  }

  const assign = async () => {
    setFailure(null)
    setNotice(null)
    const next = scope()
    const parsedUser = Number(userId)
    if (!next || !roleId || !Number.isInteger(parsedUser)) {
      setFailure(t('access.errors.invalid-scope'))
      return
    }
    try {
      const result = await createAssignment({
        userId: parsedUser,
        roleId,
        scope: next,
      }).unwrap()
      setNotice(result.idempotent ? t('access.assignment-exists') : t('access.assignment-saved'))
    } catch (error) {
      setFailure(t(accessErrorKey(accessFailure(error).code)))
    }
  }

  const revoke = async (assignmentId: string) => {
    setFailure(null)
    setNotice(null)
    try {
      await revokeAssignment({ assignmentId }).unwrap()
      setNotice(t('access.assignment-revoked'))
    } catch (error) {
      setFailure(t(accessErrorKey(accessFailure(error).code)))
    }
  }

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4">
      <form
        className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void assign()
        }}
      >
        <h2 className="text-base font-semibold">{t('access.assign-title')}</h2>
        <label className="grid min-w-0 gap-1 text-sm">
          {t('access.user')}
          <select className="h-9 rounded-md border border-border bg-background px-2" value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">{t('access.choose')}</option>
            {directory.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.position}</option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          {t('access.role')}
          <select className="h-9 rounded-md border border-border bg-background px-2" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            <option value="">{t('access.choose')}</option>
            {directory.roles.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}</option>
            ))}
          </select>
        </label>
        {role ? (
          <p className="text-sm text-muted-foreground">
            {t('access.role-summary')}: {permissionSummary(role.operational) || t('access.no-permissions')}
          </p>
        ) : null}
        {directory.scope === 'organization' ? (
          <label className="grid min-w-0 gap-1 text-sm">
            {t('access.assignment-scope')}
            <select className="h-9 rounded-md border border-border bg-background px-2" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">{t('access.scope.this-organization')}</option>
              {directory.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm">{t('access.scope.corporation')}</p>
        )}
        <Button type="submit" disabled={createState.isLoading} className="w-full sm:w-auto">
          {t('access.assign')}
        </Button>
        {notice ? <p className="text-sm" role="status">{notice}</p> : null}
        {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
      </form>
      {directory.assignments.length === 0 ? <p className="text-sm text-muted-foreground">{t('access.assignments-empty')}</p> : null}
      <ul className="flex flex-col gap-3">
        {directory.assignments.map((assignment) => (
          <li key={assignment.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{assignment.userName}</p>
              <p>{assignment.roleName}</p>
              <p className="text-muted-foreground">{scopeLabel(assignment.scope, directory.organizations, directory.projects, t)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={revokeState.isLoading || !assignment.canRevoke}
              onClick={() => void revoke(assignment.id)}
            >
              {t('access.revoke')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentChanges({ directory }: { directory: AccessDirectory }) {
  const { t } = useTranslation()
  if (directory.recentChanges.length === 0) return null
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-medium">{t('access.history')}</h2>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {directory.recentChanges.map((change) => (
          <li key={change.id}>
            {change.actorName} · {t(`access.actions.${change.action}`, { defaultValue: change.action })} · {change.roleName ?? change.assignmentId}
          </li>
        ))}
      </ul>
    </section>
  )
}
