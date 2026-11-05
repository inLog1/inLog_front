import { effectiveGrants, grantAllows } from '../../../entities/access/model/grants'
import {
  REQUEST_TITLE_MAX,
  canReadRequest,
  inspectRequestDraft,
  requestReadDenial,
  resolveRequestParties,
  type RequestDraftDetails,
  type RequestRecord,
} from '../../../entities/request'
import { requestDraftCatalogIds, requestDraftOptions } from './catalog'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockOrganization, MockState } from '../db/types'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string): FlowResult {
  return done(state, status, { code })
}

function allowedKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(body).every((key) => keys.includes(key))
}

function revisionOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function organizationOf(state: MockState, organizationId: number): MockOrganization | null {
  return state.organizations.find((item) => item.id === organizationId && item.corporationId === state.corporation.id) ?? null
}

function requestsOf(state: MockState): RequestRecord[] {
  return state.requests ?? []
}

/**
 * Operational check for this organization.
 * Project-only and own-record grants do not pass: grantAllows is called without a project.
 * The role display name is not an input.
 */
function allows(
  state: MockState,
  userId: number,
  organizationId: number,
  action: string,
): boolean {
  if (!organizationOf(state, organizationId)) return false
  return grantAllows(effectiveGrants(toSnapshot(state), userId), 'requests', action, {
    organizationId,
    projectId: null,
  })
}

function titleOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > REQUEST_TITLE_MAX) return null
  return trimmed
}

function canPrepareDraft(state: MockState, userId: number, organizationId: number): boolean {
  return allows(state, userId, organizationId, 'create') || allows(state, userId, organizationId, 'update')
}

function detailsOf(value: unknown): { ok: true; details: RequestDraftDetails } | { ok: false; code: string } {
  const parsed = inspectRequestDraft(value, requestDraftCatalogIds())
  if (!parsed.ok) return { ok: false, code: parsed.issues[0]?.code ?? 'invalid_draft' }
  return parsed
}

/** The registry title follows the project name when the wizard sends details. */
function titleWithDetails(
  titleValue: unknown,
  details: RequestDraftDetails | undefined,
  fallback: string,
): { ok: true; title: string } | { ok: false } {
  if (titleValue === undefined && details) return { ok: true, title: details.projectName }
  if (titleValue === undefined) return { ok: true, title: fallback }
  const title = titleOf(titleValue)
  if (title == null) return { ok: false }
  if (details && title !== details.projectName) return { ok: false }
  return { ok: true, title }
}

function nextNumber(requests: readonly RequestRecord[]): string {
  let max = 0
  for (const item of requests) {
    const match = /^RQ-(\d+)$/.exec(item.number)
    if (!match) continue
    max = Math.max(max, Number(match[1]))
  }
  return `RQ-${String(max + 1).padStart(4, '0')}`
}

function organizationShortName(state: MockState, organizationId: number): string {
  return state.organizations.find((item) => item.id === organizationId)?.shortName ?? ''
}

function authorName(state: MockState, authorId: number): string {
  const user = state.users.find((item) => item.id === authorId)
  if (!user) return ''
  return [user.surname, user.name, user.patronymic].filter((part) => part.trim()).join(' ')
}

/** Labels for a request the caller may already read. Requisites stay off this payload. */
function viewOf(state: MockState, request: RequestRecord) {
  return {
    ...request,
    customerShortName: organizationShortName(state, request.customerOrganizationId),
    executorShortName: organizationShortName(state, request.executorOrganizationId),
    authorName: authorName(state, request.authorId),
  }
}

function present(state: MockState, request: RequestRecord) {
  return { request: viewOf(state, request) }
}

export function listRequests(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const organization = organizationOf(state, organizationId)
  if (!organization) return problem(state, 404, 'not_found')
  const readable = allows(state, who.user.id, organizationId, 'read')
  if (!readable) return problem(state, 403, 'forbidden')
  const requests = requestsOf(state)
    .filter((item) => canReadRequest(item, organizationId, true))
    .map((item) => viewOf(state, item))
  return done(state, 200, { requests, organizationKind: organization.kind })
}

export function readRequest(
  state: MockState,
  token: string | null,
  organizationId: number,
  requestId: string,
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  if (!organizationOf(state, organizationId)) return problem(state, 404, 'not_found')
  const request = requestsOf(state).find((item) => item.id === requestId)
  if (!request) return problem(state, 404, 'not_found')
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'read'))
  if (denial === 'hidden') return problem(state, 404, 'not_found')
  if (denial === 'forbidden') return problem(state, 403, 'forbidden')
  return done(state, 200, present(state, request))
}

/**
 * Laboratories the caller may name as executor.
 * Short name and id only. Organization requisites stay behind organizations.read.
 * Create and update may both open the wizard, so either grant can read this list.
 */
