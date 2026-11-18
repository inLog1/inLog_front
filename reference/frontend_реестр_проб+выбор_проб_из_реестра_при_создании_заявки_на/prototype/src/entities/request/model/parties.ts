import type { RequestParty } from './types'

export type RequestParties = {
  customerOrganizationId: number
  executorOrganizationId: number
}

export type PartyFailure = 'unknown_executor' | 'not_laboratory' | 'foreign_party'

export type PartyResult =
  | { ok: true; parties: RequestParties }
  | { ok: false; code: PartyFailure }

/**
 * The active organization files the draft and must be the customer or the executor.
 * A customer organization stays the customer and names a laboratory.
 * A laboratory may stay the customer and name another laboratory, or stay the executor for a customer organization.
 * Omitting the customer keeps the active organization as the customer.
 */
export function resolveRequestParties(
  active: RequestParty,
  executor: RequestParty | null,
  customer?: RequestParty | null,
): PartyResult {
  if (!executor) return { ok: false, code: 'unknown_executor' }
  if (executor.kind !== 'laboratory') return { ok: false, code: 'not_laboratory' }
  const customerParty = customer === undefined ? active : customer
  if (!customerParty) return { ok: false, code: 'foreign_party' }
  if (active.kind === 'customer' && customerParty.id !== active.id) return { ok: false, code: 'foreign_party' }
  if (active.kind === 'laboratory' && customerParty.id !== active.id && customerParty.kind !== 'customer') {
    return { ok: false, code: 'foreign_party' }
  }
  if (customerParty.id !== active.id && executor.id !== active.id) return { ok: false, code: 'foreign_party' }
  if (active.kind === 'customer' && executor.id === active.id) return { ok: false, code: 'not_laboratory' }
  return {
    ok: true,
    parties: { customerOrganizationId: customerParty.id, executorOrganizationId: executor.id },
  }
}

export function sameRequestParties(left: RequestParties, right: RequestParties): boolean {
  return left.customerOrganizationId === right.customerOrganizationId
    && left.executorOrganizationId === right.executorOrganizationId
}
