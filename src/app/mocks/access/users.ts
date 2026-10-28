import { assignmentDenial, can, canManageAssignment, hasCorporateSuperadmin, hasInstallationCapability, installationCorporationId, roleOwnerScope, scopeCovers, scopeIsCanonical } from '../../../entities/access/model/grants'
import { isOfferedPermission } from '../../../entities/access/model/permission-catalog'
import type {
  AccessGrantView,
  AccessUserDetail,
  AccessUserRoleChoice,
  AccessUserRow,
  AccessUsersPage,
} from '../../../entities/access/model/directory'
import type { AccessRole, AccessScope, AccessSnapshot } from '../../../entities/access/model/types'
import type { FlowResult } from '../auth/flow'
import { principal, toSnapshot } from '../auth/flow'
import type { MockState, MockUser } from '../db/types'
import { assignmentCanBeRevoked } from './service'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 50
const QUERY_MAX = 200

function fail(state: MockState, status: number, code: string): FlowResult {
  return { state, status, body: { code } }
}

function fullName(user: MockUser): string {
  return [user.surname, user.name, user.patronymic].filter(Boolean).join(' ')
}

function organizationOf(scope: AccessScope): number | null {
  if (scope.type === 'organization' || scope.type === 'project') return scope.organizationId
  return null
}

function memberOf(state: MockState, userId: number, organizationId: number): boolean {
  return state.memberships.some((item) => item.userId === userId && item.organizationId === organizationId)
}

function reviewsCorporation(snapshot: AccessSnapshot, actorId: number): boolean {
  const corporationId = installationCorporationId(snapshot)
  return corporationId != null && hasInstallationCapability(snapshot, actorId, corporationId)
}

function canReadUsers(snapshot: AccessSnapshot, actorId: number, scope: AccessScope): boolean {
  if (!scopeIsCanonical(scope, snapshot.projects, snapshot.organizations)) return false
  if (scope.type === 'own') return false
  if (hasInstallationCapability(snapshot, actorId, scope.corporationId)) return true
  return can(snapshot, actorId, 'access-users', 'read', scope)
}

function readableOrganizations(state: MockState, actorId: number) {
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return []
  return state.organizations.filter((organization) =>
    organization.corporationId === corporationId
    && canReadUsers(snapshot, actorId, {
      type: 'organization',
      organizationId: organization.id,
      corporationId,
    }),
  )
}

function assignmentVisible(state: MockState, actorId: number, scope: AccessScope): boolean {
  return canReadUsers(toSnapshot(state), actorId, scope)
}

function grantViews(state: MockState, ids: readonly string[]): AccessGrantView[] {
  return ids.flatMap((id) => {
    const grant = state.grants.find((item) => item.id === id)
    if (!grant) return []
    return [{
      id: grant.id,
      resource: grant.resource,
      action: grant.action,
      offered: isOfferedPermission(grant.resource, grant.action),
    }]
  })
}

function roleVisible(state: MockState, actorId: number, role: AccessRole): boolean {
  const snapshot = toSnapshot(state)
  const owner = roleOwnerScope(role, snapshot)
  if (!owner) return false
  return can(snapshot, actorId, 'roles', 'read', owner) || canManageAssignment(snapshot, actorId, owner)
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

function assignableScopes(state: MockState, actorId: number, userId: number): AccessScope[] {
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return []
  const scopes: AccessScope[] = []
  const corporation = { type: 'corporation' as const, corporationId }
  if (canManageAssignment(snapshot, actorId, corporation) && recipientAllowed(state, actorId, userId, corporation)) {
    scopes.push(corporation)
  }
  for (const organization of readableOrganizations(state, actorId)) {
    const organizationScope: AccessScope = {
      type: 'organization',
      organizationId: organization.id,
      corporationId,
    }
    if (canManageAssignment(snapshot, actorId, organizationScope) && recipientAllowed(state, actorId, userId, organizationScope)) {
      scopes.push(organizationScope)
    }
    for (const project of state.projects.filter((item) => item.organizationId === organization.id && item.corporationId === corporationId)) {
      const projectScope: AccessScope = {
        type: 'project',
        projectId: project.id,
        organizationId: project.organizationId,
        corporationId,
      }
      if (canManageAssignment(snapshot, actorId, projectScope) && recipientAllowed(state, actorId, userId, projectScope)) {
        scopes.push(projectScope)
      }
    }
  }
  return scopes
}

function userTouchesOrganization(state: MockState, actorId: number, userId: number, organizationId: number): boolean {
  if (memberOf(state, userId, organizationId)) return true
  return state.assignments.some((item) =>
    item.userId === userId
    && organizationOf(item.scope) === organizationId
    && assignmentVisible(state, actorId, item.scope),
  )
}

function userVisible(state: MockState, actorId: number, user: MockUser): boolean {
  if (reviewsCorporation(toSnapshot(state), actorId)) return true
  return readableOrganizations(state, actorId).some((organization) =>
    userTouchesOrganization(state, actorId, user.id, organization.id),
  )
}

function rowFor(state: MockState, actorId: number, user: MockUser): AccessUserRow {
  const snapshot = toSnapshot(state)
  const readable = new Set(readableOrganizations(state, actorId).map((item) => item.id))
  return {
    id: user.id,
    fullName: fullName(user),
    email: user.email,
    status: user.status,
    corporateSuperadmin: hasCorporateSuperadmin(snapshot, user.id),
    organizations: state.organizations
      .filter((organization) => readable.has(organization.id) && memberOf(state, user.id, organization.id))
      .map((organization) => ({ id: organization.id, shortName: organization.shortName })),
    assignments: state.assignments
      .filter((item) => item.userId === user.id && assignmentVisible(state, actorId, item.scope))
      .map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: fullName(user),
        roleId: item.roleId,
        roleName: state.roles.find((role) => role.id === item.roleId)?.displayName ?? item.roleId,
        scope: item.scope,
        canRevoke: assignmentCanBeRevoked(state, actorId, item.scope),
      })),
  }
}

