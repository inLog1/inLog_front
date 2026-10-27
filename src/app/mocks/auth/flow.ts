import {
  assignmentDenial,
  can,
  effectiveGrants,
  hasCorporateSuperadmin,
  hasInstallationCapability,
  delegationGrantsFor,
  installationCorporationId,
  scopeCovers,
} from '../../../entities/access/model/grants'
import type { AccessRole, AccessSnapshot, EffectiveGrant, SessionAccess } from '../../../entities/access/model/types'
import type { User, UserSettings } from '../../../entities/user/model/types'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import type { MockIdentity, MockState, MockUser } from '../db/types'

export type FlowResult = {
  state: MockState
  status: number
  body: unknown
}

const settings: UserSettings = {
  language: 'ru',
  timezone: 'Europe/Moscow',
  sound_notification: false,
  disabled_email_notifications: [],
  disabled_inlog_notifications: [],
  notifiable_days_of_week: [1, 2, 3, 4, 5],
  notify_from_time: '09:00',
  notify_to_time: '18:00',
}

export function toSnapshot(state: MockState): AccessSnapshot {
  return {
    roles: state.roles,
    grants: state.grants,
    assignments: state.assignments,
    delegations: state.delegations,
    systemCapabilities: state.systemCapabilities,
    projects: state.projects.map((project) => ({
      id: project.id,
      organizationId: project.organizationId,
      corporationId: project.corporationId,
    })),
    organizations: state.organizations.map((organization) => ({
      id: organization.id,
      corporationId: organization.corporationId,
    })),
  }
}

export function resolveIdentity(state: MockState, providerId: string, externalSubject: string): MockIdentity | null {
  return state.identities.find((item) =>
    item.providerId === providerId && item.externalSubject === externalSubject,
  ) ?? null
}

function userByEmail(state: MockState, email: string): MockUser | undefined {
  const normalized = email.trim().toLowerCase()
  return state.users.find((user) => user.email.toLowerCase() === normalized)
}

function userById(state: MockState, userId: number): MockUser | undefined {
  return state.users.find((user) => user.id === userId)
}

export function toLegacyUser(user: MockUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    patronymic: user.patronymic,
    surname: user.surname,
    full_name: [user.surname, user.name, user.patronymic].filter(Boolean).join(' '),
    company_name: 'Демо-корпорация',
    position: user.position,
    about_myself: '',
    role: user.legacyRole,
    avatar: {},
    phone_number: null,
    settings,
    belonging: '',
  }
}

function issue(state: MockState, user: MockUser): FlowResult {
  const nonce = crypto.randomUUID()
  const accessToken = `mock.${user.id}.${nonce}`
  const refreshToken = `mock.refresh.${user.id}.${nonce}`
  return {
    state: {
      ...state,
      sessions: [...state.sessions, { id: nonce, userId: user.id, accessToken, refreshToken }],
    },
    status: 200,
    body: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: toLegacyUser(user),
    },
  }
}

function fail(state: MockState, status: number, code: string): FlowResult {
  return { state, status, body: { code } }
}

function sessionUser(state: MockState, token: string | null): MockUser | undefined {
  if (!token) return undefined
  const session = state.sessions.find((item) => item.accessToken === token)
  if (!session) return undefined
  return userById(state, session.userId)
}

export function accessFor(state: MockState, user: MockUser): SessionAccess {
  const snapshot = toSnapshot(state)
  const grants = effectiveGrants(snapshot, user.id)
  const delegated = delegationGrantsFor(snapshot, user.id)
  const capabilities = state.systemCapabilities
    .filter((item) => item.userId === user.id)
    .map((item) => item.code)
  let accessState: SessionAccess['accessState'] = 'ready'
  if (user.status === 'blocked') accessState = 'blocked'
  else if (grants.length === 0 && delegated.length === 0 && capabilities.length === 0) accessState = 'pending'

  return {
    identityId: user.id,
    memberships: state.memberships
      .filter((item) => item.userId === user.id)
      .map((item) => ({ id: item.id, organizationId: item.organizationId, kind: item.kind })),
    effectiveGrants: grants,
    delegationGrants: delegated,
    accessVersion: state.accessVersion,
    systemCapabilities: capabilities,
    accessState,
  }
}

