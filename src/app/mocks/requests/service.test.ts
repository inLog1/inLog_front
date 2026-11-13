import { describe, expect, it } from 'vitest'
import { can } from '../../../entities/access/model/grants'
import { emptyRequestDraft, inspectRequestDraft, isAuthoredBy, isFiledByOrganization, isIncomingSent, requestMatchesTab, requestRegistryStats, type RequestDraftDetails, type RequestStatus } from '../../../entities/request'
import { loginWithPassword, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD, MOCK_SCHEMA_VERSION } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { readCorporateOverview } from '../personnel/overview'
import { requestDraftCatalogIds } from './catalog'
import {
  createRequest,
  deleteRequest,
  deriveRequest,
  listExecutorLaboratories,
  listRequestCatalog,
  listRequests,
  readRequest,
  readRequestBasisContent,
  rejectRequest,
  returnRequest,
  sendRequest,
  startRequestReview,
  updateRequest,
  uploadRequestBasis,
  withdrawRequest,
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
      number: string
      customerOrganizationId: number
      executorOrganizationId: number
      authorId: number
      status: string
      revision: number
      title: string
      basisDocument?: { id: string; filename: string } | null
      returnReason?: string
      rejectionReason?: string
      sourceRequestId?: string
    }
  }).request
}

function listed(result: { body: unknown }) {
  return (result.body as { requests: Array<{ id: string; status: RequestStatus; authorId: number; customerOrganizationId: number; executorOrganizationId: number }> }).requests
}

