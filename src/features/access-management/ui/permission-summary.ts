import type { TFunction } from 'i18next'
import { ACCESS_PERMISSION_CATALOG, type AccessGrantView } from '../../../entities/access'

export function permissionSummary(grants: readonly AccessGrantView[]): string {
  const codes = grants.map((grant) => `${grant.resource}.${grant.action}`)
  if (codes.length <= 4) return codes.join(', ')
  return `${codes.slice(0, 4).join(', ')} +${codes.length - 4}`
}

const PREVIEW_GROUPS = 3

/** Group names for the role table, plus how many grants sit outside the named groups. */
export function permissionPreview(grants: readonly AccessGrantView[], t: TFunction): { lead: string; extra: number } {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const grant of grants) {
    const known = ACCESS_PERMISSION_CATALOG.find((item) => item.resource === grant.resource && item.action === grant.action)
    const key = known?.group ?? 'preserved'
    if (!counts.has(key)) order.push(key)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const shown = order.slice(0, PREVIEW_GROUPS)
  const shownCount = shown.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0)
  const lead = shown
    .map((key) => (key === 'preserved' ? t('access.preserved-item') : t(`access.groups.${key}`)))
    .join(', ')
  return { lead, extra: Math.max(0, grants.length - shownCount) }
}
