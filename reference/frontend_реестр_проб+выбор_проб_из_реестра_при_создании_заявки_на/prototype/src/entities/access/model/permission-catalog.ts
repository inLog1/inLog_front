/**
 * Permissions the access editor may offer.
 * Only capabilities the application already uses are listed.
 * Equipment and processes are not invented here. Request actions are listed because the request module uses them.
 * read, update, create, delete and delegate stay independent; this list does not imply one from another.
 * Installation capability covers exactly this list. A resource or action that is not here is not granted by that capability.
 */
export type PermissionGroupId =
  | 'tasks'
  | 'constructor-schema'
  | 'constructor-records'
  | 'reports'
  | 'forms'
  | 'table-views'
  | 'sections'
  | 'access'
  | 'organizations'
  | 'projects'
  | 'requests'
  | 'personnel'
  | 'directories'
  | 'system-registries'

export const SYSTEM_REGISTRIES = ['departments', 'workplaces'] as const
export type SystemRegistryId = (typeof SYSTEM_REGISTRIES)[number]

export function registryRecordsResource(registry: SystemRegistryId): string {
  return `registry.${registry}.records`
}

export function registrySchemaResource(registry: SystemRegistryId): string {
  return `registry.${registry}.schema`
}

export type CatalogPermission = {
  group: PermissionGroupId
  resource: string
  action: string
  labelKey: string
  /** Heading inside the group. Used by system registries. */
  sectionKey?: string
}

const REGISTRY_RECORD_ACTIONS = ['read', 'create', 'update', 'archive', 'delete'] as const
const REGISTRY_SCHEMA_ACTIONS = ['read', 'create', 'update', 'delete'] as const

function registryCatalog(registry: SystemRegistryId): CatalogPermission[] {
  const records = REGISTRY_RECORD_ACTIONS.map((action) => ({
    group: 'system-registries' as const,
    sectionKey: registry,
    resource: registryRecordsResource(registry),
    action,
    labelKey: `access.perm.registry.${registry}.records.${action}`,
  }))
  const schema = REGISTRY_SCHEMA_ACTIONS.map((action) => ({
    group: 'system-registries' as const,
    sectionKey: registry,
    resource: registrySchemaResource(registry),
    action,
    labelKey: `access.perm.registry.${registry}.schema.${action}`,
  }))
  return [...records, ...schema]
}