describe('request mock service', () => {
  it('lets a customer create one draft for a laboratory when create is granted', () => {
    const before = createSeed()
    const organizations = before.organizations.map((item) => ({ ...item }))
    const customer = session('customer@example.test', before)
    const created = createRequest(customer.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      title: 'Новая проба',
    })
    expect(created.status).toBe(201)
    const request = requestOf(created)
    expect(request.customerOrganizationId).toBe(201)
    expect(request.executorOrganizationId).toBe(101)
    expect(request.authorId).toBe(5)
    expect(request.status).toBe('draft')
    expect(created.state.requests?.filter((item) => item.id === request.id)).toHaveLength(1)
    expect(created.state.organizations).toEqual(organizations)
    expect(created.state.memberships).toEqual(before.memberships)
  })

  it('lets a laboratory create one request to itself when create is granted', () => {
    const laboratory = session('admin.a@example.test')
    const before = laboratory.state.requests?.length ?? 0
    const created = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      title: 'Своя заявка',
    })
    expect(created.status).toBe(201)
    const request = requestOf(created)
    expect(request.customerOrganizationId).toBe(request.executorOrganizationId)
    expect(request.customerOrganizationId).toBe(101)
    expect(request.authorId).toBe(2)
    expect(created.state.requests?.filter((item) =>
      item.customerOrganizationId === 101 && item.executorOrganizationId === 101 && item.id === request.id,
    )).toHaveLength(1)
    expect(created.state.requests).toHaveLength(before + 1)
  })

  it('lets a laboratory name another laboratory or a customer while it remains a party', () => {
    const laboratory = session('admin.a@example.test')
    const otherLaboratory = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 102,
    })
    expect(otherLaboratory.status).toBe(201)
    expect(requestOf(otherLaboratory).customerOrganizationId).toBe(101)
    expect(requestOf(otherLaboratory).executorOrganizationId).toBe(102)
    const asExecutor = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      customerOrganizationId: 201,
    })
    expect(asExecutor.status).toBe(201)
    expect(requestOf(asExecutor).customerOrganizationId).toBe(201)
    expect(requestOf(asExecutor).executorOrganizationId).toBe(101)
    const opened = readRequest(asExecutor.state, laboratory.token, 101, requestOf(asExecutor).id)
    expect(opened.status).toBe(200)
    const customer = session('customer@example.test', asExecutor.state)
    const hidden = readRequest(customer.state, customer.token, 201, requestOf(asExecutor).id)
    expect(hidden.status).toBe(404)
    const neither = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 102,
      customerOrganizationId: 201,
    })
    expect(neither.status).toBe(400)
    expect(codeOf(neither)).toBe('foreign_party')
  })

  it('refuses create and read when those grants are absent', () => {
    const employee = session('employee.a@example.test')
    const created = createRequest(employee.state, employee.token, {
      organizationId: 101,
      executorOrganizationId: 101,
    })
    expect(created.status).toBe(403)
    const opened = readRequest(employee.state, employee.token, 101, 'req-lab-self')
    expect(opened.status).toBe(403)
    expect(codeOf(opened)).toBe('forbidden')
  })

  it('does not let a grant on one organization open another organization', () => {
    const customer = session('customer@example.test')
    const abroad = listRequests(customer.state, customer.token, 101)
    expect(abroad.status).toBe(403)
    const home = listRequests(customer.state, customer.token, 201)
    expect(home.status).toBe(200)
    expect(listed(home).every((item) => item.customerOrganizationId === 201)).toBe(true)
    expect(listed(home).some((item) => item.id === 'req-lab-self')).toBe(false)

    const seed = createSeed()
    const projectScope = { type: 'project' as const, projectId: 1001, organizationId: 101, corporationId: 1 }
    const narrowed: MockState = {
      ...seed,
      roles: [...seed.roles, {
        id: 'role-project-requests',
        displayName: 'Заявки проекта',
        grantIds: ['g-requests-read', 'g-requests-create'],
        delegationGrantIds: [],
        ownerScope: projectScope,
      }],
      assignments: [...seed.assignments, {
        id: 'asg-project-requests',
        userId: 7,
        roleId: 'role-project-requests',
        scope: projectScope,
      }],
    }
    const projectOnly = session('project.only@example.test', narrowed)
    expect(listRequests(projectOnly.state, projectOnly.token, 101).status).toBe(403)
    expect(createRequest(projectOnly.state, projectOnly.token, {
      organizationId: 101,
      executorOrganizationId: 101,
    }).status).toBe(403)
  })

  it('keeps a customer draft out of the laboratory incoming list', () => {
    const laboratory = session('admin.a@example.test')
    const rows = listRequests(laboratory.state, laboratory.token, 101)
    expect(rows.status).toBe(200)
    const visible = listed(rows)
    expect(visible.some((item) => item.id === 'req-customer-draft')).toBe(false)
    expect(visible.some((item) => item.id === 'req-customer-sent')).toBe(true)
    const draft = laboratory.state.requests?.find((item) => item.id === 'req-customer-draft')
    const sent = laboratory.state.requests?.find((item) => item.id === 'req-customer-sent')
    expect(draft && isIncomingSent(draft, 101)).toBe(false)
    expect(sent && isIncomingSent(sent, 101)).toBe(true)
    const ownSent = visible.find((item) => item.id === 'req-lab-self')
    const ownDraft = visible.find((item) => item.id === 'req-lab-draft')
    const scope = { organizationId: 101, userId: 2 }
    expect(ownSent && isIncomingSent(ownSent, 101)).toBe(true)
    expect(ownDraft && isIncomingSent(ownDraft, 101)).toBe(false)
    expect(ownSent && requestMatchesTab(ownSent, 'incoming', scope)).toBe(true)
    expect(ownSent && requestMatchesTab(ownSent, 'filed', scope)).toBe(true)
    expect(ownDraft && requestMatchesTab(ownDraft, 'incoming', scope)).toBe(false)
    expect(ownDraft && requestMatchesTab(ownDraft, 'filed', scope)).toBe(true)
    expect(ownSent && isFiledByOrganization(ownSent, 101)).toBe(true)
    expect(readRequest(laboratory.state, laboratory.token, 101, 'req-customer-draft').status).toBe(404)
    const mine = visible.filter((item) => isAuthoredBy(item, 2))
    expect(mine.map((item) => item.id).sort()).toEqual(['req-lab-draft', 'req-lab-self'])
    const body = rows.body as { organizationKind?: string; requests: unknown[] }
    expect(body.organizationKind).toBe('laboratory')
    expect(JSON.stringify(body)).not.toContain('inn')
    expect(JSON.stringify(body)).not.toContain('address')
    expect(requestRegistryStats(visible).total).toBe(visible.length)
    expect(requestRegistryStats([...visible, ...visible]).total).toBe(visible.length)
    expect(visible.some((item) => item.id === 'req-customer-draft')).toBe(false)
  })

  it('updates only a visible draft and leaves organization records unchanged', () => {
    const before = createSeed()
    const customer = session('customer@example.test', before)
    const saved = updateRequest(customer.state, customer.token, 'req-customer-draft', {
      organizationId: 201,
      expectedRevision: 1,
      title: 'Уточнённый черновик',
      executorOrganizationId: 102,
    })
    expect(saved.status).toBe(200)
    const request = requestOf(saved)
    expect(request.revision).toBe(2)
    expect(request.title).toBe('Уточнённый черновик')
    expect(request.executorOrganizationId).toBe(102)
    expect(request.customerOrganizationId).toBe(201)
    expect(request.status).toBe('draft')
    const sent = updateRequest(saved.state, customer.token, 'req-customer-sent', {
      organizationId: 201,
      expectedRevision: 1,
      title: 'Нельзя',
    })
    expect(sent.status).toBe(409)
    expect(codeOf(sent)).toBe('not_draft')
    expect(saved.state.organizations).toEqual(before.organizations)
    expect(saved.state.projects).toEqual(before.projects)
  })

  it('lists executor laboratories without their requisites', () => {
    const customer = session('customer@example.test')
    expect(can(toSnapshot(customer.state), 5, 'organizations', 'read', {
      type: 'organization',
      organizationId: 101,
      corporationId: 1,
    })).toBe(false)
    const listedLabs = listExecutorLaboratories(customer.state, customer.token, 201)
    expect(listedLabs.status).toBe(200)
    const body = listedLabs.body as { laboratories: Array<Record<string, unknown>> }
    expect(body.laboratories).toEqual([
      { id: 101, shortName: 'Лаб. А' },
      { id: 102, shortName: 'Лаб. Б' },
    ])
    expect(JSON.stringify(body)).not.toContain('address')
    expect(JSON.stringify(body)).not.toContain('inn')
    const laboratory = session('admin.a@example.test')
    const own = listExecutorLaboratories(laboratory.state, laboratory.token, 101)
    const ownBody = own.body as { laboratories: { id: number }[]; customers: { id: number }[] }
    expect(ownBody.laboratories.map((item) => item.id)).toEqual([101, 102])
    expect(ownBody.customers.map((item) => item.id)).toEqual([101, 201])
    const employee = session('employee.a@example.test')
    expect(listExecutorLaboratories(employee.state, employee.token, 101).status).toBe(403)
  })

  it('counts stored requests and ignores the legacy list once the collection exists', () => {
    const seed = createSeed()
    const owner = session('owner@example.test', seed)
    const view = readCorporateOverview(owner.state, owner.token)
    const organizations = (view.body as { organizations: Array<{ id: number; requestCount: number }> }).organizations
    expect(organizations.find((item) => item.id === 101)?.requestCount).toBe(4)
    expect(organizations.find((item) => item.id === 201)?.requestCount).toBe(2)
    expect(organizations.find((item) => item.id === 102)?.requestCount).toBe(0)
    const mixed = readCorporateOverview({
      ...owner.state,
      serviceRequests: [{ id: 'legacy', organizationId: 102, status: 'new' }],
    }, owner.token)
    const mixedRows = (mixed.body as { organizations: Array<{ id: number; requestCount: number }> }).organizations
    expect(mixedRows.find((item) => item.id === 102)?.requestCount).toBe(0)
    const legacyState = { ...owner.state }
    delete legacyState.requests
    const legacy = readCorporateOverview({
      ...legacyState,
      serviceRequests: [{ id: 'legacy', organizationId: 102, status: 'new' }],
    }, owner.token)
    const legacyRows = (legacy.body as { organizations: Array<{ id: number; requestCount: number }> }).organizations
    expect(legacyRows.find((item) => item.id === 102)?.requestCount).toBe(1)
    expect(legacyRows.find((item) => item.id === 101)?.requestCount).toBe(0)
  })

  it('adds the new grant rows on migration without rewriting stored roles or organizations', () => {
    const seed = createSeed()
    const snapshot: MockState = {
      ...seed,
      schemaVersion: 13,
      grants: seed.grants.filter((grant) => grant.action === 'read' || grant.action === 'create' || grant.resource !== 'requests'),
      roles: seed.roles.map((role) => {
        if (role.id === 'role-customer') return { ...role, grantIds: ['g-requests-read', 'g-requests-create'] }
        if (role.id === 'role-lab-admin') {
          return { ...role, grantIds: role.grantIds.filter((id) => !id.startsWith('g-requests')) }
        }
        return role
      }),
    }
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(migrated?.state.roles.find((role) => role.id === 'role-customer')?.grantIds).toEqual(['g-requests-read', 'g-requests-create'])
    expect(migrated?.state.roles.find((role) => role.id === 'role-lab-admin')?.grantIds.some((id) => id.startsWith('g-requests'))).toBe(false)
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-requests-accept')).toBe(true)
    expect(migrated?.state.organizations).toEqual(seed.organizations)
    expect(migrated?.state.requests).toEqual(seed.requests)
  })

  it('does not grant request access from a role display name', () => {
    const seed = createSeed()
    const renamed: MockState = {
      ...seed,
      roles: seed.roles.map((role) => role.id === 'role-customer'
        ? { ...role, displayName: 'Заказчик', grantIds: [] }
        : role),
    }
    const namedOnly = session('customer@example.test', renamed)
    expect(createRequest(namedOnly.state, namedOnly.token, {
      organizationId: 201,
      executorOrganizationId: 101,
    }).status).toBe(403)
    const granted = session('employee.a@example.test', {
      ...seed,
      roles: [...seed.roles, {
        id: 'role-lab-filer',
        displayName: 'Сотрудник',
        grantIds: ['g-requests-create', 'g-requests-read', 'g-requests-update'],
        delegationGrantIds: [],
      }],
      assignments: [...seed.assignments, {
        id: 'asg-lab-filer',
        userId: 3,
        roleId: 'role-lab-filer',
        scope: { type: 'organization', organizationId: 101, corporationId: 1 },
      }],
    })
    const created = createRequest(granted.state, granted.token, {
      organizationId: 101,
      executorOrganizationId: 101,
    })
    expect(created.status).toBe(201)
    expect(requestOf(created).customerOrganizationId).toBe(101)
  })

  it('stores wizard details on the same draft and still opens a draft that has none', () => {
    const customer = session('customer@example.test')
    const details = emptyRequestDraft()
    details.projectName = 'Северное'
    details.contractNumber = 'Д-14'
    details.contractDate = '2026-11-01'
    details.contractUntil = '2026-12-01'
    details.plannedCompletion = '2026-12-20'
    details.subject.objectKind = 'core'
    details.subject.fieldId = 'field-north'
    details.subject.core.diameterMm = '30'
    details.program = [{
      id: 'line-1',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '2',
      demand: '',
      curatorId: 'curator-petrova',
      dueDate: '2026-12-10',
      code: '',
      note: '',
    }]
    details.sampleIds = ['sample-k104']
    const created = createRequest(customer.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details,
    })
    expect(created.status).toBe(201)
    const request = requestOf(created)
    expect(request.title).toBe('Северное')
    expect(request.customerOrganizationId).toBe(201)
    expect(request.executorOrganizationId).toBe(101)
    const stored = created.state.requests?.find((item) => item.id === request.id)
    expect(stored?.details?.program).toHaveLength(1)
    expect(stored?.details?.sampleIds).toEqual(['sample-k104'])
    const titled = updateRequest(created.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 1,
      title: 'Северное',
    })
    expect(titled.status).toBe(200)
    expect(titled.state.requests?.find((item) => item.id === request.id)?.details?.sampleIds).toEqual(['sample-k104'])
    const broken = emptyRequestDraft()
    broken.projectName = 'Северное'
    broken.program = [{ ...details.program[0], quantity: '-1' }]
    const rejected = updateRequest(titled.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 2,
      details: broken,
    })
    expect(rejected.status).toBe(400)
    expect(codeOf(rejected)).toBe('invalid_quantity')
    expect(rejected.state.requests?.find((item) => item.id === request.id)?.revision).toBe(2)
    const legacy = readRequest(customer.state, customer.token, 201, 'req-customer-draft')
    expect(legacy.status).toBe(200)
    expect(requestOf(legacy).title).toBe('Черновик заказчика')
    expect('details' in requestOf(legacy)).toBe(false)
    const employee = session('employee.a@example.test')
    expect(listRequestCatalog(employee.state, employee.token, 101).status).toBe(403)
    const catalog = listRequestCatalog(customer.state, customer.token, 201)
    expect(catalog.status).toBe(200)
    expect((catalog.body as { organizationKind?: string }).organizationKind).toBe('customer')
    expect(JSON.stringify(catalog.body)).not.toContain('inn')
  })

  it('stores several fields and one shared need without dropping revision checks', () => {
    const customer = session('customer@example.test')
    const details = studyDetails()
    const created = createRequest(customer.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details,
    })
    expect(created.status).toBe(201)
    const request = requestOf(created)
    expect(request.customerOrganizationId).toBe(201)
    expect(request.executorOrganizationId).toBe(101)
    expect(request.revision).toBe(1)
    expect(request.title).toBe('Пористость керна')
    const stored = created.state.requests?.find((item) => item.id === request.id)
    expect(stored?.details?.fields.map((field) => field.wells.map((well) => well.id))).toEqual([['well-101', 'well-102'], ['well-205']])
    expect(stored?.details?.needs[0]?.targets).toHaveLength(3)
    expect(stored?.details?.programMeta.authorUserId).toBeNull()
    const saved = updateRequest(created.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 1,
      details: stored?.details,
    })
    expect(saved.status).toBe(200)
    expect(requestOf(saved).revision).toBe(2)
    expect(saved.state.requests?.find((item) => item.id === request.id)?.details?.needs).toHaveLength(1)
    const stale = updateRequest(saved.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 1,
      title: 'Пористость керна',
    })
    expect(stale.status).toBe(409)
    expect(codeOf(stale)).toBe('stale_write')
    expect(stale.state.requests?.find((item) => item.id === request.id)?.revision).toBe(2)
    const broken = studyDetails()
    const interval = broken.fields[0]?.wells[0]?.intervals[0]
    if (!interval) throw new Error('missing interval')
    interval.to = 1000
    const rejected = updateRequest(saved.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 2,
      details: broken,
    })
    expect(rejected.status).toBe(400)
    expect(codeOf(rejected)).toBe('invalid_bounds')
    expect(rejected.state.requests?.find((item) => item.id === request.id)?.revision).toBe(2)
    const dangling = studyDetails()
    dangling.fields[0]?.wells.shift()
    const linked = updateRequest(saved.state, customer.token, request.id, {
      organizationId: 201,
      expectedRevision: 2,
      details: dangling,
    })
    expect(linked.status).toBe(400)
    expect(codeOf(linked)).toBe('invalid_link')
    const employee = session('employee.a@example.test')
    const denied = createRequest(employee.state, employee.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      details,
    })
    expect(denied.status).toBe(403)
    const laboratory = session('admin.a@example.test')
    const self = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      details,
    })
    expect(self.status).toBe(201)
    expect(requestOf(self).customerOrganizationId).toBe(101)
    expect(requestOf(self).executorOrganizationId).toBe(101)
    const otherExecutor = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 102,
      details,
    })
    expect(otherExecutor.status).toBe(201)
    expect(requestOf(otherExecutor).customerOrganizationId).toBe(101)
    const forCustomer = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      customerOrganizationId: 201,
      details,
    })
    expect(forCustomer.status).toBe(201)
    expect(requestOf(forCustomer).customerOrganizationId).toBe(201)
    const neither = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 102,
      customerOrganizationId: 201,
      details,
    })
    expect(neither.status).toBe(400)
    expect(codeOf(neither)).toBe('foreign_party')
    expect(neither.state.requests).toBe(laboratory.state.requests)
  })

  it('migrates an old draft in place and leaves title-only rows untouched', () => {
    const seed = createSeed()
    const snapshot: MockState = {
      ...seed,
      schemaVersion: 14,
      requests: seed.requests?.map((request) => request.id === 'req-customer-draft'
        ? { ...request, title: 'Северное', details: legacyDetails() }
        : request),
    }
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.changed).toBe(true)
    if (!migrated) return
    const draft = migrated.state.requests?.find((item) => item.id === 'req-customer-draft')
    expect(draft?.revision).toBe(1)
    expect(draft?.title).toBe('Северное')
    expect(draft?.customerOrganizationId).toBe(201)
    expect(draft?.executorOrganizationId).toBe(101)
    expect(draft?.details?.sampleIds).toEqual(['sample-k104'])
    expect(draft?.details?.program.map((line) => line.id)).toEqual(['line-1'])
    expect(draft?.details?.subject.core.diameterMm).toBe('30')
    expect(draft?.details?.fields).toHaveLength(1)
    expect(draft?.details?.needs).toHaveLength(1)
    expect(draft?.details?.needs[0]?.targets).toEqual([])
    expect(inspectRequestDraft(draft?.details, requestDraftCatalogIds()).ok).toBe(true)
    const sent = migrated.state.requests?.find((item) => item.id === 'req-customer-sent')
    expect(sent?.title).toBe('Проба грунта')
    expect(sent?.revision).toBe(1)
    expect(sent?.details).toBeUndefined()
    const again = migrateMockDocument(migrated.state)
    expect(again?.changed).toBe(false)
    expect(again?.state.requests?.find((item) => item.id === 'req-customer-draft')?.details?.fields).toHaveLength(1)
    expect(again?.state.requests?.find((item) => item.id === 'req-customer-draft')?.details?.needs).toHaveLength(1)
    const bare = { ...migrated.state }
    delete bare.requests
    const kept = migrateMockDocument(bare)
    expect(kept?.state.requests).toBeUndefined()
  })
})

