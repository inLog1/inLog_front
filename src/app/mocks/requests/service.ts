import { effectiveGrants, grantAllows } from '../../../entities/access/model/grants'
import {
  REQUEST_TITLE_MAX,
  canReadRequest,
  canReviseRequest,
  copyProgramSnapshot,
  copyRequestDetails,
  customerProgramIsComplete,
  emptyProgramMeta,
  inspectProgramForApproval,
  inspectProgramStudyLines,
  inspectRequestDraft,
  inspectRequestForSend,
  readProgramMeta,
  readRequestReason,
  requestReadDenial,
  resolveRequestParties,
  withDerivedStudy,
  type RequestDraftDetails,
  type RequestProgramMeta,
  type RequestRecord,
  type RequestStatus,
} from '../../../entities/request'
import {
  basisDto,
  basisFileOf,
  readBasisBytes,
  removeBasisFile,
  replaceBasisFile,
  requestHasBasis,
} from './basis'
import type { MockRequestEvent } from '../db/types'
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

function namedParty(state: MockState, value: unknown): 'absent' | 'invalid' | { id: number; kind: MockOrganization['kind'] } | null {
  if (value === undefined) return 'absent'
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return 'invalid'
  const organization = organizationOf(state, value)
  return organization ? { id: organization.id, kind: organization.kind } : null
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
  const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const listed = (key: string) => !!body && Object.prototype.hasOwnProperty.call(body, key)
  return {
    ok: true,
    details: withDerivedStudy(parsed.details, {
      fields: listed('fields'),
      needs: listed('needs'),
      clarifications: listed('clarifications'),
    }),
  }
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

function basisMeta(state: MockState, request: RequestRecord) {
  const file = request.basisFileId ? basisFileOf(state, request.id) : null
  if (!file || file.id !== request.basisFileId) return null
  return basisDto(file, request.id)
}

function eventsOf(state: MockState, requestId: string) {
  return (state.requestEvents ?? [])
    .filter((item) => item.requestId === requestId)
    .map((item) => ({
      id: item.id,
      requestId: item.requestId,
      type: item.type,
      userId: item.userId,
      authorName: authorName(state, item.userId),
      at: item.at,
      previousStatus: item.previousStatus,
      newStatus: item.newStatus,
      ...(item.comment ? { comment: item.comment } : {}),
      ...(item.previousApproval ? { previousApproval: item.previousApproval } : {}),
      ...(item.nextApproval ? { nextApproval: item.nextApproval } : {}),
    }))
}

/** Labels for a request the caller may already read. Requisites stay off this payload. */
function viewOf(state: MockState, request: RequestRecord) {
  const source = request.sourceRequestId
    ? requestsOf(state).find((item) => item.id === request.sourceRequestId)
    : undefined
  return {
    ...request,
    customerShortName: organizationShortName(state, request.customerOrganizationId),
    executorShortName: organizationShortName(state, request.executorOrganizationId),
    authorName: authorName(state, request.authorId),
    basisDocument: basisMeta(state, request),
    events: eventsOf(state, request.id),
    ...(source ? { sourceRequestNumber: source.number } : {}),
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
  const sameCorporation = state.organizations.filter((item) => item.corporationId === active.corporationId)
  const label = (item: { id: number; shortName: string }) => ({ id: item.id, shortName: item.shortName })
  const byId = (left: { id: number }, right: { id: number }) => left.id - right.id
  const laboratories = sameCorporation.filter((item) => item.kind === 'laboratory').map(label).sort(byId)
  const customers = sameCorporation
    .filter((item) => item.kind === 'customer' || item.id === active.id)
    .filter((item) => active.kind === 'laboratory' || item.id === active.id)
    .map(label)
    .sort(byId)
  return done(state, 200, { laboratories, customers })
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
  const namedCustomer = namedParty(state, body.customerOrganizationId)
  if (namedCustomer === 'invalid') return problem(state, 400, 'foreign_party')
  const resolved = resolveRequestParties(active, executor, namedCustomer === 'absent' ? undefined : namedCustomer)
  if (!resolved.ok) return problem(state, 400, resolved.code)
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
    filedByOrganizationId: active.id,
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
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'title', 'executorOrganizationId', 'customerOrganizationId', 'details'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) return problem(state, 400, 'invalid_organization')
  if (body.title === undefined && body.executorOrganizationId === undefined && body.customerOrganizationId === undefined && body.details === undefined) {
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
  if (!canReviseRequest(request, organizationId)) return problem(state, 409, 'not_draft')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_revision')
  if (request.revision !== expected) return problem(state, 409, 'stale_write')
  const executorId = body.executorOrganizationId === undefined ? request.executorOrganizationId : body.executorOrganizationId
  if (typeof executorId !== 'number' || !Number.isInteger(executorId)) return problem(state, 400, 'unknown_executor')
  const executor = organizationOf(state, executorId)
  const namedCustomer = body.customerOrganizationId === undefined
    ? organizationOf(state, request.customerOrganizationId) ?? null
    : namedParty(state, body.customerOrganizationId)
  if (namedCustomer === 'invalid') return problem(state, 400, 'foreign_party')
  const resolved = resolveRequestParties(active, executor, namedCustomer === 'absent' ? undefined : namedCustomer)
  if (!resolved.ok) return problem(state, 400, resolved.code)
  const parsed = body.details === undefined ? undefined : detailsOf(body.details)
  if (parsed && !parsed.ok) return problem(state, 400, parsed.code)
  const titled = titleWithDetails(body.title, parsed?.details, request.title)
  if (!titled.ok) return problem(state, 400, 'invalid_title')
  const next: RequestRecord = {
    ...request,
    customerOrganizationId: resolved.parties.customerOrganizationId,
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

function patchDraft(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): { ok: true; state: MockState; request: RequestRecord } | { ok: false; result: FlowResult } {
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) {
    return { ok: false, result: problem(state, 400, 'invalid_organization') }
  }
  const who = principal(state, token)
  if (!who.ok) return { ok: false, result: who.result }
  const active = organizationOf(state, organizationId)
  if (!active) return { ok: false, result: problem(state, 404, 'not_found') }
  const current = requestsOf(state)
  const request = current.find((item) => item.id === requestId)
  if (!request) return { ok: false, result: problem(state, 404, 'not_found') }
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'update'))
  if (denial === 'hidden') return { ok: false, result: problem(state, 404, 'not_found') }
  if (denial === 'forbidden') return { ok: false, result: problem(state, 403, 'forbidden') }
  if (!canReviseRequest(request, organizationId)) return { ok: false, result: problem(state, 409, 'not_draft') }
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return { ok: false, result: problem(state, 400, 'invalid_revision') }
  if (request.revision !== expected) return { ok: false, result: problem(state, 409, 'stale_write') }
  const executorId = body.executorOrganizationId === undefined ? request.executorOrganizationId : body.executorOrganizationId
  if (typeof executorId !== 'number' || !Number.isInteger(executorId)) {
    return { ok: false, result: problem(state, 400, 'unknown_executor') }
  }
  const executor = organizationOf(state, executorId)
  const namedCustomer = body.customerOrganizationId === undefined
    ? organizationOf(state, request.customerOrganizationId) ?? null
    : namedParty(state, body.customerOrganizationId)
  if (namedCustomer === 'invalid') return { ok: false, result: problem(state, 400, 'foreign_party') }
  const resolved = resolveRequestParties(active, executor, namedCustomer === 'absent' ? undefined : namedCustomer)
  if (!resolved.ok) return { ok: false, result: problem(state, 400, resolved.code) }
  const parsed = body.details === undefined ? undefined : detailsOf(body.details)
  if (parsed && !parsed.ok) return { ok: false, result: problem(state, 400, parsed.code) }
  const titled = titleWithDetails(body.title, parsed?.details, request.title)
  if (!titled.ok) return { ok: false, result: problem(state, 400, 'invalid_title') }
  const next: RequestRecord = {
    ...request,
    customerOrganizationId: resolved.parties.customerOrganizationId,
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
  return { ok: true, state: nextState, request: next }
}

export function uploadRequestBasis(
  state: MockState,
  token: string | null,
  requestId: string,
  organizationId: number,
  file: { filename: string; mimeType: string; bytes: Uint8Array },
): FlowResult {
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
  if (!canReviseRequest(request, organizationId)) return problem(state, 409, 'not_draft')
  const replaced = replaceBasisFile(state, requestId, file)
  if (!replaced.ok) return problem(state, replaced.code === 'payload_too_large' ? 413 : 400, replaced.code)
  const nextRequest: RequestRecord = { ...request, basisFileId: replaced.stored.id, updatedAt: new Date().toISOString(), revision: request.revision + 1 }
  const nextState = {
    ...replaced.state,
    requests: current.map((item) => item.id === request.id ? nextRequest : item),
  }
  return done(nextState, 200, present(nextState, nextRequest))
}

export function deleteRequestBasis(
  state: MockState,
  token: string | null,
  requestId: string,
  organizationId: number,
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  if (!organizationOf(state, organizationId)) return problem(state, 404, 'not_found')
  const current = requestsOf(state)
  const request = current.find((item) => item.id === requestId)
  if (!request) return problem(state, 404, 'not_found')
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'update'))
  if (denial === 'hidden') return problem(state, 404, 'not_found')
  if (denial === 'forbidden') return problem(state, 403, 'forbidden')
  if (!canReviseRequest(request, organizationId)) return problem(state, 409, 'not_draft')
  if (!request.basisFileId) return problem(state, 404, 'not_found')
  const stripped = removeBasisFile(state, requestId)
  const nextRequest: RequestRecord = {
    ...request,
    basisFileId: undefined,
    updatedAt: new Date().toISOString(),
    revision: request.revision + 1,
  }
  const nextState = {
    ...stripped,
    requests: current.map((item) => item.id === request.id ? nextRequest : item),
  }
  return done(nextState, 200, present(nextState, nextRequest))
}