export function listExecutorLaboratories(
  state: MockState,
  token: string | null,
  organizationId: number,
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const active = organizationOf(state, organizationId)
  if (!active) return problem(state, 404, 'not_found')
  if (!canPrepareDraft(state, who.user.id, organizationId)) return problem(state, 403, 'forbidden')
  const laboratories = state.organizations
    .filter((item) => item.corporationId === active.corporationId && item.kind === 'laboratory')
    .filter((item) => active.kind === 'customer' || item.id === active.id)
    .map((item) => ({ id: item.id, shortName: item.shortName }))
    .sort((left, right) => left.id - right.id)
  return done(state, 200, { laboratories })
}

export function listRequestCatalog(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const active = organizationOf(state, organizationId)
  if (!active) return problem(state, 404, 'not_found')
  if (!canPrepareDraft(state, who.user.id, organizationId)) return problem(state, 403, 'forbidden')
  return done(state, 200, { organizationKind: active.kind, ...requestDraftOptions() })
}

export function createRequest(state: MockState, token: string | null, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'executorOrganizationId', 'customerOrganizationId', 'title', 'details'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = body.organizationId
  const executorId = body.executorOrganizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) return problem(state, 400, 'invalid_organization')
  if (typeof executorId !== 'number' || !Number.isInteger(executorId)) return problem(state, 400, 'unknown_executor')
  const who = principal(state, token)
  if (!who.ok) return who.result
  const active = organizationOf(state, organizationId)
  const executor = organizationOf(state, executorId)
  if (!active) return problem(state, 404, 'not_found')
  if (!allows(state, who.user.id, organizationId, 'create')) return problem(state, 403, 'forbidden')
  const resolved = resolveRequestParties(active, executor)
  if (!resolved.ok) return problem(state, 400, resolved.code)
  if (body.customerOrganizationId !== undefined && body.customerOrganizationId !== resolved.parties.customerOrganizationId) {
    return problem(state, 400, 'foreign_party')
  }
  const parsed = body.details === undefined ? undefined : detailsOf(body.details)
  if (parsed && !parsed.ok) return problem(state, 400, parsed.code)
  const titled = titleWithDetails(body.title, parsed?.details, '')
  if (!titled.ok) return problem(state, 400, 'invalid_title')
  const current = requestsOf(state)
  const now = new Date().toISOString()
  const request: RequestRecord = {
    id: `req-${crypto.randomUUID()}`,
    number: nextNumber(current),
    customerOrganizationId: resolved.parties.customerOrganizationId,
    executorOrganizationId: resolved.parties.executorOrganizationId,
    authorId: who.user.id,
    status: 'draft',
    title: titled.title,
    ...(parsed ? { details: parsed.details } : {}),
    createdAt: now,
    updatedAt: now,
    revision: 1,
  }
  const nextState = { ...state, requests: [...current, request] }
  return done(nextState, 201, present(nextState, request))
}

export function updateRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'title', 'executorOrganizationId', 'details'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) return problem(state, 400, 'invalid_organization')
  if (body.title === undefined && body.executorOrganizationId === undefined && body.details === undefined) {
    return problem(state, 400, 'invalid_value')
  }
  const who = principal(state, token)
  if (!who.ok) return who.result
  const active = organizationOf(state, organizationId)
  if (!active) return problem(state, 404, 'not_found')
  const current = requestsOf(state)
  const request = current.find((item) => item.id === requestId)
  if (!request) return problem(state, 404, 'not_found')
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'update'))
  if (denial === 'hidden') return problem(state, 404, 'not_found')
  if (denial === 'forbidden') return problem(state, 403, 'forbidden')
  if (request.status !== 'draft') return problem(state, 409, 'not_draft')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_revision')
  if (request.revision !== expected) return problem(state, 409, 'stale_write')
  const executorId = body.executorOrganizationId === undefined ? request.executorOrganizationId : body.executorOrganizationId
  if (typeof executorId !== 'number' || !Number.isInteger(executorId)) return problem(state, 400, 'unknown_executor')
  const executor = organizationOf(state, executorId)
  const resolved = resolveRequestParties(active, executor)
  if (!resolved.ok) return problem(state, 400, resolved.code)
  if (resolved.parties.customerOrganizationId !== request.customerOrganizationId) {
    return problem(state, 400, 'foreign_party')
  }
  const parsed = body.details === undefined ? undefined : detailsOf(body.details)
  if (parsed && !parsed.ok) return problem(state, 400, parsed.code)
  const titled = titleWithDetails(body.title, parsed?.details, request.title)
  if (!titled.ok) return problem(state, 400, 'invalid_title')
  const next: RequestRecord = {
    ...request,
    executorOrganizationId: resolved.parties.executorOrganizationId,
    title: titled.title,
    ...(parsed ? { details: parsed.details } : {}),
    updatedAt: new Date().toISOString(),
    revision: request.revision + 1,
  }
  const nextState = {
    ...state,
    requests: current.map((item) => item.id === request.id ? next : item),
  }
  return done(nextState, 200, present(nextState, next))
}
