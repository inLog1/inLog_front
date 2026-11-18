import { describe, expect, it } from 'vitest'
import { emptyRequestDraft, type RequestDraftDetails } from '../../../entities/request'
import type { RegisterSampleInput, Sample } from '../../../entities/sample'
import {
  changeSampleStatus,
  deleteSampleRecord,
  registerSample,
  registerSubsample,
} from '../samples/service'
import { loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import {
  approveRequestProgram,
  createRequest,
  deriveRequest,
  readRequest,
  readRequestLinkedSamples,
  rejectRequest,
  saveRequestProgram,
  sendRequest,
  startRequestReview,
  submitRequestProgram,
  updateRequest,
  uploadRequestBasis,
} from './service'

function session(email: string, state: MockState = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function requestOf(result: { body: unknown }) {
  return (result.body as {
    request: {
      id: string
      status: string
      revision: number
      details?: RequestDraftDetails
    }
  }).request
}

function linkedOf(result: { body: unknown }) {
  return (result.body as {
    samples?: Array<{ id: string; code: string; stage: string; deleted: boolean }>
  }).samples
}

function sampleOf(result: { body: unknown }) {
  return (result.body as { sample: Sample }).sample
}

function root(overrides: Partial<RegisterSampleInput> = {}): RegisterSampleInput {
  return {
    organizationId: 201,
    sampleType: 'Керн',
    field: 'Северное',
    well: '12',
    formation: 'П1',
    interval: '1138–1150',
    collectedAt: '2026-09-12',
    receivedAt: '2026-11-17',
    location: 'Склад',
    externalCode: 'К-15',
    inspection: 'Соответствует',
    ...overrides,
  }
}

function details(sampleIds?: string[]): RequestDraftDetails {
  const draft = emptyRequestDraft()
  draft.projectName = 'Связанные пробы'
  draft.sampleIds = ['sample-k104']
  draft.fields = [{
    id: 'field-1',
    catalogFieldId: 'field-north',
    fieldName: '',
    wells: [{ id: 'well-1', catalogWellId: 'well-12', wellName: '', intervals: [] }],
  }]
  draft.needs = [{
    id: 'need-1',
    targets: [{ wellId: 'well-1', selection: 'well', intervalIds: [] }],
    researchId: '',
    desiredResult: 'Определить пористость',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
    ...(sampleIds ? { sampleIds } : {}),
  }]
  return draft
}

function withNeedSamples(body: RequestDraftDetails, sampleIds: string[], comment = body.comment): RequestDraftDetails {
  return {
    ...body,
    comment,
    needs: body.needs.map((need, index) => index === 0 ? { ...need, sampleIds } : need),
  }
}

function line(sampleIds: string[] | undefined, id = 'pg-need-1', needId = 'need-1') {
  return {
    id,
    needId,
    targets: [{ wellId: 'well-1', selection: 'well' as const, intervalIds: [] as string[] }],
    researchId: 'work-porosity',
    sampleTypeId: '',
    quantity: null as number | null,
    unitId: '',
    note: 'Методика уточнена',
    ...(sampleIds ? { sampleIds } : {}),
  }
}

function expectDenied(result: { status: number; body: unknown; state: MockState }, state: MockState) {
  expect(result.status).toBe(400)
  expect(result.body).toEqual({ code: 'sample_link_denied' })
  expect(result.state).toBe(state)
}

function expectHidden(result: { status: number; body: unknown; state: MockState }, state: MockState, secrets: readonly string[]) {
  expect(result.status).toBe(404)
  expect(result.body).toEqual({ code: 'not_found' })
  expect(result.state).toBe(state)
  const text = JSON.stringify(result.body)
  for (const secret of secrets) expect(text).not.toContain(secret)
}

function filed() {
  const customer = session('customer@example.test')
  const createdSample = registerSample(customer.state, customer.token, root())
  const sample = sampleOf(createdSample)
  const other = registerSample(createdSample.state, customer.token, root({
    field: 'Южное',
    well: '18',
    externalCode: 'НЕ-В-ЗАЯВКЕ',
  }))
  const child = registerSubsample(other.state, customer.token, {
    organizationId: 201,
    parentId: sample.id,
    receivedAt: '2026-11-17',
    location: 'Стол',
    externalCode: 'К-15-1',
  })
  const body = details([sample.id, sampleOf(child).id])
  const created = createRequest(child.state, customer.token, {
    organizationId: 201,
    executorOrganizationId: 101,
    details: body,
  })
  return {
    state: created.state,
    id: requestOf(created).id,
    revision: requestOf(created).revision,
    sample,
    other: sampleOf(other),
    child: sampleOf(child),
    customerToken: customer.token,
    body,
  }
}

function pdf() {
  return { filename: 'basis.pdf', mimeType: 'application/pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }
}

function inReview() {
  const draft = filed()
  const attached = uploadRequestBasis(draft.state, draft.customerToken, draft.id, 201, pdf())
  const sent = sendRequest(attached.state, draft.customerToken, draft.id, {
    organizationId: 201,
    expectedRevision: requestOf(attached).revision,
  })
  const laboratory = session('admin.a@example.test', sent.state)
  const started = startRequestReview(laboratory.state, laboratory.token, draft.id, {
    organizationId: 101,
    expectedRevision: requestOf(sent).revision,
  })
  const own = registerSample(started.state, laboratory.token, root({
    organizationId: 101,
    externalCode: 'Л-1',
    field: 'Лабораторное',
    well: '1',
  }))
  return {
    ...draft,
    state: own.state,
    revision: requestOf(started).revision,
    laboratoryToken: laboratory.token,
    laboratorySample: sampleOf(own),
  }
}

function withoutRegistryRead(state: MockState): MockState {
  return {
    ...state,
    roles: state.roles.map((role) => role.id === 'role-customer'
      ? { ...role, grantIds: role.grantIds.filter((id) => id !== 'g-requests-read') }
      : role),
  }
}

function storedRequest(state: MockState, requestId: string) {
  const request = state.requests?.find((item) => item.id === requestId)
  if (!request) throw new Error(`missing ${requestId}`)
  return request
}

function rewriteDetails(
  state: MockState,
  requestId: string,
  rewrite: (details: RequestDraftDetails) => RequestDraftDetails,
): MockState {
  return {
    ...state,
    requests: state.requests?.map((item) => item.id === requestId && item.details
      ? { ...item, details: rewrite(item.details) }
      : item),
  }
}

function rejectedRequest() {
  const draft = filed()
  const attached = uploadRequestBasis(draft.state, draft.customerToken, draft.id, 201, pdf())
  const sent = sendRequest(attached.state, draft.customerToken, draft.id, {
    organizationId: 201,
    expectedRevision: requestOf(attached).revision,
  })
  const laboratory = session('admin.a@example.test', sent.state)
  const started = startRequestReview(laboratory.state, laboratory.token, draft.id, {
    organizationId: 101,
    expectedRevision: requestOf(sent).revision,
  })
  const rejected = rejectRequest(started.state, laboratory.token, draft.id, {
    organizationId: 101,
    expectedRevision: requestOf(started).revision,
    reason: 'Объект вне области',
  })
  return {
    ...draft,
    state: rejected.state,
    revision: requestOf(rejected).revision,
    laboratoryToken: laboratory.token,
  }
}

function approvedSnapshot(sampleIds: string[]) {
  return {
    version: 1,
    preparedBy: 'laboratory' as const,
    authorUserId: 2,
    approvedByUserId: 5,
    approvedAt: '2026-11-17T00:00:00.000Z',
    note: 'снимок',
    lines: [line(sampleIds, 'pg-snapshot', 'need-1')],
  }
}

describe('sample links on request writes', () => {
  it('lets the customer add a sample from their own registry and keeps the legacy catalogue id', () => {
    const draft = filed()
    expect(draft.revision).toBe(1)
    const stored = draft.state.requests?.find((item) => item.id === draft.id)
    expect(stored?.details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    expect(stored?.details?.sampleIds).toEqual(['sample-k104'])
    const added = updateRequest(draft.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      details: withNeedSamples(draft.body, [draft.sample.id, draft.other.id, draft.child.id]),
    })
    expect(added.status).toBe(200)
    expect(requestOf(added).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.other.id, draft.child.id])
    const catalogOnNeed = createRequest(added.state, draft.customerToken, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: details(['sample-k104']),
    })
    expectDenied(catalogOnNeed, added.state)
  })

  it('shows the laboratory the linked sample and lets it move that sample into the programme', () => {
    const draft = inReview()
    const seen = readRequestLinkedSamples(draft.state, draft.laboratoryToken, 101, draft.id)
    expect(seen.status).toBe(200)
    expect((seen.body as { samples: Array<{ id: string }> }).samples.map((item) => item.id)).toEqual([
      draft.sample.id,
      draft.child.id,
    ])
    const saved = saveRequestProgram(draft.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.child.id, draft.sample.id])],
      note: 'Перенос из потребности',
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    expect(requestOf(saved).details?.programMeta.lines[0]?.sampleIds).toEqual([draft.child.id, draft.sample.id])
    expect(requestOf(saved).details?.programMeta.approvedSnapshot).toBeNull()
  })

  it('lets the laboratory add its own sample and save the same programme again', () => {
    const draft = inReview()
    const saved = saveRequestProgram(draft.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.laboratorySample.id])],
      note: 'Своя проба',
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).details?.programMeta.lines[0]?.sampleIds).toEqual([
      draft.sample.id,
      draft.laboratorySample.id,
    ])
    const again = saveRequestProgram(saved.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
      lines: [line([draft.sample.id, draft.laboratorySample.id])],
      note: 'Своя проба',
    })
    expect(again.status).toBe(200)
    expect(requestOf(again).details?.programMeta.lines[0]?.sampleIds).toEqual([
      draft.sample.id,
      draft.laboratorySample.id,
    ])
    expect(requestOf(again).revision).toBe(requestOf(saved).revision + 1)
  })

  it('rejects a foreign, unlinked, missing or third-organization id with the same error', () => {
    const draft = inReview()
    const owner = session('owner@example.test', draft.state)
    const outsider = registerSample(owner.state, owner.token, root({
      organizationId: 102,
      field: 'Чужое',
      externalCode: 'ОРГ-C',
    }))
    const foreign = sampleOf(outsider)
    const missing = crypto.randomUUID()
    const attempts = [
      [missing],
      [draft.other.id],
      [foreign.id],
      [draft.sample.id, missing],
    ]
    const bodies = attempts.map((sampleIds) => {
      const denied = saveRequestProgram(outsider.state, draft.laboratoryToken, draft.id, {
        organizationId: 101,
        expectedRevision: draft.revision,
        lines: [line(sampleIds)],
        note: 'Подмена',
      })
      expectDenied(denied, outsider.state)
      const text = JSON.stringify(denied.body)
      expect(text).not.toContain(foreign.id)
      expect(text).not.toContain(foreign.code)
      expect(text).not.toContain('ОРГ-C')
      expect(text).not.toContain(draft.other.id)
      expect(text).not.toContain(draft.other.code)
      expect(text).not.toContain('НЕ-В-ЗАЯВКЕ')
      expect(text).not.toContain(missing)
      return denied.body
    })
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1)
    expect(outsider.state.requests?.find((item) => item.id === draft.id)?.details?.programMeta.lines).toEqual([])
    expect(outsider.state.requests?.find((item) => item.id === draft.id)?.revision).toBe(draft.revision)
  })

  it('does not let the laboratory create a request that links a customer sample it does not already hold', () => {
    const draft = filed()
    const laboratory = session('admin.a@example.test', draft.state)
    const denied = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      customerOrganizationId: 201,
      executorOrganizationId: 101,
      details: details([draft.sample.id]),
    })
    expectDenied(denied, laboratory.state)
    const own = registerSample(laboratory.state, laboratory.token, root({
      organizationId: 101,
      externalCode: 'Л-2',
    }))
    const created = createRequest(own.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      details: details([sampleOf(own).id]),
    })
    expect(created.status).toBe(201)
    expect(requestOf(created).details?.needs[0]?.sampleIds).toEqual([sampleOf(own).id])
  })

  it('keeps a disposed or deleted sample that is already linked and refuses to add another', () => {
    const draft = filed()
    const disposed = changeSampleStatus(draft.state, draft.customerToken, {
      organizationId: 201,
      sampleId: draft.sample.id,
      stage: 'Утилизирована',
    })
    expect(disposed.status).toBe(200)
    const kept = updateRequest(disposed.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      details: withNeedSamples(draft.body, [draft.sample.id, draft.child.id], 'После утилизации'),
    })
    expect(kept.status).toBe(200)
    expect(requestOf(kept).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])

    const removed = deleteSampleRecord(kept.state, draft.customerToken, 201, draft.child.id)
    expect(removed.status).toBe(200)
    const still = updateRequest(removed.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(kept).revision,
      details: withNeedSamples(draft.body, [draft.sample.id, draft.child.id], 'После удаления'),
    })
    expect(still.status).toBe(200)
    expect(requestOf(still).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])

    const extraDisposed = registerSample(still.state, draft.customerToken, root({ externalCode: 'УТ-2', well: '19' }))
    const extraDisposedId = sampleOf(extraDisposed).id
    const marked = changeSampleStatus(extraDisposed.state, draft.customerToken, {
      organizationId: 201,
      sampleId: extraDisposedId,
      stage: 'Утилизирована',
    })
    const addDisposed = updateRequest(marked.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(still).revision,
      details: withNeedSamples(draft.body, [draft.sample.id, draft.child.id, extraDisposedId]),
    })
    expectDenied(addDisposed, marked.state)

    const extraDeleted = registerSample(marked.state, draft.customerToken, root({ externalCode: 'УД-2', well: '20' }))
    const extraDeletedId = sampleOf(extraDeleted).id
    const deleted = deleteSampleRecord(extraDeleted.state, draft.customerToken, 201, extraDeletedId)
    const addDeleted = updateRequest(deleted.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(still).revision,
      details: withNeedSamples(draft.body, [draft.sample.id, extraDeletedId]),
    })
    expectDenied(addDeleted, deleted.state)
    expect(addDeleted.state.requests?.find((item) => item.id === draft.id)?.details?.needs[0]?.sampleIds).toEqual([
      draft.sample.id,
      draft.child.id,
    ])
  })

  it('refuses a new disposed or deleted sample and does not add it back after it left the request', () => {
    const customer = session('customer@example.test')
    const createdSample = registerSample(customer.state, customer.token, root({ externalCode: 'НОВАЯ' }))
    const sample = sampleOf(createdSample)
    const disposed = changeSampleStatus(createdSample.state, customer.token, {
      organizationId: 201,
      sampleId: sample.id,
      stage: 'Утилизирована',
    })
    const denied = createRequest(disposed.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: details([sample.id]),
    })
    expectDenied(denied, disposed.state)

    const live = registerSample(disposed.state, customer.token, root({ externalCode: 'ЖИВАЯ', well: '21' }))
    const liveSample = sampleOf(live)
    const created = createRequest(live.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: details([liveSample.id]),
    })
    expect(created.status).toBe(201)
    const cleared = updateRequest(created.state, customer.token, requestOf(created).id, {
      organizationId: 201,
      expectedRevision: 1,
      details: withNeedSamples(details([liveSample.id]), []),
    })
    expect(cleared.status).toBe(200)
    expect(requestOf(cleared).details?.needs[0]?.sampleIds).toEqual([])
    const gone = deleteSampleRecord(cleared.state, customer.token, 201, liveSample.id)
    const restored = updateRequest(gone.state, customer.token, requestOf(created).id, {
      organizationId: 201,
      expectedRevision: requestOf(cleared).revision,
      details: details([liveSample.id]),
    })
    expectDenied(restored, gone.state)
    expect(restored.state.requests?.find((item) => item.id === requestOf(created).id)?.revision).toBe(requestOf(cleared).revision)
  })

  it('keeps a stored id after the registry row itself is gone and rejects an unknown id', () => {
    const draft = filed()
    const stripped: MockState = {
      ...draft.state,
      samples: (draft.state.samples ?? []).filter((item) => item.id !== draft.sample.id),
    }
    const kept = updateRequest(stripped, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      details: withNeedSamples(draft.body, [draft.sample.id, draft.child.id], 'Строка исчезла'),
    })
    expect(kept.status).toBe(200)
    expect(requestOf(kept).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    const missing = crypto.randomUUID()
    const denied = updateRequest(kept.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(kept).revision,
      details: withNeedSamples(draft.body, [draft.sample.id, missing]),
    })
    expectDenied(denied, kept.state)
  })

  it('changes, clones and moves programme lines without granting a new foreign link', () => {
    const draft = inReview()
    const disposed = changeSampleStatus(draft.state, draft.customerToken, {
      organizationId: 201,
      sampleId: draft.sample.id,
      stage: 'Утилизирована',
    })
    const moved = saveRequestProgram(disposed.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [
        line([draft.child.id]),
        line([draft.sample.id], 'pg-moved', ''),
      ],
      note: 'Перенос между строками',
    })
    expect(moved.status).toBe(200)
    expect(requestOf(moved).details?.programMeta.lines.map((item) => item.sampleIds)).toEqual([
      [draft.child.id],
      [draft.sample.id],
    ])
    const cloned = saveRequestProgram(moved.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(moved).revision,
      lines: [
        line([draft.sample.id, draft.child.id]),
        line([draft.sample.id, draft.child.id], 'pg-copy', ''),
      ],
      note: 'Копия строки',
    })
    expect(cloned.status).toBe(200)
    const poisoned = saveRequestProgram(cloned.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(cloned).revision,
      lines: [
        line([draft.sample.id, draft.child.id]),
        line([draft.sample.id, draft.other.id], 'pg-copy', ''),
      ],
      note: 'Копия с чужим id',
    })
    expectDenied(poisoned, cloned.state)
    expect(poisoned.state.requests?.find((item) => item.id === draft.id)?.details?.programMeta.lines.map((item) => item.sampleIds)).toEqual([
      [draft.sample.id, draft.child.id],
      [draft.sample.id, draft.child.id],
    ])
    expect(poisoned.state.requestEvents?.filter((item) => item.requestId === draft.id).map((item) => item.type)).toEqual(
      cloned.state.requestEvents?.filter((item) => item.requestId === draft.id).map((item) => item.type),
    )
  })

  it('does not write a partial programme, a revision, or the approved snapshot when a new link is rejected', () => {
    const draft = inReview()
    const snapshot = {
      version: 1,
      preparedBy: 'laboratory' as const,
      authorUserId: 2,
      approvedByUserId: 5,
      approvedAt: '2026-11-17T00:00:00.000Z',
      note: 'снимок',
      lines: [line([draft.sample.id])],
    }
    const seeded: MockState = {
      ...draft.state,
      requests: draft.state.requests?.map((item) => item.id === draft.id && item.details ? {
        ...item,
        details: { ...item.details, programMeta: { ...item.details.programMeta, approvedSnapshot: snapshot } },
      } : item),
    }
    const denied = saveRequestProgram(seeded, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [
        line([draft.sample.id, draft.laboratorySample.id]),
        line([draft.other.id], 'pg-extra', ''),
      ],
      note: 'Частичная запись',
    })
    expectDenied(denied, seeded)
    const stored = seeded.requests?.find((item) => item.id === draft.id)
    expect(stored?.revision).toBe(draft.revision)
    expect(stored?.details?.programMeta.lines).toEqual([])
    expect(stored?.details?.programMeta.approvedSnapshot).toEqual(snapshot)
    expect(seeded.requestEvents?.some((item) => item.requestId === draft.id && item.type === 'program_started')).toBe(false)

    const legal = saveRequestProgram(seeded, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.laboratorySample.id])],
      note: 'Без новой чужой пробы',
    })
    expect(legal.status).toBe(200)
    expect(requestOf(legal).details?.programMeta.approvedSnapshot).toEqual(snapshot)
  })

  it('approves an already linked sample and leaves that snapshot unchanged when a later write is rejected', () => {
    const draft = inReview()
    const saved = saveRequestProgram(draft.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.child.id])],
      note: 'К утверждению',
    })
    const submitted = submitRequestProgram(saved.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
    })
    const customer = session('customer@example.test', submitted.state)
    const edited = saveRequestProgram(customer.state, customer.token, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(submitted).revision,
      lines: [line([draft.sample.id, draft.child.id, draft.other.id])],
      note: 'Своя проба заказчика',
    })
    expect(edited.status).toBe(200)
    expect(requestOf(edited).details?.programMeta.lines[0]?.sampleIds).toEqual([
      draft.sample.id,
      draft.child.id,
      draft.other.id,
    ])
    const approved = approveRequestProgram(edited.state, customer.token, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(edited).revision,
    })
    expect(approved.status).toBe(200)
    const snapshot = requestOf(approved).details?.programMeta.approvedSnapshot
    expect(snapshot?.lines[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id, draft.other.id])
    const rewrite = saveRequestProgram(approved.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(approved).revision,
      lines: [line([draft.other.id])],
      note: 'После утверждения',
    })
    expect(rewrite.status).toBe(409)
    expect(rewrite.state).toBe(approved.state)
    expect(requestOf(approved).details?.programMeta.approvedSnapshot).toEqual(snapshot)
  })

  it('saves an old request that has no samples and still rejects a substituted id on send', () => {
    const customer = session('customer@example.test')
    const old = updateRequest(customer.state, customer.token, 'req-customer-draft', {
      organizationId: 201,
      expectedRevision: 1,
      title: 'Черновик без проб',
    })
    expect(old.status).toBe(200)
    expect(requestOf(old).details).toBeUndefined()
    const plain = createRequest(old.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: details(),
    })
    expect(plain.status).toBe(201)
    expect(requestOf(plain).details?.needs[0]?.sampleIds).toBeUndefined()
    expect(requestOf(plain).details?.sampleIds).toEqual(['sample-k104'])

    const draft = filed()
    const attached = uploadRequestBasis(draft.state, draft.customerToken, draft.id, 201, pdf())
    const laboratory = session('admin.a@example.test', attached.state)
    const laboratorySample = registerSample(laboratory.state, laboratory.token, root({
      organizationId: 101,
      externalCode: 'Л-ПОДМЕНА',
    }))
    const sent = sendRequest(laboratorySample.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(attached).revision,
      details: details([sampleOf(laboratorySample).id]),
    })
    expectDenied(sent, laboratorySample.state)
    const text = JSON.stringify(sent.body)
    expect(text).not.toContain(sampleOf(laboratorySample).id)
    expect(text).not.toContain(sampleOf(laboratorySample).code)
    expect(sent.state.requests?.find((item) => item.id === draft.id)?.status).toBe('draft')
    expect(sent.state.requests?.find((item) => item.id === draft.id)?.details?.needs[0]?.sampleIds).toEqual([
      draft.sample.id,
      draft.child.id,
    ])
    expect(sent.state.requestEvents?.find((item) => item.requestId === draft.id)).toBeUndefined()
  })

  it('does not let a third organization or a reader without registry access add a sample', () => {
    const draft = inReview()
    const third = session('employee.b@example.test', draft.state)
    const secrets = [draft.sample.id, draft.sample.code, draft.other.externalCode ?? '', draft.laboratorySample.code]
    const hidden = saveRequestProgram(third.state, third.token, draft.id, {
      organizationId: 102,
      expectedRevision: draft.revision,
      lines: [line([draft.laboratorySample.id])],
      note: 'Чужая заявка',
    })
    expectHidden(hidden, third.state, secrets)
    const forbidden = updateRequest(third.state, third.token, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      details: details([draft.laboratorySample.id]),
    })
    expect(forbidden.status).toBe(403)
    expect(forbidden.body).toEqual({ code: 'forbidden' })
    expect(forbidden.state).toBe(third.state)
    expect(JSON.stringify(forbidden.body)).not.toContain(draft.laboratorySample.id)

    const open = filed()
    const stripped = withoutRegistryRead(open.state)
    const blocked = updateRequest(stripped, open.customerToken, open.id, {
      organizationId: 201,
      expectedRevision: open.revision,
      details: withNeedSamples(open.body, [open.sample.id, open.other.id]),
    })
    expectDenied(blocked, stripped)
    const kept = updateRequest(stripped, open.customerToken, open.id, {
      organizationId: 201,
      expectedRevision: open.revision,
      details: withNeedSamples(open.body, [open.sample.id, open.child.id], 'Без права на реестр'),
    })
    expect(kept.status).toBe(200)
    expect(requestOf(kept).details?.needs[0]?.sampleIds).toEqual([open.sample.id, open.child.id])
  })

  it('does not treat corporation-wide read as permission to link another organization sample', () => {
    const draft = inReview()
    const owner = session('owner@example.test', draft.state)
    const denied = saveRequestProgram(owner.state, owner.token, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.other.id])],
      note: 'Чужая проба владельца',
    })
    expectDenied(denied, owner.state)
    const text = JSON.stringify(denied.body)
    expect(text).not.toContain(draft.other.id)
    expect(text).not.toContain(draft.other.code)
    expect(text).not.toContain('НЕ-В-ЗАЯВКЕ')
    const allowed = saveRequestProgram(owner.state, owner.token, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id])],
      note: 'Уже связана',
    })
    expect(allowed.status).toBe(200)
    expect(requestOf(allowed).details?.programMeta.lines[0]?.sampleIds).toEqual([draft.sample.id])
  })

  it('transfers an active sample when the same organization derives the request', () => {
    const closed = rejectedRequest()
    const snapshot = approvedSnapshot([closed.sample.id, closed.other.id])
    const seeded = rewriteDetails(closed.state, closed.id, (body) => ({
      ...body,
      programMeta: {
        ...body.programMeta,
        preparedBy: 'laboratory',
        approval: 'approved',
        lines: [line([closed.sample.id, closed.other.id])],
        approvedSnapshot: snapshot,
      },
    }))
    const before = storedRequest(seeded, closed.id)
    const derived = deriveRequest(seeded, closed.customerToken, closed.id, {
      organizationId: 201,
      expectedRevision: closed.revision,
    })
    expect(derived.status).toBe(201)
    const copy = requestOf(derived)
    const created = storedRequest(derived.state, copy.id)
    expect(created.filedByOrganizationId).toBe(201)
    expect(created.customerOrganizationId).toBe(201)
    expect(created.executorOrganizationId).toBe(101)
    expect(copy.details?.needs[0]?.sampleIds).toEqual([closed.sample.id, closed.child.id])
    expect(copy.details?.needs[0]?.desiredResult).toBe('Определить пористость')
    expect(copy.details?.needs[0]?.sampleIds).not.toContain(closed.other.id)
    expect(copy.details?.programMeta.lines).toEqual([])
    expect(copy.details?.programMeta.approvedSnapshot).toBeNull()
    expect(JSON.stringify(copy.details)).not.toContain(closed.other.id)
    const source = storedRequest(derived.state, closed.id)
    expect(source.revision).toBe(closed.revision + 1)
    expect(source.details?.needs[0]?.sampleIds).toEqual(before.details?.needs[0]?.sampleIds)
    expect(source.details?.programMeta.approvedSnapshot).toBe(snapshot)
    expect(derived.state.requests?.filter((item) => item.sourceRequestId === closed.id)).toHaveLength(1)
  })

  it('does not transfer samples when another organization derives the request', () => {
    const closed = rejectedRequest()
    const registered = registerSample(closed.state, closed.laboratoryToken, root({
      organizationId: 101,
      externalCode: 'Л-ЧУЖАЯ',
      field: 'Лабораторное',
      well: '1',
    }))
    const foreign = sampleOf(registered)
    const seeded = rewriteDetails(registered.state, closed.id, (body) => ({
      ...body,
      needs: body.needs.map((need, index) => index === 0
        ? { ...need, sampleIds: [closed.sample.id, foreign.id] }
        : need),
    }))
    const before = storedRequest(seeded, closed.id)
    const derived = deriveRequest(seeded, closed.laboratoryToken, closed.id, {
      organizationId: 101,
      expectedRevision: closed.revision,
    })
    expect(derived.status).toBe(201)
    const copy = storedRequest(derived.state, requestOf(derived).id)
    expect(copy.filedByOrganizationId).toBe(101)
    expect(copy.customerOrganizationId).toBe(201)
    expect(copy.details?.needs[0]?.sampleIds).toEqual([])
    expect(copy.details?.needs[0]?.desiredResult).toBe('Определить пористость')
    expect(JSON.stringify(copy.details?.needs)).not.toContain(foreign.id)
    expect(JSON.stringify(copy.details?.needs)).not.toContain(closed.sample.id)
    expect(JSON.stringify(copy.details)).not.toContain('Л-ЧУЖАЯ')
    const source = storedRequest(derived.state, closed.id)
    expect(source.details?.needs[0]?.sampleIds).toEqual([closed.sample.id, foreign.id])
    expect(source.details).toBe(before.details)
    expect(source.revision).toBe(closed.revision + 1)
    expect(derived.state.requests?.length).toBe((seeded.requests?.length ?? 0) + 1)
  })

  it('drops a deleted, disposed, or missing sample from a derived need and keeps the other need data', () => {
    const closed = rejectedRequest()
    const disposed = changeSampleStatus(closed.state, closed.customerToken, {
      organizationId: 201,
      sampleId: closed.sample.id,
      stage: 'Утилизирована',
    })
    const removed = deleteSampleRecord(disposed.state, closed.customerToken, 201, closed.child.id)
    const plain = { ...storedRequest(removed.state, closed.id).details!.needs[0]!, comment: 'Без проб' }
    delete plain.sampleIds
    const seeded = rewriteDetails(removed.state, closed.id, (body) => ({
      ...body,
      needs: [
        {
          ...body.needs[0]!,
          comment: 'Состав уточнить',
          sampleIds: [closed.other.id, closed.sample.id, closed.child.id, 'missing-sample'],
        },
        plain,
      ],
    }))
    const before = storedRequest(seeded, closed.id)
    const derived = deriveRequest(seeded, closed.customerToken, closed.id, {
      organizationId: 201,
      expectedRevision: closed.revision,
    })
    expect(derived.status).toBe(201)
    const needs = requestOf(derived).details?.needs ?? []
    const kept = needs.find((need) => need.comment === 'Состав уточнить')
    const untouched = needs.find((need) => need.comment === 'Без проб')
    expect(kept?.sampleIds).toEqual([closed.other.id])
    expect(kept?.desiredResult).toBe('Определить пористость')
    expect(untouched).not.toHaveProperty('sampleIds')
    expect(untouched?.desiredResult).toBe('Определить пористость')
    expect(requestOf(derived).details?.programMeta.lines).toEqual([])
    expect(requestOf(derived).details?.programMeta.approvedSnapshot).toBeNull()
    const source = storedRequest(derived.state, closed.id)
    expect(source.details).toBe(before.details)
    expect(source.details?.needs[0]?.sampleIds).toEqual([
      closed.other.id,
      closed.sample.id,
      closed.child.id,
      'missing-sample',
    ])
    expect(source.revision).toBe(closed.revision + 1)
    expect(derived.state.requests?.length).toBe((seeded.requests?.length ?? 0) + 1)
  })

  it('treats an id that exists only in the approved snapshot as a new link', () => {
    const draft = inReview()
    const snapshot = approvedSnapshot([draft.other.id])
    const withNote: MockState = {
      ...draft.state,
      samples: draft.state.samples?.map((sample) => sample.id === draft.other.id
        ? { ...sample, inspectionNote: 'СКРЫТАЯ-ЗАМЕТКА', location: 'СЕКРЕТ-СКЛАД' }
        : sample),
    }
    const seeded = rewriteDetails(withNote, draft.id, (body) => ({
      ...body,
      programMeta: {
        ...body.programMeta,
        approval: 'draft',
        lines: [],
        approvedSnapshot: snapshot,
      },
    }))
    const denied = saveRequestProgram(seeded, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.other.id])],
      note: 'Только из снимка',
    })
    expectDenied(denied, seeded)
    expect(JSON.stringify(denied.body)).not.toContain(draft.other.id)
    expect(JSON.stringify(denied.body)).not.toContain('НЕ-В-ЗАЯВКЕ')
    const stored = storedRequest(denied.state, draft.id)
    expect(stored.revision).toBe(draft.revision)
    expect(stored.details?.programMeta.lines).toEqual([])
    expect(stored.details?.programMeta.approvedSnapshot).toBe(snapshot)
    const seen = readRequestLinkedSamples(seeded, draft.laboratoryToken, 101, draft.id)
    expect(seen.status).toBe(200)
    expect(linkedOf(seen)?.map((item) => item.id)).toEqual([draft.sample.id, draft.child.id, draft.other.id])
    const text = JSON.stringify(seen.body)
    expect(text).toContain(draft.other.code)
    expect(text).not.toContain('СКРЫТАЯ-ЗАМЕТКА')
    expect(text).not.toContain('СЕКРЕТ-СКЛАД')
    const opened = readRequest(seeded, draft.laboratoryToken, 101, draft.id)
    expect(opened.status).toBe(200)
    expect(requestOf(opened).details?.programMeta.approvedSnapshot).toEqual(snapshot)
  })

  it('lets the owner add an active sample that was kept only in the approved snapshot', () => {
    const draft = inReview()
    const snapshot = approvedSnapshot([draft.other.id])
    const seeded = rewriteDetails(draft.state, draft.id, (body) => ({
      ...body,
      programMeta: {
        ...body.programMeta,
        approval: 'pending_customer',
        lines: [line([draft.sample.id])],
        approvedSnapshot: snapshot,
      },
    }))
    const saved = saveRequestProgram(seeded, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.other.id])],
      note: 'Своя проба из снимка',
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).details?.programMeta.lines[0]?.sampleIds).toEqual([draft.sample.id, draft.other.id])
    expect(requestOf(saved).details?.programMeta.approvedSnapshot).toEqual(snapshot)
    expect(storedRequest(saved.state, draft.id).details?.programMeta.approvedSnapshot).toEqual(snapshot)
    expect(requestOf(saved).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
  })

  it('rejects a snapshot-only sample after disposal or deletion and still opens the stored request', () => {
    const draft = inReview()
    const snapshot = approvedSnapshot([draft.other.id, draft.child.id])
    const seeded = rewriteDetails(draft.state, draft.id, (body) => ({
      ...body,
      needs: body.needs.map((need) => ({
        ...need,
        sampleIds: (need.sampleIds ?? []).filter((id) => id !== draft.child.id),
      })),
      programMeta: {
        ...body.programMeta,
        approval: 'pending_customer',
        lines: [line([draft.sample.id])],
        approvedSnapshot: snapshot,
      },
    }))
    const disposed = changeSampleStatus(seeded, draft.customerToken, {
      organizationId: 201,
      sampleId: draft.other.id,
      stage: 'Утилизирована',
    })
    const removed = deleteSampleRecord(disposed.state, draft.customerToken, 201, draft.child.id)
    const deniedDisposed = saveRequestProgram(removed.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.other.id])],
      note: 'Утилизированная из снимка',
    })
    expectDenied(deniedDisposed, removed.state)
    const deniedDeleted = saveRequestProgram(removed.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, draft.child.id])],
      note: 'Удалённая из снимка',
    })
    expectDenied(deniedDeleted, removed.state)
    const missing = saveRequestProgram(removed.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id, 'missing-sample'])],
      note: 'Отсутствующая',
    })
    expectDenied(missing, removed.state)
    expect(JSON.stringify(missing.body)).not.toContain('missing-sample')
    const stored = storedRequest(missing.state, draft.id)
    expect(stored.revision).toBe(draft.revision)
    expect(stored.details?.programMeta.lines[0]?.sampleIds).toEqual([draft.sample.id])
    expect(stored.details?.programMeta.approvedSnapshot).toBe(snapshot)
    const seen = readRequestLinkedSamples(removed.state, draft.laboratoryToken, 101, draft.id)
    expect(seen.status).toBe(200)
    expect(linkedOf(seen)?.find((item) => item.id === draft.child.id)).toMatchObject({ deleted: true })
    expect(linkedOf(seen)?.find((item) => item.id === draft.other.id)?.stage).toBe('Утилизирована')
    const opened = readRequest(removed.state, draft.customerToken, 201, draft.id)
    expect(opened.status).toBe(200)
    expect(requestOf(opened).details?.programMeta.approvedSnapshot).toEqual(snapshot)
  })

  it('keeps a disposed sample on the current programme line and does not take one from the snapshot', () => {
    const draft = inReview()
    const snapshot = approvedSnapshot([draft.sample.id, draft.other.id])
    const seeded = rewriteDetails(draft.state, draft.id, (body) => ({
      ...body,
      programMeta: {
        ...body.programMeta,
        approval: 'draft',
        preparedBy: 'laboratory',
        lines: [],
        approvedSnapshot: snapshot,
      },
    }))
    const moved = saveRequestProgram(seeded, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: draft.revision,
      lines: [line([draft.sample.id]), line([draft.sample.id], 'pg-copy', '')],
      note: 'Уже связана',
    })
    expect(moved.status).toBe(200)
    expect(requestOf(moved).details?.programMeta.lines.map((item) => item.sampleIds)).toEqual([
      [draft.sample.id],
      [draft.sample.id],
    ])
    expect(requestOf(moved).details?.programMeta.approvedSnapshot).toEqual(snapshot)
    const disposed = changeSampleStatus(moved.state, draft.customerToken, {
      organizationId: 201,
      sampleId: draft.sample.id,
      stage: 'Утилизирована',
    })
    const otherDisposed = changeSampleStatus(disposed.state, draft.customerToken, {
      organizationId: 201,
      sampleId: draft.other.id,
      stage: 'Утилизирована',
    })
    const again = saveRequestProgram(otherDisposed.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(moved).revision,
      lines: [line([draft.sample.id]), line([draft.sample.id], 'pg-copy', '')],
      note: 'Повтор без новой связи',
    })
    expect(again.status).toBe(200)
    const keptSnapshot = storedRequest(again.state, draft.id).details?.programMeta.approvedSnapshot
    expect(keptSnapshot).toEqual(snapshot)
    expect(requestOf(again).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    const denied = saveRequestProgram(again.state, draft.laboratoryToken, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(again).revision,
      lines: [line([draft.sample.id, draft.other.id])],
      note: 'Снимок после утилизации',
    })
    expectDenied(denied, again.state)
    expect(storedRequest(denied.state, draft.id).details?.programMeta.approvedSnapshot).toBe(keptSnapshot)
    expect(storedRequest(denied.state, draft.id).details?.programMeta.lines.map((item) => item.sampleIds)).toEqual([
      [draft.sample.id],
      [draft.sample.id],
    ])
    expect(denied.state.requestEvents?.filter((item) => item.requestId === draft.id).map((item) => item.type)).toEqual(
      again.state.requestEvents?.filter((item) => item.requestId === draft.id).map((item) => item.type),
    )
  })
})