export function readRequestBasisContent(
  state: MockState,
  token: string | null,
  requestId: string,
  fileId: string,
  organizationId: number,
): FlowResult & { bytes?: Uint8Array; mimeType?: string } {
  const who = principal(state, token)
  if (!who.ok) return who.result
  if (!organizationOf(state, organizationId)) return problem(state, 404, 'not_found')
  const request = requestsOf(state).find((item) => item.id === requestId)
  if (!request) return problem(state, 404, 'not_found')
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'read'))
  if (denial === 'hidden') return problem(state, 404, 'not_found')
  if (denial === 'forbidden') return problem(state, 403, 'forbidden')
  if (request.basisFileId !== fileId) return problem(state, 404, 'not_found')
  const file = readBasisBytes(state, requestId, fileId)
  if (!file.ok) return file.result
  return { state, status: 200, body: null, bytes: file.file.bytes, mimeType: file.file.mimeType }
}

function appendEvent(state: MockState, event: MockRequestEvent): MockState {
  const events = state.requestEvents ?? []
  return { ...state, requestEvents: [...events, event] }
}

export function sendRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'title', 'executorOrganizationId', 'customerOrganizationId', 'details'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) {
    return problem(state, 400, 'invalid_organization')
  }
  const who = principal(state, token)
  if (!who.ok) return who.result
  if (!organizationOf(state, organizationId)) return problem(state, 404, 'not_found')
  if (!allows(state, who.user.id, organizationId, 'send')) return problem(state, 403, 'forbidden')
  const before = requestsOf(state).find((item) => item.id === requestId)
  if (!before) return problem(state, 404, 'not_found')
  const readCheck = requestReadDenial(before, organizationId, allows(state, who.user.id, organizationId, 'update'))
  if (readCheck === 'hidden') return problem(state, 404, 'not_found')
  if (readCheck === 'forbidden') return problem(state, 403, 'forbidden')
  if (before.status === 'rework') return resendRequest(state, token, who.user.id, requestId, body)
  if (before.status !== 'draft') return problem(state, 409, 'already_sent')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_revision')
  if (before.revision !== expected) return problem(state, 409, 'stale_write')
  let request = before
  let working = state
  if (body.details !== undefined || body.title !== undefined || body.executorOrganizationId !== undefined || body.customerOrganizationId !== undefined) {
    const patched = patchDraft(state, token, requestId, body)
    if (!patched.ok) return patched.result
    working = patched.state
    request = patched.request
  }
  return finishSend(working, request, who.user.id, 'draft', 'sent')
}

