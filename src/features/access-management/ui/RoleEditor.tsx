import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { setUnsavedSource, useUnsavedSource } from '../../../shared/session/unsaved-work'
import {
  useCreateAccessRoleMutation,
  useDeleteAccessRoleMutation,
  useGetAccessDirectoryQuery,
  useGetAccessRoleQuery,
  useUpdateAccessRoleMutation,
  type AccessCreatableScope,
  type AccessGrantView,
  type AccessRoleView,
  type AccessScope,
} from '../../../entities/access'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { PageHeader, PageState, WorkPage } from '../../../shared/ui/page'
import { accessErrorKey, accessFailure } from '../model/errors'
import { PermissionSets } from './PermissionSets'
import { RoleAvailabilityField } from './RoleAvailabilityField'
import { RoleDeleteDialog } from './RoleDeleteDialog'
import { RoleDuplicateDialog } from './RoleDuplicateDialog'
import { roleDefinitionLabel, scopeKey, scopeLabel } from './scope-label'

type RoleEditorProps = {
  roleId: string | null
  owner: 'organization' | 'corporation'
  organizationId: number | null
  listHref: string
  usersHref: string
}

export function RoleEditor({ roleId, owner, organizationId, listHref, usersHref }: RoleEditorProps) {
  if (roleId) return <ExistingRole roleId={roleId} organizationId={organizationId} listHref={listHref} usersHref={usersHref} />
  return <NewRole owner={owner} organizationId={organizationId} listHref={listHref} usersHref={usersHref} />
}

function NewRole({ owner, organizationId, listHref, usersHref }: { owner: 'organization' | 'corporation'; organizationId: number | null; listHref: string; usersHref: string }) {
  const { t } = useTranslation()
  const skip = owner === 'organization' && organizationId == null
  const directory = useGetAccessDirectoryQuery(
    owner === 'corporation' ? { scope: 'corporation' } : { scope: 'organization', organizationId: organizationId ?? 0 },
    { skip },
  )
  if (directory.isError && !directory.data) return <EditorStatus error={directory.error} />
  if (directory.isLoading || !directory.data) {
    return <WorkPage><PageState kind="loading" description={t('access.loading')} /></WorkPage>
  }
  const initialScope = preferredScope(directory.data.creatableScopes, owner, organizationId)
  if (!initialScope) return <CreateDenied listHref={listHref} />
  return (
    <RoleForm
      listHref={listHref}
      usersHref={usersHref}
      initialScope={initialScope}
      organizationId={organizationId}
      scopeLocked={false}
      creatableScopes={directory.data.creatableScopes}
      accessVersion={directory.data.accessVersion}
      source={null}
      organizations={directory.data.organizations}
      projects={directory.data.projects}
      offered={directory.data.offeredGrants}
      delegableIds={directory.data.delegableGrantIds}
      canDelegateFurther={directory.data.canDelegateFurther}
      canEdit
      initial={null}
    />
  )
}

function ExistingRole({ roleId, organizationId, listHref, usersHref }: { roleId: string; organizationId: number | null; listHref: string; usersHref: string }) {
  const role = useGetAccessRoleQuery(roleId)
  if (role.isLoading || !role.data) {
    return <EditorStatus error={role.isError ? role.error : null} />
  }
  return (
    <RoleForm
      listHref={listHref}
      usersHref={usersHref}
      onRefresh={() => void role.refetch()}
      initialScope={role.data.role.ownerScope}
      organizationId={organizationId}
      scopeLocked={role.data.role.assignmentCount > 0}
      creatableScopes={role.data.creatableScopes}
      accessVersion={role.data.accessVersion}
      source={role.data.role}
      organizations={role.data.organizations}
      projects={role.data.projects}
      offered={role.data.offeredGrants}
      delegableIds={role.data.delegableGrantIds}
      canDelegateFurther={role.data.canDelegateFurther}
      canEdit={role.data.role.canEdit}
      initial={role.data.role}
    />
  )
}