export function loginWithPassword(state: MockState, email: string, password: string): FlowResult {
  const user = userByEmail(state, email)
  if (!user || password !== PUBLIC_FIXTURE_PASSWORD) return fail(state, 401, 'invalid_credentials')
  if (user.status === 'blocked') return fail(state, 403, 'blocked')
  return issue(state, user)
}

export function completeMockSso(state: MockState, providerId: string, externalSubject: string): FlowResult {
  const identity = resolveIdentity(state, providerId, externalSubject)
  if (!identity?.userId) return fail(state, 422, 'identity_not_linked')
  const user = userById(state, identity.userId)
  if (!user) return fail(state, 422, 'identity_not_linked')
  if (user.status === 'blocked') return fail(state, 403, 'blocked')
  return issue(state, user)
}

export function cancelMockSso(state: MockState): FlowResult {
  return fail(state, 400, 'sso_cancelled')
}

export function verifyToken(state: MockState, token: string): FlowResult {
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  return { state, status: 200, body: { token } }
}

export function logoutToken(state: MockState, token: string | null): FlowResult {
  if (!token) return { state, status: 204, body: null }
  return {
    state: { ...state, sessions: state.sessions.filter((item) => item.accessToken !== token) },
    status: 204,
    body: null,
  }
}

export function currentUser(state: MockState, token: string | null): FlowResult {
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  return { state, status: 200, body: toLegacyUser(user) }
}

export function sessionAccess(state: MockState, token: string | null): FlowResult {
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const access = accessFor(state, user)
  if (access.accessState === 'ready') return { state, status: 200, body: access }
  return {
    state,
    status: 200,
    body: {
      identityId: access.identityId,
      memberships: [],
      effectiveGrants: [],
      delegationGrants: [],
      accessVersion: access.accessVersion,
      systemCapabilities: [],
      accessState: access.accessState,
    },
  }
}

export function principal(state: MockState, token: string | null):
  | { ok: true; user: MockUser }
  | { ok: false; result: FlowResult } {
  const denied = denyInactive(state, token)
  if (denied) return { ok: false, result: denied }
  const user = sessionUser(state, token)
  if (!user) return { ok: false, result: fail(state, 401, 'expired') }
  return { ok: true, user }
}

function denyInactive(state: MockState, token: string | null): FlowResult | null {
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  if (user.status === 'blocked') return fail(state, 403, 'blocked')
  if (accessFor(state, user).accessState === 'pending') return fail(state, 403, 'pending')
  return null
}

function organizationScope(state: MockState, organizationId: number) {
  return { type: 'organization' as const, organizationId, corporationId: state.corporation.id }
}

function canonicalOrganization(state: MockState, organizationId: number) {
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) return null
  return organization
}

export function projectRecord(state: MockState, projectId: number) {
  return canonicalProject(state, projectId)
}

function canonicalProject(state: MockState, projectId: number) {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project || project.corporationId !== state.corporation.id) return null
  if (!canonicalOrganization(state, project.organizationId)) return null
  return project
}

function grantReachesOrganization(
  grant: EffectiveGrant,
  organization: { id: number; corporationId: number },
  projects: AccessSnapshot['projects'],
): boolean {
  const target = { type: 'organization' as const, organizationId: organization.id, corporationId: organization.corporationId }
  if (grant.scope.type !== 'own' && scopeCovers(grant.scope, target, projects, [organization])) return true
  const scope = grant.scope
  if (scope.type !== 'project') return false
  if (scope.organizationId !== organization.id || scope.corporationId !== organization.corporationId) return false
  const project = projects.find((item) => item.id === scope.projectId)
  return project != null && project.organizationId === organization.id && project.corporationId === organization.corporationId
}

