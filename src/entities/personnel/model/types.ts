export const PERSONNEL_TEMPLATE_ID = 'personnel-starter'
export const PERSONNEL_TEMPLATE_VERSION = 1
export const COLUMN_FIO = 'column.fio'
export const COLUMN_STATE = 'column.state'

export const PERSONNEL_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'checkbox', 'directory'] as const
export type PersonnelFieldType = (typeof PERSONNEL_FIELD_TYPES)[number]

export const PERSONNEL_GROUPS = ['personal', 'contacts', 'work', 'tenure', 'qualification'] as const
export type PersonnelGroup = (typeof PERSONNEL_GROUPS)[number]

export const IDENTITY_FIELD_KEYS = ['last-name', 'first-name'] as const

export type DirectorySource =
  | { type: 'manual' }
  | { type: 'registry'; registry: 'departments' | 'workplaces' }

export type DirectoryField = {
  id: string
  key: string
  label: string
  type: 'text'
  required: boolean
  archived: boolean
}

export type DirectoryDefinition = {
  id: string
  organizationId: number
  key: string
  title: string
  description: string
  revision: number
  fields: DirectoryField[]
  source: DirectorySource
  archived: boolean
}

export type DirectoryEntry = {
  id: string
  organizationId: number
  directoryId: string
  values: Record<string, string>
  revision: number
  archived: boolean
}

export type Department = {
  id: string
  organizationId: number
  name: string
  code: string
  parentId: string | null
  revision: number
  archived: boolean
}

export type Workplace = {
  id: string
  organizationId: number
  name: string
  departmentId: string | null
  revision: number
  archived: boolean
}

export type PersonnelTab = {
  id: string
  label: string
  order: number
  system: boolean
}

export type PersonnelField = {
  id: string
  key: string
  label: string
  tabId: string
  group: PersonnelGroup
  type: PersonnelFieldType
  directoryKey: string | null
  required: boolean
  visible: boolean
  system: boolean
  archived: boolean
  order: number
  /** True when a future external source owns the value. The starter leaves this false. */
  sourceOwned: boolean
}

export type PersonnelConfig = {
  organizationId: number
  revision: number
  templateId: string
  templateVersion: number
  tabs: PersonnelTab[]
  fields: PersonnelField[]
  columns: string[]
}

export type EmployeeSource = 'manual' | 'integration'

export type PersonnelValue = string | number | boolean | null

export type Employee = {
  id: string
  organizationId: number
  accountId: number | null
  revision: number
  archived: boolean
  source: EmployeeSource
  sourceId: string | null
  externalId: string | null
  values: Record<string, PersonnelValue>
}

export type OrganizationWorkspace = {
  organizationId: number
  templateId: string
  templateVersion: number
}

export type DirectoryPermissions = {
  update: boolean
  archive: boolean
  delete: boolean
  structure: boolean
}

export type PersonnelPermissions = {
  create: boolean
  update: boolean
  archive: boolean
  structure: boolean
  account: boolean
  users: boolean
  roles: boolean
  directoriesUpdate: boolean
}

export type ReferenceOption = {
  id: string
  label: string
  archived: boolean
  missing?: boolean
}

export type StarterParts = {
  workspace: OrganizationWorkspace
  directories: DirectoryDefinition[]
  entries: DirectoryEntry[]
  config: PersonnelConfig
}
