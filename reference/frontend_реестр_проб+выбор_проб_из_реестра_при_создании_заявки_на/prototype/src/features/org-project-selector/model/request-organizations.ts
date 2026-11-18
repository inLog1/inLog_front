import { actionCovered } from '../../../entities/access/model/grants'
import type { EffectiveGrant } from '../../../entities/access/model/types'

/**
 * Organizations this subject may open for one action.
 * A corporation grant covers every listed organization.
 * An organization grant covers that organization.
 * A project grant does not open the organization itself.
 * The role display name is not an input.
 */
export function organizationIdsForAction(
  organizationIds: readonly number[],
  grants: readonly EffectiveGrant[],
  resource: string,
  action: string,
): number[] {
  const known = organizationIds.filter((id) => Number.isInteger(id) && id > 0)
  const relevant = grants.filter((grant) => grant.resource === resource && actionCovered(grant.action, action))
  if (relevant.some((grant) => grant.scope.type === 'corporation')) return known
  const allowed = new Set<number>()
  for (const grant of relevant) {
    if (grant.scope.type === 'organization') allowed.add(grant.scope.organizationId)
  }
  return known.filter((id) => allowed.has(id))
}

/** Short name in the switcher. The full name is the fallback. */
export function organizationOptionLabel(organization: { id: number; shortName?: string; fullName?: string }): string {
  const shortName = organization.shortName?.trim() ?? ''
  if (shortName) return shortName
  const fullName = organization.fullName?.trim() ?? ''
  if (fullName) return fullName
  return String(organization.id)
}