export function canReadOrganization(state: MockState, userId: number, organizationId: number): boolean {
  const organization = canonicalOrganization(state, organizationId)
  if (!organization) return false
  const snapshot = toSnapshot(state)
  return effectiveGrants(snapshot, userId).some((grant) => grantReachesOrganization(grant, organization, snapshot.projects))
}

function canReadProjectRecord(state: MockState, userId: number, project: { id: number; organizationId: number; corporationId: number }): boolean {
  return can(toSnapshot(state), userId, 'projects', 'read', {
    type: 'project',
    projectId: project.id,
    organizationId: project.organizationId,
    corporationId: project.corporationId,
  })
}

function projectDto(project: { id: number; name: string; organizationId: number }) {
  return {
    id: project.id,
    name: project.name,
    organization: project.organizationId,
    role: null,
    reservoir: '',
    company_customer: '',
    contractor: '',
    country: '',
  }
}

export function listOrganizations(state: MockState, token: string | null): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const rows = state.organizations
    .filter((organization) => canReadOrganization(state, user.id, organization.id))
    .map((organization) => ({
      id: organization.id,
      full_name: organization.fullName,
      short_name: organization.shortName,
      address: organization.address,
      role: null,
    }))
  return { state, status: 200, body: rows }
}

export function readOrganization(state: MockState, token: string | null, organizationId: number): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const organization = canonicalOrganization(state, organizationId)
  if (!organization) return fail(state, 404, 'not_found')
  if (!canReadOrganization(state, user.id, organization.id)) return fail(state, 403, 'forbidden')
  return {
    state,
    status: 200,
    body: {
      id: organization.id,
      full_name: organization.fullName,
      short_name: organization.shortName,
      address: organization.address,
      role: null,
    },
  }
}

export function listProjects(state: MockState, token: string | null, organizationId: number | null): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  if (organizationId != null) {
    if (!Number.isInteger(organizationId) || organizationId <= 0) return fail(state, 400, 'invalid_organization')
    if (!canonicalOrganization(state, organizationId)) return fail(state, 404, 'not_found')
    if (!canReadOrganization(state, user.id, organizationId)) return fail(state, 403, 'forbidden')
  }
  const rows = state.projects
    .filter((project) => canonicalProject(state, project.id) != null)
    .filter((project) => organizationId == null || project.organizationId === organizationId)
    .filter((project) => canReadProjectRecord(state, user.id, project))
    .map((project) => projectDto(project))
  return { state, status: 200, body: rows }
}

export function readProject(state: MockState, token: string | null, projectId: number): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const project = canonicalProject(state, projectId)
  if (!project) return fail(state, 404, 'not_found')
  if (!canReadProjectRecord(state, user.id, project)) return fail(state, 403, 'forbidden')
  return { state, status: 200, body: projectDto(project) }
}

export function readTestResource(state: MockState, token: string | null, organizationId: number): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const allowed = can(toSnapshot(state), user.id, 'test-resource', 'read', organizationScope(state, organizationId))
  if (!allowed) return fail(state, 403, 'forbidden')
  return { state, status: 200, body: { ok: true, organizationId, code: 'mock_test_resource' } }
}

function roleAfterRevision(role: AccessRole, grantIds: string[], delegationGrantIds: string[]): AccessRole {
  return { ...role, grantIds, delegationGrantIds }
}

