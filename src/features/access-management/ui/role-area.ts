import type { AccessCreatableScope, AccessScope } from '../../../entities/access'
import { scopeKey } from './scope-label'

export type RoleArea =
  | { kind: 'corporation'; scope: AccessScope }
  | { kind: 'organizations'; scopes: AccessScope[] }

export function areaKey(area: RoleArea): string {
  if (area.kind === 'corporation') return scopeKey(area.scope)
  const corporationId = area.scopes.find((scope) => scope.type === 'organization' || scope.type === 'project')?.corporationId ?? 0
  const ids = area.scopes.flatMap((scope) => scope.type === 'organization' ? [scope.organizationId] : [])
  return `organizations:${corporationId}:${[...ids].sort((left, right) => left - right).join(',')}`
}

export function areaFromOwner(owner: AccessScope, organizationIds: readonly number[] = []): RoleArea {
  if (owner.type === 'corporation') return { kind: 'corporation', scope: owner }
  if (owner.type === 'organization' || owner.type === 'project') {
    const ids = organizationIds.length > 0 ? organizationIds : [owner.organizationId]
    const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0).sort((left, right) => left - right)
    return {
      kind: 'organizations',
      scopes: unique.map((organizationId) => ({
        type: 'organization' as const,
        organizationId,
        corporationId: owner.corporationId,
      })),
    }
  }
  return { kind: 'organizations', scopes: [] }
}

export function preferredArea(
  scopes: readonly AccessCreatableScope[],
  owner: 'organization' | 'corporation',
  organizationId: number | null,
): RoleArea | null {
  const corporation = scopes.find((item) => item.scope.type === 'corporation') ?? null
  const organization = scopes.find((item) => item.scope.type === 'organization' && item.scope.organizationId === organizationId) ?? null
  const firstOrganization = scopes.find((item) => item.scope.type === 'organization') ?? null
  if (owner === 'organization' && organization) return { kind: 'organizations', scopes: [organization.scope] }
  if (owner === 'corporation' && corporation) return { kind: 'corporation', scope: corporation.scope }
  if (organization) return { kind: 'organizations', scopes: [organization.scope] }
  if (corporation) return { kind: 'corporation', scope: corporation.scope }
  if (firstOrganization) return { kind: 'organizations', scopes: [firstOrganization.scope] }
  return null
}

export function writeArea(area: RoleArea): { ownerScope: AccessScope; organizationIds?: number[] } | null {
  if (area.kind === 'corporation') {
    if (area.scope.type !== 'corporation') return null
    return { ownerScope: area.scope }
  }
  const scopes = area.scopes.filter((scope) => scope.type === 'organization')
  if (scopes.length === 0) return null
  const sorted = [...scopes].sort((left, right) => left.organizationId - right.organizationId)
  const ownerScope = sorted[0]
  if (!ownerScope) return null
  const organizationIds = sorted.map((scope) => scope.organizationId)
  return organizationIds.length > 1 ? { ownerScope, organizationIds } : { ownerScope }
}

export function availabilityLimits(
  area: RoleArea,
  creatable: readonly AccessCreatableScope[],
): { delegableGrantIds: string[]; canDelegateFurther: boolean } {
  if (area.kind === 'corporation') {
    const match = creatable.find((item) => item.scope.type === 'corporation')
    return {
      delegableGrantIds: match ? [...match.delegableGrantIds] : [],
      canDelegateFurther: match?.canDelegateFurther === true,
    }
  }
  if (area.scopes.length === 0) return { delegableGrantIds: [], canDelegateFurther: false }
  let ids: string[] | null = null
  let further = true
  for (const scope of area.scopes) {
    if (scope.type !== 'organization') return { delegableGrantIds: [], canDelegateFurther: false }
    const match = creatable.find((item) => item.scope.type === 'organization' && item.scope.organizationId === scope.organizationId)
    if (!match) return { delegableGrantIds: [], canDelegateFurther: false }
    const allowed = new Set(match.delegableGrantIds)
    ids = ids == null ? [...match.delegableGrantIds] : ids.filter((id) => allowed.has(id))
    further = further && match.canDelegateFurther
  }
  return { delegableGrantIds: ids ?? [], canDelegateFurther: further }
}
