/** Catalog rows. Migration adds them to the grant list and does not add them to stored roles. */
export const ORGANIZATION_READ_GRANT = {
  id: 'g-organizations-read',
  resource: 'organizations',
  action: 'read',
} as const

export const ORGANIZATION_CREATE_GRANT = {
  id: 'g-organizations-create',
  resource: 'organizations',
  action: 'create',
} as const

export const ORGANIZATION_UPDATE_GRANT = {
  id: 'g-organizations-update',
  resource: 'organizations',
  action: 'update',
} as const

/** Separate from projects.read. Migration adds the row and does not add it to stored roles. */
export const PROJECT_CREATE_GRANT = {
  id: 'g-projects-create',
  resource: 'projects',
  action: 'create',
} as const

export const PROJECT_UPDATE_GRANT = {
  id: 'g-projects-update',
  resource: 'projects',
  action: 'update',
} as const

export const DIRECTORY_CATALOG_GRANTS = [
  ORGANIZATION_READ_GRANT,
  ORGANIZATION_CREATE_GRANT,
  ORGANIZATION_UPDATE_GRANT,
  PROJECT_CREATE_GRANT,
  PROJECT_UPDATE_GRANT,
] as const
