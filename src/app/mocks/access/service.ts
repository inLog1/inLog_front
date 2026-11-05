import {
  can,
  issuedSetDenial,
  canDelegate,
  canManageAssignment,
  hasInstallationCapability,
  installationCorporationId,
  roleDefinitionScopes,
  roleOrganizationIds,
  roleOwnerScope,
  rolePlacementDenial,
  scopeCovers,
  scopeIsCanonical,
} from '../../../entities/access/model/grants'
import { isOfferedPermission } from '../../../entities/access/model/permission-catalog'
import type {
  AccessAssignmentView,
  AccessCandidate,
  AccessCreatableScope,
  AccessDirectory,
  AccessGrantView,
  AccessRoleDetail,
  AccessRoleView,
  AssignmentWrite as AssignmentBody,
  RoleDuplicateBlockedGrant,
  RoleDuplicateWrite,
  RoleWrite as RoleBody,
} from '../../../entities/access/model/directory'
import type { AccessAuditEntry, AccessRole, AccessScope } from '../../../entities/access/model/types'
import type { FlowResult } from '../auth/flow'
import { principal, toSnapshot } from '../auth/flow'
import type { MockState, MockUser } from '../db/types'

type RoleBodyWrite = RoleBody
type AssignmentBodyWrite = AssignmentBody
type RoleDuplicateBody = RoleDuplicateWrite

function fail(state: MockState, status: number, code: string, extra: Record<string, unknown> = {}): FlowResult {
  return { state, status, body: { code, ...extra } }
}

function fullName(user: MockUser): string {
  return [user.surname, user.name, user.patronymic].filter(Boolean).join(' ')
}

function isDefinitionScope(scope: AccessScope): boolean {
  return scope.type === 'corporation' || scope.type === 'organization'
}

function entireRole(): { area: 'all'; organizationId: null; corporationId: null } {
  return { area: 'all', organizationId: null, corporationId: null }
}

function sameScope(left: AccessScope, right: AccessScope): boolean {
  if (left.type !== right.type) return false
  if (left.type === 'own' && right.type === 'own') return left.userId === right.userId
  if (left.type === 'corporation' && right.type === 'corporation') return left.corporationId === right.corporationId
  if (left.type === 'organization' && right.type === 'organization') {
    return left.organizationId === right.organizationId && left.corporationId === right.corporationId
  }
  if (left.type === 'project' && right.type === 'project') {
    return left.projectId === right.projectId
      && left.organizationId === right.organizationId
      && left.corporationId === right.corporationId
  }
  return false
}

function uniqueIds(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    next.push(value)
  }
  return next
}

function readOrganizationIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ids: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item <= 0 || ids.includes(item)) return null
    ids.push(item)
  }
  return ids
}

function readIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) return null
  return uniqueIds(value)
}

function readVersion(value: unknown): number | undefined | null {
  if (value == null) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null
  return value
}

function readScope(value: unknown): AccessScope | null {
  if (!value || typeof value !== 'object') return null
  const scope = value as Record<string, unknown>
  const corporationId = scope.corporationId
  if (typeof corporationId !== 'number' || !Number.isInteger(corporationId)) return null
  if (scope.type === 'corporation') return { type: 'corporation', corporationId }
  if (scope.type === 'organization' && typeof scope.organizationId === 'number' && Number.isInteger(scope.organizationId)) {
    return { type: 'organization', organizationId: scope.organizationId, corporationId }
  }
  if (
    scope.type === 'project'
    && typeof scope.organizationId === 'number'
    && Number.isInteger(scope.organizationId)
    && typeof scope.projectId === 'number'
    && Number.isInteger(scope.projectId)
  ) {
    return {
      type: 'project',
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      corporationId,
    }
  }
  return null
}

export function readRoleWrite(body: Record<string, unknown>, requireOwner: boolean):
  | { ok: true; value: RoleBodyWrite }
  | { ok: false; code: string } {
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (displayName.length < 1 || displayName.length > 80) return { ok: false, code: 'invalid_name' }
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length > 500) return { ok: false, code: 'invalid_description' }
  const grantIds = readIdList(body.grantIds)
  const delegationGrantIds = readIdList(body.delegationGrantIds)
  if (!grantIds || !delegationGrantIds) return { ok: false, code: 'invalid_grants' }
  const expectedAccessVersion = readVersion(body.expectedAccessVersion)
  if (expectedAccessVersion === null) return { ok: false, code: 'invalid_version' }
  let ownerScope: AccessScope | undefined
  if (body.ownerScope != null) {
    const parsed = readScope(body.ownerScope)
    if (!parsed) return { ok: false, code: 'invalid_scope' }
    ownerScope = parsed
  }
  if (requireOwner && !ownerScope) return { ok: false, code: 'invalid_scope' }
  let organizationIds: number[] | undefined
  if (body.organizationIds != null) {
    const parsed = readOrganizationIds(body.organizationIds)
    if (!parsed) return { ok: false, code: 'invalid_scope' }
    organizationIds = parsed
  }
  if (organizationIds && ownerScope && ownerScope.type !== 'organization') return { ok: false, code: 'invalid_scope' }
  if (organizationIds && ownerScope?.type === 'organization' && !organizationIds.includes(ownerScope.organizationId)) {
    return { ok: false, code: 'invalid_scope' }
  }
  return {
    ok: true,
    value: { displayName, description, grantIds, delegationGrantIds, ownerScope, organizationIds, expectedAccessVersion },
  }
}

