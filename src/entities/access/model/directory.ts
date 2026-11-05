import type { AccessScope } from './types'

/** Proposed DTO. This is not a production backend contract. */

export type AccessGrantView = {
  id: string
  resource: string
  action: string
  offered: boolean
}

export type AccessRoleView = {
  id: string
  displayName: string
  description: string
  ownerScope: AccessScope
  operational: AccessGrantView[]
  delegation: AccessGrantView[]
  assignmentCount: number
  affectedUserCount: number
  affectedScopes: AccessScope[]
  canRead: boolean
  canEdit: boolean
  canDelete: boolean
  /** Copy is allowed when this caller may inspect the source. The new role still needs a creatable area. */
  canDuplicate: boolean
  /**
   * Starter or other protected role. A display name is not this flag.
   * Duplication never copies it onto the new role.
   */
  system: boolean
}

export type AccessAssignmentView = {
  id: string
  userId: number
  userName: string
  roleId: string
  roleName: string
  scope: AccessScope
  canRevoke: boolean
}

export type AccessCandidate = {
  id: number
  fullName: string
  position: string
}

export type AccessChangeView = {
  id: string
  at: string
  actorId: number
  actorName: string
  action: string
  roleId: string | null
  roleName: string | null
  assignmentId: string | null
}

/** An area where this caller may create a role, with the grants they may hand on there. */
export type AccessCreatableScope = {
  scope: AccessScope
  delegableGrantIds: string[]
  canDelegateFurther: boolean
}

export type AccessDirectory = {
  scope: 'organization' | 'corporation' | 'all'
  organizationId: number | null
  corporationId: number
  accessVersion: number
  canManageCorporation: boolean
  /** Creating a role definition. Assigning an existing role uses assignments instead. */
  canCreateRole: boolean
  /**
   * Organization and corporation areas where this caller may create a role.
   * Project areas are not offered: role creation in this desk does not use them.
   */
  creatableScopes: AccessCreatableScope[]
  offeredGrants: AccessGrantView[]
  delegableGrantIds: string[]
  canDelegateFurther: boolean
  roles: AccessRoleView[]
  assignments: AccessAssignmentView[]
  candidates: AccessCandidate[]
  projects: Array<{ id: number; name: string; organizationId: number }>
  organizations: Array<{ id: number; shortName: string }>
  recentChanges: AccessChangeView[]
}

export type AccessRoleDetail = {
  role: AccessRoleView
  offeredGrants: AccessGrantView[]
  delegableGrantIds: string[]
  canDelegateFurther: boolean
  creatableScopes: AccessCreatableScope[]
  accessVersion: number
  organizations: Array<{ id: number; shortName: string }>
  projects: Array<{ id: number; name: string; organizationId: number }>
}

export type RoleWrite = {
  displayName: string
  description: string
  grantIds: string[]
  delegationGrantIds: string[]
  ownerScope?: AccessScope
  expectedAccessVersion?: number
}

export type RoleDuplicateBlockReason = 'not_delegable' | 'not_offered' | 'not_applicable'

/** A source grant that cannot be placed on the new role. It is never dropped quietly. */
export type RoleDuplicateBlockedGrant = {
  id: string
  resource: string
  action: string
  kind: 'operational' | 'delegation'
  reason: RoleDuplicateBlockReason
}

/**
 * Copy an existing role into a new one.
 * `grantIds` and `delegationGrantIds` are the grants to keep.
 * Every other source grant must be listed in the matching omit list.
 * Grants are catalog ids. The new role holds its own lists; it does not receive new catalog rows.
 */
export type RoleDuplicateWrite = {
  sourceRoleId: string
  displayName: string
  description: string
  grantIds: string[]
  delegationGrantIds: string[]
  omitGrantIds: string[]
  omitDelegationGrantIds: string[]
  ownerScope: AccessScope
  expectedAccessVersion?: number
}

export type AssignmentWrite = {
  userId: number
  roleId: string
  scope: AccessScope
  expectedAccessVersion?: number
}

export type AccessUserStatus = 'active' | 'blocked'

export type AccessUserAssignment = AccessAssignmentView

export type AccessUserRow = {
  id: number
  fullName: string
  email: string
  status: AccessUserStatus
  corporateSuperadmin: boolean
  organizations: Array<{ id: number; shortName: string }>
  assignments: AccessUserAssignment[]
}

export type AccessUsersQueryEcho = {
  organization: number | 'all'
  q: string
  page: number
  pageSize: number
}

/**
 * Proposed read model for people in the caller's area.
 * `organization: all` is a review filter. It is not an assignment scope.
 * `coverage: granted` means assignments outside the caller's area are omitted.
 */
export type AccessUsersPage = {
  accessVersion: number
  corporationId: number
  coverage: 'corporation' | 'granted'
  organizations: Array<{ id: number; shortName: string }>
  projects: Array<{ id: number; name: string; organizationId: number }>
  query: AccessUsersQueryEcho
  count: number
  users: AccessUserRow[]
}

export type AccessUserRoleChoice = {
  id: string
  displayName: string
  ownerScope: AccessScope
  operational: AccessGrantView[]
  hasDelegation: boolean
  scopes: Array<{ scope: AccessScope; assignable: boolean; reason: 'invalid_scope' | 'forbidden' | 'self_elevation' | 'scope_expansion' | null }>
}

export type AccessUserDetail = {
  accessVersion: number
  corporationId: number
  coverage: 'corporation' | 'granted'
  organizations: Array<{ id: number; shortName: string }>
  projects: Array<{ id: number; name: string; organizationId: number }>
  user: AccessUserRow
  canAssign: boolean
  roleChoices: AccessUserRoleChoice[]
}
