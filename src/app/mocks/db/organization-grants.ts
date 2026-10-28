/** Catalog row. Migration adds it to the grant list and does not add it to stored roles. */
export const ORGANIZATION_CREATE_GRANT = {
  id: 'g-organizations-create',
  resource: 'organizations',
  action: 'create',
} as const

/** Separate from projects.read. Migration adds the row and does not add it to stored roles. */
export const PROJECT_CREATE_GRANT = {
  id: 'g-projects-create',
  resource: 'projects',
  action: 'create',
} as const
