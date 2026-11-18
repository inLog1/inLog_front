import type { RequestStatus } from './types'

export const REQUEST_REASON_MAX = 1000

/**
 * A draft is revised by whoever can already see it.
 * A returned request is revised by the customer organization, including a colleague of the author.
 * The author id is not an access check.
 */
export function canReviseRequest(
  request: { status: RequestStatus; customerOrganizationId: number },
  organizationId: number,
): boolean {
  if (request.status === 'draft') return true
  return request.status === 'rework' && request.customerOrganizationId === organizationId
}

export function readRequestReason(
  value: unknown,
): { ok: true; reason: string } | { ok: false; code: 'reason_required' | 'invalid_text' } {
  if (typeof value !== 'string') return { ok: false, code: 'reason_required' }
  const reason = value.trim()
  if (!reason) return { ok: false, code: 'reason_required' }
  if (reason.length > REQUEST_REASON_MAX) return { ok: false, code: 'invalid_text' }
  return { ok: true, reason }
}
