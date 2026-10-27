/**
 * Permissions the access editor may offer.
 * Only capabilities the application already uses are listed.
 * Equipment, processes and other future domains are not invented here.
 * read, update, create, delete and delegate stay independent; this list does not imply one from another.
 */
export type PermissionGroupId =
  | 'tasks'
  | 'constructor-schema'
  | 'constructor-records'
  | 'reports'
  | 'access'

export type CatalogPermission = {
  group: PermissionGroupId
  resource: string
  action: string
  labelKey: string
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
  { group: 'access', resource: 'assignments', action: 'update', labelKey: 'access.perm.access.assignments' },
  { group: 'access', resource: 'delegations', action: 'delegate', labelKey: 'access.perm.access.delegate' },
]

export function isOfferedPermission(resource: string, action: string): boolean {
  return ACCESS_PERMISSION_CATALOG.some((item) => item.resource === resource && item.action === action)
}
