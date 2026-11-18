import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCESS_PERMISSION_CATALOG, type AccessGrantView, type PermissionGroupId } from '../../../entities/access'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { TabButton } from '../../../shared/ui/tab-button'

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
  'requests',
  'personnel',
  'directories',
  'system-registries',
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
  generalPanel?: ReactNode
  onOperational: (ids: string[]) => void
  onDelegation: (ids: string[]) => void
}

type MatrixRow = {
  grant: AccessGrantView
  label: string
  group: PermissionGroupId | 'preserved'
  sectionKey?: string
}

type GroupTabId = PermissionGroupId | 'preserved'
export type PermissionSectionTab = 'general' | GroupTabId

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

function groupLabel(item: GroupTabId, t: (key: string) => string): string {
  return item === 'preserved' ? t('access.preserved') : t(`access.groups.${item}`)
}

export function PermissionSets(props: PermissionSetsProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<PermissionSectionTab>('general')
  const delegable = useMemo(() => new Set(props.delegableIds), [props.delegableIds])
  const editable = props.editable !== false
  const needle = query.trim().toLowerCase()

  const catalogRows: MatrixRow[] = ACCESS_PERMISSION_CATALOG.flatMap((item) => {
    const grant = props.offered.find((entry) => entry.resource === item.resource && entry.action === item.action)
    if (!grant) return []
    return [{ grant, label: t(item.labelKey), group: item.group, sectionKey: item.sectionKey }]
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
  const groupIds: GroupTabId[] = [
    ...visibleGroups,
    ...(preservedRows.length > 0 ? ['preserved' as const] : []),
  ]
  const activeGroup = section !== 'general' && groupIds.includes(section) ? section : groupIds[0]
  const showGeneral = section === 'general' && props.generalPanel != null

  const mayPerform = (id: string) => delegable.has(id)
  const mayGrant = (id: string) => props.canDelegateFurther && delegable.has(id)
  const tabRows = !showGeneral && activeGroup
    ? rows.filter((row) => row.group === activeGroup && matches(row))
    : []

  const pickSection = (next: PermissionSectionTab) => {
    if (next !== 'general' && !groupIds.includes(next)) return
    setSection(next)
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border" role="tablist" aria-label={t('access.groups-label')}>
        {props.generalPanel != null ? (
          <TabButton active={section === 'general'} onClick={() => pickSection('general')}>
            {t('access.tabs.general')}
          </TabButton>
        ) : null}
        {groupIds.map((item) => (
          <TabButton key={item} active={section === item} onClick={() => pickSection(item)}>
            {groupLabel(item, t)}
          </TabButton>
        ))}
      </div>
      {showGeneral ? (
        <div className="min-w-0" role="tabpanel">
          {props.generalPanel}
        </div>
      ) : groupIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('access.search-empty')}</p>
      ) : (
        <div className="min-w-0 space-y-4" role="tabpanel">
          <label className="grid max-w-md gap-1 text-sm">
            {t('access.search')}
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('access.search')} />
          </label>
          <p className="text-sm text-muted-foreground">{t('access.matrix-hint')}</p>
          {tabRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('access.search-empty')}</p>
          ) : activeGroup ? (
            <GroupMatrix
              title={groupLabel(activeGroup, t)}
              rows={tabRows}
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
          ) : null}
        </div>
      )}
    </div>
  )
}

function sectionBlocks(rows: MatrixRow[]): Array<{ key: string; rows: MatrixRow[] }> {
  const order: string[] = []
  for (const row of rows) {
    const key = row.sectionKey ?? ''
    if (!order.includes(key)) order.push(key)
  }
  return order.map((key) => ({ key, rows: rows.filter((row) => (row.sectionKey ?? '') === key) }))
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
            {sectionBlocks(rows).map((block) => (
              <Fragment key={block.key || 'plain'}>
                {block.key ? (
                  <tr className="border-b border-border">
                    <th colSpan={3} className="px-2 pb-1 pt-3 text-left text-sm font-semibold text-foreground">
                      {t(`access.registry-sections.${block.key}`)}
                    </th>
                  </tr>
                ) : null}
                {block.rows.map((row) => {
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
