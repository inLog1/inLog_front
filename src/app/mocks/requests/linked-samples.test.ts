import { describe, expect, it } from 'vitest'
import { emptyRequestDraft, type RequestDraftDetails, type RequestLinkedSample } from '../../../entities/request'
import type { RegisterSampleInput, Sample } from '../../../entities/sample'
import {
  changeSampleStatus,
  deleteSampleRecord,
  listSamples,
  readSample,
  registerSample,
  registerSubsample,
} from '../samples/service'
import { loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { projectLinkedSamples } from './linked-samples'
import {
  approveRequestProgram,
  createRequest,
  readRequest,
  readRequestLinkedSamples,
  saveRequestProgram,
  sendRequest,
  startRequestReview,
  submitRequestProgram,
  uploadRequestBasis,
} from './service'

function session(email: string, state: MockState = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function codeOf(result: { body: unknown }) {
  return (result.body as { code?: string }).code
}

function requestOf(result: { body: unknown }) {
  return (result.body as {
    request: {
      id: string
      revision: number
      details?: RequestDraftDetails
    }
  }).request
}

function linkedOf(result: { body: unknown }) {
  return (result.body as { samples?: RequestLinkedSample[] }).samples
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
    location: 'Закрытый склад',
    externalCode: 'К-15',
    inspection: 'С ограничениями',
    inspectionNote: 'Секретное замечание',
    ...overrides,
  }
}

function details(sampleIds: string[]): RequestDraftDetails {
  const draft = emptyRequestDraft()
  draft.projectName = 'Связанные пробы'
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
    sampleIds,
  }]
  return draft
}

function line(sampleIds: string[], id = 'pg-need-1', needId = 'need-1') {
  return {
    id,
    needId,
    targets: [{ wellId: 'well-1', selection: 'well' as const, intervalIds: [] as string[] }],
    researchId: 'work-porosity',
    sampleTypeId: '',
    quantity: null as number | null,
    unitId: '',
    note: 'Методика уточнена',
    sampleIds,
  }
}

function filed() {
  const customer = session('customer@example.test')
  const createdSample = registerSample(customer.state, customer.token, root())
  const sample = sampleOf(createdSample)
  const other = registerSample(createdSample.state, customer.token, root({
    field: 'Южное',
    well: '18',
    externalCode: 'НЕ-В-ЗАЯВКЕ',
    inspection: 'Соответствует',
    inspectionNote: '',
  }))
  const child = registerSubsample(other.state, customer.token, {
    organizationId: 201,
    parentId: sample.id,
    receivedAt: '2026-11-17',
    location: 'Стол',
    externalCode: 'К-15-1',
  })
  const created = createRequest(child.state, customer.token, {
    organizationId: 201,
    executorOrganizationId: 101,
    details: details([sample.id, sampleOf(child).id]),
  })
  return {
    state: created.state,
    id: requestOf(created).id,
    revision: requestOf(created).revision,
    sample,
    other: sampleOf(other),
    child: sampleOf(child),
    customerToken: customer.token,
  }
}

