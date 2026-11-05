import type { RequestStatus } from './types'

export type VisibleRequest = {
  customerOrganizationId: number
  executorOrganizationId: number
  authorId: number
  status: RequestStatus
}

/**
 * Read access inside one organization context.
 * `readable` must already be the grant check for that organization.
 * The organization id does not grant access by itself.
 * A draft is visible only to the filing organization. The other party sees it after it leaves draft.
 * Own-record scope is not consulted here.
 */
export function canReadRequest(request: VisibleRequest, activeOrganizationId: number, readable: boolean): boolean {
  if (!readable) return false
  const filing = request.customerOrganizationId === activeOrganizationId
  const executing = request.executorOrganizationId === activeOrganizationId
  if (!filing && !executing) return false
  if (request.status === 'draft' && !filing) return false
  return true
}

/** Why a known request is withheld. Hidden means this context must not learn that it exists. */
export function requestReadDenial(
  request: VisibleRequest,
  activeOrganizationId: number,
  readable: boolean,
): 'ok' | 'hidden' | 'forbidden' {
  const filing = request.customerOrganizationId === activeOrganizationId
  const executing = request.executorOrganizationId === activeOrganizationId
  if (!filing && !executing) return 'hidden'
  if (request.status === 'draft' && !filing) return 'hidden'
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
