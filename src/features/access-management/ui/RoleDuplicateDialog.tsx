import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ACCESS_PERMISSION_CATALOG,
  useDuplicateAccessRoleMutation,
  type AccessCreatableScope,
  type AccessRoleView,
  type AccessScope,
} from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { RoleAvailabilityField } from './RoleAvailabilityField'
import { Textarea } from '../../../shared/ui/textarea'
import { planRoleDuplicate, planWithServerBlocks } from '../model/duplicate-plan'
import { accessErrorKey, accessFailure, type AccessBlockedGrant } from '../model/errors'
import { scopeKey } from './scope-label'

const NAME_LIMIT = 80

type RoleDuplicateDialogProps = {
  open: boolean
  role: AccessRoleView
  creatableScopes: readonly AccessCreatableScope[]
  organizations: readonly { id: number; shortName: string }[]
  preferredOrganizationId?: number | null
  accessVersion: number
  onOpenChange: (open: boolean) => void
  onCreated: (roleId: string) => void
}

export function RoleDuplicateDialog({
  open,
  role,
  creatableScopes,
  organizations,
  preferredOrganizationId = null,
  accessVersion,
  onOpenChange,
  onCreated,
}: RoleDuplicateDialogProps) {
  const { t } = useTranslation()
  const [duplicateRole, duplicateState] = useDuplicateAccessRoleMutation()
  const [name, setName] = useState(() => copyName(role.displayName, t('access.duplicate-suffix')))
  const [description, setDescription] = useState(role.description)
  const [scopeId, setScopeId] = useState(() => initialScopeId(role.ownerScope, creatableScopes))
  const [acceptPartial, setAcceptPartial] = useState(false)
  const [serverBlocked, setServerBlocked] = useState<AccessBlockedGrant[]>([])
  const [failure, setFailure] = useState<string | null>(null)
  const selected = creatableScopes.find((item) => scopeKey(item.scope) === scopeId) ?? null
  const plan = useMemo(() => {
    const local = planRoleDuplicate(role, selected)
    return planWithServerBlocks(local, serverBlocked)
  }, [role, selected, serverBlocked])
  const blocked = plan.blocked.length > 0
  const pending = duplicateState.isLoading
  const canSubmit = name.trim().length > 0 && selected != null && (!blocked || acceptPartial) && !pending

  const grantLabel = (item: AccessBlockedGrant) => {
    const known = ACCESS_PERMISSION_CATALOG.find((entry) => entry.resource === item.resource && entry.action === item.action)
    const label = known ? t(known.labelKey) : item.resource ? `${item.resource}.${item.action}` : t('access.preserved-item')
    return t('access.duplicate-blocked-item', {
      kind: t(`access.duplicate-kind.${item.kind}`),
      label,
      reason: t(`access.duplicate-blocked-reason.${item.reason.replaceAll('_', '-')}`),
    })
  }

  const submit = async () => {
    if (!canSubmit || !selected) return
    setFailure(null)
    try {
      const created = await duplicateRole({
        sourceRoleId: role.id,
        displayName: name.trim(),
        description: description.trim(),
        ownerScope: selected.scope,
        grantIds: plan.operational,
        delegationGrantIds: plan.delegation,
        omitGrantIds: plan.omitOperational,
        omitDelegationGrantIds: plan.omitDelegation,
        expectedAccessVersion: accessVersion,
      }).unwrap()
      toast.success(t('access.role-duplicated', { name: created.role.displayName }))
      onOpenChange(false)
      onCreated(created.role.id)
    } catch (error) {
      const parsed = accessFailure(error)
      if (parsed.blocked && parsed.blocked.length > 0) setServerBlocked(parsed.blocked)
      const message = t(accessErrorKey(parsed.code))
      setFailure(message)
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <DialogContent className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('access.duplicate-title')}</DialogTitle>
          <DialogDescription>{t('access.duplicate-lead')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Label className="grid gap-1 font-normal">
            {t('access.name')}
            <Input
              value={name}
              maxLength={NAME_LIMIT}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </Label>
          <Label className="grid gap-1 font-normal">
            {t('access.description')}
            <Textarea
              value={description}
              maxLength={500}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Label>
          {creatableScopes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('access.duplicate-no-scope')}</p>
          ) : (
            <RoleAvailabilityField
              scopes={creatableScopes}
              organizations={organizations}
              preferredOrganizationId={preferredOrganizationId}
              value={selected?.scope ?? null}
              disabled={pending}
              onChange={(scope) => {
                setScopeId(scopeKey(scope))
                setAcceptPartial(false)
                setServerBlocked([])
              }}
            />
          )}
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <p>{t('access.duplicate-permissions', { count: plan.operational.length + plan.delegation.length })}</p>
            <p className="text-muted-foreground">{t('access.duplicate-operational', { count: plan.operational.length })}</p>
            <p className="text-muted-foreground">{t('access.duplicate-delegation', { count: plan.delegation.length })}</p>
            <p className="mt-1 text-muted-foreground">{t('access.duplicate-users-note')}</p>
          </div>
          {blocked ? (
            <div className="grid gap-2" role="status">
              <p className="text-sm font-medium">{t('access.duplicate-blocked-title')}</p>
              <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-muted-foreground">
                {plan.blocked.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>{grantLabel(item)}</li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={acceptPartial}
                  disabled={pending}
                  onCheckedChange={(checked) => setAcceptPartial(checked === true)}
                />
                <span>{t('access.duplicate-accept-partial')}</span>
              </label>
            </div>
          ) : null}
          {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {t('access.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t('access.duplicate-submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function copyName(name: string, suffix: string): string {
  const trimmed = name.trim()
  const full = `${trimmed}${suffix}`
  if (full.length <= NAME_LIMIT) return full
  const room = Math.max(1, NAME_LIMIT - suffix.length)
  return `${trimmed.slice(0, room).trimEnd()}${suffix}`.slice(0, NAME_LIMIT)
}

function initialScopeId(owner: AccessScope, scopes: readonly AccessCreatableScope[]): string {
  const current = scopeKey(owner)
  if (scopes.some((item) => scopeKey(item.scope) === current)) return current
  const first = scopes[0]
  return first ? scopeKey(first.scope) : ''
}