export function mutateAssignment(state: MockState, token: string | null, assignmentId: string, roleId: string): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const assignment = state.assignments.find((item) => item.id === assignmentId)
  if (!assignment) return fail(state, 404, 'not_found')
  const role = state.roles.find((item) => item.id === roleId)
  if (!role) return fail(state, 404, 'not_found')
  const denial = assignmentDenial(toSnapshot(state), user.id, role, assignment.scope, assignment.userId)
  if (denial) return fail(state, 403, denial)
  const next: MockState = {
    ...state,
    accessVersion: state.accessVersion + 1,
    assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, roleId } : item),
  }
  return {
    state: next,
    status: 200,
    body: {
      assignment: next.assignments.find((item) => item.id === assignmentId),
      corporateSuperadmin: hasCorporateSuperadmin(toSnapshot(next), assignment.userId),
      roleDisplayName: role.displayName,
    },
  }
}

export function reviseRoleGrants(
  state: MockState,
  token: string | null,
  roleId: string,
  grantIds: string[],
  delegationGrantIds: string[] = [],
): FlowResult {
  const denied = denyInactive(state, token)
  if (denied) return denied
  const user = sessionUser(state, token)
  if (!user) return fail(state, 401, 'expired')
  const role = state.roles.find((item) => item.id === roleId)
  if (!role) return fail(state, 404, 'not_found')
  const snapshot = toSnapshot(state)
  const nextRole = roleAfterRevision(role, grantIds, delegationGrantIds)
  const affected = state.assignments.filter((item) => item.roleId === roleId)
  if (affected.length === 0) {
    const corporationId = installationCorporationId(snapshot)
    if (corporationId == null || !hasInstallationCapability(snapshot, user.id, corporationId)) {
      return fail(state, 403, 'forbidden')
    }
    const denial = assignmentDenial(
      snapshot,
      user.id,
      nextRole,
      { type: 'corporation', corporationId },
      -1,
    )
    if (denial) return fail(state, 403, denial === 'invalid_scope' ? denial : 'forbidden')
  }
  for (const assignment of affected) {
    const denial = assignmentDenial(snapshot, user.id, nextRole, assignment.scope, assignment.userId)
    if (denial) return fail(state, 403, denial === 'invalid_scope' ? denial : 'forbidden')
  }
  const next: MockState = {
    ...state,
    accessVersion: state.accessVersion + 1,
    roles: state.roles.map((item) => item.id === roleId ? nextRole : item),
  }
  return { state: next, status: 200, body: { role: nextRole } }
}

export function switchUser(state: MockState, userId: number): FlowResult {
  const user = userById(state, userId)
  if (!user) return fail(state, 404, 'not_found')
  if (user.status === 'blocked') return fail(state, 403, 'blocked')
  return issue(state, user)
}

export function capabilitiesOf(state: MockState) {
  const methods = state.authMode === 'mixed' ? ['local', 'sso'] : [state.authMode]
  return {
    authMode: state.authMode,
    methods,
    providerLabel: 'Тестовый корпоративный провайдер',
    startPath: '/auth/mock-provider',
    ssoConfigured: true,
  }
}

export function describeAccounts(state: MockState) {
  return state.users.map((user) => {
    const access = accessFor(state, user)
    return {
      id: user.id,
      email: user.email,
      fullName: toLegacyUser(user).full_name,
      status: user.status,
      legacyRole: user.legacyRole,
      accessState: access.accessState,
      memberships: access.memberships,
      grants: access.effectiveGrants.map((grant) => ({
        resource: grant.resource,
        action: grant.action,
        scope: grant.scope,
      })),
      delegationGrants: access.delegationGrants.map((grant) => ({
        resource: grant.resource,
        action: grant.action,
        scope: grant.scope,
      })),
      systemCapabilities: access.systemCapabilities,
    }
  })
}

export function listProviderIdentities(state: MockState) {
  return state.identities.map((identity) => {
    const linkedUser = identity.userId == null ? undefined : userById(state, identity.userId)
    return {
      providerId: identity.providerId,
      externalSubject: identity.externalSubject,
      email: identity.email,
      linked: linkedUser != null,
      label: linkedUser ? toLegacyUser(linkedUser).full_name ?? linkedUser.email : identity.email,
    }
  })
}
