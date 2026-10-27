import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  useCreateAccessRoleMutation,
  useDeleteAccessRoleMutation,
  useGetAccessDirectoryQuery,
  useGetAccessRoleQuery,
  useUpdateAccessRoleMutation,
  type AccessGrantView,
  type AccessScope,
} from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { accessErrorKey, accessFailure } from '../model/errors'
import { PermissionSets } from './PermissionSets'
import { scopeLabel } from './scope-label'

type RoleEditorProps = {
  roleId: string | null
  owner: 'organization' | 'corporation'
  organizationId: number | null
  backHref: string
}

export function RoleEditor({ roleId, owner, organizationId, backHref }: RoleEditorProps) {
  if (roleId) return <ExistingRole roleId={roleId} backHref={backHref} />
  return <NewRole owner={owner} organizationId={organizationId} backHref={backHref} />
}

function NewRole({ owner, organizationId, backHref }: { owner: 'organization' | 'corporation'; organizationId: number | null; backHref: string }) {
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
  if (directory.isLoading || !directory.data || !ownerScope) {
    return <p className="p-4 text-sm text-muted-foreground">{directory.isError ? null : '…'}</p>
  }
  return (
    <RoleForm
      backHref={backHref}
      ownerScope={ownerScope}
      organizations={directory.data.organizations}
      projects={directory.data.projects}
      offered={directory.data.offeredGrants}
      delegableIds={directory.data.delegableGrantIds}
      canDelegateFurther={directory.data.canDelegateFurther}
      initial={null}
    />
  )
}

function ExistingRole({ roleId, backHref }: { roleId: string; backHref: string }) {
  const role = useGetAccessRoleQuery(roleId)
  if (role.isLoading || !role.data) {
    return <EditorStatus error={role.isError ? role.error : null} />
  }
  return (
    <RoleForm
      backHref={backHref}
      ownerScope={role.data.role.ownerScope}
      organizations={role.data.organizations}
      projects={role.data.projects}
      offered={role.data.offeredGrants}
      delegableIds={role.data.delegableGrantIds}
      canDelegateFurther={role.data.canDelegateFurther}
      initial={role.data.role}
    />
  )
}

function EditorStatus({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return <p className="p-4 text-sm text-muted-foreground">{t('access.loading')}</p>
  return <p className="p-4 text-sm text-destructive" role="alert">{t(accessErrorKey(accessFailure(error).code))}</p>
}

function RoleForm({
  backHref,
  ownerScope,
  organizations,
  projects,
  offered,
  delegableIds,
  canDelegateFurther,
  initial,
}: {
  backHref: string
  ownerScope: AccessScope
  organizations: Array<{ id: number; shortName: string }>
  projects: Array<{ id: number; name: string; organizationId: number }>
  offered: AccessGrantView[]
  delegableIds: string[]
  canDelegateFurther: boolean
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
  const [name, setName] = useState(initial?.displayName ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [operationalIds, setOperationalIds] = useState(initial?.operational.map((item) => item.id) ?? [])
  const [delegationIds, setDelegationIds] = useState(initial?.delegation.map((item) => item.id) ?? [])
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createRole, createState] = useCreateAccessRoleMutation()
  const [updateRole, updateState] = useUpdateAccessRoleMutation()
  const [deleteRole, deleteState] = useDeleteAccessRoleMutation()
  const offeredIds = new Set(offered.map((item) => item.id))
  const preservedOperational = (initial?.operational ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))
  const preservedDelegation = (initial?.delegation ?? []).filter((item) => !item.offered && !offeredIds.has(item.id))

  const save = async () => {
    setFailure(null)
    setNotice(null)
    const body = {
      displayName: name,
      description,
      grantIds: operationalIds,
      delegationGrantIds: delegationIds,
      ownerScope,
    }
    try {
      if (initial) await updateRole({ roleId: initial.id, body }).unwrap()
      else await createRole(body).unwrap()
      setNotice(t('access.role-saved'))
    } catch (error) {
      const parsed = accessFailure(error)
      setFailure(t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 }))
    }
  }

  const remove = async () => {
    if (!initial) return
    setFailure(null)
    setNotice(null)
    try {
      await deleteRole({ roleId: initial.id }).unwrap()
      setNotice(t('access.role-deleted'))
    } catch (error) {
      const parsed = accessFailure(error)
      setFailure(t(accessErrorKey(parsed.code), { count: parsed.assignmentCount ?? 0 }))
    }
  }

  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-4 p-4 md:p-6">
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link to={backHref}>{t('access.back')}</Link>
      </Button>
      <p className="text-sm text-muted-foreground">{t('access.owner')}: {scopeLabel(ownerScope, organizations, projects, t)}</p>
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
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>{t('access.dependencies.independent')}</li>
        <li>{t('access.dependencies.schema')}</li>
        <li>{t('access.dependencies.report')}</li>
        <li>{t('access.dependencies.task')}</li>
        <li>{t('access.dependencies.delegate')}</li>
        <li>{t('access.dependencies.forms')}</li>
      </ul>
      <label className="grid min-w-0 gap-1 text-sm">
        {t('access.name')}
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        {t('access.description')}
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
      </label>
      <PermissionSets
        offered={offered}
        delegableIds={delegableIds}
        canDelegateFurther={canDelegateFurther}
        operationalIds={operationalIds}
        delegationIds={delegationIds}
        preservedOperational={preservedOperational}
        preservedDelegation={preservedDelegation}
        onOperational={setOperationalIds}
        onDelegation={setDelegationIds}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={createState.isLoading || updateState.isLoading} onClick={() => void save()}>
          {t('access.save')}
        </Button>
        {initial ? (
          <Button type="button" variant="outline" disabled={deleteState.isLoading || !initial.canDelete} onClick={() => void remove()}>
            {t('access.delete-role')}
          </Button>
        ) : null}
      </div>
      {initial && !initial.canDelete ? <p className="text-sm text-muted-foreground">{t('access.delete-blocked')}</p> : null}
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}
      {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
    </div>
  )
}
