import { describe, expect, it } from 'vitest'
import { organizationRequestTotal } from './count'
import { resolveRequestParties } from './parties'
import { requestStatusGroup, requestStatusLabelKey } from './status'
import { requestMatchesTab, requestRegistryStats, requestTabs } from './registry'
import { canReadRequest, isAuthoredBy, isIncomingSent, requestReadDenial } from './visibility'
import type { RequestRecord } from './types'

const customer = { id: 201, kind: 'customer' as const }
const laboratory = { id: 101, kind: 'laboratory' as const }
const otherLaboratory = { id: 102, kind: 'laboratory' as const }

function request(patch: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: 'req-1',
    number: 'RQ-0001',
    customerOrganizationId: 201,
    executorOrganizationId: 101,
    authorId: 5,
    status: 'sent',
    title: 'Проба',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    revision: 1,
    ...patch,
  }
}

describe('request parties', () => {
  it('lets a customer address a laboratory', () => {
    expect(resolveRequestParties(customer, laboratory)).toEqual({
      ok: true,
      parties: { customerOrganizationId: 201, executorOrganizationId: 101 },
    })
  })

  it('stores a laboratory request to itself as one pair of equal ids', () => {
    const resolved = resolveRequestParties(laboratory, laboratory)
    expect(resolved).toEqual({
      ok: true,
      parties: { customerOrganizationId: 101, executorOrganizationId: 101 },
    })
  })

  it('lets a laboratory choose another laboratory or a customer organization while staying a party', () => {
    expect(resolveRequestParties(laboratory, otherLaboratory)).toEqual({
      ok: true,
      parties: { customerOrganizationId: 101, executorOrganizationId: 102 },
    })
    expect(resolveRequestParties(laboratory, laboratory, customer)).toEqual({
      ok: true,
      parties: { customerOrganizationId: 201, executorOrganizationId: 101 },
    })
  })

  it('refuses a laboratory request that leaves the active organization out or names a non-laboratory', () => {
    expect(resolveRequestParties(laboratory, otherLaboratory, customer)).toEqual({ ok: false, code: 'foreign_party' })
    expect(resolveRequestParties(laboratory, customer).ok).toBe(false)
    expect(resolveRequestParties(laboratory, laboratory, null)).toEqual({ ok: false, code: 'foreign_party' })
  })

  it('refuses a customer request that does not name a laboratory', () => {
    expect(resolveRequestParties(customer, customer)).toEqual({ ok: false, code: 'not_laboratory' })
    expect(resolveRequestParties(customer, null)).toEqual({ ok: false, code: 'unknown_executor' })
  })
})

describe('request visibility', () => {
  it('does not treat the active organization as a grant', () => {
    const filed = request()
    expect(canReadRequest(filed, 201, false)).toBe(false)
    expect(requestReadDenial(filed, 201, false)).toBe('forbidden')
  })

  it('shows a laboratory the draft it filed while acting as executor', () => {
    const draft = request({
      status: 'draft',
      customerOrganizationId: 201,
      executorOrganizationId: 101,
      filedByOrganizationId: 101,
    })
    expect(canReadRequest(draft, 101, true)).toBe(true)
    expect(canReadRequest(draft, 201, true)).toBe(false)
    expect(requestReadDenial(draft, 201, true)).toBe('hidden')
  })

  it('hides a draft from the executor and does not call that draft incoming', () => {
    const draft = request({ status: 'draft' })
    expect(canReadRequest(draft, 201, true)).toBe(true)
    expect(canReadRequest(draft, 101, true)).toBe(false)
    expect(requestReadDenial(draft, 101, true)).toBe('hidden')
    expect(isIncomingSent(draft, 101)).toBe(false)
  })

  it('treats a sent customer request as incoming for the executor only', () => {
    const sent = request({ status: 'sent' })
    expect(isIncomingSent(sent, 101)).toBe(true)
    expect(isIncomingSent(sent, 201)).toBe(false)
    expect(canReadRequest(sent, 101, true)).toBe(true)
  })

  it('shows a sent laboratory request to itself in incoming and keeps the draft out', () => {
    const own = request({
      customerOrganizationId: 101,
      executorOrganizationId: 101,
      authorId: 2,
      status: 'sent',
    })
    const draft = request({ ...own, id: 'req-draft', status: 'draft' })
    const scope = { organizationId: 101, userId: 2 }
    expect(isIncomingSent(draft, 101)).toBe(false)
    expect(isIncomingSent(own, 101)).toBe(true)
    expect(requestMatchesTab(draft, 'incoming', scope)).toBe(false)
    expect(requestMatchesTab(own, 'incoming', scope)).toBe(true)
    expect(requestMatchesTab(draft, 'filed', scope)).toBe(true)
    expect(requestMatchesTab(own, 'filed', scope)).toBe(true)
    expect(canReadRequest(own, 101, true)).toBe(true)
    expect(canReadRequest(draft, 101, false)).toBe(false)
    expect(canReadRequest(own, 201, true)).toBe(false)
  })

  it('filters my requests by author after the read check', () => {
    const filed = request({ authorId: 5 })
    expect(isAuthoredBy(filed, 5)).toBe(true)
    expect(isAuthoredBy(filed, 2)).toBe(false)
  })
})

describe('request status groups', () => {
  it('keeps draft, work in progress and closed work apart', () => {
    expect(requestStatusGroup('draft')).toBe('draft')
    expect(requestStatusGroup('in_progress')).toBe('inProgress')
    expect(requestStatusGroup('in_review')).toBe('inProgress')
    expect(requestStatusGroup('rework')).toBe('inProgress')
    expect(requestStatusGroup('completed')).toBe('closed')
    expect(requestStatusGroup('cancelled')).toBe('closed')
    expect(requestStatusGroup('withdrawn')).toBe('closed')
    expect(requestStatusLabelKey('clarification')).toBe('requests.status.clarification')
    expect(requestStatusLabelKey('in_review')).toBe('requests.status.in_review')
  })
})

describe('request registry', () => {
  it('uses different tabs for a customer and a laboratory', () => {
    expect(requestTabs('customer')).toEqual(['all', 'mine', 'drafts', 'inProgress', 'closed'])
    expect(requestTabs('laboratory')).toEqual(['all', 'incoming', 'filed', 'inProgress', 'closed'])
  })

  it('counts each permitted request once and does not invent an overdue date', () => {
    const own = request({ id: 'own', customerOrganizationId: 101, executorOrganizationId: 101, status: 'sent' })
    const draft = request({ id: 'draft', status: 'draft' })
    expect(requestRegistryStats([own, own, draft])).toEqual({
      total: 2,
      fresh: 1,
      inProgress: 1,
      closed: 0,
      overdue: 0,
    })
  })
})

describe('request counters', () => {
  it('counts the stored collection and ignores the legacy list once that collection exists', () => {
    const stored = [
      request(),
      request({ id: 'req-2', customerOrganizationId: 101, executorOrganizationId: 101 }),
    ]
    const legacy = [{ organizationId: 102 }]
    expect(organizationRequestTotal(stored, legacy, 101)).toBe(2)
    expect(organizationRequestTotal(stored, legacy, 102)).toBe(0)
    expect(organizationRequestTotal(undefined, legacy, 102)).toBe(1)
    expect(organizationRequestTotal([], legacy, 102)).toBe(0)
  })
})
