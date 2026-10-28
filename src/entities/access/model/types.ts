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
  /** Optional text. Absent on an older snapshot means an empty description. */
  description?: string
  grantIds: string[]
  /**
   * Grants this role may hand to someone else. They are not operational rights.
   * Absent on an older snapshot means the role cannot delegate.
   */
  delegationGrantIds?: string[]
  /**
   * Who may change this role. Absent on an older snapshot means the installation
   * corporation: only its corporate superadmin may change the role.
   * A missing value is not a grant and is not filled in by migration.
   */
  ownerScope?: AccessScope
}

export type AccessAuditAction =
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'assignment.create'
  | 'assignment.revoke'

/** Mock history stored with the change. It is not a production audit log. */
export type AccessAuditEntry = {
  id: string
  at: string
  actorId: number
  action: AccessAuditAction
  roleId: string | null
  assignmentId: string | null
  before: unknown
  after: unknown
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

export type OrganizationRef = {
  id: number
  corporationId: number
}

export type AccessSnapshot = {
  roles: AccessRole[]
  grants: RoleGrant[]
  assignments: RoleAssignment[]
  delegations: DelegationGrant[]
  systemCapabilities: SystemCapability[]
  projects: ProjectRef[]
  organizations: OrganizationRef[]
  /**
   * Present when the server stored a verified installation corporation.
   * Omitted snapshots keep the older derivation from organizations and projects.
   */
  installationCorporationId?: number | null
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
