import { describe, expect, it } from 'vitest'
import { personnelFieldId } from '../../../entities/personnel/model/template'
import { switchUser } from '../auth/flow'
import { createEmptyInstallation } from '../db/empty-installation'
import { configureInstallation, createOrganization } from '../installation/service'
import { ORGANIZATION_ADMINISTRATOR_ROLE_NAME } from '../organizations/organization-admin-role'
import { archiveEmployee, createEmployee, linkEmployeeAccount } from './employees'
import { readCorporateOverview } from './overview'

const draft = {
  corporationName: 'Север',
  givenName: 'Алина',
  surname: 'Власова',
  email: 'owner@overview.test',
  salt: 'salt',
  hash: 'hash',
}

function tokenFor(state: ReturnType<typeof configureInstallation>, userId = 1) {
  const issued = switchUser(state, userId)
  const token = issued.body && typeof issued.body === 'object' && 'access_token' in issued.body
    ? String(issued.body.access_token)
    : ''
  return { state: issued.state, token }
}

function names(organizationId: number, surname: string, given: string, extra: Record<string, string> = {}) {
  return {
    [personnelFieldId(organizationId, 'last-name')]: surname,
    [personnelFieldId(organizationId, 'first-name')]: given,
    ...extra,
  }
}

function twoOrganizations() {
  const ready = configureInstallation(createEmptyInstallation('overview-memory'), draft)
  const first = createOrganization(ready, 1, {
    fullName: 'Лаборатория Север',
    shortName: 'Север',
    address: 'Полевая, 1',
    kind: 'laboratory',
  })
  if (!('organization' in first)) throw new Error('first')
  const second = createOrganization(first.state, 1, {
    fullName: 'Заказчик Юг',
    shortName: 'Юг',
    address: 'Офис, 2',
    kind: 'customer',
  })
  if (!('organization' in second)) throw new Error('second')
  return { state: second.state, firstId: first.organization.id, secondId: second.organization.id }
}