export function readRoleDuplicateWrite(body: Record<string, unknown>):
  | { ok: true; value: RoleDuplicateBody }
  | { ok: false; code: string } {
  const sourceRoleId = typeof body.sourceRoleId === 'string' ? body.sourceRoleId : ''
  if (sourceRoleId.length === 0) return { ok: false, code: 'invalid_role' }
  const parsed = readRoleWrite(body, true)
  if (!parsed.ok) return parsed
  if (!parsed.value.ownerScope) return { ok: false, code: 'invalid_scope' }
  const omitGrantIds = body.omitGrantIds == null ? [] : readIdList(body.omitGrantIds)
  const omitDelegationGrantIds = body.omitDelegationGrantIds == null ? [] : readIdList(body.omitDelegationGrantIds)
  if (!omitGrantIds || !omitDelegationGrantIds) return { ok: false, code: 'invalid_grants' }
  return {
    ok: true,
    value: {
      sourceRoleId,
      displayName: parsed.value.displayName,
      description: parsed.value.description,
      grantIds: parsed.value.grantIds,
      delegationGrantIds: parsed.value.delegationGrantIds,
      omitGrantIds,
      omitDelegationGrantIds,
      ownerScope: parsed.value.ownerScope,
      organizationIds: parsed.value.organizationIds,
      expectedAccessVersion: parsed.value.expectedAccessVersion,
    },
  }
}

export function readAssignmentWrite(body: Record<string, unknown>):
  | { ok: true; value: AssignmentBodyWrite }
  | { ok: false; code: string } {
  const userId = body.userId
  const roleId = body.roleId
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) return { ok: false, code: 'invalid_user' }
  if (typeof roleId !== 'string' || roleId.length === 0) return { ok: false, code: 'invalid_role' }
  const scope = readScope(body.scope)
  if (!scope) return { ok: false, code: 'invalid_scope' }
  const expectedAccessVersion = readVersion(body.expectedAccessVersion)
  if (expectedAccessVersion === null) return { ok: false, code: 'invalid_version' }
  return { ok: true, value: { userId, roleId, scope, expectedAccessVersion } }
}

function versionGuard(state: MockState, expected: number | undefined): FlowResult | null {
  if (expected == null) return null
  if (expected !== state.accessVersion) return fail(state, 409, 'stale_write')
  return null
}

function grantView(state: MockState, id: string): AccessGrantView | null {
  const grant = state.grants.find((item) => item.id === id)
  if (!grant) return null
  return {
    id: grant.id,
    resource: grant.resource,
    action: grant.action,
    offered: isOfferedPermission(grant.resource, grant.action),
  }
}

function viewsFor(state: MockState, ids: readonly string[]): AccessGrantView[] {
  return ids.flatMap((id) => {
    const view = grantView(state, id)
    return view ? [view] : []
  })
}

function offeredGrants(state: MockState): AccessGrantView[] {
  return state.grants
    .filter((grant) => isOfferedPermission(grant.resource, grant.action))
    .map((grant) => ({ id: grant.id, resource: grant.resource, action: grant.action, offered: true }))
}

function additionsAreOffered(state: MockState, previous: readonly string[], next: readonly string[]): boolean {
  const owned = new Set(previous)
  for (const id of next) {
    if (owned.has(id)) continue
    const grant = state.grants.find((item) => item.id === id)
    if (!grant || !isOfferedPermission(grant.resource, grant.action)) return false
  }
  return true
}

function roleSnapshot(role: AccessRole) {
  return {
    id: role.id,
    displayName: role.displayName,
    description: role.description ?? '',
    grantIds: [...role.grantIds],
    delegationGrantIds: [...(role.delegationGrantIds ?? [])],
    ownerScope: role.ownerScope ?? null,
    ...(role.organizationIds && role.organizationIds.length > 0 ? { organizationIds: [...role.organizationIds] } : {}),
  }
}