export const ACCESS_PERMISSION_CATALOG: readonly CatalogPermission[] = [
  { group: 'tasks', resource: 'tasks', action: 'read', labelKey: 'access.perm.tasks.read' },
  { group: 'tasks', resource: 'tasks', action: 'create', labelKey: 'access.perm.tasks.create' },
  { group: 'tasks', resource: 'tasks', action: 'update', labelKey: 'access.perm.tasks.update' },
  { group: 'tasks', resource: 'tasks', action: 'delete', labelKey: 'access.perm.tasks.delete' },
  { group: 'tasks', resource: 'tasks', action: 'assign', labelKey: 'access.perm.tasks.assign' },
  { group: 'constructor-schema', resource: 'constructor.schema', action: 'read', labelKey: 'access.perm.schema.read' },
  { group: 'constructor-schema', resource: 'constructor.schema', action: 'create', labelKey: 'access.perm.schema.create' },
  { group: 'constructor-schema', resource: 'constructor.schema', action: 'update', labelKey: 'access.perm.schema.update' },
  { group: 'constructor-schema', resource: 'constructor.schema', action: 'delete', labelKey: 'access.perm.schema.delete' },
  { group: 'constructor-records', resource: 'constructor.records', action: 'read', labelKey: 'access.perm.records.read' },
  { group: 'constructor-records', resource: 'constructor.records', action: 'create', labelKey: 'access.perm.records.create' },
  { group: 'constructor-records', resource: 'constructor.records', action: 'update', labelKey: 'access.perm.records.update' },
  { group: 'constructor-records', resource: 'constructor.records', action: 'delete', labelKey: 'access.perm.records.delete' },
  { group: 'reports', resource: 'reports', action: 'read', labelKey: 'access.perm.reports.read' },
  { group: 'reports', resource: 'reports', action: 'generate', labelKey: 'access.perm.reports.generate' },
  { group: 'forms', resource: 'forms', action: 'read', labelKey: 'access.perm.forms.read' },
  { group: 'forms', resource: 'forms', action: 'create', labelKey: 'access.perm.forms.create' },
  { group: 'forms', resource: 'forms', action: 'update', labelKey: 'access.perm.forms.update' },
  { group: 'forms', resource: 'forms', action: 'publish', labelKey: 'access.perm.forms.publish' },
  { group: 'forms', resource: 'forms', action: 'delete', labelKey: 'access.perm.forms.delete' },
  { group: 'forms', resource: 'form-records', action: 'create', labelKey: 'access.perm.forms.record-create' },
  { group: 'forms', resource: 'form-records', action: 'read', labelKey: 'access.perm.forms.record-read' },
  { group: 'table-views', resource: 'table-views', action: 'read', labelKey: 'access.perm.table-views.read' },
  { group: 'table-views', resource: 'table-views', action: 'create', labelKey: 'access.perm.table-views.create' },
  { group: 'table-views', resource: 'table-views', action: 'update', labelKey: 'access.perm.table-views.update' },
  { group: 'table-views', resource: 'table-views', action: 'delete', labelKey: 'access.perm.table-views.delete' },
  { group: 'sections', resource: 'sections', action: 'read', labelKey: 'access.perm.sections.read' },
  { group: 'sections', resource: 'sections', action: 'create', labelKey: 'access.perm.sections.create' },
  { group: 'sections', resource: 'sections', action: 'update', labelKey: 'access.perm.sections.update' },
  { group: 'sections', resource: 'sections', action: 'publish', labelKey: 'access.perm.sections.publish' },
  { group: 'access', resource: 'access-users', action: 'read', labelKey: 'access.perm.access.users-read' },
  { group: 'access', resource: 'assignments', action: 'update', labelKey: 'access.perm.access.assignments' },
  { group: 'access', resource: 'delegations', action: 'delegate', labelKey: 'access.perm.access.delegate' },
  { group: 'access', resource: 'roles', action: 'read', labelKey: 'access.perm.access.roles-read' },
  { group: 'access', resource: 'roles', action: 'create', labelKey: 'access.perm.access.roles-create' },
  { group: 'access', resource: 'roles', action: 'update', labelKey: 'access.perm.access.roles-update' },
  { group: 'access', resource: 'roles', action: 'delete', labelKey: 'access.perm.access.roles-delete' },
  { group: 'organizations', resource: 'organizations', action: 'read', labelKey: 'access.perm.organizations.read' },
  { group: 'organizations', resource: 'organizations', action: 'create', labelKey: 'access.perm.organizations.create' },
  { group: 'organizations', resource: 'organizations', action: 'update', labelKey: 'access.perm.organizations.update' },
  { group: 'organizations', resource: 'organizations', action: 'delete', labelKey: 'access.perm.organizations.delete' },
  { group: 'projects', resource: 'projects', action: 'read', labelKey: 'access.perm.projects.read' },
  { group: 'projects', resource: 'projects', action: 'create', labelKey: 'access.perm.projects.create' },
  { group: 'projects', resource: 'projects', action: 'update', labelKey: 'access.perm.projects.update' },
  { group: 'requests', resource: 'requests', action: 'read', labelKey: 'access.perm.requests.read' },
  { group: 'requests', resource: 'requests', action: 'create', labelKey: 'access.perm.requests.create' },
  { group: 'requests', resource: 'requests', action: 'update', labelKey: 'access.perm.requests.update' },
  { group: 'requests', resource: 'requests', action: 'send', labelKey: 'access.perm.requests.send' },
  { group: 'requests', resource: 'requests', action: 'accept', labelKey: 'access.perm.requests.accept' },
  { group: 'requests', resource: 'requests', action: 'reject', labelKey: 'access.perm.requests.reject' },
  { group: 'requests', resource: 'requests', action: 'assign', labelKey: 'access.perm.requests.assign' },
  { group: 'requests', resource: 'requests', action: 'cancel', labelKey: 'access.perm.requests.cancel' },
  { group: 'requests', resource: 'requests', action: 'manage_program', labelKey: 'access.perm.requests.manage_program' },
  { group: 'requests', resource: 'requests', action: 'approve_program', labelKey: 'access.perm.requests.approve_program' },
  { group: 'personnel', resource: 'personnel', action: 'read', labelKey: 'access.perm.personnel.read' },
  { group: 'personnel', resource: 'personnel', action: 'create', labelKey: 'access.perm.personnel.create' },
  { group: 'personnel', resource: 'personnel', action: 'update', labelKey: 'access.perm.personnel.update' },
  { group: 'personnel', resource: 'personnel', action: 'archive', labelKey: 'access.perm.personnel.archive' },
  { group: 'personnel', resource: 'personnel.structure', action: 'update', labelKey: 'access.perm.personnel.structure' },
  { group: 'personnel', resource: 'personnel.account', action: 'update', labelKey: 'access.perm.personnel.account' },
  { group: 'directories', resource: 'directories', action: 'read', labelKey: 'access.perm.directories.read' },
  { group: 'directories', resource: 'directories', action: 'update', labelKey: 'access.perm.directories.update' },
  { group: 'directories', resource: 'directories', action: 'archive', labelKey: 'access.perm.directories.archive' },
  { group: 'directories', resource: 'directories', action: 'delete', labelKey: 'access.perm.directories.delete' },
  { group: 'directories', resource: 'directories.structure', action: 'update', labelKey: 'access.perm.directories.structure' },
  ...registryCatalog('departments'),
  ...registryCatalog('workplaces'),
]

export function isOfferedPermission(resource: string, action: string): boolean {
  return ACCESS_PERMISSION_CATALOG.some((item) => item.resource === resource && item.action === action)
}
