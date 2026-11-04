import type { AccessGrantView } from '../../../entities/access'
import type { AccessBlockedGrant } from './errors'

export type DuplicatePlan = {
  operational: string[]
  delegation: string[]
  omitOperational: string[]
  omitDelegation: string[]
  blocked: AccessBlockedGrant[]
}

type CopyTarget = {
  delegableGrantIds: readonly string[]
  canDelegateFurther: boolean
} | null

/**
 * Same split the mock service applies: offered grants the caller can hand on are copied,
 * everything else stays blocked until the caller names it.
 */
export function planRoleDuplicate(
  role: { operational: readonly AccessGrantView[]; delegation: readonly AccessGrantView[] },
  target: CopyTarget,
): DuplicatePlan {
  const delegable = new Set(target?.delegableGrantIds ?? [])
  const further = target?.canDelegateFurther === true
  const operational: string[] = []
  const delegation: string[] = []
  const omitOperational: string[] = []
  const omitDelegation: string[] = []
  const blocked: AccessBlockedGrant[] = []
  const consider = (grant: AccessGrantView, kind: AccessBlockedGrant['kind'], needsFurther: boolean) => {
    const reason = !grant.offered
      ? 'not_offered' as const
      : !delegable.has(grant.id) || (needsFurther && !further)
        ? 'not_delegable' as const
        : null
    if (reason) {
      blocked.push({ id: grant.id, resource: grant.resource, action: grant.action, kind, reason })
      return false
    }
    return true
  }
  for (const grant of role.operational) {
    if (consider(grant, 'operational', false)) operational.push(grant.id)
    else omitOperational.push(grant.id)
  }
  for (const grant of role.delegation) {
    if (consider(grant, 'delegation', true)) delegation.push(grant.id)
    else omitDelegation.push(grant.id)
  }
  return { operational, delegation, omitOperational, omitDelegation, blocked }
}

/** Fold server-reported blocks into the omit lists so a refused grant is not sent again. */
export function planWithServerBlocks(plan: DuplicatePlan, extra: readonly AccessBlockedGrant[]): DuplicatePlan {
  if (extra.length === 0) return plan
  const operational = new Set(plan.operational)
  const delegation = new Set(plan.delegation)
  const omitOperational = new Set(plan.omitOperational)
  const omitDelegation = new Set(plan.omitDelegation)
  const blocked = [...plan.blocked]
  const known = new Set(blocked.map((item) => `${item.kind}:${item.id}`))
  for (const item of extra) {
    if (item.kind === 'operational') {
      operational.delete(item.id)
      omitOperational.add(item.id)
    } else {
      delegation.delete(item.id)
      omitDelegation.add(item.id)
    }
    const key = `${item.kind}:${item.id}`
    if (!known.has(key)) {
      known.add(key)
      blocked.push(item)
    }
  }
  return {
    operational: [...operational],
    delegation: [...delegation],
    omitOperational: [...omitOperational],
    omitDelegation: [...omitDelegation],
    blocked,
  }
}