function catalogs(state: MockState, actorId: number) {
  const readable = readableOrganizations(state, actorId)
  const ids = new Set(readable.map((item) => item.id))
  return {
    organizations: readable.map((item) => ({ id: item.id, shortName: item.shortName })),
    projects: state.projects
      .filter((project) => ids.has(project.organizationId))
      .map((project) => ({ id: project.id, name: project.name, organizationId: project.organizationId })),
  }
}

function parsePage(value: string | null, fallback: number, max: number): number | null {
  if (value == null || value === '') return fallback
  if (!/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > max) return null
  return parsed
}

function roleChoices(state: MockState, actorId: number, userId: number): AccessUserRoleChoice[] {
  const snapshot = toSnapshot(state)
  const scopes = assignableScopes(state, actorId, userId)
  return state.roles.flatMap((role) => {
    if (!roleVisible(state, actorId, role)) return []
    const owner = roleOwnerScope(role, snapshot)
    if (!owner) return []
    const evaluated = scopes.map((scope) => {
      let reason: AccessUserRoleChoice['scopes'][number]['reason'] = null
      if (!canManageAssignment(snapshot, actorId, owner) || !canManageAssignment(snapshot, actorId, scope)) {
        reason = 'forbidden'
      } else if (!scopeCovers(owner, scope, snapshot.projects, snapshot.organizations)) {
        reason = 'scope_expansion'
      } else {
        reason = assignmentDenial(snapshot, actorId, role, scope, userId)
      }
      return { scope, assignable: reason == null, reason }
    })
    if (evaluated.length === 0) return []
    return [{
      id: role.id,
      displayName: role.displayName,
      ownerScope: owner,
      operational: grantViews(state, role.grantIds),
      hasDelegation: (role.delegationGrantIds ?? []).length > 0,
      scopes: evaluated,
    }]
  })
}

export function readUsers(
  state: MockState,
  token: string | null,
  query: { organization: string | null; q: string | null; page: string | null; pageSize: string | null },
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const readable = readableOrganizations(state, who.user.id)
  if (!reviewsCorporation(snapshot, who.user.id) && readable.length === 0) return fail(state, 403, 'forbidden')

  const rawOrganization = query.organization?.trim() ?? ''
  let organization: number | 'all' = 'all'
  if (rawOrganization !== '' && rawOrganization !== 'all') {
    if (!/^[1-9]\d*$/.test(rawOrganization)) return fail(state, 400, 'invalid_organization')
    const organizationId = Number(rawOrganization)
    const found = state.organizations.find((item) => item.id === organizationId && item.corporationId === corporationId)
    if (!found) return fail(state, 404, 'not_found')
    if (!readable.some((item) => item.id === organizationId)) return fail(state, 403, 'forbidden')
    organization = organizationId
  }

  const q = (query.q ?? '').trim()
  if (q.length > QUERY_MAX) return fail(state, 400, 'invalid_query')
  const page = parsePage(query.page, 1, 10_000)
  const pageSize = parsePage(query.pageSize, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX)
  if (page == null || pageSize == null) return fail(state, 400, 'invalid_page')

  const needle = q.toLocaleLowerCase('ru')
  const matched = state.users
    .filter((user) => userVisible(state, who.user.id, user))
    .filter((user) => organization === 'all' || userTouchesOrganization(state, who.user.id, user.id, organization))
    .filter((user) => {
      if (needle.length === 0) return true
      const haystack = `${fullName(user)} ${user.email}`.toLocaleLowerCase('ru')
      return haystack.includes(needle)
    })
    .sort((left, right) => fullName(left).localeCompare(fullName(right), 'ru'))

  const listed = catalogs(state, who.user.id)
  const body: AccessUsersPage = {
    accessVersion: state.accessVersion,
    corporationId,
    coverage: reviewsCorporation(snapshot, who.user.id) ? 'corporation' : 'granted',
    organizations: listed.organizations,
    projects: listed.projects,
    query: { organization, q, page, pageSize },
    count: matched.length,
    users: matched.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map((user) => rowFor(state, who.user.id, user)),
  }
  return { state, status: 200, body }
}

export function readUser(state: MockState, token: string | null, userId: number): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const snapshot = toSnapshot(state)
  const corporationId = installationCorporationId(snapshot)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const readable = readableOrganizations(state, who.user.id)
  if (!reviewsCorporation(snapshot, who.user.id) && readable.length === 0) return fail(state, 403, 'forbidden')
  const user = state.users.find((item) => item.id === userId)
  if (!user || !userVisible(state, who.user.id, user)) return fail(state, 404, 'not_found')
  const choices = roleChoices(state, who.user.id, user.id)
  const listed = catalogs(state, who.user.id)
  const body: AccessUserDetail = {
    accessVersion: state.accessVersion,
    corporationId,
    coverage: reviewsCorporation(snapshot, who.user.id) ? 'corporation' : 'granted',
    organizations: listed.organizations,
    projects: listed.projects,
    user: rowFor(state, who.user.id, user),
    canAssign: choices.some((choice) => choice.scopes.some((item) => item.assignable)),
    roleChoices: choices,
  }
  return { state, status: 200, body }
}
