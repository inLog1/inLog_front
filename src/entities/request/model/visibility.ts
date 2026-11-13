import type { RequestStatus } from './types'

export type VisibleRequest = {
  customerOrganizationId: number
  executorOrganizationId: number
  filedByOrganizationId?: number
  authorId: number
  status: RequestStatus
}

function draftOwnerId(request: Pick<VisibleRequest, 'customerOrganizationId' | 'filedByOrganizationId'>): number {
  return request.filedByOrganizationId ?? request.customerOrganizationId
}

/**
 * The organization that saved the request may delete it.
 * A missing filedByOrganizationId means the customer filed it.
 * Status is not part of this check: a sent or reviewed request can still be removed.
 * This is the party check. The update grant is checked separately.
 */
export function isRequestFiler(
  request: Pick<VisibleRequest, 'customerOrganizationId' | 'filedByOrganizationId'>,
  organizationId: number,
): boolean {
  return draftOwnerId(request) === organizationId
}

/**
 * Read access inside one organization context.
 * `readable` must already be the grant check for that organization.
 * The organization id does not grant access by itself.
 * A draft is visible only to the organization that filed it. The other party sees it after it leaves draft.
 * Own-record scope is not consulted here.
 */
export function canReadRequest(request: VisibleRequest, activeOrganizationId: number, readable: boolean): boolean {
  if (!readable) return false
  const party = request.customerOrganizationId === activeOrganizationId
    || request.executorOrganizationId === activeOrganizationId
  if (!party) return false
  if (request.status === 'draft' && draftOwnerId(request) !== activeOrganizationId) return false
  return true
}

/** Why a known request is withheld. Hidden means this context must not learn that it exists. */
export function requestReadDenial(
  request: VisibleRequest,
  activeOrganizationId: number,
  readable: boolean,
): 'ok' | 'hidden' | 'forbidden' {
  const party = request.customerOrganizationId === activeOrganizationId
    || request.executorOrganizationId === activeOrganizationId
  if (!party) return 'hidden'
  if (request.status === 'draft' && draftOwnerId(request) !== activeOrganizationId) return 'hidden'
  if (!readable) return 'forbidden'
  return 'ok'
}

/**
 * A request this organization executes after it has left draft.
 * A draft is never incoming, including a laboratory draft addressed to itself.
 * Once that own request is sent, it is incoming and still filed by the same laboratory.
 */
export function isIncomingSent(request: VisibleRequest, organizationId: number): boolean {
  return request.status !== 'draft' && request.executorOrganizationId === organizationId
}

/** Filed by this organization. It is a list bucket, not an access check. */
export function isFiledByOrganization(
  request: Pick<VisibleRequest, 'customerOrganizationId'>,
  organizationId: number,
): boolean {
  return request.customerOrganizationId === organizationId
}

/** "My requests" after the read check. It is not an access scope. */
export function isAuthoredBy(request: Pick<VisibleRequest, 'authorId'>, userId: number): boolean {
  return request.authorId === userId
}