function studyDetails(): RequestDraftDetails {
  const details = emptyRequestDraft()
  details.projectName = 'Пористость керна'
  details.contractNumber = 'Д-14'
  details.subject.objectKind = 'core'
  details.fields = [
    {
      id: 'field-a',
      catalogFieldId: 'field-north',
      fieldName: 'Месторождение А',
      wells: [
        {
          id: 'well-101',
          catalogWellId: 'well-12',
          wellName: '101',
          intervals: [{ id: 'int-101', from: 1200, to: 1210, unit: 'm' }],
        },
        { id: 'well-102', catalogWellId: '', wellName: '102', intervals: [] },
      ],
    },
    {
      id: 'field-b',
      catalogFieldId: 'field-east',
      fieldName: 'Месторождение Б',
      wells: [
        {
          id: 'well-205',
          catalogWellId: 'well-18',
          wellName: '205',
          intervals: [{ id: 'int-205', from: 1400, to: 1420, unit: 'm' }],
        },
      ],
    },
  ]
  details.needs = [{
    id: 'need-porosity',
    targets: [
      { wellId: 'well-101', selection: 'intervals', intervalIds: ['int-101'] },
      { wellId: 'well-102', selection: 'well', intervalIds: [] },
      { wellId: 'well-205', selection: 'intervals', intervalIds: ['int-205'] },
    ],
    researchId: 'work-porosity',
    desiredResult: 'Определить пористость керна',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
  }]
  return details
}

