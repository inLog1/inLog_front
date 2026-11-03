import { can } from '../../../entities/access/model/grants'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockState, MockUser } from '../db/types'

export function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

export function problem(state: MockState, status: number, code: string, extra?: Record<string, unknown>): FlowResult {
  return done(state, status, extra ? { code, ...extra } : { code })
}

export function allowedKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(body).every((key) => keys.includes(key))
}

export function revisionOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

export function optionalText(value: unknown, max: number): string | null | undefined {
  if (value == null) return ''
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length > max) return undefined
  return trimmed
}

export type Gate = { ok: true; user: MockUser } | { ok: false; result: FlowResult }

export function organizationOf(state: MockState, organizationId: number) {
  return state.organizations.find((item) => item.id === organizationId && item.corporationId === state.corporation.id) ?? null
}

export function allows(
  state: MockState,
  userId: number,
  organizationId: number,
  resource: string,
  action: string,
): boolean {
  const organization = organizationOf(state, organizationId)
  if (!organization) return false
  return can(toSnapshot(state), userId, resource, action, {
    type: 'organization',
    organizationId: organization.id,
    corporationId: organization.corporationId,
  })
}

/** Authenticated user inside this installation's organization. Permission is checked by the caller. */
export function authenticate(
  state: MockState,
  token: string | null,
  organizationId: number,
): Gate {
  const who = principal(state, token)
  if (!who.ok) return who
  if (!organizationOf(state, organizationId)) return { ok: false, result: problem(state, 404, 'not_found') }
  return { ok: true, user: who.user }
}

export function enter(
  state: MockState,
  token: string | null,
  organizationId: number,
  resource: string,
  action: string,
): Gate {
  const who = principal(state, token)
  if (!who.ok) return who
  if (!organizationOf(state, organizationId)) return { ok: false, result: problem(state, 404, 'not_found') }
  if (!allows(state, who.user.id, organizationId, resource, action)) {
    return { ok: false, result: problem(state, 403, 'forbidden') }
  }
  return { ok: true, user: who.user }
}

/** Two organization ids in one request never select a third organization. */
export function agreedOrganization(queryId: number | null, bodyId: unknown): number | 'mismatch' | 'missing' {
  const body = typeof bodyId === 'number' && Number.isInteger(bodyId) && bodyId > 0 ? bodyId : null
  if (queryId != null && body != null && queryId !== body) return 'mismatch'
  const id = queryId ?? body
  return id == null ? 'missing' : id
}