function CreateDenied({ listHref }: { listHref: string }) {
  const { t } = useTranslation()
  return (
    <WorkPage>
      <PageHeader
        title={t('access.edit-title')}
        breadcrumbs={[{ label: t('nav.access'), to: listHref }, { label: t('access.create-role') }]}
      />
      <PageState kind="empty" description={t('access.create-denied')} />
      <p className="text-sm text-muted-foreground">{t('access.installation-superadmin-note')}</p>
    </WorkPage>
  )
}

function EditorStatus({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return <WorkPage><PageState kind="loading" description={t('access.loading')} /></WorkPage>
  return <WorkPage><PageState kind="error" description={t(accessErrorKey(accessFailure(error).code))} /></WorkPage>
}

function RoleForm({
  listHref,
  usersHref,
  onRefresh,
  initialScope,
  organizationId,
  scopeLocked,
  creatableScopes,
  accessVersion,
  source,
  organizations,
  projects,
  offered,
  delegableIds,
  canDelegateFurther,
  canEdit,
  initial,
}: {
  listHref: string
  usersHref: string
  onRefresh?: () => void
  initialScope: AccessScope
  organizationId: number | null
  scopeLocked: boolean
  creatableScopes: readonly AccessCreatableScope[]
  accessVersion: number
  source: AccessRoleView | null
  organizations: Array<{ id: number; shortName: string }>
  projects: Array<{ id: number; name: string; organizationId: number }>
  offered: AccessGrantView[]
  delegableIds: string[]
  canDelegateFurther: boolean
  canEdit: boolean
  initial: {
    id: string
    displayName: string
    description: string
    operational: AccessGrantView[]
    delegation: AccessGrantView[]
    assignmentCount: number
    affectedUserCount: number
    affectedScopes: AccessScope[]
    canDelete: boolean
  } | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState(initial?.displayName ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [scope, setScope] = useState(initialScope)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [operationalIds, setOperationalIds] = useState(initial?.operational.map((item) => item.id) ?? [])
  const [delegationIds, setDelegationIds] = useState(initial?.delegation.map((item) => item.id) ?? [])
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [leaveClean, setLeaveClean] = useState(false)
  const [createRole, createState] = useCreateAccessRoleMutation()
  const [updateRole, updateState] = useUpdateAccessRoleMutation()
  const [deleteRole, deleteState] = useDeleteAccessRoleMutation()
  const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id, index) => id === right[index])
  const initialOperational = initial?.operational.map((item) => item.id) ?? []
  const initialDelegation = initial?.delegation.map((item) => item.id) ?? []
  const dirty = !leaveClean && (
    name !== (initial?.displayName ?? '')
    || description !== (initial?.description ?? '')
    || scopeKey(scope) !== scopeKey(initialScope)
    || !sameIds(operationalIds, initialOperational)
    || !sameIds(delegationIds, initialDelegation)
  )
  useUnsavedSource(initial ? `role-editor:${initial.id}` : 'role-editor:new', dirty)
  const pending = createState.isLoading || updateState.isLoading || deleteState.isLoading
  const returnToList = () => {
    setLeaveClean(true)
    setUnsavedSource(initial ? `role-editor:${initial.id}` : 'role-editor:new', false)
    navigate(listHref, { replace: true })
  }
  useEffect(() => {
    if (window.location.hash !== '#role-permissions') return
    document.getElementById('role-permissions')?.scrollIntoView({ block: 'start' })
  }, [])
  const offeredIds = new Set(offered.map((item) => item.id))
  const preservedOperational = (initial?.operational ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))
  const preservedDelegation = (initial?.delegation ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))

  const save = async () => {
    if (pending) return
    setFailure(null)
    setNotice(null)
    const displayName = name.trim()
    if (displayName.length < 1) {
      const message = t('access.errors.invalid-name')
      setFailure(message)
      toast.error(message)
      return
    }
    const body = {
      displayName,
      description,
      grantIds: operationalIds,
      delegationGrantIds: delegationIds,
      ownerScope: scope,
      expectedAccessVersion: accessVersion,
    }
    try {
      if (initial) await updateRole({ roleId: initial.id, body }).unwrap()
      else await createRole(body).unwrap()
      toast.success(t('access.role-saved'))
      returnToList()
    } catch (error) {
      const parsed = accessFailure(error)
      const message = t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 })
      setFailure(message)
      toast.error(message)
    }
  }

  const remove = async () => {
    if (!initial || pending || conflict || initial.assignmentCount > 0) return
    setFailure(null)
    setNotice(null)
    try {
      await deleteRole({ roleId: initial.id }).unwrap()
      toast.success(t('access.role-deleted'))
      setConfirmDelete(false)
      returnToList()
    } catch (error) {
      const parsed = accessFailure(error)
      if (parsed.code === 'role_in_use') {
        setConflict(true)
        onRefresh?.()
      }
      const message = t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 })
      setFailure(message)
      toast.error(message)
    }
  }

  const scopeText = roleDefinitionLabel(scope, organizations, t)
  const selectedAvailability = creatableScopes.find((item) => scopeKey(item.scope) === scopeKey(scope)) ?? null
  const sameArea = scopeKey(scope) === scopeKey(initialScope)
  const activeDelegable = sameArea ? delegableIds : (selectedAvailability?.delegableGrantIds ?? [])
  const activeFurther = sameArea ? canDelegateFurther : (selectedAvailability?.canDelegateFurther ?? false)
  const busy = !canEdit || pending
  const knownInUse = (initial?.assignmentCount ?? 0) > 0 || conflict
  const actionButtons = () => (
    <>
      <Button asChild variant="outline">
        <Link to={listHref}>{t('access.cancel')}</Link>
      </Button>
      {initial?.canDelete ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setConflict(false)
            setConfirmDelete(true)
          }}
        >
          {t('access.delete-role')}
        </Button>
      ) : null}
      <Button type="button" disabled={busy} onClick={() => void save()}>
        {t('access.save-changes')}
      </Button>
    </>
  )
  return (
    <WorkPage>
      <PageHeader
        title={initial ? t('access.edit-title') : t('access.create-role')}
        description={t('access.edit-lead')}
        breadcrumbs={[
          { label: t('nav.access'), to: listHref },
          { label: initial ? initial.displayName : t('access.create-role') },
        ]}
        actions={actionButtons()}
      />
      {initial && knownInUse && initial.canDelete ? <p className="text-sm text-foreground">{t('access.delete-blocked')}</p> : null}
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}
      {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
      <div id="role-permissions" className="grid scroll-mt-6 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <PermissionSets
          offered={offered}
          delegableIds={activeDelegable}
          canDelegateFurther={activeFurther}
          operationalIds={operationalIds}
          delegationIds={delegationIds}
          preservedOperational={preservedOperational}
          preservedDelegation={preservedDelegation}
          editable={canEdit}
          onOperational={setOperationalIds}
          onDelegation={setDelegationIds}
          generalPanel={(
            <div className="max-w-xl rounded-lg border border-border bg-card p-4">
              <div className="grid gap-3">
              <label className="grid min-w-0 gap-1 text-sm">
                {t('access.name')}
                <Input
                  value={name}
                  disabled={!canEdit}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                    event.preventDefault()
                    void save()
                  }}
                  maxLength={80}
                />
              </label>
              <RoleAvailabilityField
                scopes={creatableScopes}
                organizations={organizations}
                value={scope}
                preferredOrganizationId={organizationId}
                onChange={setScope}
                disabled={!canEdit || pending}
                locked={scopeLocked}
              />
              {scopeLocked && source?.canDuplicate && creatableScopes.length > 0 ? (
                <Button type="button" variant="outline" onClick={() => setDuplicateOpen(true)}>
                  {t('access.duplicate')}
                </Button>
              ) : null}
              <label className="grid min-w-0 gap-1 text-sm">
                {t('access.description')}
                <Textarea value={description} disabled={!canEdit} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
              </label>
              {!canEdit ? <p className="text-sm text-foreground">{t('access.edit-denied')}</p> : null}
              </div>
            </div>
          )}
        />
        <RoleSummary
          scopeText={scopeText}
          operationalCount={operationalIds.length}
          delegationCount={delegationIds.length}
          people={initial?.affectedUserCount ?? 0}
          assigned={initial != null}
        />
      </div>
      {initial && initial.assignmentCount > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm" role="status">
          <p>{t('access.impact', { users: initial.affectedUserCount, count: initial.assignmentCount })}</p>
          <ul className="mt-2 list-disc pl-5">
            {initial.affectedScopes.map((scope, index) => (
              <li key={`${scope.type}-${index}`}>{scopeLabel(scope, organizations, projects, t)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {source && duplicateOpen ? (
        <RoleDuplicateDialog
          open
          role={source}
          creatableScopes={creatableScopes}
          organizations={organizations}
          preferredOrganizationId={organizationId}
          accessVersion={accessVersion}
          onOpenChange={setDuplicateOpen}
          onCreated={(roleId) => {
            const query = listHref.includes('?') ? listHref.slice(listHref.indexOf('?')) : ''
            setLeaveClean(true)
            setUnsavedSource(initial ? `role-editor:${initial.id}` : 'role-editor:new', false)
            navigate(`${routes.settings.accessRole(roleId)}${query}`)
          }}
        />
      ) : null}
      {initial ? (
        <RoleDeleteDialog
          open={confirmDelete}
          name={initial.displayName}
          pending={deleteState.isLoading}
          blocked={knownInUse}
          usersHref={usersHref}
          onOpenChange={(open) => {
            if (open) return
            setConfirmDelete(false)
            setConflict(false)
          }}
          onConfirm={() => void remove()}
        />
      ) : null}
    </WorkPage>
  )
}

function preferredScope(
  scopes: readonly AccessCreatableScope[],
  owner: 'organization' | 'corporation',
  organizationId: number | null,
): AccessScope | null {
  const corporation = scopes.find((item) => item.scope.type === 'corporation')
  const organization = scopes.find((item) => item.scope.type === 'organization' && item.scope.organizationId === organizationId)
  if (owner === 'organization' && organization) return organization.scope
  if (owner === 'corporation' && corporation) return corporation.scope
  if (organization) return organization.scope
  if (corporation) return corporation.scope
  return scopes.find((item) => item.scope.type === 'organization')?.scope ?? null
}

function RoleSummary({
  scopeText,
  operationalCount,
  delegationCount,
  people,
  assigned,
}: {
  scopeText: string
  operationalCount: number
  delegationCount: number
  people: number
  assigned: boolean
}) {
  const { t } = useTranslation()
  const body = (
    <div className="space-y-3 text-sm">
      <p><span className="text-muted-foreground">{t('access.availability.title')}: </span>{scopeText}</p>
      <p>{t('access.summary-operational', { count: operationalCount })}</p>
      <p>{delegationCount > 0 ? t('access.summary-delegation', { count: delegationCount }) : t('access.summary-none-delegation')}</p>
      <p>{assigned ? t('access.summary-people', { count: people }) : t('access.summary-unassigned')}</p>
      <p className="text-muted-foreground">{t('access.summary-role-note')}</p>
    </div>
  )
  return (
    <>
      <details className="rounded-lg border border-border bg-card p-3 xl:hidden">
        <summary className="cursor-pointer text-sm font-medium">{t('access.summary')}</summary>
        <div className="mt-3">{body}</div>
      </details>
      <aside className="sticky top-4 hidden rounded-lg border border-border bg-card p-4 xl:block">
        <h2 className="text-sm font-semibold">{t('access.summary')}</h2>
        <div className="mt-3">{body}</div>
      </aside>
    </>
  )
}
