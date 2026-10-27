/** Catalog rows so the editor can offer role administration. They are not added to stored roles. */
export const ROLE_GRANT_DEFINITIONS = [
  { id: 'g-roles-read', resource: 'roles', action: 'read' },
  { id: 'g-roles-create', resource: 'roles', action: 'create' },
  { id: 'g-roles-update', resource: 'roles', action: 'update' },
  { id: 'g-roles-delete', resource: 'roles', action: 'delete' },
] as const
