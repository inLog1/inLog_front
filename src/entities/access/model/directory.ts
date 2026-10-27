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
  canEdit: boolean
  canDelete: boolean
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

export type AccessDirectory = {
  scope: 'organization' | 'corporation'
  organizationId: number | null
  corporationId: number
  accessVersion: number
  canManageCorporation: boolean
  /** Creating a role definition. Assigning an existing role uses assignments instead. */
  canCreateRole: boolean
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

export type AssignmentWrite = {
  userId: number
  roleId: string
  scope: AccessScope
  expectedAccessVersion?: number
}