function legacyDetails(): RequestDraftDetails {
  const legacy = {
    projectName: 'Северное',
    contractNumber: 'Д-1',
    contractDate: '',
    contractUntil: '',
    workBasis: 'Договор',
    comment: '',
    plannedCompletion: '',
    subject: {
      objectKind: 'core' as const,
      fieldId: 'field-north',
      wellId: 'well-12',
      padId: '',
      formationId: '',
      objectNumber: '1',
      materialId: '',
      deliveryDate: '',
      note: '',
      core: { diameterMm: '30', recoveryPercent: '' },
      fluid: { fluidKindId: '', sampleVolumeMl: '' },
    },
    program: [{
      id: 'line-1',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '2',
      curatorId: '',
      dueDate: '',
      note: 'К-1',
    }],
    sampleIds: ['sample-k104'],
  }
  return legacy as unknown as RequestDraftDetails
}

function sendableDetails(): RequestDraftDetails {
  const details = emptyRequestDraft()
  details.projectName = 'Отправка'
  details.fields = [{
    id: 'field-1',
    catalogFieldId: 'field-north',
    fieldName: '',
    wells: [{ id: 'well-1', catalogWellId: 'well-12', wellName: '', intervals: [] }],
  }]
  details.needs = [{
    id: 'need-1',
    researchId: 'work-porosity',
    desiredResult: '',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
    targets: [{ wellId: 'well-1', selection: 'well', intervalIds: [] }],
  }]
  return details
}

