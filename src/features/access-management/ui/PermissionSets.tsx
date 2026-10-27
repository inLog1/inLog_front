import { useTranslation } from 'react-i18next'
import { ACCESS_PERMISSION_CATALOG, type AccessGrantView, type PermissionGroupId } from '../../../entities/access'
import { Checkbox } from '../../../shared/ui/checkbox'

const GROUPS: PermissionGroupId[] = [
  'tasks',
  'constructor-schema',
  'constructor-records',
  'reports',
  'access',
]

type PermissionSetsProps = {
  offered: readonly AccessGrantView[]
  delegableIds: readonly string[]
  canDelegateFurther: boolean
  operationalIds: readonly string[]
  delegationIds: readonly string[]
  preservedOperational: readonly AccessGrantView[]
  preservedDelegation: readonly AccessGrantView[]
  onOperational: (ids: string[]) => void
  onDelegation: (ids: string[]) => void
}

function toggle(ids: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return ids.includes(id) ? [...ids] : [...ids, id]
  return ids.filter((item) => item !== id)
}

export function PermissionSets(props: PermissionSetsProps) {
  const { t } = useTranslation()
  const delegable = new Set(props.delegableIds)
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <PermissionColumn
        title={t('access.can-perform')}
        hint={t('access.can-perform-hint')}
        offered={props.offered}
        selected={props.operationalIds}
        preserved={props.preservedOperational}
        mayAdd={(id) => delegable.has(id)}
        disabledReason={t('access.not-delegable')}
        onChange={props.onOperational}
      />
      <PermissionColumn
        title={t('access.can-grant')}
        hint={t('access.can-grant-hint')}
        offered={props.offered}
        selected={props.delegationIds}
        preserved={props.preservedDelegation}
        mayAdd={(id) => props.canDelegateFurther && delegable.has(id)}
        disabledReason={props.canDelegateFurther ? t('access.not-delegable') : t('access.no-further')}
        onChange={props.onDelegation}
      />
    </div>
  )
}

function PermissionColumn({
  title,
  hint,
  offered,
  selected,
  preserved,
  mayAdd,
  disabledReason,
  onChange,
}: {
  title: string
  hint: string
  offered: readonly AccessGrantView[]
  selected: readonly string[]
  preserved: readonly AccessGrantView[]
  mayAdd: (id: string) => boolean
  disabledReason: string
  onChange: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const selectedSet = new Set(selected)

  const row = (grant: AccessGrantView, label: string) => {
    const checked = selectedSet.has(grant.id)
    const disabled = !checked && !mayAdd(grant.id)
    return (
      <label key={grant.id} className="flex min-w-0 items-start gap-2 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onChange(toggle(selected, grant.id, value === true))}
        />
        <span className="min-w-0">
          <span className="block">{label}</span>
          <span className="block text-xs text-muted-foreground">{grant.resource}.{grant.action}</span>
          {disabled ? <span className="block text-xs text-muted-foreground">{disabledReason}</span> : null}
        </span>
      </label>
    )
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-4 space-y-4">
        {GROUPS.map((group) => (
          <fieldset key={group} className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{t(`access.groups.${group}`)}</legend>
            {ACCESS_PERMISSION_CATALOG.filter((item) => item.group === group).map((item) => {
              const grant = offered.find((entry) => entry.resource === item.resource && entry.action === item.action)
              if (!grant) return null
              return row(grant, t(item.labelKey))
            })}
          </fieldset>
        ))}
        {preserved.length > 0 ? (
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{t('access.preserved')}</legend>
            <p className="text-xs text-muted-foreground">{t('access.preserved-hint')}</p>
            {preserved.map((grant) => row(grant, `${grant.resource}.${grant.action}`))}
          </fieldset>
        ) : null}
      </div>
    </section>
  )
}
