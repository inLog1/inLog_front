import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCESS_PERMISSION_CATALOG, type AccessGrantView, type PermissionGroupId } from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'

const GROUPS: PermissionGroupId[] = [
  'tasks',
  'constructor-schema',
  'constructor-records',
  'reports',
  'forms',
  'table-views',
  'sections',
  'access',
  'organizations',
  'projects',
]

type PermissionSetsProps = {
  offered: readonly AccessGrantView[]
  delegableIds: readonly string[]
  canDelegateFurther: boolean
  operationalIds: readonly string[]
  delegationIds: readonly string[]
  preservedOperational: readonly AccessGrantView[]
  preservedDelegation: readonly AccessGrantView[]
  editable?: boolean
  onOperational: (ids: string[]) => void
  onDelegation: (ids: string[]) => void
}

type MatrixRow = {
  grant: AccessGrantView
  label: string
  group: PermissionGroupId | 'preserved'
}

function toggle(ids: readonly string[], id: string, checked: boolean): string[] {
  if (checked) return ids.includes(id) ? [...ids] : [...ids, id]
  return ids.filter((item) => item !== id)
}

function addAvailable(selected: readonly string[], grants: readonly AccessGrantView[], mayAdd: (id: string) => boolean): string[] {
  const next = new Set(selected)
  for (const grant of grants) {
    if (mayAdd(grant.id)) next.add(grant.id)
  }
  return [...next]
}