describe('request send and basis document', () => {
  it('stores a basis file, sends the request and exposes it to the laboratory', () => {
    const customer = session('customer@example.test')
    const created = createRequest(customer.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: sendableDetails(),
    })
    expect(created.status).toBe(201)
    const id = requestOf(created).id
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
    const attached = uploadRequestBasis(created.state, customer.token, id, 201, {
      filename: 'basis.pdf',
      mimeType: 'application/pdf',
      bytes: pdf,
    })
    expect(attached.status).toBe(200)
    const withBasis = requestOf(attached)
    expect(withBasis.basisDocument?.filename).toBe('basis.pdf')
    const sent = sendRequest(attached.state, customer.token, id, {
      organizationId: 201,
      expectedRevision: withBasis.revision,
    })
    expect(sent.status).toBe(200)
    const record = requestOf(sent)
    expect(record.status).toBe('sent')
    expect(sent.state.requestEvents?.some((item) => item.requestId === id && item.type === 'sent')).toBe(true)
    const laboratory = session('admin.a@example.test', sent.state)
    const incoming = listRequests(laboratory.state, laboratory.token, 101)
    expect(incoming.status).toBe(200)
    expect(listed(incoming).some((item) => item.id === id && item.status === 'sent')).toBe(true)
    const denied = readRequestBasisContent(customer.state, customer.token, id, withBasis.basisDocument!.id, 102)
    expect(denied.status).toBe(404)
    const allowed = readRequestBasisContent(laboratory.state, laboratory.token, id, withBasis.basisDocument!.id, 101)
    expect(allowed.status).toBe(200)
    expect(allowed.bytes?.byteLength).toBe(pdf.byteLength)
  })

  it('refuses send without a basis document and refuses a second send', () => {
    const customer = session('customer@example.test')
    const created = createRequest(customer.state, customer.token, {
      organizationId: 201,
      executorOrganizationId: 101,
      details: sendableDetails(),
    })
    const id = requestOf(created).id
    const failed = sendRequest(created.state, customer.token, id, {
      organizationId: 201,
      expectedRevision: requestOf(created).revision,
    })
    expect(failed.status).toBe(400)
    expect(codeOf(failed)).toBe('not_ready')
  })
})

