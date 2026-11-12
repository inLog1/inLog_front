import { describe, expect, it } from 'vitest'
import { emptyRequestDraft, type RequestDraftDetails } from '../../../entities/request'
import { loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import {
  approveRequestProgram,
  createRequest,
  listRequests,
  readRequest,
  returnRequestProgram,
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
      status: string
      revision: number
      customerOrganizationId: number
      executorOrganizationId: number
      basisDocument?: { id: string } | null
      events: Array<{ type: string; userId: number; comment?: string; previousApproval?: string; nextApproval?: string }>
      details?: RequestDraftDetails
    }
  }).request
}

function line(researchId: string) {
  return {
    id: 'pg-need-1',
    needId: 'need-1',
    targets: [{ wellId: 'well-1', selection: 'well' as const, intervalIds: [] as string[] }],
    researchId,
    sampleTypeId: '',
    quantity: null as number | null,
    unitId: '',
    note: 'Методика уточнена',
  }
}

function details(researchId: string, desiredResult = ''): RequestDraftDetails {
  const draft = emptyRequestDraft()
  draft.projectName = 'Программа'
  draft.fields = [{
    id: 'field-1',
    catalogFieldId: 'field-north',
    fieldName: '',
    wells: [{ id: 'well-1', catalogWellId: 'well-12', wellName: '', intervals: [] }],
  }]
  draft.needs = [{
    id: 'need-1',
    targets: [{ wellId: 'well-1', selection: 'well', intervalIds: [] }],
    researchId,
    desiredResult,
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
  }]
  return draft
}

