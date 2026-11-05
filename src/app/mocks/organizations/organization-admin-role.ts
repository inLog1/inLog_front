import type { AccessAuditEntry, AccessRole, AccessScope } from '../../../entities/access/model/types'
import { personWithPosition } from '../../../entities/organization/model/requisites'
import { PERSONNEL_GRANT_DEFINITIONS } from '../db/personnel-grants'
import type { MockOrganization, MockState } from '../db/types'

/**
 * Explicit allowlist for the organization administrator role.
 * It is not derived from the full catalog, so a grant added later is not included.
 * The same ids are operational rights and the only grants this role may hand on.
 * organizations.create and corporate_superadmin are intentionally absent.
 */
export const ORGANIZATION_ADMINISTRATOR_ROLE_NAME = 'Администратор организации'

export const ORGANIZATION_ADMINISTRATOR_GRANTS = [
  { id: 'g-organizations-read', resource: 'organizations', action: 'read' },
  { id: 'g-organizations-update', resource: 'organizations', action: 'update' },
  { id: 'g-access-users-read', resource: 'access-users', action: 'read' },
  { id: 'g-assign', resource: 'assignments', action: 'update' },
  { id: 'g-roles-read', resource: 'roles', action: 'read' },
  { id: 'g-roles-create', resource: 'roles', action: 'create' },
  { id: 'g-roles-update', resource: 'roles', action: 'update' },
  { id: 'g-roles-delete', resource: 'roles', action: 'delete' },
  { id: 'g-delegate', resource: 'delegations', action: 'delegate' },
  { id: 'g-tasks', resource: 'tasks', action: 'read' },
  { id: 'g-tasks-create', resource: 'tasks', action: 'create' },
  { id: 'g-tasks-update', resource: 'tasks', action: 'update' },
  { id: 'g-tasks-delete', resource: 'tasks', action: 'delete' },
  { id: 'g-tasks-assign', resource: 'tasks', action: 'assign' },
  { id: 'g-constructor-schema-read', resource: 'constructor.schema', action: 'read' },
  { id: 'g-constructor-schema-create', resource: 'constructor.schema', action: 'create' },
  { id: 'g-constructor-schema-update', resource: 'constructor.schema', action: 'update' },
  { id: 'g-constructor-schema-delete', resource: 'constructor.schema', action: 'delete' },
  { id: 'g-constructor-records-read', resource: 'constructor.records', action: 'read' },
  { id: 'g-constructor-records-create', resource: 'constructor.records', action: 'create' },
  { id: 'g-constructor-records-update', resource: 'constructor.records', action: 'update' },
  { id: 'g-constructor-records-delete', resource: 'constructor.records', action: 'delete' },
  { id: 'g-reports-read', resource: 'reports', action: 'read' },
  { id: 'g-reports-generate', resource: 'reports', action: 'generate' },
  { id: 'g-forms-read', resource: 'forms', action: 'read' },
  { id: 'g-forms-create', resource: 'forms', action: 'create' },
  { id: 'g-forms-update', resource: 'forms', action: 'update' },
  { id: 'g-forms-publish', resource: 'forms', action: 'publish' },
  { id: 'g-forms-delete', resource: 'forms', action: 'delete' },
  { id: 'g-form-records-create', resource: 'form-records', action: 'create' },
  { id: 'g-form-records-read', resource: 'form-records', action: 'read' },
  { id: 'g-table-views-read', resource: 'table-views', action: 'read' },
  { id: 'g-table-views-create', resource: 'table-views', action: 'create' },
  { id: 'g-table-views-update', resource: 'table-views', action: 'update' },
  { id: 'g-table-views-delete', resource: 'table-views', action: 'delete' },
  { id: 'g-sections-read', resource: 'sections', action: 'read' },
  { id: 'g-sections-create', resource: 'sections', action: 'create' },
  { id: 'g-sections-update', resource: 'sections', action: 'update' },
  { id: 'g-sections-publish', resource: 'sections', action: 'publish' },
  { id: 'g-projects', resource: 'projects', action: 'read' },
  { id: 'g-projects-create', resource: 'projects', action: 'create' },
  { id: 'g-projects-update', resource: 'projects', action: 'update' },
  ...PERSONNEL_GRANT_DEFINITIONS,
] as const