function sentRequest(state?: MockState, details: RequestDraftDetails = sendableDetails()) {
  const customer = session('customer@example.test', state)
  const created = createRequest(customer.state, customer.token, {
    organizationId: 201,
    executorOrganizationId: 101,
    details,
  })
  const id = requestOf(created).id
  const attached = uploadRequestBasis(created.state, customer.token, id, 201, {
    filename: 'basis.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  })
  const sent = sendRequest(attached.state, customer.token, id, {
    organizationId: 201,
    expectedRevision: requestOf(attached).revision,
  })
  return { state: sent.state, id, customerToken: customer.token, revision: requestOf(sent).revision, number: requestOf(sent).number }
}

function recordOf(state: MockState, id: string) {
  const request = state.requests?.find((item) => item.id === id)
  if (!request) throw new Error(id)
  return request
}

describe('request laboratory review', () => {
  it('lets the laboratory start a review and refuses the customer, a repeat and a stale revision', () => {
    const filed = sentRequest()
    const laboratory = session('admin.a@example.test', filed.state)
    const incoming = listRequests(laboratory.state, laboratory.token, 101)
    expect(listed(incoming).some((item) => item.id === filed.id && item.status === 'sent')).toBe(true)
    const customerAttempt = startRequestReview(filed.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: filed.revision,
    })
    expect(customerAttempt.status).toBe(403)
    expect(recordOf(customerAttempt.state, filed.id).status).toBe('sent')
    const employee = session('employee.a@example.test', filed.state)
    const employeeAttempt = startRequestReview(employee.state, employee.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(employeeAttempt.status).toBe(403)
    const stale = startRequestReview(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision + 5,
    })
    expect(stale.status).toBe(409)
    expect(codeOf(stale)).toBe('stale_write')
    expect(recordOf(stale.state, filed.id).status).toBe('sent')
    const started = startRequestReview(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(started.status).toBe(200)
    expect(requestOf(started).status).toBe('in_review')
    expect(requestOf(started).revision).toBe(filed.revision + 1)
    expect(started.state.requestEvents?.some((item) => item.requestId === filed.id && item.type === 'review_started' && item.previousStatus === 'sent' && item.newStatus === 'in_review')).toBe(true)
    const again = startRequestReview(started.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
    })
    expect(again.status).toBe(409)
    expect(codeOf(again)).toBe('invalid_status')
    const withdrawn = withdrawRequest(started.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(started).revision,
    })
    expect(withdrawn.status).toBe(409)
    expect(codeOf(withdrawn)).toBe('invalid_status')
    expect(recordOf(withdrawn.state, filed.id).status).toBe('in_review')
  })

  it('lets the customer withdraw a sent request and refuses the laboratory', () => {
    const filed = sentRequest()
    const laboratory = session('admin.a@example.test', filed.state)
    const laboratoryAttempt = withdrawRequest(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(laboratoryAttempt.status).toBe(403)
    expect(codeOf(laboratoryAttempt)).toBe('not_customer')
    const withdrawn = withdrawRequest(filed.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: filed.revision,
    })
    expect(withdrawn.status).toBe(200)
    expect(requestOf(withdrawn).status).toBe('withdrawn')
    const edited = updateRequest(withdrawn.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(withdrawn).revision,
      title: 'После отзыва',
    })
    expect(edited.status).toBe(409)
    expect(codeOf(edited)).toBe('not_draft')
    expect(withdrawn.state.requestEvents?.some((item) => item.requestId === filed.id && item.type === 'withdrawn')).toBe(true)
  })

  it('returns a request only with a reason, lets an authorized colleague correct it and resends the same number', () => {
    const filed = sentRequest()
    const laboratory = session('admin.a@example.test', filed.state)
    const started = startRequestReview(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    const blank = returnRequest(started.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
      reason: '   ',
    })
    expect(blank.status).toBe(400)
    expect(codeOf(blank)).toBe('reason_required')
    expect(recordOf(blank.state, filed.id).status).toBe('in_review')
    const returned = returnRequest(started.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
      reason: 'Укажите интервал',
    })
    expect(returned.status).toBe(200)
    expect(requestOf(returned).status).toBe('rework')
    const seen = readRequest(returned.state, filed.customerToken, 201, filed.id)
    expect(seen.status).toBe(200)
    expect(requestOf(seen).returnReason).toBe('Укажите интервал')
    const laboratoryEdit = updateRequest(returned.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(returned).revision,
      title: 'Чужая правка',
    })
    expect(laboratoryEdit.status).toBe(409)
    expect(codeOf(laboratoryEdit)).toBe('not_draft')
    const stranger = session('pending@example.test', returned.state)
    const denied = updateRequest(stranger.state, stranger.token, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(returned).revision,
      title: 'Без права',
    })
    expect(denied.status).toBe(403)
    const colleagueState: MockState = {
      ...returned.state,
      memberships: [...returned.state.memberships, { id: 'mem-6-201', userId: 6, organizationId: 201, kind: 'customer' }],
      assignments: [...returned.state.assignments, {
        id: 'asg-customer-colleague',
        userId: 6,
        roleId: 'role-customer',
        scope: { type: 'organization', organizationId: 201, corporationId: 1 },
      }],
    }
    const colleague = session('pending@example.test', colleagueState)
    const details = structuredClone(recordOf(colleague.state, filed.id).details)
    if (!details) throw new Error('details')
    details.comment = 'Интервал добавлен'
    const corrected = updateRequest(colleague.state, colleague.token, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(returned).revision,
      details,
    })
    expect(corrected.status).toBe(200)
    expect(recordOf(corrected.state, filed.id).authorId).toBe(5)
    expect(recordOf(corrected.state, filed.id).details?.comment).toBe('Интервал добавлен')
    const resent = sendRequest(corrected.state, colleague.token, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(corrected).revision,
      details,
    })
    expect(resent.status).toBe(200)
    expect(requestOf(resent).status).toBe('sent')
    expect(requestOf(resent).id).toBe(filed.id)
    expect(requestOf(resent).number).toBe(filed.number)
    expect(resent.state.requestEvents?.filter((item) => item.requestId === filed.id).map((item) => item.type)).toEqual([
      'sent', 'review_started', 'returned', 'resent',
    ])
  })

  it('rejects only with a reason and opens a new draft without the old history or the private file', () => {
    const details = studyDetails()
    details.program = [{
      id: 'line-porosity',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '2',
      demand: '',
      curatorId: '',
      dueDate: '',
      code: '',
      note: '',
    }]
    details.needs[0]!.legacyLineId = 'line-porosity'
    details.programMeta = { ...details.programMeta, authorUserId: 5, preparedBy: 'customer', approval: 'unspecified' }
    const filed = sentRequest(undefined, details)
    const laboratory = session('admin.a@example.test', filed.state)
    const started = startRequestReview(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    const blank = rejectRequest(started.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
      reason: '',
    })
    expect(blank.status).toBe(400)
    expect(codeOf(blank)).toBe('reason_required')
    const rejected = rejectRequest(started.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: requestOf(started).revision,
      reason: 'Объект вне области',
    })
    expect(rejected.status).toBe(200)
    expect(requestOf(rejected).status).toBe('rejected')
    const seen = readRequest(rejected.state, filed.customerToken, 201, filed.id)
    expect(requestOf(seen).rejectionReason).toBe('Объект вне области')
    const edited = updateRequest(rejected.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(rejected).revision,
      title: 'После отклонения',
    })
    expect(edited.status).toBe(409)
    expect(codeOf(edited)).toBe('not_draft')
    const early = deriveRequest(filed.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: filed.revision,
    })
    expect(early.status).toBe(409)
    expect(codeOf(early)).toBe('not_derivable')
    const derived = deriveRequest(rejected.state, filed.customerToken, filed.id, {
      organizationId: 201,
      expectedRevision: requestOf(rejected).revision,
    })
    expect(derived.status).toBe(201)
    const copy = requestOf(derived)
    expect(copy.status).toBe('draft')
    expect(copy.id).not.toBe(filed.id)
    expect(copy.number).not.toBe(filed.number)
    expect(copy.sourceRequestId).toBe(filed.id)
    expect(copy.basisDocument).toBeNull()
    const source = recordOf(derived.state, filed.id)
    const created = recordOf(derived.state, copy.id)
    expect(created.basisFileId).toBeUndefined()
    expect(source.basisFileId).toBeTruthy()
    expect(created.details?.programMeta.authorUserId).toBeNull()
    const sourceWell = source.details?.fields[0]?.wells[0]
    const copyWell = created.details?.fields[0]?.wells[0]
    const copyNeed = created.details?.needs[0]
    expect(copyWell?.id).toBeTruthy()
    expect(copyWell?.id).not.toBe(sourceWell?.id)
    expect(copyNeed?.targets[0]?.wellId).toBe(copyWell?.id)
    expect(copyNeed?.targets[0]?.intervalIds[0]).toBe(copyWell?.intervals[0]?.id)
    expect(copyNeed?.legacyLineId).toBe(created.details?.program[0]?.id)
    expect(created.details?.program[0]?.id).not.toBe(source.details?.program[0]?.id)
    const sourceEvents = derived.state.requestEvents?.filter((item) => item.requestId === filed.id) ?? []
    const copyEvents = derived.state.requestEvents?.filter((item) => item.requestId === copy.id) ?? []
    expect(sourceEvents.map((item) => item.type)).toContain('rejected')
    expect(copyEvents.map((item) => item.type)).toEqual(['derived'])
    expect(copyEvents[0]?.comment).toBe(filed.number)
    expect(copyEvents.some((item) => sourceEvents.some((sourceEvent) => sourceEvent.id === item.id))).toBe(false)
  })

  it('reviews a laboratory request to itself without creating a second record or skipping sent', () => {
    const laboratory = session('admin.a@example.test')
    const created = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      details: sendableDetails(),
    })
    const id = requestOf(created).id
    const attached = uploadRequestBasis(created.state, laboratory.token, id, 101, {
      filename: 'own.pdf',
      mimeType: 'application/pdf',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })
    const sent = sendRequest(attached.state, laboratory.token, id, {
      organizationId: 101,
      expectedRevision: requestOf(attached).revision,
    })
    expect(requestOf(sent).status).toBe('sent')
    expect(sent.state.requests?.filter((item) => item.id === id)).toHaveLength(1)
    const started = startRequestReview(sent.state, laboratory.token, id, {
      organizationId: 101,
      expectedRevision: requestOf(sent).revision,
    })
    expect(requestOf(started).status).toBe('in_review')
    expect(started.state.requests?.filter((item) => item.customerOrganizationId === 101 && item.executorOrganizationId === 101 && item.id === id)).toHaveLength(1)
    const scope = { organizationId: 101, userId: 2 }
    const row = recordOf(started.state, id)
    expect(requestMatchesTab(row, 'incoming', scope)).toBe(true)
    expect(requestMatchesTab(row, 'inProgress', scope)).toBe(true)
    const reader = session('admin.a@example.test')
    const opened = readRequest(reader.state, reader.token, 101, 'req-customer-sent')
    expect(opened.status).toBe(200)
    expect(requestOf(opened).number).toBe('RQ-0001')
    const registry = listRequests(reader.state, reader.token, 101)
    expect(listed(registry).some((item) => item.id === 'req-customer-sent')).toBe(true)
    expect(listed(registry).some((item) => item.id === 'req-lab-self')).toBe(true)
  })
})

