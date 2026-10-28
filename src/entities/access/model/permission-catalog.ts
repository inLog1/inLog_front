/**
 * Permissions the access editor may offer.
 * Only capabilities the application already uses are listed.
 * Equipment, processes and other future domains are not invented here.
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
]

export function isOfferedPermission(resource: string, action: string): boolean {
  return ACCESS_PERMISSION_CATALOG.some((item) => item.resource === resource && item.action === action)
}