function withAudit(state: MockState, entry: Omit<AccessAuditEntry, 'id' | 'at'>): MockState {
  const audit: AccessAuditEntry = {
    ...entry,
    id: `audit-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
  }
  return {
    ...state,
    accessVersion: state.accessVersion + 1,
    accessAudit: [...(state.accessAudit ?? []), audit],
  }
}

function actor(state: MockState, token: string | null): { ok: true; user: MockUser } | { ok: false; result: FlowResult } {
  return principal(state, token)
}

function staleOrActor(state: MockState, token: string | null, expected: number | undefined) {
  const who = actor(state, token)
  if (!who.ok) return who
  const stale = versionGuard(state, expected)
  if (stale) return { ok: false as const, result: stale }
  return who
}

function delegableIds(state: MockState, userId: number, scope: AccessScope): string[] {
  const snapshot = toSnapshot(state)
  return state.grants
    .filter((grant) => canDelegate(snapshot, userId, grant.resource, grant.action, scope))
    .map((grant) => grant.id)
}

function organizationOf(scope: AccessScope): number | null {
  if (scope.type === 'organization' || scope.type === 'project') return scope.organizationId
  return null
}

function scopeInOrganization(scope: AccessScope, organizationId: number): boolean {
  return organizationOf(scope) === organizationId
}

function memberOf(state: MockState, userId: number, organizationId: number): boolean {
  return state.memberships.some((item) => item.userId === userId && item.organizationId === organizationId)
}

function assignmentInView(
  scope: AccessScope,
  view: { area: 'organization' | 'corporation' | 'all'; organizationId: number | null; corporationId: number | null },
): boolean {
  if (view.area === 'all' || view.area === 'corporation') return true
  if (view.organizationId == null) return false
  if (scope.type === 'corporation') return view.corporationId != null && scope.corporationId === view.corporationId
  return scopeInOrganization(scope, view.organizationId)
}

function roleView(
  state: MockState,
  role: AccessRole,
  owner: AccessScope,
  actorId: number,
  view: { area: 'organization' | 'corporation' | 'all'; organizationId: number | null; corporationId: number | null },
): AccessRoleView {
  const snapshot = toSnapshot(state)
  const homes = roleDefinitionScopes(role, snapshot)
  const assignments = state.assignments.filter((item) => item.roleId === role.id && assignmentInView(item.scope, view))
  const users = new Set(assignments.map((item) => item.userId))
  const allows = (action: 'read' | 'update' | 'delete') => homes.some((scope) => can(snapshot, actorId, 'roles', action, scope))
  const allowsEvery = (action: 'update' | 'delete') => homes.length > 0 && homes.every((scope) => can(snapshot, actorId, 'roles', action, scope))
  return {
    id: role.id,
    displayName: role.displayName,
    description: role.description ?? '',
    ownerScope: owner,
    organizationIds: roleOrganizationIds(role),
    operational: viewsFor(state, role.grantIds),
    delegation: viewsFor(state, role.delegationGrantIds ?? []),
    assignmentCount: assignments.length,
    affectedUserCount: users.size,
    affectedScopes: assignments.map((item) => item.scope),
    canRead: allows('read'),
    canEdit: allowsEvery('update'),
    canDelete: allowsEvery('delete'),
    canDuplicate: role.origin == null && homes.some((scope) => canInspectRole(snapshot, actorId, scope)),
    system: role.origin != null,
  }
}

const ROLE_DESK_ACTIONS = ['read', 'create', 'update', 'delete'] as const
const ROLE_LIST_ACTIONS = ['read', 'update', 'delete'] as const

function canEnterRoleDesk(snapshot: ReturnType<typeof toSnapshot>, userId: number, scope: AccessScope): boolean {
  if (canManageAssignment(snapshot, userId, scope)) return true
  return ROLE_DESK_ACTIONS.some((action) => can(snapshot, userId, 'roles', action, scope))
}

function canInspectRole(snapshot: ReturnType<typeof toSnapshot>, userId: number, owner: AccessScope): boolean {
  if (canManageAssignment(snapshot, userId, owner)) return true
  return ROLE_LIST_ACTIONS.some((action) => can(snapshot, userId, 'roles', action, owner))
}

function visibleRoles(
  state: MockState,
  userId: number,
  area: 'organization' | 'corporation' | 'all',
  organizationId: number | null,
  corporationId: number,
): AccessRole[] {
  const snapshot = toSnapshot(state)
  return state.roles.filter((role) => {
    const owner = roleOwnerScope(role, snapshot)
    if (!owner || owner.type === 'own' || owner.corporationId !== corporationId) return false
    const homes = roleDefinitionScopes(role, snapshot)
    if (area === 'corporation') return owner.type === 'corporation' && canInspectRole(snapshot, userId, owner)
    if (area === 'all') {
      if (owner.type === 'corporation') {
        if (canInspectRole(snapshot, userId, owner)) return true
        return state.organizations.some((organization) =>
          organization.corporationId === corporationId
          && rolePlacementDenial(snapshot, userId, role, {
            type: 'organization',
            organizationId: organization.id,
            corporationId,
          }, -1) == null,
        )
      }
      return homes.some((home) => {
        if (home.type !== 'organization' && home.type !== 'project') return false
        const listed = state.organizations.some((organization) =>
          organization.id === home.organizationId && organization.corporationId === corporationId,
        )
        return listed && canInspectRole(snapshot, userId, home)
      })
    }
    if (organizationId == null) return false
    if (owner.type === 'corporation') {
      if (canInspectRole(snapshot, userId, owner)) return true
      const target: AccessScope = { type: 'organization', organizationId, corporationId }
      return rolePlacementDenial(snapshot, userId, role, target, -1) == null
    }
    return homes.some((home) => {
      if (!scopeInOrganization(home, organizationId)) return false
      const desk: AccessScope = home.type === 'project'
        ? home
        : { type: 'organization', organizationId, corporationId }
      return canInspectRole(snapshot, userId, desk)
    })
  })
}

function visibleAssignments(
  state: MockState,
  userId: number,
  area: 'organization' | 'corporation' | 'all',
  organizationId: number | null,
  corporationId: number,
) {
  const snapshot = toSnapshot(state)
  return state.assignments.filter((item) => {
    if (!canManageAssignment(snapshot, userId, item.scope)) return false
    if (item.scope.type === 'own') return false
    if (item.scope.corporationId !== corporationId) return false
    if (area === 'all') return true
    if (area === 'corporation') return item.scope.type === 'corporation'
    if (organizationId == null) return false
    return scopeInOrganization(item.scope, organizationId)
  })
}

export function readDirectory(
  state: MockState,
  token: string | null,
  query: { scope: string | null; organization: string | null },
): FlowResult {
  const who = actor(state, token)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const canManageCorporation = hasInstallationCapability(snapshot, who.user.id, corporationId)

  let area: 'organization' | 'corporation' | 'all'
  let organizationId: number | null = null
  if (query.scope === 'corporation' && (query.organization == null || query.organization === '')) {
    if (!canEnterRoleDesk(snapshot, who.user.id, { type: 'corporation', corporationId })) {
      return fail(state, 403, 'forbidden')
    }
    area = 'corporation'
  } else if (query.organization === 'all' && query.scope !== 'corporation') {
    const canOpen = canEnterRoleDesk(snapshot, who.user.id, { type: 'corporation', corporationId })
      || state.organizations.some((organization) =>
        organization.corporationId === corporationId
        && canEnterRoleDesk(snapshot, who.user.id, {
          type: 'organization',
          organizationId: organization.id,
          corporationId,
        }),
      )
    if (!canOpen) return fail(state, 403, 'forbidden')
    area = 'all'
  } else if (query.organization != null && query.organization !== '' && query.scope !== 'corporation') {
    if (!/^[1-9]\d*$/.test(query.organization)) return fail(state, 400, 'invalid_organization')
    organizationId = Number(query.organization)
    const organization = state.organizations.find((item) => item.id === organizationId)
    if (!organization || organization.corporationId !== corporationId) return fail(state, 404, 'not_found')
    const scope = { type: 'organization' as const, organizationId, corporationId }
    if (!canEnterRoleDesk(snapshot, who.user.id, scope)) {
      return fail(state, 403, 'forbidden')
    }
    area = 'organization'
  } else {
    return fail(state, 400, 'invalid_organization')
  }

  const creatableScopes = scopesForRoleCreation(state, who.user.id)
  const corporationScope: AccessScope = { type: 'corporation', corporationId }
  const delegationScope: AccessScope = area === 'corporation' || (area === 'all' && can(snapshot, who.user.id, 'roles', 'create', corporationScope))
    ? corporationScope
    : area === 'all'
      ? (creatableScopes.find((item) => item.scope.type === 'organization')?.scope ?? corporationScope)
      : { type: 'organization', organizationId: organizationId as number, corporationId }
  const creatableOrgIds = new Set(creatableScopes.flatMap((item) =>
    item.scope.type === 'organization' ? [item.scope.organizationId] : [],
  ))
  const roles = visibleRoles(state, who.user.id, area, organizationId, corporationId)
  const assignments = visibleAssignments(state, who.user.id, area, organizationId, corporationId)
  const roleIds = new Set(roles.map((role) => role.id))
  const assignmentIds = new Set(assignments.map((item) => item.id))
  const candidates = candidatesFor(state, area, organizationId)
  const projects = state.projects
    .filter((project) => area === 'all' || (area === 'organization' && project.organizationId === organizationId))
    .map((project) => ({ id: project.id, name: project.name, organizationId: project.organizationId }))
  const organizations = state.organizations
    .filter((organization) => {
      const manageable = canManageAssignment(snapshot, who.user.id, {
        type: 'organization',
        organizationId: organization.id,
        corporationId,
      })
      const inDesk = area === 'corporation' || area === 'all' || organization.id === organizationId
      if (inDesk && manageable) return true
      return creatableOrgIds.has(organization.id)
    })
    .map((organization) => ({ id: organization.id, shortName: organization.shortName }))

  const body: AccessDirectory = {
    scope: area,
    organizationId,
    corporationId,
    accessVersion: state.accessVersion,
    canManageCorporation,
    canCreateRole: area === 'all'
      ? creatableScopes.length > 0
      : can(snapshot, who.user.id, 'roles', 'create', delegationScope),
    creatableScopes,
    offeredGrants: offeredGrants(state),
    delegableGrantIds: delegableIds(state, who.user.id, delegationScope),
    canDelegateFurther: canDelegate(snapshot, who.user.id, 'delegations', 'delegate', delegationScope),
    roles: roles.flatMap((role) => {
      const owner = roleOwnerScope(role, snapshot)
      return owner ? [roleView(state, role, owner, who.user.id, { area, organizationId, corporationId })] : []
    }),
    assignments: assignments.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: fullName(state.users.find((user) => user.id === item.userId) ?? who.user),
      roleId: item.roleId,
      roleName: state.roles.find((role) => role.id === item.roleId)?.displayName ?? item.roleId,
      scope: item.scope,
      canRevoke: assignmentCanBeRevoked(state, who.user.id, item.scope),
    })),
    candidates,
    projects,
    organizations,
    recentChanges: recentChanges(state, who.user.id, roleIds, assignmentIds),
  }
  return { state, status: 200, body }
}

function candidatesFor(state: MockState, area: 'organization' | 'corporation' | 'all', organizationId: number | null): AccessCandidate[] {
  const users = area === 'organization'
    ? state.users.filter((user) => organizationId != null && memberOf(state, user.id, organizationId))
    : state.users
  return users
    .map((user) => ({
      id: user.id,
      fullName: fullName(user),
      surname: user.surname,
      givenName: user.name,
      patronymic: user.patronymic,
      position: user.position,
      status: user.status,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru'))
}

function recentChanges(
  state: MockState,
  actorId: number,
  roleIds: Set<string>,
  assignmentIds: Set<string>,
) {
  return [...(state.accessAudit ?? [])].reverse().filter((entry) =>
    entry.actorId === actorId
    || (entry.roleId != null && roleIds.has(entry.roleId))
    || (entry.assignmentId != null && assignmentIds.has(entry.assignmentId)),
  ).slice(0, 8).map((entry) => {
    const person = state.users.find((user) => user.id === entry.actorId)
    const role = entry.roleId == null ? undefined : state.roles.find((item) => item.id === entry.roleId)
    return {
      id: entry.id,
      at: entry.at,
      actorId: entry.actorId,
      actorName: person ? fullName(person) : String(entry.actorId),
      action: entry.action,
      roleId: entry.roleId,
      roleName: role?.displayName ?? null,
      assignmentId: entry.assignmentId,
    }
  })
}

export function readRole(state: MockState, token: string | null, roleId: string): FlowResult {
  const who = actor(state, token)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const role = state.roles.find((item) => item.id === roleId)
  if (!role) return fail(state, 404, 'not_found')
  const owner = roleOwnerScope(role, snapshot)
  const homes = roleDefinitionScopes(role, snapshot)
  if (!owner || !homes.some((scope) => can(snapshot, who.user.id, 'roles', 'read', scope))) return fail(state, 403, 'forbidden')
  const shared = sharedDelegation(state, who.user.id, homes)
  const creatableScopes = scopesForRoleCreation(state, who.user.id)
  const namedOrganizationIds = new Set(creatableScopes.flatMap((item) => (
    item.scope.type === 'organization' ? [item.scope.organizationId] : []
  )))
  const body: AccessRoleDetail = {
    role: roleView(state, role, owner, who.user.id, entireRole()),
    offeredGrants: offeredGrants(state),
    delegableGrantIds: shared.ids,
    canDelegateFurther: shared.further,
    creatableScopes,
    accessVersion: state.accessVersion,
    organizations: state.organizations
      .filter((organization) => namedOrganizationIds.has(organization.id) || canManageAssignment(snapshot, who.user.id, {
        type: 'organization',
        organizationId: organization.id,
        corporationId: organization.corporationId,
      }))
      .map((organization) => ({ id: organization.id, shortName: organization.shortName })),
    projects: state.projects
      .filter((project) => canManageAssignment(snapshot, who.user.id, {
        type: 'project',
        projectId: project.id,
        organizationId: project.organizationId,
        corporationId: project.corporationId,
      }))
      .map((project) => ({ id: project.id, name: project.name, organizationId: project.organizationId })),
  }
  return { state, status: 200, body }
}

function nextRole(
  id: string,
  write: RoleBody,
  ownerScope: AccessScope | undefined,
  organizationIds?: number[],
): AccessRole {
  return {
    id,
    displayName: write.displayName,
    description: write.description,
    grantIds: write.grantIds,
    delegationGrantIds: write.delegationGrantIds,
    ownerScope,
    ...(organizationIds && organizationIds.length >= 2 ? { organizationIds: [...organizationIds] } : {}),
  }
}

function definitionTargets(
  snapshot: ReturnType<typeof toSnapshot>,
  owner: AccessScope,
  organizationIds: number[] | undefined,
): AccessScope[] | null {
  if (!isDefinitionScope(owner) || !scopeIsCanonical(owner, snapshot.projects, snapshot.organizations)) return null
  if (owner.type === 'corporation') {
    if (organizationIds && organizationIds.length > 0) return null
    return [owner]
  }
  if (owner.type !== 'organization') return null
  const ids = organizationIds && organizationIds.length > 0 ? organizationIds : [owner.organizationId]
  if (!ids.includes(owner.organizationId)) return null
  const corporationId = owner.corporationId
  const scopes = [...new Set(ids)].sort((left, right) => left - right).map((organizationId) => ({
    type: 'organization' as const,
    organizationId,
    corporationId,
  }))
  if (scopes.some((scope) => !scopeIsCanonical(scope, snapshot.projects, snapshot.organizations))) return null
  return scopes
}

function storedOrganizationIds(scopes: readonly AccessScope[]): number[] | undefined {
  const ids = scopes.flatMap((scope) => scope.type === 'organization' ? [scope.organizationId] : [])
  return ids.length >= 2 ? ids : undefined
}

function scopeListKey(scope: AccessScope): string {
  if (scope.type === 'corporation') return `corporation:${scope.corporationId}`
  if (scope.type === 'organization') return `organization:${scope.corporationId}:${scope.organizationId}`
  if (scope.type === 'project') return `project:${scope.projectId}`
  return `own:${scope.userId}`
}

function sameScopeList(left: readonly AccessScope[], right: readonly AccessScope[]): boolean {
  if (left.length !== right.length) return false
  const a = left.map(scopeListKey).sort()
  const b = right.map(scopeListKey).sort()
  return a.every((item, index) => item === b[index])
}

function sharedDelegation(state: MockState, userId: number, scopes: readonly AccessScope[]) {
  const snapshot = toSnapshot(state)
  if (scopes.length === 0) return { ids: [] as string[], further: false }
  let ids: string[] | null = null
  let further = true
  for (const scope of scopes) {
    const next = delegableIds(state, userId, scope)
    ids = ids == null ? next : ids.filter((id) => next.includes(id))
    further = further && canDelegate(snapshot, userId, 'delegations', 'delegate', scope)
  }
  return { ids: ids ?? [], further }
}

function denyIssued(
  state: MockState,
  userId: number,
  role: AccessRole,
  scopes: readonly AccessScope[],
): FlowResult | null {
  const snapshot = toSnapshot(state)
  for (const scope of scopes) {
    const denial = issuedSetDenial(snapshot, userId, role, scope, -1)
    if (denial) return fail(state, 403, denial === 'invalid_scope' ? 'invalid_scope' : 'forbidden')
  }
  return null
}

function grantsFitRole(state: MockState, previous: AccessRole | null, write: RoleBodyWrite): boolean {
  const previousOperational = previous?.grantIds ?? []
  const previousDelegation = previous?.delegationGrantIds ?? []
  return additionsAreOffered(state, previousOperational, write.grantIds)
    && additionsAreOffered(state, previousDelegation, write.delegationGrantIds)
}

export function createRole(state: MockState, token: string | null, write: RoleBodyWrite): FlowResult {
  const who = staleOrActor(state, token, write.expectedAccessVersion)
  if (!who.ok) return who.result
  if (!write.ownerScope) return fail(state, 400, 'invalid_scope')
  const snapshot = toSnapshot(state)
  const targets = definitionTargets(snapshot, write.ownerScope, write.organizationIds)
  if (!targets) return fail(state, 403, 'invalid_scope')
  if (!targets.every((scope) => can(snapshot, who.user.id, 'roles', 'create', scope))) return fail(state, 403, 'forbidden')
  if (!grantsFitRole(state, null, write)) return fail(state, 403, 'forbidden')
  const role = nextRole(`role-${crypto.randomUUID()}`, write, write.ownerScope, storedOrganizationIds(targets))
  const denial = denyIssued(state, who.user.id, role, targets)
  if (denial) return denial
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'role.create',
    roleId: role.id,
    assignmentId: null,
    before: null,
    after: roleSnapshot(role),
  })
  saved.roles = [...state.roles, role]
  return { state: saved, status: 201, body: { role: roleView(saved, role, write.ownerScope, who.user.id, entireRole()) } }
}

export function updateRole(state: MockState, token: string | null, roleId: string, write: RoleBodyWrite): FlowResult {
  const who = staleOrActor(state, token, write.expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const current = state.roles.find((item) => item.id === roleId)
  if (!current) return fail(state, 404, 'not_found')
  const currentHomes = roleDefinitionScopes(current, snapshot)
  if (currentHomes.length === 0 || !currentHomes.every((scope) => can(snapshot, who.user.id, 'roles', 'update', scope))) {
    return fail(state, 403, 'forbidden')
  }
  let nextHomes = currentHomes
  let storedOwner = current.ownerScope
  let storedIds = current.organizationIds
  if (write.ownerScope != null || write.organizationIds != null) {
    const base = write.ownerScope ?? roleOwnerScope(current, snapshot)
    if (!base) return fail(state, 403, 'invalid_scope')
    const parsed = definitionTargets(snapshot, base, write.organizationIds)
    if (!parsed) return fail(state, 403, 'invalid_scope')
    if (!sameScopeList(parsed, currentHomes)) {
      if (state.assignments.some((item) => item.roleId === current.id)) return fail(state, 403, 'scope_locked')
      if (!parsed.every((scope) => can(snapshot, who.user.id, 'roles', 'create', scope))) return fail(state, 403, 'forbidden')
      const requestedOwner = write.ownerScope
      const requested = requestedOwner && parsed.some((scope) => sameScope(scope, requestedOwner))
        ? requestedOwner
        : parsed[0]
      storedOwner = requested
      storedIds = storedOrganizationIds(parsed)
      nextHomes = parsed
    }
  }
  if (!grantsFitRole(state, current, write)) return fail(state, 403, 'forbidden')
  const role: AccessRole = {
    ...nextRole(current.id, write, storedOwner, storedIds),
    ...(current.origin ? { origin: current.origin } : {}),
  }
  const affected = state.assignments.filter((item) => item.roleId === current.id)
  for (const assignment of affected) {
    const covered = nextHomes.some((home) => scopeCovers(home, assignment.scope, snapshot.projects, snapshot.organizations))
    if (!covered) return fail(state, 403, 'scope_expansion')
    const denial = issuedSetDenial(snapshot, who.user.id, role, assignment.scope, assignment.userId)
    if (denial) return fail(state, 403, denial === 'self_elevation' ? 'self_elevation' : denial === 'invalid_scope' ? 'invalid_scope' : 'forbidden')
  }
  if (affected.length === 0) {
    const denial = denyIssued(state, who.user.id, role, nextHomes)
    if (denial) return denial
  }
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'role.update',
    roleId: role.id,
    assignmentId: null,
    before: roleSnapshot(current),
    after: roleSnapshot(role),
  })
  saved.roles = state.roles.map((item) => item.id === role.id ? role : item)
  const viewOwner = roleOwnerScope(role, snapshot)
  if (!viewOwner) return fail(state, 403, 'forbidden')
  return { state: saved, status: 200, body: { role: roleView(saved, role, viewOwner, who.user.id, entireRole()) } }
}

export function deleteRole(state: MockState, token: string | null, roleId: string, expectedAccessVersion?: number): FlowResult {
  const who = staleOrActor(state, token, expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const current = state.roles.find((item) => item.id === roleId)
  if (!current) return fail(state, 404, 'not_found')
  const homes = roleDefinitionScopes(current, snapshot)
  if (homes.length === 0 || !homes.every((scope) => can(snapshot, who.user.id, 'roles', 'delete', scope))) {
    return fail(state, 403, 'forbidden')
  }
  const affected = state.assignments.filter((item) => item.roleId === current.id)
  if (affected.length > 0) {
    return fail(state, 409, 'role_in_use', {
      assignmentCount: affected.length,
      userCount: new Set(affected.map((item) => item.userId)).size,
    })
  }
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'role.delete',
    roleId: current.id,
    assignmentId: null,
    before: roleSnapshot(current),
    after: null,
  })
  saved.roles = state.roles.filter((item) => item.id !== current.id)
  return { state: saved, status: 200, body: { deleted: current.id } }
}

/**
 * Areas where this caller may create a role.
 * Corporation is included only when roles.create covers the installation corporation.
 * Projects are not role-creation areas in this desk.
 */
function scopesForRoleCreation(state: MockState, userId: number): AccessCreatableScope[] {
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return []
  const scopes: AccessScope[] = []
  const corporation: AccessScope = { type: 'corporation', corporationId }
  if (can(snapshot, userId, 'roles', 'create', corporation)) scopes.push(corporation)
  const organizations = state.organizations
    .filter((organization) => organization.corporationId === corporationId)
    .slice()
    .sort((left, right) => left.shortName.localeCompare(right.shortName, 'ru'))
  for (const organization of organizations) {
    const scope: AccessScope = { type: 'organization', organizationId: organization.id, corporationId }
    if (can(snapshot, userId, 'roles', 'create', scope)) scopes.push(scope)
  }
  return scopes.map((scope) => ({
    scope,
    delegableGrantIds: delegableIds(state, userId, scope),
    canDelegateFurther: canDelegate(snapshot, userId, 'delegations', 'delegate', scope),
  }))
}

type CopyPartition = 'ok' | 'invalid' | 'missing'

function copyPartition(source: readonly string[], requested: readonly string[], omitted: readonly string[]): CopyPartition {
  const sourceIds = uniqueIds(source)
  const sourceSet = new Set(sourceIds)
  const seen = new Set<string>()
  for (const id of requested) {
    if (!sourceSet.has(id) || seen.has(id)) return 'invalid'
    seen.add(id)
  }
  for (const id of omitted) {
    if (!sourceSet.has(id) || seen.has(id)) return 'invalid'
    seen.add(id)
  }
  return seen.size === sourceSet.size ? 'ok' : 'missing'
}

/**
 * Split the source grants into those this actor may place on a new role in the target area,
 * and those that must be named before they are left behind.
 * Catalog grant ids stay shared. The new role stores its own lists.
 */
function classifyRoleCopy(
  state: MockState,
  userId: number,
  source: AccessRole,
  targets: readonly AccessScope[],
): { operational: string[]; delegation: string[]; blocked: RoleDuplicateBlockedGrant[] } {
  const snapshot = toSnapshot(state)
  const operational: string[] = []
  const delegation: string[] = []
  const blocked: RoleDuplicateBlockedGrant[] = []
  const further = targets.every((target) => canDelegate(snapshot, userId, 'delegations', 'delegate', target))
  const consider = (id: string, kind: RoleDuplicateBlockedGrant['kind']): boolean => {
    const grant = state.grants.find((item) => item.id === id)
    if (!grant) {
      blocked.push({ id, resource: '', action: '', kind, reason: 'not_applicable' })
      return false
    }
    if (!isOfferedPermission(grant.resource, grant.action)) {
      blocked.push({ id, resource: grant.resource, action: grant.action, kind, reason: 'not_offered' })
      return false
    }
    const delegable = targets.every((target) => canDelegate(snapshot, userId, grant.resource, grant.action, target))
    if (!delegable || (kind === 'delegation' && !further)) {
      blocked.push({ id, resource: grant.resource, action: grant.action, kind, reason: 'not_delegable' })
      return false
    }
    return true
  }
  for (const id of uniqueIds(source.grantIds)) {
    if (consider(id, 'operational')) operational.push(id)
  }
  for (const id of uniqueIds(source.delegationGrantIds ?? [])) {
    if (consider(id, 'delegation')) delegation.push(id)
  }
  return { operational, delegation, blocked }
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const seen = new Set(right)
  return left.every((id) => seen.has(id))
}

/**
 * Creates one new role and its grant lists in a single state update.
 * A refused copy returns the previous state and does not leave a role without its grants.
 * Assignments, audit history, system capabilities and protected origin are not copied.
 */
export function duplicateRole(state: MockState, token: string | null, write: RoleDuplicateBody): FlowResult {
  const who = staleOrActor(state, token, write.expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const source = state.roles.find((item) => item.id === write.sourceRoleId)
  if (!source) return fail(state, 404, 'not_found')
  const sourceHomes = roleDefinitionScopes(source, snapshot)
  if (!sourceHomes.some((scope) => canInspectRole(snapshot, who.user.id, scope))) return fail(state, 403, 'forbidden')
  const targets = definitionTargets(snapshot, write.ownerScope, write.organizationIds)
  if (!targets) return fail(state, 403, 'invalid_scope')
  if (!targets.every((scope) => can(snapshot, who.user.id, 'roles', 'create', scope))) return fail(state, 403, 'forbidden')

  const classified = classifyRoleCopy(state, who.user.id, source, targets)
  const operationalStatus = copyPartition(source.grantIds, write.grantIds, write.omitGrantIds)
  const delegationStatus = copyPartition(source.delegationGrantIds ?? [], write.delegationGrantIds, write.omitDelegationGrantIds)
  if (operationalStatus === 'invalid' || delegationStatus === 'invalid') return fail(state, 400, 'invalid_grants')

  const requestedBlocked = classified.blocked.filter((item) =>
    item.kind === 'operational' ? write.grantIds.includes(item.id) : write.delegationGrantIds.includes(item.id),
  )
  if (requestedBlocked.length > 0) {
    return fail(state, 403, 'grants_not_delegable', { blocked: requestedBlocked })
  }
  if (!sameIdSet(write.grantIds, classified.operational) || !sameIdSet(write.delegationGrantIds, classified.delegation)) {
    return fail(state, 400, 'invalid_grants')
  }
  const omittedBlocked = classified.blocked.filter((item) =>
    item.kind === 'operational' ? write.omitGrantIds.includes(item.id) : write.omitDelegationGrantIds.includes(item.id),
  )
  if (omittedBlocked.length !== classified.blocked.length || operationalStatus === 'missing' || delegationStatus === 'missing') {
    const pending = classified.blocked.filter((item) =>
      item.kind === 'operational' ? !write.omitGrantIds.includes(item.id) : !write.omitDelegationGrantIds.includes(item.id),
    )
    return fail(state, 403, 'unacknowledged_omissions', { blocked: pending })
  }

  let roleId = `role-${crypto.randomUUID()}`
  while (state.roles.some((item) => item.id === roleId)) roleId = `role-${crypto.randomUUID()}`
  const role = nextRole(roleId, {
    displayName: write.displayName,
    description: write.description,
    grantIds: write.grantIds,
    delegationGrantIds: write.delegationGrantIds,
    ownerScope: write.ownerScope,
  }, write.ownerScope, storedOrganizationIds(targets))
  if (!grantsFitRole(state, null, write)) return fail(state, 403, 'forbidden')
  const denial = denyIssued(state, who.user.id, role, targets)
  if (denial) return denial

  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'role.create',
    roleId: role.id,
    assignmentId: null,
    before: null,
    after: roleSnapshot(role),
  })
  saved.roles = [...state.roles, role]
  return { state: saved, status: 201, body: { role: roleView(saved, role, write.ownerScope, who.user.id, entireRole()) } }
}

function recipientAllowed(state: MockState, actorId: number, userId: number, scope: AccessScope): boolean {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return false
  const snapshot = toSnapshot(state)
  if (scope.type === 'corporation') return hasInstallationCapability(snapshot, actorId, scope.corporationId)
  const organizationId = organizationOf(scope)
  if (organizationId == null || scope.type === 'own') return false
  if (memberOf(state, userId, organizationId)) return true
  return hasInstallationCapability(snapshot, actorId, scope.corporationId)
}

export function createAssignment(state: MockState, token: string | null, write: AssignmentBodyWrite): FlowResult {
  const who = staleOrActor(state, token, write.expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  if (!scopeIsCanonical(write.scope, snapshot.projects, snapshot.organizations)) return fail(state, 403, 'invalid_scope')
  const role = state.roles.find((item) => item.id === write.roleId)
  if (!role) return fail(state, 404, 'not_found')
  const user = state.users.find((item) => item.id === write.userId)
  if (!user) return fail(state, 404, 'not_found')
  const owner = roleOwnerScope(role, snapshot)
  if (!owner) return fail(state, 403, 'forbidden')
  const gate = rolePlacementDenial(snapshot, who.user.id, role, write.scope, -1)
  if (gate) return fail(state, 403, gate)
  if (!recipientAllowed(state, who.user.id, write.userId, write.scope)) return fail(state, 404, 'not_found')
  const existing = state.assignments.find((item) =>
    item.userId === write.userId && item.roleId === write.roleId && sameScope(item.scope, write.scope),
  )
  if (existing) {
    const view: AccessAssignmentView = {
      id: existing.id,
      userId: existing.userId,
      userName: fullName(user),
      roleId: existing.roleId,
      roleName: role.displayName,
      scope: existing.scope,
      canRevoke: assignmentCanBeRevoked(state, who.user.id, existing.scope),
    }
    return { state, status: 200, body: { assignment: view, idempotent: true } }
  }
  const denial = rolePlacementDenial(snapshot, who.user.id, role, write.scope, write.userId)
  if (denial) return fail(state, 403, denial)
  const assignment = {
    id: `asg-${crypto.randomUUID()}`,
    userId: write.userId,
    roleId: write.roleId,
    scope: write.scope,
  }
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'assignment.create',
    roleId: role.id,
    assignmentId: assignment.id,
    before: null,
    after: assignment,
  })
  saved.assignments = [...state.assignments, assignment]
  return {
    state: saved,
    status: 201,
    body: {
      assignment: {
        id: assignment.id,
        userId: assignment.userId,
        userName: fullName(user),
        roleId: assignment.roleId,
        roleName: role.displayName,
        scope: assignment.scope,
        canRevoke: assignmentCanBeRevoked(saved, who.user.id, assignment.scope),
      },
      idempotent: false,
    },
  }
}

/** Same check the revoke service uses. A row is not revocable merely because it was returned. */
export function assignmentCanBeRevoked(state: MockState, actorId: number, scope: AccessScope): boolean {
  return canManageAssignment(toSnapshot(state), actorId, scope)
}

export function revokeAssignment(
  state: MockState,
  token: string | null,
  assignmentId: string,
  expectedAccessVersion?: number,
): FlowResult {
  const who = staleOrActor(state, token, expectedAccessVersion)
  if (!who.ok) return who.result
  const current = state.assignments.find((item) => item.id === assignmentId)
  if (!current) return fail(state, 404, 'not_found')
  if (!assignmentCanBeRevoked(state, who.user.id, current.scope)) return fail(state, 403, 'forbidden')
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'assignment.revoke',
    roleId: current.roleId,
    assignmentId: current.id,
    before: { id: current.id, userId: current.userId, roleId: current.roleId, scope: current.scope },
    after: null,
  })
  saved.assignments = state.assignments.filter((item) => item.id !== current.id)
  return { state: saved, status: 200, body: { revoked: current.id } }
}
