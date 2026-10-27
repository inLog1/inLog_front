import { ACCESS_PERMISSION_CATALOG } from './permission-catalog'
import type {
  AccessRole,
  AccessScope,
  AccessSnapshot,
  EffectiveGrant,
  OrganizationRef,
  ProjectRef,
  RoleGrant,
  SystemCapabilityCode,
} from './types'

/**
 * Actions do not imply each other. create/update do not include read.
 * manage does not include read, create, update, delete, or delegate.
 * A new action is allowed only when this table lists it explicitly.
 */
const ACTION_COVERS: Record<string, readonly string[]> = {
  read: ['read'],
  create: ['create'],
  update: ['update'],
  delete: ['delete'],
  manage: ['manage'],
  assign: ['assign'],
  delegate: ['delegate'],
  generate: ['generate'],
  publish: ['publish'],
}

export type AssignmentDenial = 'invalid_scope' | 'forbidden' | 'self_elevation'

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

function knownCorporationIds(projects: ProjectRef[], organizations: OrganizationRef[]): Set<number> {
  const ids = new Set<number>()
  for (const project of projects) ids.add(project.corporationId)
  for (const organization of organizations) ids.add(organization.corporationId)
  return ids
}

export function scopeIsCanonical(
  scope: AccessScope,
  projects: ProjectRef[],
  organizations: OrganizationRef[] = [],
): boolean {
  if (scope.type === 'own') return Number.isInteger(scope.userId)
  if (scope.type === 'project') {
    const project = projects.find((item) => item.id === scope.projectId)
    return project != null
      && project.organizationId === scope.organizationId
      && project.corporationId === scope.corporationId
  }
  if (scope.type === 'organization') {
    if (organizations.length > 0) {
      const organization = organizations.find((item) => item.id === scope.organizationId)
      return organization != null && organization.corporationId === scope.corporationId
    }
    const related = projects.filter((item) => item.organizationId === scope.organizationId)
    if (related.length === 0) return false
    return related.every((item) => item.corporationId === scope.corporationId)
  }
  return knownCorporationIds(projects, organizations).has(scope.corporationId)
}

export function scopeCovers(
  granted: AccessScope,
  target: AccessScope,
  projects: ProjectRef[],
  organizations: OrganizationRef[] = [],
): boolean {
  if (granted.type === 'own') {
    return target.type === 'own' && granted.userId === target.userId
  }
  if (target.type === 'own') return false
  if (!scopeIsCanonical(granted, projects, organizations)) return false
  if (!scopeIsCanonical(target, projects, organizations)) return false

  if (granted.type === 'project') {
    return target.type === 'project' && granted.projectId === target.projectId
  }
  if (granted.type === 'organization') {
    if (target.type === 'organization') return granted.organizationId === target.organizationId
    if (target.type === 'project') return target.organizationId === granted.organizationId
    return false
  }
  return granted.corporationId === target.corporationId
}

export function isDelegationSubset(
  parentGrants: EffectiveGrant[],
  delegation: EffectiveGrant,
  projects: ProjectRef[],
  organizations: OrganizationRef[] = [],
): boolean {
  return parentGrants.some((grant) =>
    grant.resource === delegation.resource
    && actionCovered(grant.action, delegation.action)
    && scopeCovers(grant.scope, delegation.scope, projects, organizations),
  )
}

function grantsByIds(snapshot: AccessSnapshot, ids: readonly string[]): RoleGrant[] | null {
  const grants: RoleGrant[] = []
  for (const id of ids) {
    const grant = snapshot.grants.find((item) => item.id === id)
    if (!grant) return null
    grants.push(grant)
  }
  return grants
}

function grantCovered(
  parents: EffectiveGrant[],
  grant: RoleGrant,
  scope: AccessScope,
  snapshot: AccessSnapshot,
): boolean {
  return parents.some((parent) =>
    parent.resource === grant.resource
    && actionCovered(parent.action, grant.action)
    && scopeCovers(parent.scope, scope, snapshot.projects, snapshot.organizations),
  )
}

/**
 * Known catalog at the installation corporation.
 * Stored roles are not rewritten. An unknown resource or action is absent from this list.
 * The scope is only the installation's own corporation, so another corporation is not covered.
 */
function installationCatalogGrants(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  if (!hasCorporateSuperadmin(snapshot, userId)) return []
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return []
  const scope = { type: 'corporation' as const, corporationId }
  return ACCESS_PERMISSION_CATALOG.map((item) => ({
    id: `installation:${item.resource}:${item.action}`,
    resource: item.resource,
    action: item.action,
    scope,
  }))
}

export function effectiveGrants(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  const grants: EffectiveGrant[] = []
  for (const assignment of snapshot.assignments) {
    if (assignment.userId !== userId) continue
    if (!scopeIsCanonical(assignment.scope, snapshot.projects, snapshot.organizations)) continue
    const role = snapshot.roles.find((item) => item.id === assignment.roleId)
    if (!role) continue
    for (const grantId of role.grantIds) {
      const grant = snapshot.grants.find((item) => item.id === grantId)
      if (!grant) continue
      grants.push({ ...grant, scope: assignment.scope })
    }
  }
  return [...grants, ...installationCatalogGrants(snapshot, userId)]
}

export function roleDelegationGrants(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  const grants: EffectiveGrant[] = []
  for (const assignment of snapshot.assignments) {
    if (assignment.userId !== userId) continue
    if (!scopeIsCanonical(assignment.scope, snapshot.projects, snapshot.organizations)) continue
    const role = snapshot.roles.find((item) => item.id === assignment.roleId)
    if (!role) continue
    for (const grantId of role.delegationGrantIds ?? []) {
      const grant = snapshot.grants.find((item) => item.id === grantId)
      if (!grant) continue
      grants.push({ ...grant, scope: assignment.scope })
    }
  }
  return [...grants, ...installationCatalogGrants(snapshot, userId)]
}