function resendRequest(
  state: MockState,
  token: string | null,
  userId: number,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number') return problem(state, 400, 'invalid_organization')
  const before = requestsOf(state).find((item) => item.id === requestId)
  if (!before || before.status !== 'rework') return problem(state, 409, 'invalid_status')
  if (before.customerOrganizationId !== organizationId) return problem(state, 403, 'not_customer')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_revision')
  if (before.revision !== expected) return problem(state, 409, 'stale_write')
  let request = before
  let working = state
  if (body.details !== undefined || body.title !== undefined || body.executorOrganizationId !== undefined || body.customerOrganizationId !== undefined) {
    const patched = patchDraft(state, token, requestId, body)
    if (!patched.ok) return patched.result
    working = patched.state
    request = patched.request
  }
  return finishSend(working, request, userId, 'rework', 'resent')
}

function finishSend(
  working: MockState,
  request: RequestRecord,
  userId: number,
  previousStatus: RequestStatus,
  type: 'sent' | 'resent',
): FlowResult {
  if (!request.details) return problem(working, 400, 'invalid_draft')
  const ready = inspectRequestForSend({
    customerOrganizationId: request.customerOrganizationId,
    executorOrganizationId: request.executorOrganizationId,
    details: request.details,
    hasBasisDocument: requestHasBasis(working, request),
  })
  if (!ready.ok) return problem(working, 400, 'not_ready')
  const now = new Date().toISOString()
  const sent: RequestRecord = {
    ...request,
    status: 'sent',
    sentAt: now,
    sentByUserId: userId,
    updatedAt: now,
    revision: request.revision + 1,
  }
  delete sent.reviewStartedAt
  delete sent.reviewStartedByUserId
  const event: MockRequestEvent = {
    id: `rev-${crypto.randomUUID()}`,
    requestId: request.id,
    type,
    userId,
    at: now,
    previousStatus,
    newStatus: 'sent',
  }
  working = appendEvent(working, event)
  working = {
    ...working,
    requests: requestsOf(working).map((item) => item.id === request.id ? sent : item),
  }
  return done(working, 200, present(working, sent))
}

