import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useDeleteAccessRoleMutation,
  useGetAccessDirectoryQuery,
  type AccessDirectory,
  type AccessRoleView,
} from '../../../entities/access'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../shared/ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs'
import { accessErrorKey, accessFailure } from '../model/errors'
import { permissionSummary } from './permission-summary'
import { RoleDeleteDialog } from './RoleDeleteDialog'
import { scopeLabel } from './scope-label'
import { UserDirectory } from './UserDirectory'

type AccessDeskProps = {
  area: 'organization' | 'corporation'
  organizationId: number | null
  canManageCorporation: boolean
  installationSuperadmin: boolean
  onArea: (area: 'organization' | 'corporation') => void
  roleHref: (roleId: string | 'new') => string
  userHref: (userId: number) => string
}

export function AccessDesk({ area, organizationId, canManageCorporation, installationSuperadmin, onArea, roleHref, userHref }: AccessDeskProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  const requestedTab = search.get('tab')
  const tab = requestedTab === 'users' || requestedTab === 'assignments' ? 'users' : 'roles'
  useEffect(() => {
    if (search.get('tab') !== 'assignments') return
    setSearch((prev) => {
      const copy = new URLSearchParams(prev)
      copy.set('tab', 'users')
      return copy
    }, { replace: true })
  }, [search, setSearch])
  const skip = area === 'organization' && organizationId == null
  const directory = useGetAccessDirectoryQuery(
    area === 'corporation' ? { scope: 'corporation' } : { scope: 'organization', organizationId: organizationId ?? 0 },
    { skip },
  )
  const directoryView = directory.currentData
  const setTab = (value: string) => {
    setSearch((prev) => {
      const copy = new URLSearchParams(prev)
      if (value === 'roles') copy.delete('tab')
      else copy.set('tab', value)
      return copy
    }, { replace: true })
  }

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
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="roles">{t('access.tabs.roles')}</TabsTrigger>
          <TabsTrigger value="users">{t('access.tabs.users')}</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="min-w-0">
          <DirectoryGate query={directory} empty={skip}>
            {directoryView ? (
              <RoleList
                directory={directoryView}
                roleHref={roleHref}
                usersHref={usersTabHref(search)}
                onRefresh={() => void directory.refetch()}
              />
            ) : null}
          </DirectoryGate>
        </TabsContent>
        <TabsContent value="users" className="min-w-0">
          <UserDirectory userHref={userHref} />
        </TabsContent>
      </Tabs>
    </WorkPage>
  )
}

function DirectoryGate({
  query,
  empty,
  children,
}: {
  query: { isError: boolean; currentData?: AccessDirectory; error?: unknown }
  empty: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (empty) return null
  if (query.isError && !query.currentData) {
    return <PageState kind="error" description={t(accessErrorKey(accessFailure(query.error).code))} />
  }
  if (!query.currentData) return <PageState kind="loading" description={t('access.loading')} />
  return children
}

function usersTabHref(search: URLSearchParams): string {
  const copy = new URLSearchParams(search)
  copy.set('tab', 'users')
  return `${routes.settings.access()}?${copy.toString()}`
}

function RoleList({
  directory,
  roleHref,
  usersHref,
  onRefresh,
}: {
  directory: AccessDirectory
  roleHref: (roleId: string | 'new') => string
  usersHref: string
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const [pendingRole, setPendingRole] = useState<AccessRoleView | null>(null)
  const [conflict, setConflict] = useState(false)
  const [deleteRole, deleteState] = useDeleteAccessRoleMutation()
  const remove = async () => {
    if (!pendingRole || deleteState.isLoading || pendingRole.assignmentCount > 0 || conflict) return
    try {
      await deleteRole({ roleId: pendingRole.id }).unwrap()
      toast.success(t('access.role-deleted'))
      setPendingRole(null)
      setConflict(false)
    } catch (error) {
      const parsed = accessFailure(error)
      if (parsed.code === 'role_in_use') {
        setConflict(true)
        onRefresh()
      }
      toast.error(t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? pendingRole.assignmentCount }))
    }
  }
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
                    <div className="flex flex-wrap gap-2">
                      {role.canEdit ? (
                        <Button asChild variant="outline" size="sm" className="w-fit">
                          <Link to={roleHref(role.id)}>{t('access.edit-role')}</Link>
                        </Button>
                      ) : null}
                      {role.canDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          disabled={deleteState.isLoading}
                          onClick={() => {
                            setConflict(false)
                            setPendingRole(role)
                          }}
                        >
                          {t('access.delete-role')}
                        </Button>
                      ) : null}
                      {!role.canEdit && !role.canDelete ? (
                        <span className="text-xs text-muted-foreground">{t('access.edit-denied')}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <RecentChanges directory={directory} />
      <RoleDeleteDialog
        open={pendingRole != null}
        name={pendingRole?.displayName ?? ''}
        pending={deleteState.isLoading}
        blocked={(pendingRole?.assignmentCount ?? 0) > 0 || conflict}
        usersHref={usersHref}
        onOpenChange={(open) => {
          if (open) return
          setPendingRole(null)
          setConflict(false)
        }}
        onConfirm={() => void remove()}
      />
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