export function delegationGrantsFor(snapshot: AccessSnapshot, userId: number): EffectiveGrant[] {
  const received = snapshot.delegations
    .filter((item) => item.toUserId === userId)
    .filter((item) => isDelegationSubset(
      roleDelegationGrants(snapshot, item.fromUserId),
      item.grant,
      snapshot.projects,
      snapshot.organizations,
    ))
    .map((item) => item.grant)
  return [...roleDelegationGrants(snapshot, userId), ...received]
}

/**
 * Operational check against grants the server already scoped.
 * A project grant covers only that project inside its organization.
 * An organization grant covers that organization, including a confirmed project of it.
 * A corporation grant covers a target the server already accepted for this installation.
 * The role display name is not an input.
 */
export function grantAllows(
  grants: readonly EffectiveGrant[],
  resource: string,
  action: string,
  target: { organizationId: number; projectId: number | null },
): boolean {
  return grants.some((grant) => {
    if (grant.resource !== resource || !actionCovered(grant.action, action)) return false
    if (grant.scope.type === 'project') {
      return target.projectId != null
        && grant.scope.projectId === target.projectId
        && grant.scope.organizationId === target.organizationId
    }
    if (grant.scope.type === 'organization') return grant.scope.organizationId === target.organizationId
    return grant.scope.type === 'corporation'
  })
}

export function can(
  snapshot: AccessSnapshot,
  userId: number,
  resource: string,
  action: string,
  target: AccessScope,
): boolean {
  return effectiveGrants(snapshot, userId).some((grant) =>
    grant.resource === resource
    && actionCovered(grant.action, action)
    && scopeCovers(grant.scope, target, snapshot.projects, snapshot.organizations),
  )
}

export function canDelegate(
  snapshot: AccessSnapshot,
  userId: number,
  resource: string,
  action: string,
  target: AccessScope,
): boolean {
  return delegationGrantsFor(snapshot, userId).some((grant) =>
    grant.resource === resource
    && actionCovered(grant.action, action)
    && scopeCovers(grant.scope, target, snapshot.projects, snapshot.organizations),
  )
}

export function installationCorporationId(snapshot: AccessSnapshot): number | null {
  const ids = knownCorporationIds(snapshot.projects, snapshot.organizations)
  if (ids.size !== 1) return null
  const [corporationId] = ids
  return corporationId ?? null
}

export function hasInstallationCapability(
  snapshot: AccessSnapshot,
  userId: number,
  corporationId: number,
): boolean {
  if (!hasCorporateSuperadmin(snapshot, userId)) return false
  return installationCorporationId(snapshot) === corporationId
}

/**
 * Administrative gate for assignments in one scope.
 * Installation capability covers the corporation because the known catalog includes assignments.update.
 * A corporation scope still requires that capability: an organization grant does not manage the corporation.
 * An organization administrator still needs assignments.update on that scope.
 * Role definitions use roles.read, roles.create, roles.update and roles.delete, not this gate.
 */
export function canManageAssignment(
  snapshot: AccessSnapshot,
  actorId: number,
  scope: AccessScope,
): boolean {
  if (!scopeIsCanonical(scope, snapshot.projects, snapshot.organizations)) return false
  if (scope.type === 'own') return can(snapshot, actorId, 'assignments', 'update', scope)
  if (hasInstallationCapability(snapshot, actorId, scope.corporationId)) return true
  if (scope.type === 'corporation') return false
  return can(snapshot, actorId, 'assignments', 'update', scope)
}

/** Older roles have no ownerScope. They belong to the installation, not to an organization. */
export function roleOwnerScope(role: AccessRole, snapshot: AccessSnapshot): AccessScope | null {
  if (role.ownerScope) return role.ownerScope
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return null
  return { type: 'corporation', corporationId }
}

/**
 * Whether this actor may put this exact grant set on a role or assignment in this scope.
 * It does not decide whether the actor may edit the role definition or create the assignment.
 */
export function issuedSetDenial(
  snapshot: AccessSnapshot,
  actorId: number,
  role: AccessRole,
  scope: AccessScope,
  assigneeId: number,
): AssignmentDenial | null {
  if (!scopeIsCanonical(scope, snapshot.projects, snapshot.organizations)) return 'invalid_scope'
  const operational = grantsByIds(snapshot, role.grantIds)
  const delegated = grantsByIds(snapshot, role.delegationGrantIds ?? [])
  if (!operational || !delegated) return 'forbidden'
  for (const grant of operational) {
    if (!canDelegate(snapshot, actorId, grant.resource, grant.action, scope)) return 'forbidden'
  }
  if (delegated.length > 0) {
    if (!canDelegate(snapshot, actorId, 'delegations', 'delegate', scope)) return 'forbidden'
    for (const grant of delegated) {
      if (!canDelegate(snapshot, actorId, grant.resource, grant.action, scope)) return 'forbidden'
    }
  }
  if (assigneeId === actorId) {
    const current = effectiveGrants(snapshot, actorId)
    if (operational.some((grant) => !grantCovered(current, grant, scope, snapshot))) return 'self_elevation'
  }
  return null
}

export function assignmentDenial(
  snapshot: AccessSnapshot,
  actorId: number,
  role: AccessRole,
  scope: AccessScope,
  assigneeId: number,
): AssignmentDenial | null {
  if (!scopeIsCanonical(scope, snapshot.projects, snapshot.organizations)) return 'invalid_scope'
  if (!canManageAssignment(snapshot, actorId, scope)) return 'forbidden'
  return issuedSetDenial(snapshot, actorId, role, scope, assigneeId)
}