type DecisionGate = {
  userId: number
  organizationId: number
  request: RequestRecord
}

function openDecision(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
  keys: readonly string[],
  action: string,
): { ok: true; gate: DecisionGate } | { ok: false; result: FlowResult } {
  if (!allowedKeys(body, keys)) return { ok: false, result: problem(state, 400, 'unknown_key') }
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) {
    return { ok: false, result: problem(state, 400, 'invalid_organization') }
  }
  const who = principal(state, token)
  if (!who.ok) return { ok: false, result: who.result }
  if (!organizationOf(state, organizationId)) return { ok: false, result: problem(state, 404, 'not_found') }
  const request = requestsOf(state).find((item) => item.id === requestId)
  if (!request) return { ok: false, result: problem(state, 404, 'not_found') }
  const denial = requestReadDenial(request, organizationId, allows(state, who.user.id, organizationId, 'read'))
  if (denial === 'hidden') return { ok: false, result: problem(state, 404, 'not_found') }
  if (denial === 'forbidden') return { ok: false, result: problem(state, 403, 'forbidden') }
  if (!allows(state, who.user.id, organizationId, action)) {
    return { ok: false, result: problem(state, 403, 'forbidden') }
  }
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return { ok: false, result: problem(state, 400, 'invalid_revision') }
  if (request.revision !== expected) return { ok: false, result: problem(state, 409, 'stale_write') }
  return { ok: true, gate: { userId: who.user.id, organizationId, request } }
}

function applyDecision(
  state: MockState,
  request: RequestRecord,
  type: MockRequestEvent['type'],
  userId: number,
  comment?: string,
): MockState {
  const event: MockRequestEvent = {
    id: `rev-${crypto.randomUUID()}`,
    requestId: request.id,
    type,
    userId,
    at: request.updatedAt,
    previousStatus: eventPrevious(state, request.id),
    newStatus: request.status,
    ...(comment ? { comment } : {}),
  }
  const withEvent = appendEvent(state, event)
  return {
    ...withEvent,
    requests: requestsOf(withEvent).map((item) => item.id === request.id ? request : item),
  }
}

