export type CorporationScope = {
  type: 'corporation'
  corporationId: number
}

export type OrganizationScope = {
  type: 'organization'
  organizationId: number
  corporationId: number
}

export type ProjectScope = {
  type: 'project'
  projectId: number
  organizationId: number
  corporationId: number
}

export type OwnScope = {
  type: 'own'
  userId: number
}

export type AccessScope = CorporationScope | OrganizationScope | ProjectScope | OwnScope

export type RoleGrant = {
  id: string
  resource: string
  action: string
}

export type EffectiveGrant = RoleGrant & {
  scope: AccessScope
}

export type AccessRole = {
  id: string
  displayName: string
  grantIds: string[]
}

export type RoleAssignment = {
  id: string
  userId: number
  roleId: string
  scope: AccessScope
}

export type DelegationGrant = {
  id: string
  fromUserId: number
  toUserId: number
  grant: EffectiveGrant
}

export type SystemCapabilityCode = 'corporate_superadmin'

export type SystemCapability = {
  userId: number
  code: SystemCapabilityCode
}

export type ProjectRef = {
  id: number
  organizationId: number
  corporationId: number
}

export type AccessSnapshot = {
  roles: AccessRole[]
  grants: RoleGrant[]
  assignments: RoleAssignment[]
  delegations: DelegationGrant[]
  systemCapabilities: SystemCapability[]
  projects: ProjectRef[]
}

export type AccessState = 'ready' | 'pending' | 'blocked'

export type SessionAccess = {
  identityId: number
  memberships: Array<{
    id: string
    organizationId: number
    kind: 'laboratory' | 'customer'
  }>
  effectiveGrants: EffectiveGrant[]
  delegationGrants: EffectiveGrant[]
  accessVersion: number
  systemCapabilities: SystemCapabilityCode[]
  accessState: AccessState
}
