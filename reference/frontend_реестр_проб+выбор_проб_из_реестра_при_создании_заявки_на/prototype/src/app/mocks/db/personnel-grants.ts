/** Catalog rows. Migration adds them to the grant list and does not add them to stored roles. */
export const PERSONNEL_GRANT_DEFINITIONS = [
  { id: 'g-personnel-read', resource: 'personnel', action: 'read' },
  { id: 'g-personnel-create', resource: 'personnel', action: 'create' },
  { id: 'g-personnel-update', resource: 'personnel', action: 'update' },
  { id: 'g-personnel-archive', resource: 'personnel', action: 'archive' },
  { id: 'g-personnel-structure', resource: 'personnel.structure', action: 'update' },
  { id: 'g-personnel-account', resource: 'personnel.account', action: 'update' },
  { id: 'g-directories-read', resource: 'directories', action: 'read' },
  { id: 'g-directories-update', resource: 'directories', action: 'update' },
  { id: 'g-directories-archive', resource: 'directories', action: 'archive' },
  { id: 'g-directories-delete', resource: 'directories', action: 'delete' },
  { id: 'g-directories-structure', resource: 'directories.structure', action: 'update' },
] as const