function eventPrevious(state: MockState, requestId: string): string {
  return requestsOf(state).find((item) => item.id === requestId)?.status ?? ''
}

export function startRequestReview(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision'], 'accept')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_executor')
  if (request.status !== 'sent') return problem(state, 409, 'invalid_status')
  const now = new Date().toISOString()
  const next: RequestRecord = {
    ...request,
    status: 'in_review',
    reviewStartedAt: now,
    reviewStartedByUserId: userId,
    updatedAt: now,
    revision: request.revision + 1,
  }
  const saved = applyDecision(state, next, 'review_started', userId)
  return done(saved, 200, present(saved, next))
}

export function returnRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision', 'reason'], 'accept')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_executor')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const reason = readRequestReason(body.reason)
  if (!reason.ok) return problem(state, 400, reason.code)
  const now = new Date().toISOString()
  const next: RequestRecord = {
    ...request,
    status: 'rework',
    returnReason: reason.reason,
    returnedAt: now,
    returnedByUserId: userId,
    updatedAt: now,
    revision: request.revision + 1,
    ...(request.details ? { details: { ...request.details, programMeta: emptyProgramMeta() } } : {}),
  }
  const saved = applyDecision(state, next, 'returned', userId, reason.reason)
  return done(saved, 200, present(saved, next))
}

export function rejectRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision', 'reason'], 'reject')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_executor')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const reason = readRequestReason(body.reason)
  if (!reason.ok) return problem(state, 400, reason.code)
  const now = new Date().toISOString()
  const next: RequestRecord = {
    ...request,
    status: 'rejected',
    rejectionReason: reason.reason,
    rejectedAt: now,
    rejectedByUserId: userId,
    updatedAt: now,
    revision: request.revision + 1,
  }
  const saved = applyDecision(state, next, 'rejected', userId, reason.reason)
  return done(saved, 200, present(saved, next))
}

export function withdrawRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision'], 'cancel')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (request.customerOrganizationId !== organizationId) return problem(state, 403, 'not_customer')
  if (request.status !== 'sent') return problem(state, 409, 'invalid_status')
  const now = new Date().toISOString()
  const next: RequestRecord = {
    ...request,
    status: 'withdrawn',
    withdrawnAt: now,
    withdrawnByUserId: userId,
    updatedAt: now,
    revision: request.revision + 1,
  }
  const saved = applyDecision(state, next, 'withdrawn', userId)
  return done(saved, 200, present(saved, next))
}

export function deriveRequest(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision'], 'create')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (request.status !== 'rejected' && request.status !== 'withdrawn') {
    return problem(state, 409, 'not_derivable')
  }
  const party = request.customerOrganizationId === organizationId || request.executorOrganizationId === organizationId
  if (!party) return problem(state, 404, 'not_found')
  const now = new Date().toISOString()
  const copyId = `req-${crypto.randomUUID()}`
  const details = request.details
    ? copyRequestDetails(request.details, (prefix) => `${prefix}-${crypto.randomUUID()}`)
    : undefined
  const copy: RequestRecord = {
    id: copyId,
    number: nextNumber([...requestsOf(state), request]),
    customerOrganizationId: request.customerOrganizationId,
    executorOrganizationId: request.executorOrganizationId,
    filedByOrganizationId: organizationId,
    authorId: userId,
    status: 'draft',
    title: request.title,
    ...(details ? { details } : {}),
    sourceRequestId: request.id,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  }
  const marked: RequestRecord = { ...request, updatedAt: now, revision: request.revision + 1 }
  let saved = applyDecision(state, marked, 'derived', userId, copy.number)
  const child: MockRequestEvent = {
    id: `rev-${crypto.randomUUID()}`,
    requestId: copy.id,
    type: 'derived',
    userId,
    at: now,
    previousStatus: request.status,
    newStatus: 'draft',
    comment: request.number,
  }
  saved = appendEvent(saved, child)
  saved = { ...saved, requests: [...requestsOf(saved), copy] }
  return done(saved, 201, present(saved, copy))
}

