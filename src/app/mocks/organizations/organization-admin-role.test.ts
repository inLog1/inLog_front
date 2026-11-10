import { indexedDB } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { sectionAccess, sectionByPath, visibleNavigation } from '../../navigation/catalog'
import { can, capabilityFromRoleDisplayName, effectiveGrants, hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import { emptyRequestDraft, requestMatchesTab, type RequestDraftDetails } from '../../../entities/request'
import { createAssignment, deleteRole, readDirectory as readAccessDirectory } from '../access/service'
import { loginWithPassword, switchUser, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createEmptyInstallation } from '../db/empty-installation'
import { migrateMockDocument } from '../db/migrate'
import { ensureMockState, readMockState, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import {
  REQUEST_CUSTOMER_ADMINISTRATOR_GRANT_IDS,
  REQUEST_LABORATORY_ADMINISTRATOR_GRANT_IDS,
} from '../db/request-grants'
import { configureInstallation, createOrganization } from '../installation/service'
import {
  createRequest,
  listRequests,
  sendRequest,
  startRequestReview,
  uploadRequestBasis,
} from '../requests/service'
import { readDirectory, updateOrganizationRecord } from './service'
import {
  ORGANIZATION_ADMINISTRATOR_GRANTS,
  ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
  ensureOrganizationAdministrator,
  organizationAdministratorGrants,
  organizationAdministratorLabel,
} from './organization-admin-role'

const draft = {
  corporationName: 'Север',
  givenName: 'Алина',
  surname: 'Власова',
  email: 'owner@personal.test',
  salt: 'salt',
  hash: 'hash',
}

function readyInstallation() {
  return configureInstallation(createEmptyInstallation('personal-memory'), draft)
}

function tokenFor(state: ReturnType<typeof readyInstallation>) {
  const issued = switchUser(state, 1)
  const token = issued.body && typeof issued.body === 'object' && 'access_token' in issued.body
    ? String(issued.body.access_token)
    : ''
  return { state: issued.state, token }
}

const organizationInput = {
  fullName: 'Лаборатория Север',
  shortName: 'Север',
  address: 'Полевая, 1',
  kind: 'laboratory' as const,
}

describe('organization administrator role', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
  })

  it('creates one unassigned role atomically and keeps a second organization independent', () => {
    const ready = readyInstallation()
    const beforeRoles = ready.roles.length
    const created = createOrganization(ready, 1, organizationInput)
    if (!('organization' in created)) throw new Error('organization')
    const roles = created.state.roles.filter((role) => role.ownerScope?.type === 'organization' && role.ownerScope.organizationId === created.organization.id)
    expect(roles).toHaveLength(1)
    expect(created.state.roles).toHaveLength(beforeRoles + 1)
    expect(roles[0]).toMatchObject({
      displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
      grantIds: ORGANIZATION_ADMINISTRATOR_GRANTS.map((grant) => grant.id),
      delegationGrantIds: ORGANIZATION_ADMINISTRATOR_GRANTS.map((grant) => grant.id),
      ownerScope: {
        type: 'organization',
        organizationId: created.organization.id,
        corporationId: ready.installationCorporationId,
      },
    })
    expect(roles[0]?.grantIds).not.toContain('g-organizations-create')
    expect(created.state.assignments).toEqual(ready.assignments)
    expect(created.state.users).toEqual(ready.users)
    expect(created.state.systemCapabilities).toEqual(ready.systemCapabilities)
    expect(created.state.accessVersion).toBe(ready.accessVersion + 1)
    expect(created.state.accessAudit?.at(-1)).toMatchObject({ action: 'role.create', roleId: roles[0]?.id, actorId: 1 })

    const opened = tokenFor(created.state)
    const listed = readAccessDirectory(opened.state, opened.token, {
      scope: null,
      organization: String(created.organization.id),
    })
    expect(listed.status).toBe(200)
    expect(listed.state.roles).toHaveLength(created.state.roles.length)
    const again = readDirectory(opened.state, opened.token)
    expect(again.state.roles).toHaveLength(created.state.roles.length)

    const second = createOrganization(created.state, 1, {
      fullName: 'Лаборатория Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'laboratory',
    })
    if (!('organization' in second)) throw new Error('second')
    const firstRole = second.state.roles.find((role) => role.id === roles[0]?.id)
    const secondRole = second.state.roles.find((role) =>
      role.ownerScope?.type === 'organization' && role.ownerScope.organizationId === second.organization.id,
    )
    expect(firstRole?.displayName).toBe(ORGANIZATION_ADMINISTRATOR_ROLE_NAME)
    expect(secondRole?.displayName).toBe(ORGANIZATION_ADMINISTRATOR_ROLE_NAME)
    expect(secondRole?.id).not.toBe(firstRole?.id)
    expect(second.state.assignments).toEqual(ready.assignments)
    const openedAll = tokenFor(second.state)
    const every = readAccessDirectory(openedAll.state, openedAll.token, {
      scope: null,
      organization: 'all',
    })
    expect(every.status).toBe(200)
    const listedIds = ((every.body as { roles: Array<{ id: string }> }).roles).map((role) => role.id)
    expect(listedIds).toContain(firstRole?.id)
    expect(listedIds).toContain(secondRole?.id)

    const scopeA = { type: 'organization' as const, organizationId: created.organization.id, corporationId: 1 }
    const scopeB = { type: 'organization' as const, organizationId: second.organization.id, corporationId: 1 }
    const outsider = {
      ...second.state,
      users: [...second.state.users, {
        id: 6,
        email: 'member@personal.test',
        name: 'Илья',
        patronymic: '',
        surname: 'Сотрудник',
        position: '',
        legacyRole: 'member' as const,
        status: 'active' as const,
      }],
      assignments: [{
        id: 'asg-org-admin',
        userId: 6,
        roleId: firstRole?.id ?? '',
        scope: scopeA,
      }],
    }
    const snapshot = toSnapshot(outsider)
    expect(can(snapshot, 6, 'organizations', 'read', scopeA)).toBe(true)
    expect(can(snapshot, 6, 'organizations', 'update', scopeA)).toBe(true)
    expect(can(snapshot, 6, 'organizations', 'read', scopeB)).toBe(false)
    expect(can(snapshot, 6, 'organizations', 'update', scopeB)).toBe(false)
    expect(can(snapshot, 6, 'organizations', 'create', { type: 'corporation', corporationId: 1 })).toBe(false)
    expect(can(snapshot, 6, 'organizations', 'delete', scopeA)).toBe(false)
    expect(can(snapshot, 6, 'roles', 'delete', scopeB)).toBe(false)
    expect(hasCorporateSuperadmin(snapshot, 6)).toBe(false)
    expect(capabilityFromRoleDisplayName(ORGANIZATION_ADMINISTRATOR_ROLE_NAME)).toEqual([])
    const namedOnly = toSnapshot({
      ...ready,
      roles: [{
        id: 'role-title-only',
        displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
        grantIds: [],
        delegationGrantIds: [],
        ownerScope: scopeA,
      }],
      assignments: [{ id: 'asg-title', userId: 6, roleId: 'role-title-only', scope: scopeA }],
      users: outsider.users,
    })
    expect(can(namedOnly, 6, 'organizations', 'read', scopeA)).toBe(false)
    expect(hasCorporateSuperadmin(namedOnly, 1)).toBe(true)
  })

  it('stores neither the organization nor the role when the allowlist cannot be saved', () => {
    const ready = readyInstallation()
    const broken = {
      ...ready,
      grants: ready.grants.filter((grant) => grant.id !== 'g-organizations-read'),
    }
    const failed = createOrganization(broken, 1, organizationInput)
    expect(failed).toEqual({ error: 'invalid_organization' })
    expect(broken.organizations).toEqual([])
    expect(broken.roles).toEqual(ready.roles)
    expect(broken.assignments).toEqual([])
    expect(broken.accessVersion).toBe(ready.accessVersion)
  })

  it('assigns a chosen specialist to the role created with the organization', () => {
    const ready = readyInstallation()
    const staffed = {
      ...ready,
      users: [
        ...ready.users,
        {
          id: 2,
          email: 'lab@example.test',
          name: 'Борис',
          patronymic: 'Ильич',
          surname: 'Лебедев',
          position: 'Заведующий лабораторией',
          legacyRole: 'member' as const,
          status: 'active' as const,
        },
      ],
    }
    const created = createOrganization(staffed, 1, { ...organizationInput, inn: '7701000001', kpp: '770101001' })
    if (!('organization' in created)) throw new Error('organization')
    expect(created.organization.inn).toBe('7701000001')
    expect(created.organization.kpp).toBe('770101001')
    const session = tokenFor(created.state)
    const assigned = createAssignment(session.state, session.token, {
      userId: 2,
      roleId: created.administratorRoleId,
      scope: {
        type: 'organization',
        organizationId: created.organization.id,
        corporationId: created.organization.corporationId,
      },
    })
    expect(assigned.status).toBe(201)
    expect(organizationAdministratorLabel(assigned.state, created.organization.id)).toBe('Лебедев Б.И. - Заведующий лабораторией')
    expect(createOrganization(ready, 1, { ...organizationInput, inn: '12a', kpp: '770101001' })).toEqual({ error: 'invalid_organization' })
  })

  it('deletes an unassigned administrator role without removing corporate_superadmin', () => {
    const ready = readyInstallation()
    const session = tokenFor(ready)
    const created = createOrganization(session.state, 1, organizationInput)
    if (!('organization' in created)) throw new Error('organization')
    const role = created.state.roles.find((item) => item.displayName === ORGANIZATION_ADMINISTRATOR_ROLE_NAME)
    if (!role) throw new Error('role')
    const removed = deleteRole(created.state, session.token, role.id)
    expect(removed.status).toBe(200)
    expect(removed.state.roles.some((item) => item.id === role.id)).toBe(false)
    expect(hasCorporateSuperadmin(toSnapshot(removed.state), 1)).toBe(true)
    expect(removed.state.systemCapabilities).toEqual(created.state.systemCapabilities)
    expect(removed.state.assignments).toEqual(created.state.assignments)
  })

  it('gives a customer administrator filing and programme approval, and a laboratory administrator review', () => {
    const ready = readyInstallation()
    const staffed = {
      ...ready,
      users: [
        ...ready.users,
        member(6, 'customer.admin@personal.test', 'Нина', 'Орлова', 'Представитель заказчика'),
        member(7, 'lab.admin@personal.test', 'Борис', 'Лебедев', 'Заведующий лабораторией'),
        member(8, 'staff@personal.test', 'Кира', 'Соколова', 'Сотрудник'),
      ],
    }
    const laboratory = createOrganization(staffed, 1, {
      fullName: 'Лаборатория Север',
      shortName: 'Север',
      address: 'Полевая, 1',
      kind: 'laboratory',
      inn: '7701000001',
      kpp: '770101001',
    })
    if (!('organization' in laboratory)) throw new Error('laboratory')
    const customer = createOrganization(laboratory.state, 1, {
      fullName: 'Заказчик Восток',
      shortName: 'Восток',
      address: 'Офис, 3',
      kind: 'customer',
      inn: '7701000099',
      kpp: '770101099',
    })
    if (!('organization' in customer)) throw new Error('customer')
    const owner = tokenFor(customer.state)
    const laboratoryScope = {
      type: 'organization' as const,
      organizationId: laboratory.organization.id,
      corporationId: laboratory.organization.corporationId,
    }
    const customerScope = {
      type: 'organization' as const,
      organizationId: customer.organization.id,
      corporationId: customer.organization.corporationId,
    }
    const laboratoryAssigned = createAssignment(owner.state, owner.token, {
      userId: 7,
      roleId: laboratory.administratorRoleId,
      scope: laboratoryScope,
    })
    expect(laboratoryAssigned.status).toBe(201)
    const assigned = createAssignment(laboratoryAssigned.state, owner.token, {
      userId: 6,
      roleId: customer.administratorRoleId,
      scope: customerScope,
    })
    expect(assigned.status).toBe(201)
    const again = createAssignment(assigned.state, owner.token, {
      userId: 6,
      roleId: customer.administratorRoleId,
      scope: customerScope,
    })
    expect(again.status).toBe(200)
    expect(again.state.assignments.filter((item) => item.roleId === customer.administratorRoleId)).toHaveLength(1)

    const laboratoryRole = assigned.state.roles.find((role) => role.id === laboratory.administratorRoleId)
    const customerRole = assigned.state.roles.find((role) => role.id === customer.administratorRoleId)
    expect(requestIds(laboratoryRole?.grantIds ?? [])).toEqual([...REQUEST_LABORATORY_ADMINISTRATOR_GRANT_IDS])
    expect(requestIds(customerRole?.grantIds ?? [])).toEqual([...REQUEST_CUSTOMER_ADMINISTRATOR_GRANT_IDS])
    expect(customerRole?.delegationGrantIds).toEqual(customerRole?.grantIds)
    expect(customerRole?.grantIds).not.toEqual(expect.arrayContaining(['g-requests-accept', 'g-requests-reject', 'g-requests-assign']))
    expect(assigned.state.roles.filter((role) => role.origin?.template === 'organization-administrator')).toHaveLength(2)
    expect(assigned.state.systemCapabilities).toEqual(staffed.systemCapabilities)

    const customerSession = switchUser(assigned.state, 6)
    const customerToken = accessToken(customerSession)
    const draft = createRequest(customerSession.state, customerToken, {
      organizationId: customer.organization.id,
      executorOrganizationId: laboratory.organization.id,
      details: sendableDetails(),
    })
    expect(draft.status).toBe(201)
    const requestId = requestOf(draft).id
    expect(requestOf(draft).status).toBe('draft')
    const sent = sendFiled(draft.state, customerToken, requestId, customer.organization.id)
    expect(sent.status).toBe(200)
    expect(requestOf(sent).status).toBe('sent')
    const reviewDenied = startRequestReview(sent.state, customerToken, requestId, {
      organizationId: customer.organization.id,
      expectedRevision: requestOf(sent).revision,
    })
    expect(reviewDenied.status).toBe(403)
    expect(listRequests(sent.state, customerToken, laboratory.organization.id).status).toBe(403)

    const laboratorySession = switchUser(sent.state, 7)
    const laboratoryToken = accessToken(laboratorySession)
    const ownDraft = createRequest(laboratorySession.state, laboratoryToken, {
      organizationId: laboratory.organization.id,
      executorOrganizationId: laboratory.organization.id,
      details: sendableDetails(),
    })
    expect(ownDraft.status).toBe(201)
    const own = requestOf(ownDraft)
    expect(own.customerOrganizationId).toBe(laboratory.organization.id)
    expect(own.executorOrganizationId).toBe(laboratory.organization.id)
    expect(requestMatchesTab(own, 'incoming', { organizationId: laboratory.organization.id, userId: 7 })).toBe(false)
    const ownSent = sendFiled(ownDraft.state, laboratoryToken, own.id, laboratory.organization.id)
    expect(ownSent.status).toBe(200)
    const ownRecord = requestOf(ownSent)
    const incoming = listRequests(ownSent.state, laboratoryToken, laboratory.organization.id)
    expect(incoming.status).toBe(200)
    expect(requestsOf(incoming).some((item) => item.id === own.id && item.status === 'sent')).toBe(true)
    expect(requestMatchesTab(ownRecord, 'incoming', { organizationId: laboratory.organization.id, userId: 7 })).toBe(true)
    const started = startRequestReview(ownSent.state, laboratoryToken, own.id, {
      organizationId: laboratory.organization.id,
      expectedRevision: ownRecord.revision,
    })
    expect(started.status).toBe(200)
    expect(requestOf(started).status).toBe('in_review')
    expect(listRequests(ownSent.state, laboratoryToken, customer.organization.id).status).toBe(403)
    expect(readHidden(ownSent.state, customerToken, own.id, customer.organization.id)).toBe(404)

    const employee = switchUser(started.state, 8)
    const employeeToken = accessToken(employee)
    expect(createRequest(employee.state, employeeToken, {
      organizationId: customer.organization.id,
      executorOrganizationId: laboratory.organization.id,
      title: 'Чужая',
    }).status).toBe(403)
    expect(hasCorporateSuperadmin(toSnapshot(employee.state), 8)).toBe(false)
    expect(can(toSnapshot(employee.state), 8, 'requests', 'read', customerScope)).toBe(false)

    const navigation = {
      enforceGrants: true,
      grantsPending: false,
      hasOrganizations: true,
      projectId: null,
      systemCapabilities: [],
    }
    const customerGrants = effectiveGrants(toSnapshot(sent.state), 6)
    const requestsSection = sectionByPath('/requests')
    expect(requestsSection?.id).toBe('requests')
    expect(sectionByPath('/requests/new')?.id).toBe('requests')
    expect(visibleNavigation({ ...navigation, grants: customerGrants, organizationId: customer.organization.id }).some((item) => item.id === 'requests')).toBe(true)
    expect(sectionAccess(requestsSection!, { ...navigation, grants: customerGrants, organizationId: customer.organization.id })).toBe('allowed')
    expect(visibleNavigation({
      ...navigation,
      grants: effectiveGrants(toSnapshot(employee.state), 8),
      organizationId: customer.organization.id,
    }).some((item) => item.id === 'requests')).toBe(false)

    const kept = ensureOrganizationAdministrator(started.state, customer.organization, 1)
    expect(kept?.roleId).toBe(customer.administratorRoleId)
    expect(kept?.state.roles.filter((role) => role.origin?.template === 'organization-administrator')).toHaveLength(2)
    const revoked = {
      ...started.state,
      roles: started.state.roles.map((role) => role.id === customer.administratorRoleId
        ? {
          ...role,
          grantIds: role.grantIds.filter((id) => !id.startsWith('g-requests')),
          delegationGrantIds: (role.delegationGrantIds ?? []).filter((id) => !id.startsWith('g-requests')),
        }
        : role),
    }
    const reopened = updateOrganizationRecord(revoked, owner.token, customer.organization.id, { expectedRevision: 1 })
    expect(reopened.status).toBe(200)
    const afterReopen = reopened.state.roles.find((role) => role.id === customer.administratorRoleId)
    expect(requestIds(afterReopen?.grantIds ?? [])).toEqual([])
    expect(reopened.state.roles.filter((role) => role.origin?.template === 'organization-administrator')).toHaveLength(2)
    expect(reopened.state.assignments).toEqual(started.state.assignments)

    const reloaded = structuredClone(assigned.state)
    expect(can(toSnapshot(reloaded), 6, 'requests', 'create', customerScope)).toBe(true)
    expect(can(toSnapshot(reloaded), 6, 'requests', 'accept', customerScope)).toBe(false)
    expect(can(toSnapshot(reloaded), 7, 'requests', 'accept', laboratoryScope)).toBe(true)
    expect(can(toSnapshot(reloaded), 7, 'requests', 'read', customerScope)).toBe(false)
  })

  it('creates a customer organization when the unused review grant is absent from the catalog', () => {
    const ready = readyInstallation()
    const withoutAccept = {
      ...ready,
      grants: ready.grants.filter((grant) => grant.id !== 'g-requests-accept'),
    }
    const customer = createOrganization(withoutAccept, 1, {
      fullName: 'Заказчик Восток',
      shortName: 'Восток',
      address: 'Офис, 3',
      kind: 'customer',
    })
    if (!('organization' in customer)) throw new Error('customer')
    expect(requestIds(customer.state.roles.find((role) => role.id === customer.administratorRoleId)?.grantIds ?? [])).toEqual([
      ...REQUEST_CUSTOMER_ADMINISTRATOR_GRANT_IDS,
    ])
    expect(createOrganization(withoutAccept, 1, organizationInput)).toEqual({ error: 'invalid_organization' })
    expect(withoutAccept.organizations).toEqual([])
  })

  it('does not add request grants to a stored administrator role', () => {
    const ready = readyInstallation()
    const created = createOrganization(ready, 1, {
      fullName: 'Заказчик Восток',
      shortName: 'Восток',
      address: 'Офис, 3',
      kind: 'customer',
    })
    if (!('organization' in created)) throw new Error('customer')
    const coreIds = organizationAdministratorGrants('customer')
      .map((grant) => grant.id)
      .filter((id) => !id.startsWith('g-requests'))
    const stored = {
      ...created.state,
      roles: created.state.roles.map((role) => role.id === created.administratorRoleId
        ? { ...role, grantIds: coreIds, delegationGrantIds: coreIds }
        : role),
    }
    const migrated = migrateMockDocument(stored)
    const role = (migrated?.state ?? stored).roles.find((item) => item.id === created.administratorRoleId)
    expect(requestIds(role?.grantIds ?? [])).toEqual([])
    expect((migrated?.state ?? stored).assignments).toEqual(stored.assignments)
    expect((migrated?.state ?? stored).roles).toHaveLength(stored.roles.length)
  })

  it('keeps the administrator request grants after the mock record is read again', async () => {
    const namespace = `inlog:mock:test-org-admin-requests-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const opened = await readMockState(namespace)
    if (!opened.ok) throw new Error('missing record')
    const beforeAssignments = opened.state.assignments.map((item) => item.id)
    const login = loginWithPassword(opened.state, 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = accessToken(login)
    await updateMockState(() => login.state, namespace)
    await updateMockState((current) => {
      const created = createOrganization(current, 1, {
        fullName: 'Заказчик Восток',
        shortName: 'Восток',
        address: 'Офис, 3',
        kind: 'customer',
        inn: '7701000099',
        kpp: '770101099',
      })
      if (!('organization' in created)) throw new Error('organization')
      const assigned = createAssignment(created.state, token, {
        userId: 6,
        roleId: created.administratorRoleId,
        scope: {
          type: 'organization',
          organizationId: created.organization.id,
          corporationId: created.organization.corporationId,
        },
      })
      if (assigned.status !== 201) throw new Error('assignment')
      return assigned.state
    }, namespace)
    const again = await readMockState(namespace)
    if (!again.ok) throw new Error('missing record')
    const role = again.state.roles.find((item) =>
      item.origin?.template === 'organization-administrator'
      && item.ownerScope?.type === 'organization',
    )
    expect(requestIds(role?.grantIds ?? [])).toEqual([...REQUEST_CUSTOMER_ADMINISTRATOR_GRANT_IDS])
    expect(again.state.roles.filter((item) => item.origin?.template === 'organization-administrator')).toHaveLength(1)
    const repeated = await readMockState(namespace)
    if (!repeated.ok) throw new Error('missing record')
    expect(repeated.state.roles.filter((item) => item.origin?.template === 'organization-administrator')).toHaveLength(1)
    expect(repeated.state.assignments.map((item) => item.id).filter((id) => beforeAssignments.includes(id))).toEqual(beforeAssignments)
    const admin = switchUser(repeated.state, 6)
    const scope = role?.ownerScope
    if (!scope || scope.type !== 'organization') throw new Error('scope')
    expect(can(toSnapshot(admin.state), 6, 'requests', 'read', scope)).toBe(true)
    expect(can(toSnapshot(admin.state), 6, 'requests', 'create', scope)).toBe(true)
    expect(can(toSnapshot(admin.state), 3, 'requests', 'create', scope)).toBe(false)
    expect(createSeed().roles.some((item) => item.origin?.template === 'organization-administrator')).toBe(false)
  })
})

function member(id: number, email: string, name: string, surname: string, position: string) {
  return {
    id,
    email,
    name,
    patronymic: '',
    surname,
    position,
    legacyRole: 'member' as const,
    status: 'active' as const,
  }
}

function requestIds(ids: readonly string[]): string[] {
  return ids.filter((id) => id.startsWith('g-requests'))
}

function accessToken(result: { body: unknown }): string {
  return result.body && typeof result.body === 'object' && 'access_token' in result.body
    ? String(result.body.access_token)
    : ''
}

function requestOf(result: { body: unknown }) {
  return (result.body as {
    request: {
      id: string
      status: 'draft' | 'sent' | 'in_review'
      revision: number
      customerOrganizationId: number
      executorOrganizationId: number
      authorId: number
    }
  }).request
}

function requestsOf(result: { body: unknown }) {
  return (result.body as { requests: Array<{ id: string; status: string }> }).requests
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

function sendFiled(state: Parameters<typeof uploadRequestBasis>[0], token: string, requestId: string, organizationId: number) {
  const attached = uploadRequestBasis(state, token, requestId, organizationId, {
    filename: 'basis.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  })
  if (attached.status !== 200) return attached
  return sendRequest(attached.state, token, requestId, {
    organizationId,
    expectedRevision: requestOf(attached).revision,
  })
}

function readHidden(state: Parameters<typeof listRequests>[0], token: string, requestId: string, organizationId: number) {
  const rows = listRequests(state, token, organizationId)
  if (rows.status !== 200) return rows.status
  return requestsOf(rows).some((item) => item.id === requestId) ? 200 : 404
}