export function PermissionSets(props: PermissionSetsProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<PermissionGroupId | 'preserved' | 'all'>('all')
  const delegable = useMemo(() => new Set(props.delegableIds), [props.delegableIds])
  const editable = props.editable !== false
  const needle = query.trim().toLowerCase()

  const catalogRows: MatrixRow[] = ACCESS_PERMISSION_CATALOG.flatMap((item) => {
    const grant = props.offered.find((entry) => entry.resource === item.resource && entry.action === item.action)
    if (!grant) return []
    return [{ grant, label: t(item.labelKey), group: item.group }]
  })
  const preservedIds = new Set<string>()
  const preservedRows: MatrixRow[] = []
  for (const grant of [...props.preservedOperational, ...props.preservedDelegation]) {
    if (preservedIds.has(grant.id)) continue
    preservedIds.add(grant.id)
    preservedRows.push({ grant, label: t('access.preserved-item'), group: 'preserved' })
  }
  const rows = [...catalogRows, ...preservedRows]
  const matches = (row: MatrixRow) => {
    if (!needle) return true
    const code = `${row.grant.resource}.${row.grant.action}`.toLowerCase()
    return row.label.toLowerCase().includes(needle) || code.includes(needle)
  }
  const visibleGroups = GROUPS.filter((item) => rows.some((row) => row.group === item))
  const groupIds: Array<PermissionGroupId | 'preserved' | 'all'> = [
    'all',
    ...visibleGroups,
    ...(preservedRows.length > 0 ? ['preserved' as const] : []),
  ]
  const selectedGroup = groupIds.includes(group) ? group : 'all'
  const shown = rows.filter((row) => (selectedGroup === 'all' || row.group === selectedGroup) && matches(row))
  const grouped = selectedGroup === 'all'
    ? groupIds.filter((item) => item !== 'all').map((item) => ({
      id: item,
      rows: shown.filter((row) => row.group === item),
    })).filter((item) => item.rows.length > 0)
    : [{ id: selectedGroup, rows: shown }]

  const mayPerform = (id: string) => delegable.has(id)
  const mayGrant = (id: string) => props.canDelegateFurther && delegable.has(id)

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-w-0">
        <label className="grid gap-1 text-sm">
          {t('access.search')}
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('access.search')} />
        </label>
        <label className="mt-3 grid gap-1 text-sm lg:hidden">
          {t('access.groups-label')}
          <select
            className="h-9 rounded-md border border-border bg-background px-2"
            value={selectedGroup}
            onChange={(event) => setGroup(event.target.value as PermissionGroupId | 'preserved' | 'all')}
          >
            {groupIds.map((item) => (
              <option key={item} value={item}>{item === 'all' ? t('access.all-groups') : item === 'preserved' ? t('access.preserved') : t(`access.groups.${item}`)}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 hidden flex-col gap-1 lg:flex" role="tablist" aria-label={t('access.groups-label')}>
          {groupIds.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === selectedGroup}
              className={item === selectedGroup
                ? 'rounded-lg bg-primary/10 px-3 py-2 text-left text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : 'rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'}
              onClick={() => setGroup(item)}
            >
              {item === 'all' ? t('access.all-groups') : item === 'preserved' ? t('access.preserved') : t(`access.groups.${item}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 space-y-4" role="tabpanel">
        <p className="text-sm text-muted-foreground">{t('access.matrix-hint')}</p>
        {grouped.length === 0 ? <p className="text-sm text-muted-foreground">{t('access.search-empty')}</p> : null}
        {grouped.map((block) => (
          <GroupMatrix
            key={block.id}
            title={block.id === 'preserved' ? t('access.preserved') : t(`access.groups.${block.id}`)}
            rows={block.rows}
            operationalIds={props.operationalIds}
            delegationIds={props.delegationIds}
            editable={editable}
            mayPerform={mayPerform}
            mayGrant={mayGrant}
            performReason={t('access.not-delegable')}
            grantReason={props.canDelegateFurther ? t('access.not-delegable') : t('access.no-further')}
            lockedReason={t('access.edit-denied')}
            onOperational={props.onOperational}
            onDelegation={props.onDelegation}
          />
        ))}
      </div>
    </div>
  )
}

function GroupMatrix({
  title,
  rows,
  operationalIds,
  delegationIds,
  editable,
  mayPerform,
  mayGrant,
  performReason,
  grantReason,
  lockedReason,
  onOperational,
  onDelegation,
}: {
  title: string
  rows: MatrixRow[]
  operationalIds: readonly string[]
  delegationIds: readonly string[]
  editable: boolean
  mayPerform: (id: string) => boolean
  mayGrant: (id: string) => boolean
  performReason: string
  grantReason: string
  lockedReason: string
  onOperational: (ids: string[]) => void
  onDelegation: (ids: string[]) => void
}) {
  const { t } = useTranslation()
  const operational = new Set(operationalIds)
  const delegation = new Set(delegationIds)
  const performTargets = rows.map((row) => row.grant).filter((grant) => mayPerform(grant.id) && !operational.has(grant.id))
  const grantTargets = rows.map((row) => row.grant).filter((grant) => mayGrant(grant.id) && !delegation.has(grant.id))
  const performLockedAll = rows.length > 0 && rows.every((row) => !operational.has(row.grant.id) && (!editable || !mayPerform(row.grant.id)))
  const grantLockedAll = rows.length > 0 && rows.every((row) => !delegation.has(row.grant.id) && (!editable || !mayGrant(row.grant.id)))
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editable || performTargets.length === 0}
            onClick={() => onOperational(addAvailable(operationalIds, rows.map((row) => row.grant), mayPerform))}
          >
            {t('access.select-perform')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editable || grantTargets.length === 0}
            onClick={() => onDelegation(addAvailable(delegationIds, rows.map((row) => row.grant), mayGrant))}
          >
            {t('access.select-grant')}
          </Button>
        </div>
      </div>
      {!editable ? <p className="mt-2 text-xs text-foreground">{lockedReason}</p> : null}
      {editable && performLockedAll ? <p className="mt-2 text-xs text-foreground">{performReason}</p> : null}
      {editable && grantLockedAll ? <p className="mt-2 text-xs text-foreground">{grantReason}</p> : null}
      {editable && rows.some((row) => mayPerform(row.grant.id)) && performTargets.length === 0 ? <p className="mt-2 text-xs text-foreground">{t('access.select-perform-done')}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">{t('access.matrix.action')}</th>
              <th className="px-2 py-2 font-medium">{t('access.matrix.perform')}</th>
              <th className="px-2 py-2 font-medium">{t('access.matrix.grant')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const performOn = operational.has(row.grant.id)
              const grantOn = delegation.has(row.grant.id)
              const performDisabled = !editable || (!performOn && !mayPerform(row.grant.id))
              const grantDisabled = !editable || (!grantOn && !mayGrant(row.grant.id))
              const performText = !editable ? lockedReason : performReason
              const grantText = !editable ? lockedReason : grantReason
              return (
                <tr key={row.grant.id} className="border-b border-border align-top last:border-0">
                  <td className="px-2 py-2">
                    <span className="block font-medium">{row.label}</span>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">{t('access.technical')}</summary>
                      <p className="mt-1 text-xs text-muted-foreground">{row.grant.resource}.{row.grant.action}</p>
                    </details>
                  </td>
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={performOn}
                      disabled={performDisabled}
                      aria-label={t('access.matrix.perform')}
                      onCheckedChange={(value) => onOperational(toggle(operationalIds, row.grant.id, value === true))}
                    />
                    {editable && performDisabled && !performLockedAll ? <p className="mt-1 max-w-[12rem] text-xs text-foreground">{performText}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={grantOn}
                      disabled={grantDisabled}
                      aria-label={t('access.matrix.grant')}
                      onCheckedChange={(value) => onDelegation(toggle(delegationIds, row.grant.id, value === true))}
                    />
                    {editable && grantDisabled && !grantLockedAll ? <p className="mt-1 max-w-[12rem] text-xs text-foreground">{grantText}</p> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