export function organizationAdministratorGrantIds(): string[] {
  return ORGANIZATION_ADMINISTRATOR_GRANTS.map((grant) => grant.id)
}

function assignmentInOrganization(scope: AccessScope, organizationId: number): boolean {
  return (scope.type === 'organization' || scope.type === 'project') && scope.organizationId === organizationId
}

/** People assigned to this organization's administrator role. Surname, initials and position are all required. */
export function organizationAdministratorLabel(state: MockState, organizationId: number): string | null {
  const role = state.roles.find((item) =>
    item.origin?.template === 'organization-administrator'
    && item.ownerScope?.type === 'organization'
    && item.ownerScope.organizationId === organizationId,
  )
  if (!role) return null
  const labels = state.assignments.flatMap((assignment) => {
    if (assignment.roleId !== role.id || !assignmentInOrganization(assignment.scope, organizationId)) return []
    const user = state.users.find((item) => item.id === assignment.userId)
    if (!user || user.status === 'blocked') return []
    const label = personWithPosition(user)
    return label ? [label] : []
  })
  labels.sort((left, right) => left.localeCompare(right, 'ru'))
  return labels.length > 0 ? labels.join(', ') : null
}

function catalogReady(state: MockState): boolean {
  return ORGANIZATION_ADMINISTRATOR_GRANTS.every((expected) =>
    state.grants.some((grant) =>
      grant.id === expected.id && grant.resource === expected.resource && grant.action === expected.action,
    ),
  )
}

export function organizationAdministratorRole(state: MockState, organizationId: number): AccessRole | undefined {
  return state.roles.find((item) =>
    item.origin?.template === 'organization-administrator'
    && item.ownerScope?.type === 'organization'
    && item.ownerScope.organizationId === organizationId,
  )
}

/** Keeps the existing administrator role, or adds it when an older organization does not have one yet. */
export function ensureOrganizationAdministrator(
  state: MockState,
  organization: MockOrganization,
  actorId: number,
): { state: MockState; roleId: string } | null {
  const existing = organizationAdministratorRole(state, organization.id)
  if (existing) return { state, roleId: existing.id }
  const next = withOrganizationAdministrator(state, organization, actorId)
  if (!next) return null
  const created = organizationAdministratorRole(next, organization.id)
  return created ? { state: next, roleId: created.id } : null
}

/** Adds the administrator role to the same state as the new organization. Returns null when the catalog cannot support the allowlist. */
export function withOrganizationAdministrator(
  state: MockState,
  organization: MockOrganization,
  actorId: number,
): MockState | null {
  if (!catalogReady(state)) return null
  const grantIds = organizationAdministratorGrantIds()
  const role: AccessRole = {
    id: `role-${crypto.randomUUID()}`,
    displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
    description: '',
    grantIds,
    delegationGrantIds: [...grantIds],
    ownerScope: {
      type: 'organization',
      organizationId: organization.id,
      corporationId: organization.corporationId,
    },
    origin: { template: 'organization-administrator' },
  }
  const audit: AccessAuditEntry = {
    id: `audit-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    actorId,
    action: 'role.create',
    roleId: role.id,
    assignmentId: null,
    before: null,
    after: {
      id: role.id,
      displayName: role.displayName,
      description: '',
      grantIds: [...grantIds],
      delegationGrantIds: [...grantIds],
      ownerScope: role.ownerScope ?? null,
    },
  }
  return {
    ...state,
    roles: [...state.roles, role],
    accessVersion: state.accessVersion + 1,
    accessAudit: [...(state.accessAudit ?? []), audit],
  }
}
