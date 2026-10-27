import { describe, expect, it } from 'vitest'
import { capabilityFromRoleDisplayName, can, hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import type { SessionAccess } from '../../../entities/access/model/types'
import {
  createAssignment,
  createRole,
  readDirectory,
  readRole,
  updateRole,
} from '../access/service'
import {
  currentUser,
  loginWithPassword,
  readTestResource,
  sessionAccess,
  toSnapshot,
} from './flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { createForm, listForms, publishForm } from '../forms/service'
import { combinedConstructorData } from '../reports/service'
import { createSection, listSections } from '../sections/service'
import { createTableView, listTableViews } from '../table-views/service'
import { listTasks } from '../tasks/service'

const laboratory = { type: 'organization' as const, organizationId: 101, corporationId: 1 }
const otherLaboratory = { type: 'organization' as const, organizationId: 102, corporationId: 1 }

function oldInstallation(): MockState {
  const seed = createSeed()
  return {
    ...seed,
    roles: seed.roles.map((role) => role.id === 'role-owner'
      ? { ...role, grantIds: ['g-projects'], delegationGrantIds: [] }
      : role),
  }
}

function sessionFor(state: MockState, email: string) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = login.state.sessions.at(-1)?.accessToken ?? ''
  return { state: login.state, token }
}

function holds(access: SessionAccess, resource: string, action: string): boolean {
  return access.effectiveGrants.some((grant) =>
    grant.resource === resource
    && grant.action === action
    && grant.scope.type === 'corporation'
    && grant.scope.corporationId === 1)
}