function programCatalog() {
  const ids = requestDraftCatalogIds()
  return { workKinds: ids.workKinds, sampleKinds: ids.sampleKinds, units: ids.units }
}

function metaOf(request: RequestRecord): RequestProgramMeta {
  return readProgramMeta(request.details?.programMeta)
}

function ownRequest(request: RequestRecord): boolean {
  return request.customerOrganizationId === request.executorOrganizationId
}

/** The customer already chose every research and the laboratory has not replaced the programme. */
function customerDefinedProgram(request: RequestRecord): boolean {
  const meta = metaOf(request)
  return customerProgramIsComplete(request.details?.needs ?? []) && meta.lines.length === 0 && meta.preparedBy !== 'laboratory'
}

function readProgramNote(value: unknown, fallback: string): { ok: true; note: string } | { ok: false; code: 'invalid_text' } {
  if (value === undefined) return { ok: true, note: fallback }
  if (typeof value !== 'string') return { ok: false, code: 'invalid_text' }
  const note = value.trim()
  if (note.length > 1000) return { ok: false, code: 'invalid_text' }
  return { ok: true, note }
}

function commitProgram(
  state: MockState,
  request: RequestRecord,
  meta: RequestProgramMeta,
  userId: number,
  type: MockRequestEvent['type'],
  previousApproval: string,
  status: RequestStatus,
  comment?: string,
): FlowResult {
  if (!request.details) return problem(state, 400, 'invalid_draft')
  const now = new Date().toISOString()
  const next: RequestRecord = {
    ...request,
    status,
    details: { ...request.details, programMeta: meta },
    updatedAt: now,
    revision: request.revision + 1,
  }
  const event: MockRequestEvent = {
    id: `rev-${crypto.randomUUID()}`,
    requestId: request.id,
    type,
    userId,
    at: now,
    previousStatus: request.status,
    newStatus: status,
    previousApproval,
    nextApproval: meta.approval,
    ...(comment ? { comment } : {}),
  }
  let saved = appendEvent(state, event)
  if (type === 'program_approved') {
    saved = appendEvent(saved, {
      id: `rev-${crypto.randomUUID()}`,
      requestId: request.id,
      type: 'request_approved',
      userId,
      at: now,
      previousStatus: request.status,
      newStatus: status,
    })
  }
  saved = {
    ...saved,
    requests: requestsOf(saved).map((item) => item.id === request.id ? next : item),
  }
  return done(saved, 200, present(saved, next))
}

export function saveRequestProgram(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision', 'lines', 'note'], 'manage_program')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (!request.details) return problem(state, 400, 'invalid_draft')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const meta = metaOf(request)
  if (meta.approval === 'approved') return problem(state, 409, 'invalid_status')
  const own = ownRequest(request)
  const executor = request.executorOrganizationId === organizationId
  const customer = request.customerOrganizationId === organizationId
  let mode: 'laboratory' | 'customer'
  if (executor) {
    if (!own && meta.approval === 'pending_customer') return problem(state, 409, 'invalid_status')
    if (!own && customerDefinedProgram(request)) return problem(state, 409, 'customer_program')
    mode = 'laboratory'
  } else if (customer && meta.approval === 'pending_customer') {
    mode = 'customer'
  } else {
    return problem(state, 403, 'not_executor')
  }
  const parsed = inspectProgramStudyLines(body.lines, programCatalog())
  if (!parsed.ok) return problem(state, 400, 'program_invalid')
  const note = readProgramNote(body.note, meta.note)
  if (!note.ok) return problem(state, 400, note.code)
  const now = new Date().toISOString()
  const nextMeta: RequestProgramMeta = mode === 'customer'
    ? { ...meta, authorUserId: userId, lines: parsed.lines, note: note.note }
    : {
      ...meta,
      authorUserId: userId,
      preparedBy: 'laboratory',
      approval: 'draft',
      lines: parsed.lines,
      note: note.note,
      preparedAt: meta.preparedAt ?? now,
    }
  const type = mode === 'laboratory' && meta.approval === 'unspecified' ? 'program_started' : 'program_changed'
  return commitProgram(state, request, nextMeta, userId, type, meta.approval, request.status)
}

