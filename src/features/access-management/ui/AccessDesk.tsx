import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Eye, Info, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs'
import { accessErrorKey, accessFailure } from '../model/errors'
import { permissionPreview } from './permission-summary'
import { RoleDeleteDialog } from './RoleDeleteDialog'
import { scopeLabel } from './scope-label'
import { UserDirectory } from './UserDirectory'

const NO_ROLES: readonly { id: string; displayName: string }[] = []

type AccessDeskProps = {
  area: 'organization' | 'corporation'
  organizationId: number | null
  canManageCorporation: boolean
  installationSuperadmin: boolean
  onArea: (area: 'organization' | 'corporation') => void
  roleHref: (roleId: string | 'new') => string
  userHref: (userId: number) => string
}

const tabTriggerClass = 'rounded-lg px-4 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground'

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
      <PageHeader
        title={t('nav.access')}
        description={t(tab === 'users' ? 'access.desk-lead-users' : 'access.desk-lead-roles')}
      />
      {installationSuperadmin ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
          <span className="font-medium">{t('access.installation-superadmin')}</span>
          <span className="mt-1 block text-muted-foreground">{t('access.installation-superadmin-note')}</span>
        </p>
      ) : null}
      {area === 'organization' && organizationId == null ? (
        <p className="text-sm text-muted-foreground">{t('access.choose-organization')}</p>
      ) : null}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-auto justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="roles" className={tabTriggerClass}>{t('access.tabs.roles')}</TabsTrigger>
            <TabsTrigger value="users" className={tabTriggerClass}>{t('access.tabs.users')}</TabsTrigger>
          </TabsList>
          {canManageCorporation ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('access.scope.corporation')}>
              <Button type="button" size="sm" variant={area === 'organization' ? 'default' : 'ghost'} onClick={() => onArea('organization')}>
                {t('access.area.organization')}
              </Button>
              <Button type="button" size="sm" variant={area === 'corporation' ? 'default' : 'ghost'} onClick={() => onArea('corporation')}>
                {t('access.area.corporation')}
              </Button>
            </div>
          ) : null}
        </div>
        {area === 'corporation' ? <p className="text-xs text-muted-foreground">{t('access.scope.corporation-help')}</p> : null}
        <AccessGuide kind={tab} />
        <TabsContent value="roles" className="mt-4 min-w-0">
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
        <TabsContent value="users" className="mt-4 min-w-0">
          <UserDirectory
            userHref={userHref}
            area={area}
            roles={directoryView?.roles ?? NO_ROLES}
          />
        </TabsContent>
      </Tabs>
    </WorkPage>
  )
}

function AccessGuide({ kind }: { kind: 'roles' | 'users' }) {
  const { t } = useTranslation()
  const steps = kind === 'roles'
    ? [
        { title: t('access.guide.roles.1'), hint: t('access.guide.roles.1-hint') },
        { title: t('access.guide.roles.2'), hint: t('access.guide.roles.2-hint') },
        { title: t('access.guide.roles.3'), hint: t('access.guide.roles.3-hint') },
      ]
    : [
        { title: t('access.guide.users.1'), hint: '' },
        { title: t('access.guide.users.2'), hint: '' },
        { title: t('access.guide.users.3'), hint: '' },
      ]
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/10 px-4 py-3 lg:flex-row lg:items-center" role="note">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-primary">
          <Info className="size-4" aria-hidden />
        </span>
        {kind === 'roles' ? <span>{t('access.guide.roles-title')}</span> : null}
      </div>
      <ol className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-2">
            {index > 0 ? <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden /> : null}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.title}</span>
              {step.hint ? <span className="block text-xs text-muted-foreground">{step.hint}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
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
  const heading = directory.scope === 'corporation' ? t('access.roles-heading-corporation') : t('access.roles-heading')
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {directory.canCreateRole ? (
          <Button asChild>
            <Link to={roleHref('new')}><Plus />{t('access.create-role')}</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('access.create-denied')}</p>
        )}
      </div>
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Shield className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        {directory.roles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('access.roles-empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('access.column-role-name')}</TableHead>
                  <TableHead>{t('access.column-scope')}</TableHead>
                  <TableHead>{t('access.column-users')}</TableHead>
                  <TableHead>{t('access.column-permissions')}</TableHead>
                  <TableHead className="pr-4">{t('access.row-actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directory.roles.map((role) => {
                  const scope = scopeLabel(role.ownerScope, directory.organizations, directory.projects, t)
                  const preview = permissionPreview(role.operational, t)
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="pl-4">
                        <p className="font-medium">{role.displayName}</p>
                        {role.description ? <p className="text-xs text-primary">{role.description}</p> : null}
                      </TableCell>
                      <TableCell className="text-sm">{scope}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Users className="size-3.5 text-muted-foreground" aria-hidden />
                          {role.affectedUserCount}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {preview.lead || t('access.no-permissions')}
                        {preview.extra > 0 ? <span className="ml-1 font-medium text-primary">+{preview.extra}</span> : null}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button asChild variant="outline" size="sm">
                            <Link to={roleHref(role.id)}><Eye />{t('access.view-role')}</Link>
                          </Button>
                          {role.canEdit ? (
                            <Button asChild variant="outline" size="sm">
                              <Link to={roleHref(role.id)}><Pencil />{t('access.edit-role')}</Link>
                            </Button>
                          ) : null}
                          <Button asChild variant="outline" size="sm">
                            <Link to={`${roleHref(role.id)}#role-permissions`}><Shield />{t('access.open-permissions')}</Link>
                          </Button>
                          {role.canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteState.isLoading}
                              aria-label={t('access.delete-role')}
                              onClick={() => {
                                setConflict(false)
                                setPendingRole(role)
                              }}
                            >
                              <Trash2 />
                            </Button>
                          ) : null}
                          {!role.canEdit && !role.canDelete ? (
                            <span className="text-xs text-muted-foreground">{t('access.edit-denied')}</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
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