describe('installation capability policy', () => {
  it('opens the known catalog for a saved capability without rewriting roles', () => {
    const stored = oldInstallation()
    const owner = sessionFor(stored, 'owner@example.test')
    const access = sessionAccess(owner.state, owner.token)
    expect(access.status).toBe(200)
    const body = access.body as SessionAccess
    for (const [resource, action] of [
      ['forms', 'read'],
      ['form-records', 'read'],
      ['table-views', 'read'],
      ['sections', 'read'],
      ['tasks', 'read'],
      ['reports', 'read'],
      ['reports', 'generate'],
      ['roles', 'create'],
      ['roles', 'update'],
      ['assignments', 'update'],
    ] as const) {
      expect(holds(body, resource, action)).toBe(true)
      expect(body.delegationGrants.some((grant) => grant.resource === resource && grant.action === action)).toBe(true)
    }
    expect(holds(body, 'requests', 'create')).toBe(false)
    expect(holds(body, 'not-a-resource', 'read')).toBe(false)
    expect(body.systemCapabilities).toEqual(['corporate_superadmin'])
    const ownerRole = owner.state.roles.find((role) => role.id === 'role-owner')
    expect(ownerRole?.grantIds).toEqual(['g-projects'])
    expect(ownerRole?.delegationGrantIds).toEqual([])

    const snapshot = toSnapshot(owner.state)
    expect(can(snapshot, 1, 'forms', 'publish', otherLaboratory)).toBe(true)
    expect(can(snapshot, 1, 'sections', 'update', otherLaboratory)).toBe(true)
    expect(can(snapshot, 1, 'tasks', 'read', { type: 'project', projectId: 1002, organizationId: 102, corporationId: 1 })).toBe(true)
    expect(can(snapshot, 1, 'equipment', 'read', laboratory)).toBe(false)
    expect(can(snapshot, 1, 'forms', 'explode', laboratory)).toBe(false)
    expect(can(snapshot, 1, 'forms', 'read', { type: 'organization', organizationId: 101, corporationId: 2 })).toBe(false)
    expect(can(snapshot, 2, 'forms', 'read', laboratory)).toBe(false)
    expect(can(snapshot, 3, 'sections', 'read', laboratory)).toBe(false)
    expect(capabilityFromRoleDisplayName('Суперадминистратор')).toEqual([])
    expect(hasCorporateSuperadmin(snapshot, 2)).toBe(false)

    expect(listTasks(owner.state, owner.token, 1001, { limit: 10, offset: 0 }).status).toBe(200)
    expect(listTasks(owner.state, owner.token, 1002, { limit: 10, offset: 0 }).status).toBe(200)
    expect(listTasks(owner.state, owner.token, 9999, { limit: 10, offset: 0 }).status).toBe(404)
    expect(listSections(owner.state, owner.token, 101).status).toBe(200)
    expect(listSections(owner.state, owner.token, 102).status).toBe(200)
    expect(combinedConstructorData(owner.state, owner.token, 102, []).status).toBe(200)
    expect(combinedConstructorData(owner.state, owner.token, 102, {}).status).toBe(400)
    expect(combinedConstructorData(owner.state, owner.token, 999, []).status).toBe(404)
    expect(readTestResource(owner.state, owner.token, 101).status).toBe(403)

    const createdForm = createForm(owner.state, owner.token, { organizationId: 101, title: 'Журнал владельца', description: '' })
    expect(createdForm.status).toBe(201)
    const formId = (createdForm.body as { id: string }).id
    const stale = publishForm(createdForm.state, owner.token, formId, {
      organizationId: 101,
      expectedFormRevision: 9,
      expectedDraftRevision: 1,
    })
    expect(stale.status).toBe(409)
    expect(stale.state.formVersions).toEqual([])
    const views = listTableViews(createdForm.state, owner.token, 101, formId)
    expect(views.status).toBe(200)
    const rejectedView = createTableView(createdForm.state, owner.token, formId, {
      organizationId: 101,
      schemaVersion: 99,
      title: 'Черновик',
      description: '',
      columns: ['sys:createdAt'],
      filters: [],
      sort: { columnId: 'sys:createdAt', direction: 'desc' },
      pageSize: 10,
    })
    expect(rejectedView.status).toBe(400)
    expect(rejectedView.state.tableViews).toEqual(createdForm.state.tableViews)
    const section = createSection(createdForm.state, owner.token, { organizationId: 102, title: 'Раздел лаборатории Б', description: '' })
    expect(section.status).toBe(201)
    expect(section.state.sections.some((item) => item.organizationId === 102)).toBe(true)
    expect(createForm(owner.state, owner.token, { organizationId: 999, title: 'Чужая', description: '' }).status).toBe(404)

    const directory = readDirectory(owner.state, owner.token, { scope: 'corporation', organization: null })
    expect(directory.status).toBe(200)
    const desk = directory.body as { canCreateRole: boolean; delegableGrantIds: string[] }
    expect(desk.canCreateRole).toBe(true)
    expect(desk.delegableGrantIds).toContain('g-roles-create')
    expect(desk.delegableGrantIds).toContain('g-forms-read')
    expect(desk.delegableGrantIds).not.toContain('g-test')

    const known = createRole(section.state, owner.token, {
      displayName: 'Чтение форм',
      description: '',
      grantIds: ['g-forms-read'],
      delegationGrantIds: [],
      ownerScope: laboratory,
    })
    expect(known.status).toBe(201)
    const knownId = (known.body as { role: { id: string } }).role.id
    const self = createAssignment(known.state, owner.token, { userId: 1, roleId: knownId, scope: laboratory })
    expect(self.status).toBe(201)
    expect(self.body).not.toMatchObject({ code: 'self_elevation' })
    expect(self.state.accessAudit?.some((entry) => entry.action === 'assignment.create' && entry.actorId === 1)).toBe(true)
    expect(hasCorporateSuperadmin(toSnapshot(self.state), 1)).toBe(true)

    const unknown = createRole(self.state, owner.token, {
      displayName: 'Неизвестный ресурс',
      description: '',
      grantIds: ['g-test'],
      delegationGrantIds: [],
      ownerScope: laboratory,
    })
    expect(unknown.status).toBe(403)
    expect(unknown.state.roles).toEqual(self.state.roles)

    const employeeGrants = self.state.roles.find((role) => role.id === 'role-employee')?.grantIds ?? []
    const widened = updateRole(self.state, owner.token, 'role-employee', {
      displayName: 'Сотрудник',
      description: '',
      grantIds: ['g-tasks', 'g-forms-read'],
      delegationGrantIds: [],
    })
    expect(widened.status).toBe(200)
    expect(can(toSnapshot(widened.state), 3, 'forms', 'read', laboratory)).toBe(true)
    expect(can(toSnapshot(widened.state), 3, 'forms', 'read', otherLaboratory)).toBe(false)
    expect(can(toSnapshot(widened.state), 4, 'forms', 'read', otherLaboratory)).toBe(true)
    const strengthened = updateRole(widened.state, owner.token, 'role-employee', {
      displayName: 'Сотрудник',
      description: '',
      grantIds: ['g-tasks', 'g-forms-read', 'g-test'],
      delegationGrantIds: [],
    })
    expect(strengthened.status).toBe(403)
    expect(strengthened.state.roles.find((role) => role.id === 'role-employee')?.grantIds).toEqual(['g-tasks', 'g-forms-read'])
    expect(employeeGrants).toContain('g-tasks')

    const titled = createRole(widened.state, owner.token, {
      displayName: 'Суперадминистратор',
      description: '',
      grantIds: [],
      delegationGrantIds: [],
      ownerScope: laboratory,
    })
    expect(titled.status).toBe(201)
    const titledId = (titled.body as { role: { id: string } }).role.id
    const copied = createAssignment(titled.state, owner.token, { userId: 2, roleId: titledId, scope: laboratory })
    expect(copied.status).toBe(201)
    expect(hasCorporateSuperadmin(toSnapshot(copied.state), 2)).toBe(false)
    expect(copied.state.systemCapabilities).toEqual(stored.systemCapabilities)
    expect(copied.state.roles.find((role) => role.id === 'role-owner')?.grantIds).toEqual(['g-projects'])
    expect(copied.state.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).toEqual([])

    const admin = sessionFor(copied.state, 'admin.a@example.test')
    const adminCreate = createRole(admin.state, admin.token, {
      displayName: 'Роль администратора',
      description: '',
      grantIds: ['g-forms-read'],
      delegationGrantIds: [],
      ownerScope: laboratory,
    })
    expect(adminCreate.status).toBe(403)
    expect(adminCreate.state.roles).toEqual(admin.state.roles)
    expect(readRole(admin.state, admin.token, 'role-employee').status).toBe(403)
    expect(listForms(admin.state, admin.token, 101).status).toBe(403)
    const employee = sessionFor(copied.state, 'employee.a@example.test')
    expect(listTasks(employee.state, employee.token, 1002, { limit: 10, offset: 0 }).status).toBe(403)

    const me = currentUser(owner.state, owner.token)
    expect(me.status).toBe(200)
    expect(me.body).toMatchObject({ id: 1 })
    const blockedState: MockState = {
      ...owner.state,
      users: owner.state.users.map((user) => user.id === 1 ? { ...user, status: 'blocked' as const } : user),
    }
    const blockedAccess = sessionAccess(blockedState, owner.token)
    expect(blockedAccess.body).toMatchObject({
      accessState: 'blocked',
      memberships: [],
      effectiveGrants: [],
      delegationGrants: [],
      systemCapabilities: [],
    })
    const blockedForm = createForm(blockedState, owner.token, { organizationId: 101, title: 'Закрыто', description: '' })
    expect(blockedForm.status).toBe(403)
    expect(blockedForm.body).toEqual({ code: 'blocked' })
    expect(blockedForm.state.forms).toEqual(blockedState.forms)
    expect(listTasks(blockedState, owner.token, 1001, { limit: 10, offset: 0 }).status).toBe(403)
    expect(listSections(blockedState, owner.token, 101).status).toBe(403)
  })
})
