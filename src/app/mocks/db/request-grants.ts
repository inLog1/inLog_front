/** Catalog rows. Migration adds missing rows and does not copy them onto stored roles. */
export const REQUEST_GRANT_DEFINITIONS = [
  { id: 'g-requests-read', resource: 'requests', action: 'read' },
  { id: 'g-requests-create', resource: 'requests', action: 'create' },
  { id: 'g-requests-update', resource: 'requests', action: 'update' },
  { id: 'g-requests-send', resource: 'requests', action: 'send' },
  { id: 'g-requests-accept', resource: 'requests', action: 'accept' },
  { id: 'g-requests-reject', resource: 'requests', action: 'reject' },
  { id: 'g-requests-assign', resource: 'requests', action: 'assign' },
  { id: 'g-requests-cancel', resource: 'requests', action: 'cancel' },
  { id: 'g-requests-manage-program', resource: 'requests', action: 'manage_program' },
  { id: 'g-requests-approve-program', resource: 'requests', action: 'approve_program' },
] as const

export const REQUEST_GRANT_IDS = REQUEST_GRANT_DEFINITIONS.map((grant) => grant.id)

/** Filing side: read, create, edit a draft, send, and cancel. Acceptance stays with the executor. */
export const REQUEST_AUTHOR_GRANT_IDS = [
  'g-requests-read',
  'g-requests-create',
  'g-requests-update',
  'g-requests-send',
  'g-requests-cancel',
] as const