function reviewed(body: RequestDraftDetails, organizationId = 201, executorOrganizationId = 101) {
  const customer = session(organizationId === 101 ? 'admin.a@example.test' : 'customer@example.test')
  const created = createRequest(customer.state, customer.token, {
    organizationId,
    executorOrganizationId,
    details: body,
  })
  const id = requestOf(created).id
  const attached = uploadRequestBasis(created.state, customer.token, id, organizationId, {
    filename: 'basis.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  })
  const sent = sendRequest(attached.state, customer.token, id, {
    organizationId,
    expectedRevision: requestOf(attached).revision,
  })
  const laboratory = session('admin.a@example.test', sent.state)
  const started = startRequestReview(laboratory.state, laboratory.token, id, {
    organizationId: executorOrganizationId,
    expectedRevision: requestOf(sent).revision,
  })
  return {
    state: started.state,
    id,
    revision: requestOf(started).revision,
    customerToken: customer.token,
    laboratoryToken: laboratory.token,
  }
}

describe('request programme agreement', () => {
  it('lets the laboratory agree a programme the customer already defined', () => {
    const filed = reviewed(details('work-porosity', 'Определить пористость'))
    const customer = session('customer@example.test', filed.state)
    const denied = approveRequestProgram(customer.state, customer.token, filed.id, {
      organizationId: 201,
      expectedRevision: filed.revision,
    })
    expect(denied.status).toBe(403)
    expect(codeOf(denied)).toBe('not_approver')
    const stale = approveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision + 3,
    })
    expect(stale.status).toBe(409)
    expect(codeOf(stale)).toBe('stale_write')
    const agreed = approveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(agreed.status).toBe(200)
    const request = requestOf(agreed)
    expect(request.status).toBe('approved')
    expect(request.details?.programMeta.approval).toBe('approved')
    expect(request.details?.programMeta.preparedBy).toBe('customer')
    expect(request.details?.programMeta.approvedSnapshot?.lines[0]?.researchId).toBe('work-porosity')
    expect(request.details?.programMeta.approvedSnapshot?.version).toBe(1)
    expect(request.details?.needs[0]?.desiredResult).toBe('Определить пористость')
    expect(request.events.map((event) => event.type)).toEqual(expect.arrayContaining(['program_approved', 'request_approved']))
    const again = approveRequestProgram(agreed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: request.revision,
    })
    expect(again.status).toBe(409)
    expect(codeOf(again)).toBe('invalid_status')
    const listed = listRequests(agreed.state, filed.customerToken, 201)
    expect(listed.status).toBe(200)
    const legacy = readRequest(agreed.state, filed.customerToken, 201, 'req-customer-draft')
    expect(legacy.status).toBe(200)
  })

  it('lets the laboratory prepare a programme, the customer change it, and then approve it', () => {
    const filed = reviewed(details('', 'Необходимо определить фильтрационно-ёмкостные свойства керна'))
    const early = approveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(early.status).toBe(403)
    expect(codeOf(early)).toBe('not_approver')
    const incomplete = saveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
      lines: [line('')],
      note: '',
    })
    const refused = submitRequestProgram(incomplete.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(incomplete).revision,
    })
    expect(refused.status).toBe(400)
    expect(codeOf(refused)).toBe('program_invalid')
    const employee = session('employee.a@example.test', filed.state)
    const blocked = saveRequestProgram(employee.state, employee.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
      lines: [line('work-porosity')],
      note: 'Черновик',
    })
    expect(blocked.status).toBe(403)
    const saved = saveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
      lines: [line('work-porosity')],
      note: 'Подбор по описанию',
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).status).toBe('in_review')
    expect(requestOf(saved).details?.programMeta.approval).toBe('draft')
    expect(requestOf(saved).details?.programMeta.preparedBy).toBe('laboratory')
    expect(requestOf(saved).details?.needs[0]?.desiredResult).toContain('фильтрационно')
    expect(requestOf(saved).details?.needs[0]?.researchId).toBe('')
    const submitted = submitRequestProgram(saved.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
    })
    expect(submitted.status).toBe(200)
    expect(requestOf(submitted).status).toBe('program_approval')
    expect(requestOf(submitted).details?.programMeta.approval).toBe('pending_customer')
    expect(requestOf(submitted).details?.programMeta.version).toBe(1)
    const seen = readRequest(submitted.state, filed.customerToken, 201, filed.id)
    expect(requestOf(seen).details?.programMeta.lines[0]?.researchId).toBe('work-porosity')
    const changed = saveRequestProgram(submitted.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(submitted).revision,
      lines: [{ ...line('work-permeability'), note: 'Заказчик заменил исследование' }],
      note: 'Исправлено заказчиком',
    })
    expect(changed.status).toBe(200)
    expect(requestOf(changed).details?.needs[0]?.desiredResult).toContain('фильтрационно')
    expect(requestOf(changed).details?.programMeta.preparedBy).toBe('laboratory')
    expect(requestOf(changed).details?.programMeta.lines[0]?.researchId).toBe('work-permeability')
    const approved = approveRequestProgram(changed.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(changed).revision,
    })
    expect(approved.status).toBe(200)
    expect(requestOf(approved).status).toBe('approved')
    expect(requestOf(approved).details?.programMeta.approval).toBe('approved')
    expect(requestOf(approved).details?.programMeta.approvedSnapshot?.lines[0]?.researchId).toBe('work-permeability')
    expect(requestOf(approved).events.some((event) => event.type === 'request_approved')).toBe(true)
    const laboratoryAgain = approveRequestProgram(approved.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(approved).revision,
    })
    expect(laboratoryAgain.status).toBe(409)
  })

  it('returns a programme to the laboratory and accepts the next submission', () => {
    const filed = reviewed(details('', 'Нужен состав флюида'))
    const saved = saveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
      lines: [line('work-composition')],
      note: '',
    })
    const submitted = submitRequestProgram(saved.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
    })
    const blank = returnRequestProgram(submitted.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(submitted).revision,
      reason: '   ',
    })
    expect(blank.status).toBe(400)
    const returned = returnRequestProgram(submitted.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(submitted).revision,
      reason: 'Нужна проницаемость, не состав',
    })
    expect(returned.status).toBe(200)
    expect(requestOf(returned).status).toBe('in_review')
    expect(requestOf(returned).details?.programMeta.approval).toBe('returned')
    expect(requestOf(returned).details?.programMeta.returnReason).toBe('Нужна проницаемость, не состав')
    expect(requestOf(returned).events.some((event) => event.type === 'program_returned' && event.comment === 'Нужна проницаемость, не состав')).toBe(true)
    const revised = saveRequestProgram(returned.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(returned).revision,
      lines: [line('work-permeability')],
      note: 'Заменили состав на проницаемость',
    })
    const again = submitRequestProgram(revised.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(revised).revision,
    })
    expect(requestOf(again).status).toBe('program_approval')
    expect(requestOf(again).details?.programMeta.approval).toBe('pending_customer')
    expect(requestOf(again).details?.programMeta.version).toBe(2)
    expect(requestOf(again).details?.needs[0]?.researchId).toBe('')
  })

  it('approves a laboratory request to itself without sending it to another organization', () => {
    const filed = reviewed(details('', 'Собственное исследование керна'), 101, 101)
    expect(requestOf(readRequest(filed.state, filed.laboratoryToken, 101, filed.id)).customerOrganizationId).toBe(101)
    const sentAway = submitRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(sentAway.status).toBe(409)
    expect(codeOf(sentAway)).toBe('own_request')
    const beforeSave = approveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(beforeSave.status).toBe(400)
    expect(codeOf(beforeSave)).toBe('program_invalid')
    const saved = saveRequestProgram(filed.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
      lines: [line('work-porosity')],
      note: '',
    })
    const approved = approveRequestProgram(saved.state, filed.laboratoryToken, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(saved).revision,
    })
    expect(approved.status).toBe(200)
    const request = requestOf(approved)
    expect(request.status).toBe('approved')
    expect(request.customerOrganizationId).toBe(101)
    expect(request.executorOrganizationId).toBe(101)
    expect(request.details?.programMeta.approval).toBe('approved')
    expect(request.details?.programMeta.preparedBy).toBe('laboratory')
    expect(request.events.some((event) => event.type === 'program_submitted')).toBe(false)
    expect(approved.state.requests?.filter((item) => item.id === filed.id)).toHaveLength(1)
  })
})
