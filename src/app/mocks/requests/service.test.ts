import { describe, expect, it } from 'vitest'
import { can } from '../../../entities/access/model/grants'
import { emptyRequestDraft, isAuthoredBy, isFiledByOrganization, isIncomingSent, requestMatchesTab, requestRegistryStats, type RequestStatus } from '../../../entities/request'
import { loginWithPassword, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD, MOCK_SCHEMA_VERSION } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { readCorporateOverview } from '../personnel/overview'
import {
  createRequest,
  listExecutorLaboratories,
  listRequestCatalog,
  listRequests,
  readRequest,
  updateRequest,
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
  return (result.body as { request: { id: string; number: string; customerOrganizationId: number; executorOrganizationId: number; authorId: number; status: string; revision: number; title: string } }).request
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

  it('refuses a laboratory request filed for another organization', () => {
    const laboratory = session('admin.a@example.test')
    const otherLaboratory = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 102,
    })
    expect(otherLaboratory.status).toBe(400)
    expect(codeOf(otherLaboratory)).toBe('foreign_party')
    const asCustomer = createRequest(laboratory.state, laboratory.token, {
      organizationId: 101,
      executorOrganizationId: 101,
      customerOrganizationId: 201,
    })
    expect(asCustomer.status).toBe(400)
    expect(codeOf(asCustomer)).toBe('foreign_party')
    expect(asCustomer.state.requests).toBe(laboratory.state.requests)
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
    expect((own.body as { laboratories: { id: number }[] }).laboratories.map((item) => item.id)).toEqual([101])
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
})
