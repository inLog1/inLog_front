import type {
  AccessScope,
  AccessSnapshot,
  EffectiveGrant,
  ProjectRef,
  SystemCapabilityCode,
} from './types'

const ACTION_COVERS: Record<string, readonly string[]> = {
  manage: ['manage', 'read', 'update', 'assign', 'create'],
  update: ['update', 'read'],
  assign: ['assign'],
  create: ['create', 'read'],
  read: ['read'],
}

export function capabilityFromRoleDisplayName(displayName: string): readonly SystemCapabilityCode[] {
  void displayName
  return []
}

export function hasCorporateSuperadmin(snapshot: AccessSnapshot, userId: number): boolean {
  return snapshot.systemCapabilities.some(
    (item) => item.userId === userId && item.code === 'corporate_superadmin',
  )
}

export function actionCovered(grantedAction: string, requestedAction: string): boolean {
  const covered = ACTION_COVERS[grantedAction]
  if (!covered) return grantedAction === requestedAction
  return covered.includes(requestedAction)
}

export function scopeCovers(granted: AccessScope, target: AccessScope, projects: ProjectRef[]): boolean {
  if (granted.type === 'own') {
    return target.type === 'own' && granted.userId === target.userId
  }

  if (granted.type === 'project') {
    return target.type === 'project' && granted.projectId === target.projectId
  }

  if (granted.type === 'organization') {
    if (target.type === 'organization') return granted.organizationId === target.organizationId
    if (target.type === 'project') return target.organizationId === granted.organizationId
    return false
  }

  if (target.type === 'corporation') return granted.corporationId === target.corporationId
  if (target.type === 'organization') return target.corporationId === granted.corporationId
  if (target.type === 'project') {
    const project = projects.find((item) => item.id === target.projectId)
    return project?.corporationId === granted.corporationId && target.corporationId === granted.corporationId
  }
  return false
}

export function isDelegationSubset(
  parentGrants: EffectiveGrant[],
  delegation: EffectiveGrant,
  projects: ProjectRef[],
): boolean {
  return parentGrants.some((grant) =>
    grant.resource === delegation.resource
    && actionCovered(grant.action, delegation.action)
    && scopeCovers(grant.scope, delegation.scope, projects),
  )
}

export function effectiveGrants(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  const grants: EffectiveGrant[] = []
  for (const assignment of snapshot.assignments) {
    if (assignment.userId !== userId) continue
    const role = snapshot.roles.find((item) => item.id === assignment.roleId)
    if (!role) continue
    for (const grantId of role.grantIds) {
      const grant = snapshot.grants.find((item) => item.id === grantId)
      if (!grant) continue
      grants.push({ ...grant, scope: assignment.scope })
    }
  }
  return grants
}

export function delegationGrantsFor(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  return snapshot.delegations
    .filter((item) => item.toUserId === userId)
    .filter((item) => isDelegationSubset(
      effectiveGrants(snapshot, item.fromUserId),
      item.grant,
      snapshot.projects,
    ))
    .map((item) => item.grant)
}

export function can(
  snapshot: AccessSnapshot,
  userId: number,
  resource: string,
  action: string,
  target: AccessScope,
): boolean {
  const grants = [...effectiveGrants(snapshot, userId), ...delegationGrantsFor(snapshot, userId)]
  return grants.some((grant) =>
    grant.resource === resource
    && actionCovered(grant.action, action)
    && scopeCovers(grant.scope, target, snapshot.projects),
  )
}
