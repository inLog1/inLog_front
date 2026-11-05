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
 * Customer files for a laboratory.
 * A laboratory files only for itself, and that is still one record: both ids match.
 * The active organization is the filing side. A caller cannot name a different customer.
 */
export function resolveRequestParties(active: RequestParty, executor: RequestParty | null): PartyResult {
  if (!executor) return { ok: false, code: 'unknown_executor' }
  if (active.kind === 'laboratory') {
    if (executor.id !== active.id || executor.kind !== 'laboratory') {
      return { ok: false, code: 'foreign_party' }
    }
    return {
      ok: true,
      parties: { customerOrganizationId: active.id, executorOrganizationId: active.id },
    }
  }
  if (executor.kind !== 'laboratory' || executor.id === active.id) {
    return { ok: false, code: 'not_laboratory' }
  }
  return {
    ok: true,
    parties: { customerOrganizationId: active.id, executorOrganizationId: executor.id },
  }
}

export function sameRequestParties(left: RequestParties, right: RequestParties): boolean {
  return left.customerOrganizationId === right.customerOrganizationId
    && left.executorOrganizationId === right.executorOrganizationId
}