export function submitRequestProgram(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision'], 'manage_program')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (!request.details) return problem(state, 400, 'invalid_draft')
  if (ownRequest(request)) return problem(state, 409, 'own_request')
  if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_executor')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const meta = metaOf(request)
  if (meta.approval !== 'draft' && meta.approval !== 'returned') return problem(state, 409, 'invalid_status')
  if (customerDefinedProgram(request)) return problem(state, 409, 'customer_program')
  const ready = inspectProgramForApproval({
    fields: request.details.fields,
    needs: request.details.needs,
    meta,
    catalog: programCatalog(),
  })
  if (!ready.ok) return problem(state, 400, 'program_invalid')
  const now = new Date().toISOString()
  const nextMeta: RequestProgramMeta = {
    ...meta,
    preparedBy: 'laboratory',
    authorUserId: meta.authorUserId ?? userId,
    approval: 'pending_customer',
    note: ready.note,
    version: meta.version + 1,
    submittedAt: now,
    returnReason: '',
  }
  return commitProgram(state, request, nextMeta, userId, 'program_submitted', meta.approval, request.status)
}

export function approveRequestProgram(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision'], 'approve_program')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (!request.details) return problem(state, 400, 'invalid_draft')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const meta = metaOf(request)
  if (meta.approval === 'approved') return problem(state, 409, 'invalid_status')
  const own = ownRequest(request)
  const defined = customerDefinedProgram(request)
  if (own) {
    if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_executor')
  } else if (defined) {
    if (request.executorOrganizationId !== organizationId) return problem(state, 403, 'not_approver')
  } else if (request.customerOrganizationId !== organizationId || meta.approval !== 'pending_customer') {
    if (request.customerOrganizationId !== organizationId) return problem(state, 403, 'not_approver')
    return problem(state, 409, 'invalid_status')
  }
  const ready = inspectProgramForApproval({
    fields: request.details.fields,
    needs: request.details.needs,
    meta,
    catalog: programCatalog(),
  })
  if (!ready.ok) return problem(state, 400, 'program_invalid')
  const now = new Date().toISOString()
  const preparedBy = meta.preparedBy === 'laboratory' ? 'laboratory' : 'customer'
  const authorUserId = meta.authorUserId ?? (preparedBy === 'customer' ? request.authorId : userId)
  const version = meta.version > 0 ? meta.version : 1
  const approved: RequestProgramMeta = {
    ...meta,
    preparedBy,
    authorUserId,
    approval: 'approved',
    note: ready.note,
    version,
    approvedAt: now,
    approvedByUserId: userId,
    returnReason: '',
    approvedSnapshot: null,
  }
  const snapshot = copyProgramSnapshot(approved, ready.lines, userId, now)
  if (!snapshot) return problem(state, 400, 'program_invalid')
  return commitProgram(state, request, { ...approved, approvedSnapshot: snapshot }, userId, 'program_approved', meta.approval, 'approved')
}

export function returnRequestProgram(
  state: MockState,
  token: string | null,
  requestId: string,
  body: Record<string, unknown>,
): FlowResult {
  const opened = openDecision(state, token, requestId, body, ['organizationId', 'expectedRevision', 'reason'], 'approve_program')
  if (!opened.ok) return opened.result
  const { request, organizationId, userId } = opened.gate
  if (!request.details) return problem(state, 400, 'invalid_draft')
  if (ownRequest(request)) return problem(state, 409, 'own_request')
  if (request.customerOrganizationId !== organizationId) return problem(state, 403, 'not_customer')
  if (request.status !== 'in_review') return problem(state, 409, 'invalid_status')
  const meta = metaOf(request)
  if (meta.approval !== 'pending_customer') return problem(state, 409, 'invalid_status')
  const reason = readRequestReason(body.reason)
  if (!reason.ok) return problem(state, 400, reason.code)
  const nextMeta: RequestProgramMeta = {
    ...meta,
    approval: 'returned',
    returnReason: reason.reason,
  }
  return commitProgram(state, request, nextMeta, userId, 'program_returned', meta.approval, request.status, reason.reason)
}
