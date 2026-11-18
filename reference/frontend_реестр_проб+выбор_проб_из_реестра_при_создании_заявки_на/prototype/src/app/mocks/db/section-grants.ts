/** Catalog rows for the access editor. They are not operational grants by themselves. */
export const SECTION_GRANT_DEFINITIONS = [
  { id: 'g-sections-read', resource: 'sections', action: 'read' },
  { id: 'g-sections-create', resource: 'sections', action: 'create' },
  { id: 'g-sections-update', resource: 'sections', action: 'update' },
  { id: 'g-sections-publish', resource: 'sections', action: 'publish' },
] as const

export const SECTION_DELEGATION_IDS = SECTION_GRANT_DEFINITIONS.map((grant) => grant.id)
