import {
  assignmentDenial,
  canDelegate,
  canManageAssignment,
  hasInstallationCapability,
  installationCorporationId,
  roleOwnerScope,
  scopeCovers,
  scopeIsCanonical,
} from '../../../entities/access/model/grants'
import { isOfferedPermission } from '../../../entities/access/model/permission-catalog'
import type {
  AccessAssignmentView,
  AccessCandidate,
  AccessDirectory,
  AccessGrantView,
  AccessRoleDetail,
  AccessRoleView,
  AssignmentWrite as AssignmentBody,
  RoleWrite as RoleBody,
} from '../../../entities/access/model/directory'
import type { AccessAuditEntry, AccessRole, AccessScope } from '../../../entities/access/model/types'
import type { FlowResult } from '../auth/flow'
import { principal, toSnapshot } from '../auth/flow'
import type { MockState, MockUser } from '../db/types'

type RoleBodyWrite = RoleBody
type AssignmentBodyWrite = AssignmentBody

function fail(state: MockState, status: number, code: string, extra: Record<string, unknown> = {}): FlowResult {
  return { state, status, body: { code, ...extra } }
}

function fullName(user: MockUser): string {
  return [user.surname, user.name, user.patronymic].filter(Boolean).join(' ')
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
  return {
    ok: true,
    value: { displayName, description, grantIds, delegationGrantIds, ownerScope, expectedAccessVersion },
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

function roleView(state: MockState, role: AccessRole, owner: AccessScope): AccessRoleView {
  const assignments = state.assignments.filter((item) => item.roleId === role.id)
  const users = new Set(assignments.map((item) => item.userId))
  return {
    id: role.id,
    displayName: role.displayName,
    description: role.description ?? '',
    ownerScope: owner,
    operational: viewsFor(state, role.grantIds),
    delegation: viewsFor(state, role.delegationGrantIds ?? []),
    assignmentCount: assignments.length,
    affectedUserCount: users.size,
    affectedScopes: assignments.map((item) => item.scope),
    canEdit: true,
    canDelete: assignments.length === 0,
  }
}

function visibleRoles(state: MockState, userId: number, area: 'organization' | 'corporation', organizationId: number | null): AccessRole[] {
  const snapshot = toSnapshot(state)
  return state.roles.filter((role) => {
    const owner = roleOwnerScope(role, snapshot)
    if (!owner || !canManageAssignment(snapshot, userId, owner)) return false
    if (area === 'corporation') return owner.type === 'corporation'
    if (organizationId == null) return false
    return scopeInOrganization(owner, organizationId)
  })
}

function visibleAssignments(state: MockState, userId: number, area: 'organization' | 'corporation', organizationId: number | null) {
  const snapshot = toSnapshot(state)
  return state.assignments.filter((item) => {
    if (!canManageAssignment(snapshot, userId, item.scope)) return false
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

  let area: 'organization' | 'corporation'
  let organizationId: number | null = null
  if (query.scope === 'corporation' && (query.organization == null || query.organization === '')) {
    if (!canManageCorporation) return fail(state, 403, 'forbidden')
    area = 'corporation'
  } else if (query.organization != null && query.organization !== '' && query.scope !== 'corporation') {
    if (!/^[1-9]\d*$/.test(query.organization)) return fail(state, 400, 'invalid_organization')
    organizationId = Number(query.organization)
    const organization = state.organizations.find((item) => item.id === organizationId)
    if (!organization || organization.corporationId !== corporationId) return fail(state, 404, 'not_found')
    const scope = { type: 'organization' as const, organizationId, corporationId }
    if (!canManageAssignment(snapshot, who.user.id, scope)) return fail(state, 403, 'forbidden')
    area = 'organization'
  } else {
    return fail(state, 400, 'invalid_organization')
  }

  const delegationScope: AccessScope = area === 'corporation'
    ? { type: 'corporation', corporationId }
    : { type: 'organization', organizationId: organizationId as number, corporationId }
  const roles = visibleRoles(state, who.user.id, area, organizationId)
  const assignments = visibleAssignments(state, who.user.id, area, organizationId)
  const roleIds = new Set(roles.map((role) => role.id))
  const assignmentIds = new Set(assignments.map((item) => item.id))
  const candidates = candidatesFor(state, area, organizationId)
  const projects = state.projects
    .filter((project) => area === 'organization' && project.organizationId === organizationId)
    .map((project) => ({ id: project.id, name: project.name, organizationId: project.organizationId }))
  const organizations = state.organizations
    .filter((organization) => area === 'corporation' || organization.id === organizationId)
    .filter((organization) => canManageAssignment(snapshot, who.user.id, {
      type: 'organization',
      organizationId: organization.id,
      corporationId,
    }))
    .map((organization) => ({ id: organization.id, shortName: organization.shortName }))

  const body: AccessDirectory = {
    scope: area,
    organizationId,
    corporationId,
    accessVersion: state.accessVersion,
    canManageCorporation,
    offeredGrants: offeredGrants(state),
    delegableGrantIds: delegableIds(state, who.user.id, delegationScope),
    canDelegateFurther: canDelegate(snapshot, who.user.id, 'delegations', 'delegate', delegationScope),
    roles: roles.flatMap((role) => {
      const owner = roleOwnerScope(role, snapshot)
      return owner ? [roleView(state, role, owner)] : []
    }),
    assignments: assignments.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: fullName(state.users.find((user) => user.id === item.userId) ?? who.user),
      roleId: item.roleId,
      roleName: state.roles.find((role) => role.id === item.roleId)?.displayName ?? item.roleId,
      scope: item.scope,
      canRevoke: true,
    })),
    candidates,
    projects,
    organizations,
    recentChanges: recentChanges(state, who.user.id, roleIds, assignmentIds),
  }
  return { state, status: 200, body }
}

function candidatesFor(state: MockState, area: 'organization' | 'corporation', organizationId: number | null): AccessCandidate[] {
  const users = area === 'corporation'
    ? state.users
    : state.users.filter((user) => organizationId != null && memberOf(state, user.id, organizationId))
  return users
    .map((user) => ({ id: user.id, fullName: fullName(user), position: user.position }))
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
  if (!owner || !canManageAssignment(snapshot, who.user.id, owner)) return fail(state, 403, 'forbidden')
  const body: AccessRoleDetail = {
    role: roleView(state, role, owner),
    offeredGrants: offeredGrants(state),
    delegableGrantIds: delegableIds(state, who.user.id, owner),
    canDelegateFurther: canDelegate(snapshot, who.user.id, 'delegations', 'delegate', owner),
    accessVersion: state.accessVersion,
    organizations: state.organizations
      .filter((organization) => canManageAssignment(snapshot, who.user.id, {
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

function nextRole(id: string, write: RoleBody, ownerScope: AccessScope | undefined): AccessRole {
  return {
    id,
    displayName: write.displayName,
    description: write.description,
    grantIds: write.grantIds,
    delegationGrantIds: write.delegationGrantIds,
    ownerScope,
  }
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
  if (!scopeIsCanonical(write.ownerScope, snapshot.projects, snapshot.organizations)) return fail(state, 403, 'invalid_scope')
  if (!canManageAssignment(snapshot, who.user.id, write.ownerScope)) return fail(state, 403, 'forbidden')
  if (!grantsFitRole(state, null, write)) return fail(state, 403, 'forbidden')
  const role = nextRole(`role-${crypto.randomUUID()}`, write, write.ownerScope)
  const denial = assignmentDenial(snapshot, who.user.id, role, write.ownerScope, -1)
  if (denial) return fail(state, 403, denial === 'invalid_scope' ? 'invalid_scope' : 'forbidden')
  const saved = withAudit(state, {
    actorId: who.user.id,
    action: 'role.create',
    roleId: role.id,
    assignmentId: null,
    before: null,
    after: roleSnapshot(role),
  })
  saved.roles = [...state.roles, role]
  return { state: saved, status: 201, body: { role: roleView(saved, role, write.ownerScope) } }
}

export function updateRole(state: MockState, token: string | null, roleId: string, write: RoleBodyWrite): FlowResult {
  const who = staleOrActor(state, token, write.expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const current = state.roles.find((item) => item.id === roleId)
  if (!current) return fail(state, 404, 'not_found')
  const owner = roleOwnerScope(current, snapshot)
  if (!owner || !canManageAssignment(snapshot, who.user.id, owner)) return fail(state, 403, 'forbidden')
  if (write.ownerScope && !sameScope(write.ownerScope, owner)) return fail(state, 403, 'scope_expansion')
  if (!grantsFitRole(state, current, write)) return fail(state, 403, 'forbidden')
  const role = nextRole(current.id, write, current.ownerScope)
  const affected = state.assignments.filter((item) => item.roleId === current.id)
  for (const assignment of affected) {
    if (!scopeCovers(owner, assignment.scope, snapshot.projects, snapshot.organizations)) {
      return fail(state, 403, 'scope_expansion')
    }
    const denial = assignmentDenial(snapshot, who.user.id, role, assignment.scope, assignment.userId)
    if (denial) return fail(state, 403, denial === 'self_elevation' ? 'self_elevation' : denial === 'invalid_scope' ? 'invalid_scope' : 'forbidden')
  }
  if (affected.length === 0) {
    const denial = assignmentDenial(snapshot, who.user.id, role, owner, -1)
    if (denial) return fail(state, 403, denial === 'invalid_scope' ? 'invalid_scope' : 'forbidden')
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
  return { state: saved, status: 200, body: { role: roleView(saved, role, owner) } }
}

export function deleteRole(state: MockState, token: string | null, roleId: string, expectedAccessVersion?: number): FlowResult {
  const who = staleOrActor(state, token, expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const current = state.roles.find((item) => item.id === roleId)
  if (!current) return fail(state, 404, 'not_found')
  const owner = roleOwnerScope(current, snapshot)
  if (!owner || !canManageAssignment(snapshot, who.user.id, owner)) return fail(state, 403, 'forbidden')
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
  if (!owner || !canManageAssignment(snapshot, who.user.id, owner)) return fail(state, 403, 'forbidden')
  if (!canManageAssignment(snapshot, who.user.id, write.scope)) return fail(state, 403, 'forbidden')
  if (!scopeCovers(owner, write.scope, snapshot.projects, snapshot.organizations)) return fail(state, 403, 'scope_expansion')
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
      canRevoke: true,
    }
    return { state, status: 200, body: { assignment: view, idempotent: true } }
  }
  const denial = assignmentDenial(snapshot, who.user.id, role, write.scope, write.userId)
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
        canRevoke: true,
      },
      idempotent: false,
    },
  }
}

export function revokeAssignment(
  state: MockState,
  token: string | null,
  assignmentId: string,
  expectedAccessVersion?: number,
): FlowResult {
  const who = staleOrActor(state, token, expectedAccessVersion)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const current = state.assignments.find((item) => item.id === assignmentId)
  if (!current) return fail(state, 404, 'not_found')
  if (!canManageAssignment(snapshot, who.user.id, current.scope)) return fail(state, 403, 'forbidden')
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
