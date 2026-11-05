import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Info, MoreHorizontal, Plus, Search, Shield, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useDeleteAccessRoleMutation,
  useGetAccessDirectoryQuery,
  type AccessDirectory,
  type AccessRoleView,
} from '../../../entities/access'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageState, WorkPage } from '../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs'
import type { AccessDeskScope, AccessOrganizationFilter } from '../model/access-address'
import { accessErrorKey, accessFailure } from '../model/errors'
import { permissionPreview } from './permission-summary'
import { RoleDeleteDialog } from './RoleDeleteDialog'
import { RoleDuplicateDialog } from './RoleDuplicateDialog'
import { roleDefinitionLabel } from './scope-label'
import { UserDirectory } from './UserDirectory'

const NO_ROLES: readonly { id: string; displayName: string }[] = []

export type { AccessDeskScope } from '../model/access-address'

type AccessDeskProps = {
  deskScope: AccessDeskScope
  organizationId: AccessOrganizationFilter | null
  organizationOptions: readonly { id: number; shortName: string }[]
  onOrganizationChange: (organizationId: AccessOrganizationFilter) => void
  roleHref: (roleId: string | 'new') => string
  userHref: (userId: number) => string
}

const tabTriggerClass = 'rounded-lg px-4 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground'

export function AccessDesk({
  deskScope,
  organizationId,
  organizationOptions,
  onOrganizationChange,
  roleHref,
  userHref,
}: AccessDeskProps) {
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
  const skipOrganization = deskScope === 'organization' && organizationId == null
  const directory = useGetAccessDirectoryQuery(
    deskScope === 'corporation'
      ? { scope: 'corporation' }
      : { scope: 'organization', organizationId: organizationId ?? 'all' },
    { skip: skipOrganization },
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
      {deskScope === 'organization' && organizationId == null ? (
        <p className="text-sm text-muted-foreground">{t('access.choose-organization')}</p>
      ) : null}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList className="h-auto justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="roles" className={tabTriggerClass}>{t('access.tabs.roles')}</TabsTrigger>
          <TabsTrigger value="users" className={tabTriggerClass}>{t('access.tabs.users')}</TabsTrigger>
        </TabsList>
        <AccessGuide kind={tab} />
        <TabsContent value="roles" className="mt-4 min-w-0">
          <DirectoryGate query={directory} empty={skipOrganization}>
            {directoryView ? (
              <RoleList
                directory={directoryView}
                organizationOptions={organizationOptions}
                onOrganizationChange={onOrganizationChange}
                roleHref={roleHref}
                usersHref={usersTabHref(search)}
                organizationId={organizationId}
                onRefresh={() => void directory.refetch()}
              />
            ) : null}
          </DirectoryGate>
        </TabsContent>
        <TabsContent value="users" className="mt-4 min-w-0">
          <UserDirectory
            userHref={userHref}
            area={deskScope}
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
  organizationOptions,
  onOrganizationChange,
  roleHref,
  usersHref,
  organizationId,
  onRefresh,
}: {
  directory: AccessDirectory
  organizationOptions: readonly { id: number; shortName: string }[]
  onOrganizationChange: (organizationId: AccessOrganizationFilter) => void
  roleHref: (roleId: string | 'new') => string
  usersHref: string
  organizationId: AccessOrganizationFilter | null
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pendingRole, setPendingRole] = useState<AccessRoleView | null>(null)
  const [duplicateRole, setDuplicateRole] = useState<AccessRoleView | null>(null)
  const [query, setQuery] = useState('')
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
  const heading = directory.scope === 'corporation'
    ? t('access.roles-heading-corporation')
    : directory.scope === 'all'
      ? t('access.roles-heading-all')
      : t('access.roles-heading')
  const needle = query.trim().toLowerCase()
  const visibleRoles = directory.roles.filter((role) => {
    if (!needle) return true
    const scope = roleDefinitionLabel(role.ownerScope, directory.organizations, t)
    return `${role.displayName} ${role.description} ${scope}`.toLowerCase().includes(needle)
  })
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {directory.canCreateRole ? (
            <Button asChild>
              <Link to={roleHref('new')}><Plus />{t('access.create-role')}</Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('access.create-denied')}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('access.roles-search')}
              aria-label={t('access.roles-search')}
              className="pl-9"
            />
          </div>
          {organizationOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="access-organization-filter" className="shrink-0">
                {t('access.organization-filter.label')}
              </Label>
              <Select
                value={organizationId == null ? undefined : String(organizationId)}
                onValueChange={(value) => onOrganizationChange(value === 'all' ? 'all' : Number(value))}
              >
                <SelectTrigger id="access-organization-filter" className="w-full sm:w-[13rem]" aria-label={t('access.organization-filter.label')}>
                  <SelectValue placeholder={t('access.availability.organization-placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('access.organization-filter.all')}</SelectItem>
                  {organizationOptions.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.shortName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Shield className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        {directory.roles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('access.roles-empty')}</p>
        ) : visibleRoles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('access.roles-filter.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('access.column-role-name')}</TableHead>
                  <TableHead>{t('access.column-scope')}</TableHead>
                  <TableHead>{t('access.column-users')}</TableHead>
                  <TableHead>{t('access.column-permissions')}</TableHead>
                  <TableHead className="w-12 pr-4 text-right">{t('access.row-actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRoles.map((role) => {
                  const scope = roleDefinitionLabel(role.ownerScope, directory.organizations, t)
                  const preview = permissionPreview(role.operational, t)
                  const permissionsHref = `${roleHref(role.id)}#role-permissions`
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
                      <TableCell className="pr-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('access.row-actions')}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {role.canRead ? (
                              <DropdownMenuItem asChild>
                                <Link to={roleHref(role.id)}>{t('access.view-role')}</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {role.canEdit ? (
                              <DropdownMenuItem asChild>
                                <Link to={roleHref(role.id)}>{t('access.edit-role')}</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {role.canRead ? (
                              <DropdownMenuItem asChild>
                                <Link to={permissionsHref}>{t('access.open-permissions')}</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {role.canDuplicate && directory.creatableScopes.length > 0 ? (
                              <DropdownMenuItem onSelect={() => setDuplicateRole(role)}>
                                {t('access.duplicate')}
                              </DropdownMenuItem>
                            ) : null}
                            {role.canDelete ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={deleteState.isLoading}
                                onSelect={() => {
                                  setConflict(false)
                                  setPendingRole(role)
                                }}
                              >
                                {t('access.delete')}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
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
      {duplicateRole ? (
        <RoleDuplicateDialog
          key={duplicateRole.id}
          open
          role={duplicateRole}
          creatableScopes={directory.creatableScopes}
          organizations={directory.organizations}
          preferredOrganizationId={typeof organizationId === 'number' ? organizationId : null}
          accessVersion={directory.accessVersion}
          onOpenChange={(open) => {
            if (!open) setDuplicateRole(null)
          }}
          onCreated={(roleId) => navigate(roleHref(roleId))}
        />
      ) : null}
    </div>
  )
}