describe('linked samples of a request', () => {
  it('returns only the fixed fields and hides a parent that is not linked', () => {
    const parent = {
      id: 'parent',
      organizationId: 201,
      code: 'PRB-2026-000001',
      externalCode: 'К-15',
      kind: 'Керн' as const,
      material: '',
      sampleType: 'Керн' as const,
      field: 'Северное',
      well: '№ 12',
      formation: 'П1',
      interval: '10–20',
      collectedAt: '',
      receivedAt: '2026-11-17',
      container: 'ящик',
      quantity: '1 м',
      supplier: 'А',
      document: 'акт',
      conditions: 'сухо',
      location: 'Закрытый склад',
      inspection: 'С ограничениями' as const,
      inspectionNote: 'Секретное замечание',
      stage: 'На хранении' as const,
      events: [{ at: '2026-11-17T00:00:00.000Z', text: 'Служебная запись' }],
    }
    const child = { ...parent, id: 'child', code: 'PRB-2026-000001-01', parentId: 'parent', externalCode: 'К-15-1' }
    const outsider = { ...parent, id: 'outsider', organizationId: 102, code: 'PRB-2026-000099', externalCode: 'ЧУЖАЯ' }
    const childOnly = projectLinkedSamples([parent, child, outsider], ['child', 'outsider'], [201, 101])
    expect(childOnly.map((item) => item.id)).toEqual(['child'])
    expect(childOnly[0]?.parentId).toBeUndefined()
    expect(childOnly[0]?.well).toBe('12')
    expect(JSON.stringify(childOnly)).not.toContain('Секретное замечание')
    expect(JSON.stringify(childOnly)).not.toContain('Закрытый склад')
    expect(JSON.stringify(childOnly)).not.toContain('Служебная запись')
    expect(JSON.stringify(childOnly)).not.toContain('ЧУЖАЯ')
    expect(Object.keys(childOnly[0] ?? {}).sort()).toEqual([
      'code', 'deleted', 'externalCode', 'field', 'formation', 'id', 'inspection',
      'interval', 'intervalInherited', 'organizationId', 'sampleType', 'stage', 'well',
    ])
    const both = projectLinkedSamples([parent, child], ['parent', 'child'], [201, 101])
    expect(both.find((item) => item.id === 'child')?.parentId).toBe('parent')
    expect(both.find((item) => item.id === 'child')?.intervalInherited).toBe(true)
  })

  it('keeps a draft from the named laboratory and shows the laboratory the linked rows after send', () => {
    const draft = filed()
    const laboratory = session('admin.a@example.test', draft.state)
    const hidden = readRequestLinkedSamples(laboratory.state, laboratory.token, 101, draft.id)
    expect(hidden.status).toBe(404)
    expect(codeOf(hidden)).toBe('not_found')
    expect(JSON.stringify(hidden.body)).not.toContain(draft.sample.id)
    expect(JSON.stringify(hidden.body)).not.toContain(draft.sample.code)
    expect(JSON.stringify(hidden.body)).not.toContain('Секретное замечание')

    const ownDraft = readRequestLinkedSamples(draft.state, draft.customerToken, 201, draft.id)
    expect(ownDraft.status).toBe(200)
    expect(linkedOf(ownDraft)?.map((item) => item.id)).toEqual([draft.sample.id, draft.child.id])
    expect(linkedOf(ownDraft)?.some((item) => item.id === draft.other.id)).toBe(false)

    const attached = uploadRequestBasis(draft.state, draft.customerToken, draft.id, 201, {
      filename: 'basis.pdf',
      mimeType: 'application/pdf',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })
    const sent = sendRequest(attached.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(attached).revision,
    })
    expect(sent.status).toBe(200)
    const laboratoryAfter = session('admin.a@example.test', sent.state)
    const opened = readRequestLinkedSamples(laboratoryAfter.state, laboratoryAfter.token, 101, draft.id)
    expect(opened.status).toBe(200)
    const rows = linkedOf(opened) ?? []
    expect(rows.map((item) => item.code)).toEqual([draft.sample.code, draft.child.code])
    expect(rows[0]).toMatchObject({
      id: draft.sample.id,
      organizationId: 201,
      sampleType: 'Керн',
      externalCode: 'К-15',
      field: 'Северное',
      well: '12',
      formation: 'П1',
      interval: '1138–1150',
      inspection: 'С ограничениями',
      deleted: false,
    })
    expect(rows[1]?.parentId).toBe(draft.sample.id)
    expect(JSON.stringify(opened.body)).not.toContain('Секретное замечание')
    expect(JSON.stringify(opened.body)).not.toContain('Закрытый склад')
    expect(JSON.stringify(opened.body)).not.toContain(draft.other.id)
    expect(JSON.stringify(opened.body)).not.toContain('НЕ-В-ЗАЯВКЕ')

    const third = session('employee.b@example.test', laboratoryAfter.state)
    const foreignRead = readRequestLinkedSamples(third.state, third.token, 102, draft.id)
    expect(foreignRead.status).toBe(404)
    expect(JSON.stringify(foreignRead.body)).not.toContain(draft.sample.code)

    const projectOnly = session('project.only@example.test', laboratoryAfter.state)
    const projectRead = readRequestLinkedSamples(projectOnly.state, projectOnly.token, 101, draft.id)
    expect(projectRead.status).toBe(403)
    expect(linkedOf(projectRead)).toBeUndefined()

    const owner = session('owner@example.test', laboratoryAfter.state)
    const ownerOtherOrg = readRequestLinkedSamples(owner.state, owner.token, 102, draft.id)
    expect(ownerOtherOrg.status).toBe(404)
    expect(JSON.stringify(ownerOtherOrg.body)).not.toContain(draft.sample.code)
    const ownerParty = readRequestLinkedSamples(owner.state, owner.token, 101, draft.id)
    expect(ownerParty.status).toBe(200)
    expect(linkedOf(ownerParty)?.map((item) => item.id)).toEqual([draft.sample.id, draft.child.id])

    expect(listSamples(laboratoryAfter.state, laboratoryAfter.token, 201).status).toBe(403)
    expect(readSample(laboratoryAfter.state, laboratoryAfter.token, 201, draft.sample.id).status).toBe(403)
    expect(readSample(laboratoryAfter.state, laboratoryAfter.token, 101, draft.sample.id).status).toBe(404)
    expect(readSample(laboratoryAfter.state, laboratoryAfter.token, 101, draft.other.id).status).toBe(404)

    const old = readRequestLinkedSamples(laboratoryAfter.state, laboratoryAfter.token, 101, 'req-customer-sent')
    expect(old.status).toBe(200)
    expect(linkedOf(old)).toEqual([])

    const outsider = registerSample(owner.state, owner.token, root({
      organizationId: 102,
      field: 'Чужое',
      externalCode: 'ОРГ-C',
      inspection: 'Соответствует',
      inspectionNote: '',
    }))
    const outsiderSample = sampleOf(outsider)
    const poisoned: MockState = {
      ...outsider.state,
      requests: outsider.state.requests?.map((item) => item.id === draft.id && item.details ? {
        ...item,
        details: {
          ...item.details,
          needs: item.details.needs.map((need, index) => index === 0
            ? { ...need, sampleIds: [...(need.sampleIds ?? []), outsiderSample.id] }
            : need),
        },
      } : item),
    }
    const narrowed = readRequestLinkedSamples(poisoned, laboratoryAfter.token, 101, draft.id)
    expect(narrowed.status).toBe(200)
    expect(linkedOf(narrowed)?.map((item) => item.id)).toEqual([draft.sample.id, draft.child.id])
    expect(JSON.stringify(narrowed.body)).not.toContain(outsiderSample.id)
    expect(JSON.stringify(narrowed.body)).not.toContain('ОРГ-C')
  })

  it('keeps the linked sample through the programme, the approved snapshot, disposal and deletion', () => {
    const draft = filed()
    const attached = uploadRequestBasis(draft.state, draft.customerToken, draft.id, 201, {
      filename: 'basis.pdf',
      mimeType: 'application/pdf',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })
    const sent = sendRequest(attached.state, draft.customerToken, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(attached).revision,
    })
    const laboratory = session('admin.a@example.test', sent.state)
    const started = startRequestReview(laboratory.state, laboratory.token, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(sent).revision,
    })
    expect(started.status).toBe(200)
    const saved = saveRequestProgram(started.state, laboratory.token, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
      lines: [
        line([draft.sample.id, draft.child.id]),
        line([draft.sample.id, draft.child.id], 'pg-copy', ''),
      ],
      note: 'Состав проб',
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    expect(requestOf(saved).details?.programMeta.lines.map((item) => item.sampleIds)).toEqual([
      [draft.sample.id, draft.child.id],
      [draft.sample.id, draft.child.id],
    ])
    const again = readRequest(saved.state, laboratory.token, 101, draft.id)
    expect(requestOf(again).details?.programMeta.lines[1]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    const seen = readRequestLinkedSamples(saved.state, laboratory.token, 101, draft.id)
    expect(linkedOf(seen)?.map((item) => item.id)).toEqual([draft.sample.id, draft.child.id])

    const submitted = submitRequestProgram(saved.state, laboratory.token, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
    })
    expect(submitted.status).toBe(200)
    const customer = session('customer@example.test', submitted.state)
    const approved = approveRequestProgram(customer.state, customer.token, draft.id, {
      organizationId: 201,
      expectedRevision: requestOf(submitted).revision,
    })
    expect(approved.status).toBe(200)
    const snapshotIds = requestOf(approved).details?.programMeta.approvedSnapshot?.lines.map((item) => item.sampleIds)
    expect(snapshotIds).toEqual([
      [draft.sample.id, draft.child.id],
      [draft.sample.id, draft.child.id],
    ])
    const rewrite = saveRequestProgram(approved.state, laboratory.token, draft.id, {
      organizationId: 101,
      expectedRevision: requestOf(approved).revision,
      lines: [line([draft.other.id])],
      note: 'Поздняя правка',
    })
    expect(rewrite.status).toBe(409)
    const still = readRequest(approved.state, customer.token, 201, draft.id)
    expect(requestOf(still).details?.programMeta.approvedSnapshot?.lines.map((item) => item.sampleIds)).toEqual(snapshotIds)
    expect(requestOf(still).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])

    const disposed = changeSampleStatus(approved.state, customer.token, {
      organizationId: 201,
      sampleId: draft.sample.id,
      stage: 'Утилизирована',
    })
    expect(disposed.status).toBe(200)
    const afterDisposal = readRequestLinkedSamples(disposed.state, laboratory.token, 101, draft.id)
    expect(linkedOf(afterDisposal)?.find((item) => item.id === draft.sample.id)).toMatchObject({
      code: draft.sample.code,
      stage: 'Утилизирована',
      deleted: false,
    })
    expect(requestOf(readRequest(disposed.state, customer.token, 201, draft.id)).details?.programMeta.approvedSnapshot?.lines[0]?.sampleIds)
      .toEqual([draft.sample.id, draft.child.id])

    const removed = deleteSampleRecord(disposed.state, customer.token, 201, draft.child.id)
    expect(removed.status).toBe(200)
    const afterDelete = readRequestLinkedSamples(removed.state, laboratory.token, 101, draft.id)
    expect(linkedOf(afterDelete)?.find((item) => item.id === draft.child.id)).toMatchObject({
      code: draft.child.code,
      deleted: true,
    })
    const kept = readRequest(removed.state, laboratory.token, 101, draft.id)
    expect(requestOf(kept).details?.needs[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    expect(requestOf(kept).details?.programMeta.approvedSnapshot?.lines[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
    expect(requestOf(kept).details?.programMeta.lines[0]?.sampleIds).toEqual([draft.sample.id, draft.child.id])
  })
})
