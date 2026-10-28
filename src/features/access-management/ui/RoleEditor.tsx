import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useCreateAccessRoleMutation,
  useDeleteAccessRoleMutation,
  useGetAccessDirectoryQuery,
  useGetAccessRoleQuery,
  useGetSessionAccessQuery,
  useUpdateAccessRoleMutation,
  type AccessGrantView,
  type AccessScope,
} from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { EditorActions, PageHeader, PageState, WorkPage } from '../../../shared/ui/page'
import { accessErrorKey, accessFailure } from '../model/errors'
import { PermissionSets } from './PermissionSets'
import { scopeLabel } from './scope-label'

type RoleEditorProps = {
  roleId: string | null
  owner: 'organization' | 'corporation'
  organizationId: number | null
  backHref: string
  savedHref: (roleId: string) => string
}

export function RoleEditor({ roleId, owner, organizationId, backHref, savedHref }: RoleEditorProps) {
  if (roleId) return <ExistingRole roleId={roleId} backHref={backHref} savedHref={savedHref} />
  return <NewRole owner={owner} organizationId={organizationId} backHref={backHref} savedHref={savedHref} />
}

function NewRole({ owner, organizationId, backHref, savedHref }: { owner: 'organization' | 'corporation'; organizationId: number | null; backHref: string; savedHref: (roleId: string) => string }) {
  const { t } = useTranslation()
  const skip = owner === 'organization' && organizationId == null
  const directory = useGetAccessDirectoryQuery(
    owner === 'corporation' ? { scope: 'corporation' } : { scope: 'organization', organizationId: organizationId ?? 0 },
    { skip },
  )
  const ownerScope: AccessScope | null = directory.data == null
    ? null
    : owner === 'corporation'
      ? { type: 'corporation', corporationId: directory.data.corporationId }
      : directory.data.organizationId == null
        ? null
        : { type: 'organization', organizationId: directory.data.organizationId, corporationId: directory.data.corporationId }
  if (directory.isError && !directory.data) return <EditorStatus error={directory.error} />
  if (directory.isLoading || !directory.data || !ownerScope) {
    return <WorkPage><PageState kind="loading" description={t('access.loading')} /></WorkPage>
  }
  if (!directory.data.canCreateRole) return <CreateDenied backHref={backHref} />
  return (
    <RoleForm
      backHref={backHref}
      savedHref={savedHref}
      ownerScope={ownerScope}
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

function ExistingRole({ roleId, backHref, savedHref }: { roleId: string; backHref: string; savedHref: (roleId: string) => string }) {
  const role = useGetAccessRoleQuery(roleId)
  if (role.isLoading || !role.data) {
    return <EditorStatus error={role.isError ? role.error : null} />
  }
  return (
    <RoleForm
      backHref={backHref}
      savedHref={savedHref}
      ownerScope={role.data.role.ownerScope}
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

function CreateDenied({ backHref }: { backHref: string }) {
  const { t } = useTranslation()
  return (
    <WorkPage>
      <PageHeader
        title={t('access.edit-title')}
        breadcrumbs={[{ label: t('nav.access'), to: backHref }, { label: t('access.create-role') }]}
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
  backHref,
  savedHref,
  ownerScope,
  organizations,
  projects,
  offered,
  delegableIds,
  canDelegateFurther,
  canEdit,
  initial,
}: {
  backHref: string
  savedHref: (roleId: string) => string
  ownerScope: AccessScope
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
  const [operationalIds, setOperationalIds] = useState(initial?.operational.map((item) => item.id) ?? [])
  const [delegationIds, setDelegationIds] = useState(initial?.delegation.map((item) => item.id) ?? [])
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createRole, createState] = useCreateAccessRoleMutation()
  const [updateRole, updateState] = useUpdateAccessRoleMutation()
  const [deleteRole, deleteState] = useDeleteAccessRoleMutation()
  const session = useGetSessionAccessQuery(undefined, { skip: import.meta.env.VITE_API_MODE !== 'mock' })
  const operatorOwner = session.data?.accessState === 'ready' && session.data.systemCapabilities.includes('corporate_superadmin')
  const offeredIds = new Set(offered.map((item) => item.id))
  const preservedOperational = (initial?.operational ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))
  const preservedDelegation = (initial?.delegation ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))

  const save = async () => {
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
      ownerScope,
    }
    try {
      if (initial) {
        await updateRole({ roleId: initial.id, body }).unwrap()
        setNotice(t('access.role-saved'))
        toast.success(t('access.role-saved'))
      } else {
        const created = await createRole(body).unwrap()
        toast.success(t('access.role-saved'))
        navigate(savedHref(created.role.id), { replace: true })
      }
    } catch (error) {
      const parsed = accessFailure(error)
      const message = t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 })
      setFailure(message)
      toast.error(message)
    }
  }

  const remove = async () => {
    if (!initial) return
    setFailure(null)
    setNotice(null)
    try {
      await deleteRole({ roleId: initial.id }).unwrap()
      toast.success(t('access.role-deleted'))
      navigate(backHref, { replace: true })
    } catch (error) {
      const parsed = accessFailure(error)
      setFailure(t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 }))
    }
  }

  const scopeText = scopeLabel(ownerScope, organizations, projects, t)
  const busy = !canEdit || createState.isLoading || updateState.isLoading
  const actionButtons = () => (
    <>
      <Button asChild variant="outline">
        <Link to={backHref}>{t('access.cancel')}</Link>
      </Button>
      {initial ? (
        <Button type="button" variant="outline" disabled={deleteState.isLoading || !initial.canDelete} onClick={() => void remove()}>
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
          { label: t('nav.access'), to: backHref },
          { label: initial ? initial.displayName : t('access.create-role') },
        ]}
        actions={actionButtons()}
      />
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}
      {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
      {operatorOwner ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
          <span className="font-medium">{t('access.installation-superadmin')}</span>
          <span className="mt-1 block text-muted-foreground">{t('access.installation-superadmin-note')}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('access.role-not-capability')}</p>
      )}
      <div className="grid max-w-xl gap-3">
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
        <div className="grid min-w-0 gap-1 text-sm">
          <span>{t('access.owner')}</span>
          <p className="flex h-9 items-center rounded-md border border-border bg-card px-3">{scopeText}</p>
          {ownerScope.type === 'corporation' ? <p className="text-xs text-muted-foreground">{t('access.scope.corporation-help')}</p> : null}
        </div>
        <label className="grid min-w-0 gap-1 text-sm">
          {t('access.description')}
          <Textarea value={description} disabled={!canEdit} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
        </label>
      </div>
      {!canEdit ? <p className="text-sm text-foreground">{t('access.edit-denied')}</p> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <PermissionSets
          offered={offered}
          delegableIds={delegableIds}
          canDelegateFurther={canDelegateFurther}
          operationalIds={operationalIds}
          delegationIds={delegationIds}
          preservedOperational={preservedOperational}
          preservedDelegation={preservedDelegation}
          editable={canEdit}
          onOperational={setOperationalIds}
          onDelegation={setDelegationIds}
        />
        <RoleSummary
          scopeText={scopeText}
          operationalCount={operationalIds.length}
          delegationCount={delegationIds.length}
          people={initial?.affectedUserCount ?? 0}
          assigned={initial != null}
        />
      </div>
      <details className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">{t('access.dependencies-title')}</summary>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>{t('access.dependencies.independent')}</li>
          <li>{t('access.dependencies.schema')}</li>
          <li>{t('access.dependencies.report')}</li>
          <li>{t('access.dependencies.task')}</li>
          <li>{t('access.dependencies.delegate')}</li>
          <li>{t('access.dependencies.roles')}</li>
          <li>{t('access.dependencies.forms')}</li>
          <li>{t('access.dependencies.table-views')}</li>
        </ul>
      </details>
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
      <EditorActions
        notice={(
          <>
            {initial && !initial.canDelete ? <p className="text-foreground">{t('access.delete-blocked')}</p> : null}
            {notice ? <p role="status">{notice}</p> : null}
            {failure ? <p className="text-destructive" role="alert">{failure}</p> : null}
          </>
        )}
      >
        {actionButtons()}
      </EditorActions>
    </WorkPage>
  )
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
      <p><span className="text-muted-foreground">{t('access.owner')}: </span>{scopeText}</p>
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
