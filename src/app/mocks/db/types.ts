import type {
  AccessRole,
  DelegationGrant,
  RoleAssignment,
  RoleGrant,
  SystemCapability,
} from '../../../entities/access/model/types'
import type { AuthMode } from '../../../shared/config/runtime'
import type { InstallationPhase } from '../../../entities/access/model/accessApi'

export type MockUser = {
  id: number
  email: string
  name: string
  patronymic: string
  surname: string
  position: string
  legacyRole: 'member' | 'admin' | 'super_admin'
  status: 'active' | 'blocked'
}

export type MockIdentity = {
  id: string
  providerId: string
  externalSubject: string
  email: string
  userId: number | null
}

export type MockOrganization = {
  id: number
  corporationId: number
  kind: 'laboratory' | 'customer'
  fullName: string
  shortName: string
  address: string
}

export type MockProject = {
  id: number
  organizationId: number
  corporationId: number
  name: string
}

export type MockMembership = {
  id: string
  userId: number
  organizationId: number
  kind: 'laboratory' | 'customer'
}

export type MockSessionRecord = {
  id: string
  userId: number
  accessToken: string
  refreshToken: string
}

export type MockFault = {
  path: string
  kind: 'unauthorized' | 'forbidden' | 'network' | 'server' | 'cancel'
} | null

export type MockState = {
  schemaVersion: number
  namespace: string
  installationPhase: InstallationPhase
  authMode: AuthMode
  accessVersion: number
  corporation: { id: number; name: string }
  users: MockUser[]
  identities: MockIdentity[]
  organizations: MockOrganization[]
  projects: MockProject[]
  memberships: MockMembership[]
  roles: AccessRole[]
  grants: RoleGrant[]
  assignments: RoleAssignment[]
  delegations: DelegationGrant[]
  systemCapabilities: SystemCapability[]
  sessions: MockSessionRecord[]
  fault: MockFault
}
