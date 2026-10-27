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

export type MockTaskStatus = {
  id: number
  projectId: number
  nameEn: string
  nameRu: string
  position: number
}

export type MockTaskTag = {
  id: number
  projectId: number
  name: string
  isSystemic: boolean
}

export type MockTaskParticipant = {
  id: number
  userId: number
}

export type MockTask = {
  id: number
  projectId: number
  slug: string
  name: string
  description: string
  creatorId: number
  priority: 'low' | 'medium' | 'critical' | 'important'
  statusId: number
  statusPosition: number
  dueDateStart: string
  dueDateEnd: string
  parentId: number | null
  archived: boolean
  isTemplate: boolean
  tagIds: number[]
  doers: MockTaskParticipant[]
  supervisor: MockTaskParticipant | null
  createdAt: string
}

export type MockTaskComment = {
  id: number
  taskId: number
  projectId: number
  userId: number
  text: string
  createdAt: string
}

export type MockTaskFile = {
  id: number
  taskId: number
  projectId: number
  filename: string
  mimeType: string
  size: number
  createdAt: string
  /** File bytes. A blob: URL is never stored. */
  bytes: Uint8Array
}

export type ConstructorFieldType = 'string' | 'integer' | 'date' | 'file' | 'dropdown'

export type MockConstructorNode = {
  id: number
  organizationId: number
  parentId: number | null
  nameEn: string
  nameRu: string
  relatedNodeIds: number[]
}

export type MockConstructorTab = {
  id: number
  organizationId: number
  nodeId: number
  nameEn: string
  nameRu: string
  relatedTabIds: number[]
}

/** Stable field identity. nameEn and nameRu are labels and are not the value key. */
export type MockConstructorField = {
  id: number
  organizationId: number
  nodeId: number
  tabId: number | null
  nameEn: string
  nameRu: string
  type: ConstructorFieldType
  dropdownChoices: string[]
}

export type MockConstructorValue = {
  fieldId: number
  value: string
}

export type MockConstructorRecord = {
  id: number
  organizationId: number
  nodeId: number
  tabId: number | null
  values: MockConstructorValue[]
}

export type MockNotificationRecord = {
  id: number
  userId: number
  type: string
  isRead: boolean
  isDeleted: boolean
  createdAt: string
  data: Record<string, unknown>
}

export type MockFault = {
  path: string
  kind: 'unauthorized' | 'forbidden' | 'network' | 'server' | 'cancel'
} | null

export type MockState = {
  schemaVersion: number
  /**
   * Concurrency token for this document. It is not an access right.
   * A write that carries an older token is refused so it cannot cover a newer record.
   */
  recordRevision?: number
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
  taskStatuses: MockTaskStatus[]
  taskTags: MockTaskTag[]
  tasks: MockTask[]
  taskComments: MockTaskComment[]
  taskFiles: MockTaskFile[]
  constructorNodes: MockConstructorNode[]
  constructorTabs: MockConstructorTab[]
  constructorFields: MockConstructorField[]
  constructorRecords: MockConstructorRecord[]
  notifications: MockNotificationRecord[]
  fault: MockFault
}