describe('corporate personnel overview', () => {
  it('separates organization creation from personnel creation and hides another organization', () => {
    const opened = twoOrganizations()
    const scope = { type: 'organization' as const, organizationId: opened.firstId, corporationId: 1 }
    const otherScope = { type: 'organization' as const, organizationId: opened.secondId, corporationId: 1 }
    const prepared = {
      ...opened.state,
      users: [
        ...opened.state.users,
        { id: 8, email: 'clerk@lab.test', name: 'Лев', patronymic: '', surname: 'Кадровый', position: '', legacyRole: 'member' as const, status: 'active' as const },
      ],
      roles: [
        ...opened.state.roles,
        { id: 'role-create', displayName: 'Кадровик', grantIds: ['g-personnel-read', 'g-personnel-create'], delegationGrantIds: [], ownerScope: scope },
        { id: 'role-title', displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME, grantIds: [], delegationGrantIds: [], ownerScope: scope },
        { id: 'role-org', displayName: 'Только создание организаций', grantIds: ['g-organizations-create'], delegationGrantIds: [], ownerScope: { type: 'corporation' as const, corporationId: 1 } },
      ],
      assignments: [
        ...opened.state.assignments,
        { id: 'asg-create', userId: 8, roleId: 'role-create', scope },
        { id: 'asg-title', userId: 8, roleId: 'role-title', scope },
      ],
    }
    const owner = tokenFor(prepared, 1)
    const hired = createEmployee(owner.state, owner.token, {
      organizationId: opened.firstId,
      values: names(opened.firstId, 'Иванов', 'Иван', { [personnelFieldId(opened.firstId, 'email')]: 'ivan@lab.test' }),
    })
    const other = createEmployee(hired.state, owner.token, {
      organizationId: opened.secondId,
      values: names(opened.secondId, 'Петров', 'Пётр'),
    })
    const clerk = tokenFor(other.state, 8)
    const view = readCorporateOverview(clerk.state, clerk.token)
    expect(view.status).toBe(200)
    const body = view.body as {
      createOrganization: boolean
      organizations: { id: number }[]
      createTargets: { id: number }[]
      personnel: { employeeId: string; organizationId: number; actions: { update: boolean; archive: boolean; openOrganization: boolean }; roles: unknown }[]
    }
    expect(body.createOrganization).toBe(false)
    expect(body.organizations).toEqual([])
    expect(body.createTargets.map((item) => item.id)).toEqual([opened.firstId])
    expect(body.personnel.map((item) => item.organizationId)).toEqual([opened.firstId])
    expect(body.personnel[0]?.actions).toEqual({ update: false, archive: false, openOrganization: false })
    expect(body.personnel[0]?.roles).toBeNull()
    expect(body.personnel.some((item) => item.organizationId === otherScope.organizationId)).toBe(false)

    const founder = {
      ...clerk.state,
      assignments: [
        ...clerk.state.assignments.filter((item) => item.userId !== 8),
        { id: 'asg-org', userId: 8, roleId: 'role-org', scope: { type: 'corporation' as const, corporationId: 1 } },
      ],
    }
    const founderSession = tokenFor(founder, 8)
    const founded = readCorporateOverview(founderSession.state, founderSession.token)
    const foundedBody = founded.body as { createOrganization: boolean; createTargets: unknown[] }
    expect(foundedBody.createOrganization).toBe(true)
    expect(foundedBody.createTargets).toEqual([])
  })

  it('checks edit, archive and open independently and keeps the account after archive', () => {
    const opened = twoOrganizations()
    const scope = { type: 'organization' as const, organizationId: opened.firstId, corporationId: 1 }
    const prepared = {
      ...opened.state,
      users: [
        ...opened.state.users,
        { id: 8, email: 'editor@lab.test', name: 'Нина', patronymic: '', surname: 'Редактор', position: '', legacyRole: 'member' as const, status: 'active' as const },
        { id: 9, email: 'linked@lab.test', name: 'Марк', patronymic: '', surname: 'Связанный', position: '', legacyRole: 'member' as const, status: 'active' as const },
      ],
      roles: [
        ...opened.state.roles,
        {
          id: 'role-edit',
          displayName: 'Правка без архива',
          grantIds: ['g-personnel-read', 'g-personnel-update', 'g-organizations-read', 'g-roles-read'],
          delegationGrantIds: [],
          ownerScope: scope,
        },
        { id: 'role-person', displayName: 'Исполнитель лаборатории', grantIds: ['g-tasks'], delegationGrantIds: [], ownerScope: scope },
      ],
      assignments: [
        ...opened.state.assignments,
        { id: 'asg-edit', userId: 8, roleId: 'role-edit', scope },
        { id: 'asg-person', userId: 9, roleId: 'role-person', scope },
      ],
      memberships: [
        ...opened.state.memberships,
        { id: 'mem-9', userId: 9, organizationId: opened.firstId, kind: 'laboratory' as const },
      ],
    }
    const owner = tokenFor(prepared, 1)
    const hired = createEmployee(owner.state, owner.token, {
      organizationId: opened.firstId,
      values: names(opened.firstId, 'Сидоров', 'Кирилл'),
    })
    const employeeId = hired.state.employees[0]?.id ?? ''
    const linked = linkEmployeeAccount(hired.state, owner.token, employeeId, {
      organizationId: opened.firstId,
      expectedRevision: 1,
      accountId: 9,
    })
    expect(linked.status).toBe(200)
    const editor = tokenFor(linked.state, 8)
    const view = readCorporateOverview(editor.state, editor.token)
    const body = view.body as {
      organizations: { id: number; employeeCount: number | null }[]
      personnel: { employeeId: string; revision: number; roles: { displayName: string }[] | null; actions: { update: boolean; archive: boolean; openOrganization: boolean } }[]
    }
    const row = body.personnel.find((item) => item.employeeId === employeeId)
    expect(row?.actions).toEqual({ update: true, archive: false, openOrganization: true })
    expect(row?.roles?.map((role) => role.displayName)).toEqual(['Исполнитель лаборатории'])
    expect(body.organizations.find((item) => item.id === opened.firstId)?.employeeCount).toBe(1)
    expect(body.organizations.find((item) => item.id === opened.secondId)).toBeUndefined()

    const denied = archiveEmployee(editor.state, editor.token, employeeId, {
      organizationId: opened.firstId,
      expectedRevision: row?.revision,
      archived: true,
    })
    expect(denied.status).toBe(403)
    expect(denied.state.employees.find((item) => item.id === employeeId)?.archived).toBe(false)
    expect(denied.state.users).toBe(editor.state.users)
    expect(denied.state.assignments).toBe(editor.state.assignments)

    const ownerAgain = tokenFor(editor.state, 1)
    const archived = archiveEmployee(ownerAgain.state, ownerAgain.token, employeeId, {
      organizationId: opened.firstId,
      expectedRevision: row?.revision,
      archived: true,
    })
    expect(archived.status).toBe(200)
    expect(archived.state.users).toBe(editor.state.users)
    expect(archived.state.assignments).toBe(editor.state.assignments)
    expect(archived.state.memberships).toBe(editor.state.memberships)
    expect(archived.state.employees.find((item) => item.id === employeeId)?.accountId).toBe(9)
    const after = readCorporateOverview(archived.state, editor.token)
    const afterBody = after.body as { personnel: { employeeId: string; archived: boolean }[]; organizations: { id: number; employeeCount: number | null }[] }
    const archivedRow = afterBody.personnel.find((item) => item.employeeId === employeeId)
    expect(archivedRow?.archived).toBe(true)
    expect(afterBody.organizations.find((item) => item.id === opened.firstId)?.employeeCount).toBe(0)
  })
})