describe('request deletion', () => {
  it('removes a sent request for both parties, including its file and history', () => {
    const filed = sentRequest()
    const laboratory = session('admin.a@example.test', filed.state)
    const started = startRequestReview(laboratory.state, laboratory.token, filed.id, {
      organizationId: 101,
      expectedRevision: filed.revision,
    })
    expect(requestOf(started).status).toBe('in_review')
    const blocked = deleteRequest(started.state, laboratory.token, filed.id, 101)
    expect(blocked.status).toBe(403)
    expect(codeOf(blocked)).toBe('not_filer')
    expect(recordOf(blocked.state, filed.id).status).toBe('in_review')
    const removed = deleteRequest(blocked.state, filed.customerToken, filed.id, 201)
    expect(removed.status).toBe(200)
    expect((removed.body as { id: string }).id).toBe(filed.id)
    expect(removed.state.requests?.some((item) => item.id === filed.id)).toBe(false)
    expect(removed.state.requestEvents?.some((item) => item.requestId === filed.id)).toBe(false)
    expect(removed.state.requestBasisFiles?.some((item) => item.requestId === filed.id)).toBe(false)
    expect(readRequest(removed.state, filed.customerToken, 201, filed.id).status).toBe(404)
    expect(readRequest(removed.state, laboratory.token, 101, filed.id).status).toBe(404)
    const owner = session('owner@example.test', removed.state)
    const view = readCorporateOverview(owner.state, owner.token)
    const organizations = (view.body as { organizations: Array<{ id: number; requestCount: number }> }).organizations
    expect(organizations.find((item) => item.id === 201)?.requestCount).toBe(2)
    expect(organizations.find((item) => item.id === 101)?.requestCount).toBe(4)
  })

  it('lets the filing laboratory delete its draft and hides that draft from the customer', () => {
    const laboratory = session('admin.a@example.test')
    const created = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      customerOrganizationId: 201,
      title: 'От лаборатории',
    })
    const id = requestOf(created).id
    const customer = session('customer@example.test', created.state)
    const hidden = deleteRequest(customer.state, customer.token, id, 201)
    expect(hidden.status).toBe(404)
    expect(codeOf(hidden)).toBe('not_found')
    expect(hidden.state.requests?.some((item) => item.id === id)).toBe(true)
    const removed = deleteRequest(hidden.state, laboratory.token, id, 101)
    expect(removed.status).toBe(200)
    expect(removed.state.requests?.some((item) => item.id === id)).toBe(false)
  })

  it('refuses deletion without the update grant and leaves the row in place', () => {
    const seed = createSeed()
    const narrowed: MockState = {
      ...seed,
      roles: seed.roles.map((role) => role.id === 'role-customer'
        ? { ...role, grantIds: role.grantIds.filter((id) => id !== 'g-requests-update') }
        : role),
    }
    const reader = session('customer@example.test', narrowed)
    const denied = deleteRequest(reader.state, reader.token, 'req-customer-draft', 201)
    expect(denied.status).toBe(403)
    expect(codeOf(denied)).toBe('forbidden')
    expect(denied.state.requests?.some((item) => item.id === 'req-customer-draft')).toBe(true)
    const missing = deleteRequest(reader.state, reader.token, 'req-missing', 201)
    expect(missing.status).toBe(404)
    const unknownOrganization = deleteRequest(reader.state, reader.token, 'req-customer-draft', 999)
    expect(unknownOrganization.status).toBe(404)
  })
})
