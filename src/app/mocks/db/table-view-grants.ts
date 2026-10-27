/** Catalog rows for the access editor. They are not operational grants by themselves. */
export const TABLE_VIEW_GRANT_DEFINITIONS = [
  { id: 'g-table-views-read', resource: 'table-views', action: 'read' },
  { id: 'g-table-views-create', resource: 'table-views', action: 'create' },
  { id: 'g-table-views-update', resource: 'table-views', action: 'update' },
  { id: 'g-table-views-delete', resource: 'table-views', action: 'delete' },
] as const

export const TABLE_VIEW_DELEGATION_IDS = TABLE_VIEW_GRANT_DEFINITIONS.map((grant) => grant.id)
