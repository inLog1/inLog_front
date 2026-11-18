/** Catalog rows for the access editor. They are not operational grants by themselves. */
export const FORM_GRANT_DEFINITIONS = [
  { id: 'g-forms-read', resource: 'forms', action: 'read' },
  { id: 'g-forms-create', resource: 'forms', action: 'create' },
  { id: 'g-forms-update', resource: 'forms', action: 'update' },
  { id: 'g-forms-publish', resource: 'forms', action: 'publish' },
  { id: 'g-forms-delete', resource: 'forms', action: 'delete' },
  { id: 'g-form-records-create', resource: 'form-records', action: 'create' },
  { id: 'g-form-records-read', resource: 'form-records', action: 'read' },
] as const

export const FORM_DELEGATION_IDS = FORM_GRANT_DEFINITIONS.map((grant) => grant.id)
