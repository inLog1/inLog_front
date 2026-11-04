import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { accessManagementMode } from '../../../entities/access'
import { isOfferedPermission } from '../../../entities/access/model/permission-catalog'
import {
  can,
  canDelegate,
  capabilityFromRoleDisplayName,
  hasCorporateSuperadmin,
} from '../../../entities/access/model/grants'
import { accessFor, loginWithPassword, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { ensureMockState, readMockState, updateMockState } from '../db/repository'
import { readUser } from './users'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import {
  createAssignment,
  createRole,
  deleteRole,
  duplicateRole,
  readAssignmentWrite,
  readDirectory,
  readRoleDuplicateWrite,
  readRoleWrite,
  revokeAssignment,
  updateRole,
} from './service'

const org = (organizationId: number) => ({ type: 'organization' as const, organizationId, corporationId: 1 })

function sessionFor(state: MockState, email: string, userId: number) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = [...login.state.sessions].reverse().find((item) => item.userId === userId)?.accessToken ?? ''
  return { state: login.state, token }
}

function ownerSession() {
  return sessionFor(createSeed(), 'owner@example.test', 1)
}

function adminSession(state = createSeed()) {
  return sessionFor(state, 'admin.a@example.test', 2)
}

function grantId(state: MockState, resource: string, action: string): string {
  const grant = state.grants.find((item) => item.resource === resource && item.action === action)
  if (!grant) throw new Error(`missing ${resource}.${action}`)
  return grant.id
}

describe('access management service', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
  })
  it('does not turn a role name, role id or payload into corporate_superadmin', () => {
    expect(capabilityFromRoleDisplayName('Суперадминистратор')).toEqual([])
    const { state, token } = ownerSession()
    const parsed = readRoleWrite({
      displayName: 'Суперадминистратор',
      description: 'название не является полномочием',
      grantIds: [],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
      systemCapabilities: ['corporate_superadmin'],
      capability: 'corporate_superadmin',
      id: 'role-owner',
      code: 'corporate_superadmin',
    }, true)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.displayName).toBe('Суперадминистратор')
    expect(parsed.value).not.toHaveProperty('systemCapabilities')
    const created = createRole(state, token, parsed.value)
    expect(created.status).toBe(201)
    expect(created.state.systemCapabilities).toEqual(state.systemCapabilities)
    expect(hasCorporateSuperadmin(toSnapshot(created.state), 3)).toBe(false)
    expect(created.state.roles.some((role) => role.id === 'role-owner' && role.displayName === 'Суперадминистратор')).toBe(false)
  })

  it('keeps operational permissions independent from permissions that can be granted', () => {
    const { state, token } = ownerSession()
    const reports = grantId(state, 'reports', 'read')
    const created = createRole(state, token, {
      displayName: 'Только делегирование отчётов',
      description: '',
      grantIds: [],
      delegationGrantIds: [reports],
      ownerScope: org(101),
    })
    expect(created.status).toBe(201)
    const roleId = created.state.roles.find((role) => role.displayName === 'Только делегирование отчётов')?.id
    expect(roleId).toBeTruthy()
    const assigned = createAssignment(created.state, token, { userId: 3, roleId: roleId ?? '', scope: org(101) })
    expect(assigned.status).toBe(201)
    const snapshot = toSnapshot(assigned.state)
    expect(can(snapshot, 3, 'reports', 'read', org(101))).toBe(false)
    expect(canDelegate(snapshot, 3, 'reports', 'read', org(101))).toBe(true)
    expect(can(snapshot, 3, 'reports', 'generate', org(101))).toBe(false)
  })

  it('lets the owner create and assign a limited role, and rejects extra permissions and a wider scope', () => {
    const { state, token } = ownerSession()
    const created = createRole(state, token, {
      displayName: 'Читатель отчётов А',
      description: 'только чтение',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(created.status).toBe(201)
    const role = created.state.roles.find((item) => item.displayName === 'Читатель отчётов А')
    expect(role?.delegationGrantIds).toEqual([])
    const assigned = createAssignment(created.state, token, { userId: 3, roleId: role?.id ?? '', scope: org(101) })
    expect(assigned.status).toBe(201)
    expect(can(toSnapshot(assigned.state), 3, 'reports', 'read', org(101))).toBe(true)
    expect(can(toSnapshot(assigned.state), 3, 'reports', 'generate', org(101))).toBe(false)
    expect(assigned.state.sessions).toHaveLength(state.sessions.length)

    const extra = createRole(state, token, {
      displayName: 'Слишком сильная',
      description: '',
      grantIds: [grantId(state, 'tasks', 'delete')],
      delegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(extra.status).toBe(201)
    const strong = extra.state.roles.find((item) => item.displayName === 'Слишком сильная')
    const widened = createAssignment(extra.state, token, {
      userId: 3,
      roleId: strong?.id ?? '',
      scope: { type: 'corporation', corporationId: 1 },
    })
    expect(widened.status).toBe(403)
    expect(widened.body).toEqual({ code: 'scope_expansion' })
    expect(widened.state.assignments).toHaveLength(state.assignments.length)
    expect(widened.state.accessAudit).toHaveLength(1)
  })

  it('rejects self-elevation and a change that strengthens an assigned role', () => {
    const stock = adminSession()
    const deniedCreate = createRole(stock.state, stock.token, {
      displayName: 'Без права создавать',
      description: '',
      grantIds: [grantId(stock.state, 'tasks', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(deniedCreate.status).toBe(403)
    expect(deniedCreate.body).toEqual({ code: 'forbidden' })
    expect(deniedCreate.state.roles).toEqual(stock.state.roles)
    expect(deniedCreate.state.accessAudit).toEqual(stock.state.accessAudit)

    const seed = createSeed()
    const tasksRead = grantId(seed, 'tasks', 'read')
    const prepared: MockState = {
      ...seed,
      roles: seed.roles.map((role) => role.id === 'role-lab-admin'
        ? {
          ...role,
          grantIds: [...role.grantIds, grantId(seed, 'roles', 'create'), grantId(seed, 'roles', 'update')],
          delegationGrantIds: [...(role.delegationGrantIds ?? []), tasksRead],
        }
        : role),
    }
    const admin = adminSession(prepared)
    const tasksDelete = grantId(admin.state, 'tasks', 'delete')
    const owned = createRole(admin.state, admin.token, {
      displayName: 'Чтение задач лаборатории',
      description: '',
      grantIds: [tasksRead],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(owned.status).toBe(201)
    const role = owned.state.roles.find((item) => item.displayName === 'Чтение задач лаборатории')
    const self = createAssignment(owned.state, admin.token, { userId: 2, roleId: role?.id ?? '', scope: org(101) })
    expect(self.status).toBe(403)
    expect(self.body).toEqual({ code: 'self_elevation' })
    expect(self.state.assignments).toEqual(owned.state.assignments)
    expect(self.state.accessAudit).toEqual(owned.state.accessAudit)

    const formsRead = grantId(owned.state, 'forms', 'read')
    const formsUpdate = grantId(owned.state, 'forms', 'update')
    const owner = ownerSession()
    const formRole = createRole(owner.state, owner.token, {
      displayName: 'Проверка форм',
      description: '',
      grantIds: [formsRead, formsUpdate],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(formRole.status).toBe(201)
    const formRoleId = formRole.state.roles.find((item) => item.displayName === 'Проверка форм')?.id ?? ''
    const elevated = createAssignment(formRole.state, owner.token, { userId: 1, roleId: formRoleId, scope: org(101) })
    expect(elevated.status).toBe(201)
    expect(elevated.state.accessAudit?.some((entry) => entry.action === 'assignment.create' && entry.actorId === 1)).toBe(true)
    expect(hasCorporateSuperadmin(toSnapshot(elevated.state), 1)).toBe(true)
    expect(hasCorporateSuperadmin(toSnapshot(elevated.state), 9)).toBe(false)
    const switchAuthor = createAssignment(formRole.state, owner.token, { userId: 9, roleId: formRoleId, scope: org(101) })
    expect(switchAuthor.status).toBe(201)
    expect(can(toSnapshot(switchAuthor.state), 9, 'forms', 'update', org(101))).toBe(true)
    expect(can(toSnapshot(switchAuthor.state), 9, 'forms', 'update', org(102))).toBe(false)

    const given = createAssignment(owned.state, admin.token, { userId: 3, roleId: role?.id ?? '', scope: org(101) })
    expect(given.status).toBe(201)
    const strengthened = updateRole(given.state, admin.token, role?.id ?? '', {
      displayName: 'Чтение задач лаборатории',
      description: '',
      grantIds: [tasksRead, tasksDelete],
      delegationGrantIds: [],
    })
    expect(strengthened.status).toBe(403)
    expect(strengthened.state.roles.find((item) => item.id === role?.id)?.grantIds).toEqual([tasksRead])
    expect(strengthened.state.accessAudit).toEqual(given.state.accessAudit)
    expect(can(toSnapshot(strengthened.state), 3, 'reports', 'read', org(101))).toBe(false)
  })

  it('rejects foreign ids and lets an organization administrator act only inside the delegated set', () => {
    const { state, token } = ownerSession()
    const reports = grantId(state, 'reports', 'read')
    const allowed = updateRole(state, token, 'role-lab-admin', {
      displayName: 'Администратор лаборатории',
      description: '',
      grantIds: state.roles.find((role) => role.id === 'role-lab-admin')?.grantIds ?? [],
      delegationGrantIds: ['g-members-read', reports],
    })
    expect(allowed.status).toBe(200)
    const admin = adminSession(allowed.state)
    const directory = readDirectory(admin.state, admin.token, { scope: null, organization: '101' })
    expect(directory.status).toBe(200)
    const body = directory.body as { candidates: Array<{ id: number }>; roles: Array<{ id: string }> }
    expect(body.candidates.map((item) => item.id)).not.toContain(4)
    expect(body.candidates.map((item) => item.id)).not.toContain(5)
    expect(body.roles.map((item) => item.id)).not.toContain('role-owner')
    expect(JSON.stringify(body.candidates)).not.toContain('@')

    const otherOrg = readDirectory(admin.state, admin.token, { scope: null, organization: '102' })
    expect(otherOrg.status).toBe(403)
    const missingUser = createAssignment(admin.state, admin.token, { userId: 4, roleId: 'role-members-reader', scope: org(101) })
    expect(missingUser.status).toBe(404)
    expect(missingUser.state.assignments).toEqual(admin.state.assignments)
    const unknownRole = createAssignment(admin.state, admin.token, { userId: 3, roleId: 'role-missing', scope: org(101) })
    expect(unknownRole.status).toBe(404)
    const forgedProject = createAssignment(admin.state, admin.token, {
      userId: 3,
      roleId: 'role-members-reader',
      scope: { type: 'project', projectId: 1002, organizationId: 101, corporationId: 1 },
    })
    expect(forgedProject.status).toBe(403)
    expect(forgedProject.body).toEqual({ code: 'invalid_scope' })
    expect((directory.body as { canCreateRole: boolean }).canCreateRole).toBe(false)

    const noDefinition = createRole(admin.state, admin.token, {
      displayName: 'Допустимый читатель',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(noDefinition.status).toBe(403)
    expect(noDefinition.state.roles).toEqual(admin.state.roles)
    const editor: MockState = {
      ...admin.state,
      roles: admin.state.roles.map((role) => role.id === 'role-lab-admin'
        ? { ...role, grantIds: [...role.grantIds, grantId(admin.state, 'roles', 'create'), grantId(admin.state, 'roles', 'update')] }
        : role),
    }

    const created = createRole(editor, admin.token, {
      displayName: 'Допустимый читатель',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(created.status).toBe(201)
    const roleId = created.state.roles.find((item) => item.displayName === 'Допустимый читатель')?.id ?? ''
    const assigned = createAssignment(created.state, admin.token, { userId: 3, roleId, scope: org(101) })
    expect(assigned.status).toBe(201)
    const tooStrong = createRole(editor, admin.token, {
      displayName: 'Удаление задач',
      description: '',
      grantIds: [grantId(state, 'tasks', 'delete')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(tooStrong.status).toBe(403)
    const otherOrganization = createRole(editor, admin.token, {
      displayName: 'Чужая лаборатория',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(otherOrganization.status).toBe(403)
    const edited = updateRole(editor, admin.token, 'role-employee', {
      displayName: 'Сотрудник',
      description: '',
      grantIds: ['g-tasks', reports],
      delegationGrantIds: [],
    })
    expect(edited.status).toBe(403)
    expect(edited.state.roles.find((item) => item.id === 'role-employee')?.grantIds).toEqual(
      state.roles.find((item) => item.id === 'role-employee')?.grantIds,
    )
  })

  it('revokes one assignment, refuses to delete a used role, and records history with the change', () => {
    const { state, token } = ownerSession()
    const created = createRole(state, token, {
      displayName: 'Временная',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((item) => item.displayName === 'Временная')?.id ?? ''
    const first = createAssignment(created.state, token, { userId: 3, roleId, scope: org(101) })
    const second = createAssignment(first.state, token, {
      userId: 3,
      roleId,
      scope: { type: 'project', projectId: 1001, organizationId: 101, corporationId: 1 },
    })
    expect(second.status).toBe(201)
    const projectAssignment = second.state.assignments.find((item) => item.roleId === roleId && item.scope.type === 'project')
    const revoked = revokeAssignment(second.state, token, projectAssignment?.id ?? '')
    expect(revoked.status).toBe(200)
    expect(revoked.state.assignments.some((item) => item.id === projectAssignment?.id)).toBe(false)
    expect(revoked.state.assignments.some((item) => item.roleId === roleId && item.scope.type === 'organization')).toBe(true)
    expect(can(toSnapshot(revoked.state), 3, 'reports', 'read', org(101))).toBe(true)
    const blocked = deleteRole(revoked.state, token, roleId)
    expect(blocked.status).toBe(409)
    expect(blocked.body).toMatchObject({ code: 'role_in_use' })
    expect(blocked.state.roles.some((item) => item.id === roleId)).toBe(true)
    const orgAssignment = revoked.state.assignments.find((item) => item.roleId === roleId)
    const cleared = revokeAssignment(revoked.state, token, orgAssignment?.id ?? '')
    expect(can(toSnapshot(cleared.state), 3, 'reports', 'read', org(101))).toBe(false)
    expect(can(toSnapshot(cleared.state), 3, 'tasks', 'read', org(101))).toBe(true)
    const removed = deleteRole(cleared.state, token, roleId)
    expect(removed.status).toBe(200)
    const last = removed.state.accessAudit?.at(-1)
    expect(last).toMatchObject({ action: 'role.delete', roleId, actorId: 1, after: null })
    expect(JSON.stringify(removed.state.accessAudit)).not.toContain('mock.')
    expect(JSON.stringify(removed.state.accessAudit)).not.toContain(PUBLIC_FIXTURE_PASSWORD)
    expect(removed.state.sessions.map((item) => item.accessToken)).toEqual(state.sessions.map((item) => item.accessToken))
  })

  it('treats an exact duplicate as the same assignment and rejects a stale version without writing history', () => {
    const { state, token } = ownerSession()
    const created = createRole(state, token, {
      displayName: 'Повтор',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((item) => item.displayName === 'Повтор')?.id ?? ''
    const once = createAssignment(created.state, token, { userId: 3, roleId, scope: org(101) })
    const twice = createAssignment(once.state, token, { userId: 3, roleId, scope: org(101) })
    expect(twice.status).toBe(200)
    expect(twice.body).toMatchObject({ idempotent: true })
    expect(twice.state.assignments.filter((item) => item.roleId === roleId)).toHaveLength(1)
    expect(twice.state.accessVersion).toBe(once.state.accessVersion)
    expect(twice.state.accessAudit).toEqual(once.state.accessAudit)
    const stale = updateRole(once.state, token, roleId, {
      displayName: 'Повтор 2',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      expectedAccessVersion: 0,
    })
    expect(stale.status).toBe(409)
    expect(stale.body).toEqual({ code: 'stale_write' })
    expect(stale.state.roles.find((item) => item.id === roleId)?.displayName).toBe('Повтор')
    expect(stale.state.accessAudit).toEqual(once.state.accessAudit)
  })

  it('sends a person with no assignments to the pending state without ending the session', () => {
    const { state, token } = ownerSession()
    const only = state.assignments.find((item) => item.userId === 8)
    const revoked = revokeAssignment(state, token, only?.id ?? '')
    expect(revoked.status).toBe(200)
    expect(accessFor(revoked.state, revoked.state.users[7]).accessState).toBe('pending')
    expect(revoked.state.sessions).toEqual(state.sessions)
    const parsed = readAssignmentWrite({ userId: '3', roleId: 'role-employee', scope: org(101) })
    expect(parsed.ok).toBe(false)
  })

  it('keeps a saved role after the record is read again', async () => {
    const namespace = `inlog:mock:test-access-reload-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const opened = await readMockState(namespace)
    if (!opened.ok) throw new Error('missing record')
    const login = loginWithPassword(opened.state, 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = login.state.sessions.at(-1)?.accessToken ?? ''
    await updateMockState(() => login.state, namespace)
    const created = await updateMockState((state) => {
      const result = createRole(state, token, {
        displayName: 'После перезагрузки',
        description: 'сохранено',
        grantIds: [grantId(state, 'reports', 'read')],
        delegationGrantIds: [],
        ownerScope: org(101),
      })
      if (result.status !== 201) throw new Error('role was not saved')
      return result.state
    }, namespace)
    const again = await readMockState(namespace)
    expect(again.ok && again.state.roles.some((role) => role.displayName === 'После перезагрузки')).toBe(true)
    expect(again.ok && again.state.accessAudit?.some((entry) => entry.action === 'role.create')).toBe(true)
    expect(created.accessVersion).toBeGreaterThan(1)
  })

  it('keeps role deletion independent from update and refuses an assigned role', () => {
    const { state, token } = ownerSession()
    const created = createRole(state, token, {
      displayName: 'Съёмная',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((item) => item.displayName === 'Съёмная')?.id ?? ''
    const withActor = (grantIds: string[]) => ({
      ...created.state,
      roles: [...created.state.roles, {
        id: 'role-actor',
        displayName: 'Оператор ролей',
        grantIds,
        delegationGrantIds: [],
        ownerScope: org(101),
      }],
      assignments: [...created.state.assignments, {
        id: 'asg-actor',
        userId: 6,
        roleId: 'role-actor',
        scope: org(101),
      }],
    })
    const updater = sessionFor(withActor([grantId(created.state, 'roles', 'update')]), 'pending@example.test', 6)
    const denied = deleteRole(updater.state, updater.token, roleId)
    expect(denied.status).toBe(403)
    expect(denied.state.roles.some((item) => item.id === roleId)).toBe(true)
    expect(denied.state.assignments).toEqual(updater.state.assignments)

    const deleter = sessionFor(withActor([grantId(created.state, 'roles', 'delete')]), 'pending@example.test', 6)
    const removed = deleteRole(deleter.state, deleter.token, roleId)
    expect(removed.status).toBe(200)
    expect(removed.state.roles.some((item) => item.id === roleId)).toBe(false)
    expect(hasCorporateSuperadmin(toSnapshot(removed.state), 1)).toBe(true)
    expect(removed.state.systemCapabilities).toEqual(deleter.state.systemCapabilities)

    const assigned = createAssignment(created.state, token, { userId: 3, roleId, scope: org(101) })
    const blocked = deleteRole(assigned.state, token, roleId)
    expect(blocked.status).toBe(409)
    expect(blocked.body).toMatchObject({ code: 'role_in_use' })
    expect(blocked.state.roles).toEqual(assigned.state.roles)
    expect(blocked.state.assignments).toEqual(assigned.state.assignments)
    expect(blocked.state.users).toEqual(assigned.state.users)
    expect(blocked.state.systemCapabilities).toEqual(assigned.state.systemCapabilities)

    const reader = sessionFor(withActor([grantId(created.state, 'roles', 'read')]), 'pending@example.test', 6)
    expect(readDirectory(reader.state, reader.token, { scope: null, organization: '101' }).status).toBe(200)
    const editor = sessionFor(withActor([grantId(created.state, 'roles', 'update')]), 'pending@example.test', 6)
    expect(readDirectory(editor.state, editor.token, { scope: null, organization: '102' }).status).toBe(403)
    expect(readDirectory(editor.state, editor.token, { scope: null, organization: '101' }).status).toBe(200)
  })

  it('reports that live mode does not call the access contract', () => {
    expect(accessManagementMode('live')).toBe('unavailable')
    expect(accessManagementMode(undefined)).toBe('unavailable')
    expect(accessManagementMode('mock')).toBe('mock')
  })

  it('lists role-creation areas without turning a role title into a system role', () => {
    const owner = ownerSession()
    const directory = readDirectory(owner.state, owner.token, { scope: null, organization: '101' })
    expect(directory.status).toBe(200)
    const body = directory.body as {
      creatableScopes: Array<{ scope: { type: string; organizationId?: number } }>
      roles: Array<{ id: string; system: boolean }>
    }
    const orgIds = owner.state.organizations
      .filter((item) => item.corporationId === 1)
      .slice()
      .sort((left, right) => left.shortName.localeCompare(right.shortName, 'ru'))
      .map((item) => item.id)
    expect(body.creatableScopes.map((item) => item.scope.type === 'organization' ? item.scope.organizationId : item.scope.type)).toEqual([
      'corporation',
      ...orgIds,
    ])
    const corporation = readDirectory(owner.state, owner.token, { scope: 'corporation', organization: null })
    const roles = (corporation.body as { roles: Array<{ id: string; system: boolean }> }).roles
    expect(roles.find((role) => role.id === 'role-decoy')?.system).toBe(false)

    const stock = adminSession()
    const hidden = readDirectory(stock.state, stock.token, { scope: null, organization: '101' })
    expect((hidden.body as { creatableScopes: unknown[] }).creatableScopes).toEqual([])
  })

  it('duplicates an ordinary role into another organization without assignments, history or system capability', () => {
    const { state, token } = ownerSession()
    const reportsRead = grantId(state, 'reports', 'read')
    const tasksDelete = grantId(state, 'tasks', 'delete')
    const legacy = grantId(state, 'test-resource', 'read')
    const created = createRole(state, token, {
      displayName: 'Дворник',
      description: 'территория',
      grantIds: [reportsRead, tasksDelete],
      delegationGrantIds: [reportsRead],
      ownerScope: org(101),
    })
    expect(created.status).toBe(201)
    const source = created.state.roles.find((role) => role.displayName === 'Дворник')
    expect(source).toBeTruthy()
    const sourceId = source?.id ?? ''
    const marked: MockState = {
      ...created.state,
      roles: created.state.roles.map((role) => role.id === sourceId
        ? { ...role, grantIds: [...role.grantIds, legacy], origin: { template: 'organization-administrator' } }
        : role),
    }
    const assigned = createAssignment(marked, token, { userId: 3, roleId: sourceId, scope: org(101) })
    expect(assigned.status).toBe(201)
    const sourceRole = assigned.state.roles.find((role) => role.id === sourceId)
    expect(sourceRole?.origin).toEqual({ template: 'organization-administrator' })

    const blocked = duplicateRole(assigned.state, token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: 'территория',
      grantIds: [reportsRead, tasksDelete, legacy],
      delegationGrantIds: [reportsRead],
      omitGrantIds: [],
      omitDelegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(blocked.status).toBe(403)
    expect(blocked.body).toMatchObject({ code: 'grants_not_delegable' })
    expect(blocked.state.roles).toHaveLength(assigned.state.roles.length)
    expect(blocked.state.assignments).toEqual(assigned.state.assignments)
    expect(blocked.state.accessVersion).toBe(assigned.state.accessVersion)
    expect(blocked.state.systemCapabilities).toEqual(assigned.state.systemCapabilities)

    const quiet = duplicateRole(assigned.state, token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: 'территория',
      grantIds: [reportsRead, tasksDelete],
      delegationGrantIds: [reportsRead],
      omitGrantIds: [],
      omitDelegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(quiet.status).toBe(403)
    expect(quiet.body).toMatchObject({ code: 'unacknowledged_omissions' })
    expect(quiet.state.roles.map((role) => role.id)).toEqual(assigned.state.roles.map((role) => role.id))

    const copied = duplicateRole(assigned.state, token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: 'территория',
      grantIds: [reportsRead, tasksDelete],
      delegationGrantIds: [reportsRead],
      omitGrantIds: [legacy],
      omitDelegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(copied.status).toBe(201)
    const copy = copied.state.roles.find((role) => role.displayName === 'Дворник (копия)')
    expect(copy?.id).toBeTruthy()
    expect(copy?.id).not.toBe(sourceId)
    expect(copy?.description).toBe('территория')
    expect(copy?.ownerScope).toEqual(org(102))
    expect(copy?.grantIds).toEqual([reportsRead, tasksDelete])
    expect(copy?.delegationGrantIds).toEqual([reportsRead])
    expect(copy?.grantIds).not.toBe(sourceRole?.grantIds)
    expect(copy?.origin).toBeUndefined()
    expect(copied.state.roles.find((role) => role.id === sourceId)?.origin).toEqual({ template: 'organization-administrator' })
    expect(copied.state.roles.find((role) => role.id === sourceId)?.grantIds).toEqual([reportsRead, tasksDelete, legacy])
    expect(copied.state.assignments.filter((item) => item.roleId === copy?.id)).toEqual([])
    expect(copied.state.assignments.filter((item) => item.roleId === sourceId)).toHaveLength(1)
    expect(copied.state.systemCapabilities).toEqual(state.systemCapabilities)
    expect(hasCorporateSuperadmin(toSnapshot(copied.state), 3)).toBe(false)
    expect(copied.state.accessAudit?.filter((entry) => entry.roleId === copy?.id).map((entry) => entry.action)).toEqual(['role.create'])
    expect(copied.state.accessAudit?.filter((entry) => entry.roleId === sourceId)).toHaveLength(
      assigned.state.accessAudit?.filter((entry) => entry.roleId === sourceId).length ?? 0,
    )

    const edited = updateRole(copied.state, token, copy?.id ?? '', {
      displayName: 'Дворник изменён',
      description: 'только копия',
      grantIds: [reportsRead],
      delegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(edited.status).toBe(200)
    expect(edited.state.roles.find((role) => role.id === sourceId)?.displayName).toBe('Дворник')
    expect(edited.state.roles.find((role) => role.id === sourceId)?.grantIds).toEqual([reportsRead, tasksDelete, legacy])
    expect(edited.state.roles.find((role) => role.id === sourceId)?.delegationGrantIds).toEqual([reportsRead])

    const removed = deleteRole(edited.state, token, copy?.id ?? '')
    expect(removed.status).toBe(200)
    expect(removed.state.roles.some((role) => role.id === copy?.id)).toBe(false)
    expect(removed.state.roles.find((role) => role.id === sourceId)?.displayName).toBe('Дворник')
    expect(removed.state.assignments.some((item) => item.roleId === sourceId)).toBe(true)
  })

  it('rejects a copy into an area the caller cannot create in, and a permission the caller cannot delegate', () => {
    const owner = ownerSession()
    const formsRead = grantId(owner.state, 'forms', 'read')
    const tasksDelete = grantId(owner.state, 'tasks', 'delete')
    const created = createRole(owner.state, owner.token, {
      displayName: 'Дворник',
      description: '',
      grantIds: [formsRead, tasksDelete],
      delegationGrantIds: [formsRead],
      ownerScope: org(101),
    })
    expect(created.status).toBe(201)
    const sourceId = created.state.roles.find((role) => role.displayName === 'Дворник')?.id ?? ''
    const prepared: MockState = {
      ...created.state,
      roles: created.state.roles.map((role) => role.id === 'role-lab-admin'
        ? {
          ...role,
          grantIds: [...role.grantIds, grantId(created.state, 'roles', 'create')],
          delegationGrantIds: [
            ...(role.delegationGrantIds ?? []),
            formsRead,
            grantId(created.state, 'delegations', 'delegate'),
          ],
        }
        : role),
    }
    const admin = adminSession(prepared)
    const otherOrganization = duplicateRole(admin.state, admin.token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: '',
      grantIds: [formsRead],
      delegationGrantIds: [formsRead],
      omitGrantIds: [tasksDelete],
      omitDelegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(otherOrganization.status).toBe(403)
    expect(otherOrganization.body).toEqual({ code: 'forbidden' })
    expect(otherOrganization.state.roles.map((role) => role.id)).toEqual(admin.state.roles.map((role) => role.id))
    expect(otherOrganization.state.assignments).toEqual(admin.state.assignments)

    const missingOrganization = duplicateRole(created.state, owner.token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: '',
      grantIds: [formsRead],
      delegationGrantIds: [formsRead],
      omitGrantIds: [tasksDelete],
      omitDelegationGrantIds: [],
      ownerScope: { type: 'organization', organizationId: 999, corporationId: 1 },
    })
    expect(missingOrganization.status).toBe(403)
    expect(missingOrganization.body).toEqual({ code: 'invalid_scope' })
    expect(missingOrganization.state.roles).toBe(created.state.roles)

    const tooStrong = duplicateRole(admin.state, admin.token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: '',
      grantIds: [formsRead, tasksDelete],
      delegationGrantIds: [formsRead],
      omitGrantIds: [],
      omitDelegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(tooStrong.status).toBe(403)
    expect(tooStrong.body).toMatchObject({ code: 'grants_not_delegable' })
    expect(tooStrong.state.roles).toHaveLength(admin.state.roles.length)
    expect(tooStrong.state.accessAudit).toEqual(admin.state.accessAudit)

    const partial = duplicateRole(admin.state, admin.token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: '',
      grantIds: [formsRead],
      delegationGrantIds: [formsRead],
      omitGrantIds: [tasksDelete],
      omitDelegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(partial.status).toBe(201)
    const copyId = partial.state.roles.find((role) => role.displayName === 'Дворник (копия)')?.id ?? ''
    expect(partial.state.roles.find((role) => role.id === copyId)?.grantIds).toEqual([formsRead])
    expect(partial.state.roles.find((role) => role.id === copyId)?.delegationGrantIds).toEqual([formsRead])
    expect(partial.state.assignments.filter((item) => item.roleId === copyId)).toEqual([])
    const elevated = createAssignment(partial.state, admin.token, { userId: 2, roleId: copyId, scope: org(101) })
    expect(elevated.status).toBe(403)
    expect(elevated.body).toEqual({ code: 'self_elevation' })
    expect(elevated.state.assignments).toEqual(partial.state.assignments)
    expect(elevated.state.roles.find((role) => role.id === copyId)?.grantIds).toEqual([formsRead])
    expect(hasCorporateSuperadmin(toSnapshot(elevated.state), 2)).toBe(false)
  })

  it('does not accept corporate_superadmin, origin or assignments from a duplicate payload', () => {
    const { state, token } = ownerSession()
    const parsed = readRoleDuplicateWrite({
      sourceRoleId: 'role-decoy',
      displayName: 'СуперАдминистратор',
      description: 'название не является полномочием',
      grantIds: [],
      delegationGrantIds: [],
      omitGrantIds: [],
      omitDelegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
      systemCapabilities: ['corporate_superadmin'],
      capability: 'corporate_superadmin',
      origin: { template: 'organization-administrator' },
      assignments: [{ userId: 9, roleId: 'role-decoy' }],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).not.toHaveProperty('systemCapabilities')
    expect(parsed.value).not.toHaveProperty('origin')
    expect(parsed.value).not.toHaveProperty('assignments')
    const created = duplicateRole(state, token, parsed.value)
    expect(created.status).toBe(201)
    const copy = created.state.roles.find((role) => role.displayName === 'СуперАдминистратор')
    expect(copy?.id).not.toBe('role-decoy')
    expect(copy?.origin).toBeUndefined()
    expect(copy?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    expect(created.state.roles.find((role) => role.id === 'role-decoy')?.displayName).toBe('corporate_superadmin')
    expect(created.state.systemCapabilities).toEqual(state.systemCapabilities)
    expect(created.state.assignments).toEqual(state.assignments)
    expect(hasCorporateSuperadmin(toSnapshot(created.state), 9)).toBe(false)
    expect(isOfferedPermission('test-resource', 'read')).toBe(false)
  })

  it('keeps a duplicated role after the record is read again', async () => {
    const namespace = `inlog:mock:test-access-duplicate-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const opened = await readMockState(namespace)
    if (!opened.ok) throw new Error('missing record')
    const login = loginWithPassword(opened.state, 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = login.state.sessions.at(-1)?.accessToken ?? ''
    await updateMockState(() => login.state, namespace)
    await updateMockState((current) => {
      const result = duplicateRole(current, token, {
        sourceRoleId: 'role-decoy',
        displayName: 'После перезагрузки копия',
        description: 'сохранено',
        grantIds: [],
        delegationGrantIds: [],
        omitGrantIds: [],
        omitDelegationGrantIds: [],
        ownerScope: org(102),
      })
      if (result.status !== 201) throw new Error('copy was not saved')
      return result.state
    }, namespace)
    const again = await readMockState(namespace)
    expect(again.ok && again.state.roles.some((role) => role.displayName === 'После перезагрузки копия' && role.ownerScope && role.ownerScope.type === 'organization' && role.ownerScope.organizationId === 102)).toBe(true)
    expect(again.ok && again.state.roles.some((role) => role.id === 'role-decoy')).toBe(true)
    expect(again.ok && again.state.assignments.every((item) => item.roleId !== again.state.roles.find((role) => role.displayName === 'После перезагрузки копия')?.id)).toBe(true)
  })

  it('keeps corporate and local role areas separate from assignment scope', () => {
    const owner = ownerSession()
    const reports = grantId(owner.state, 'reports', 'read')
    const tasksRead = grantId(owner.state, 'tasks', 'read')
    const corporate = createRole(owner.state, owner.token, {
      displayName: 'Дворник',
      description: 'общая',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
    })
    expect(corporate.status).toBe(201)
    const corporateRole = corporate.state.roles.find((role) => role.displayName === 'Дворник')
    expect(corporateRole?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    const corporateId = corporateRole?.id ?? ''

    const local = createRole(corporate.state, owner.token, {
      displayName: 'Дворник — Тест лаба',
      description: 'местная',
      grantIds: [tasksRead],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(local.status).toBe(201)
    const localRole = local.state.roles.find((role) => role.displayName === 'Дворник — Тест лаба')
    const localId = localRole?.id ?? ''
    expect(localId).not.toBe(corporateId)

    const outside = createAssignment(local.state, owner.token, { userId: 4, roleId: localId, scope: org(102) })
    expect(outside.status).toBe(403)
    expect(outside.body).toEqual({ code: 'scope_expansion' })
    expect(outside.state.assignments).toEqual(local.state.assignments)

    const inLaboratory = createAssignment(local.state, owner.token, { userId: 3, roleId: corporateId, scope: org(101) })
    expect(inLaboratory.status).toBe(201)
    const otherLaboratory = createAssignment(inLaboratory.state, owner.token, { userId: 4, roleId: corporateId, scope: org(102) })
    expect(otherLaboratory.status).toBe(201)
    const repeated = createAssignment(otherLaboratory.state, owner.token, { userId: 3, roleId: corporateId, scope: org(101) })
    expect(repeated.status).toBe(200)
    expect(repeated.body).toMatchObject({ idempotent: true })
    expect(repeated.state.assignments.filter((item) => item.roleId === corporateId && item.userId === 3 && item.scope.type === 'organization')).toHaveLength(1)

    const snapshot = toSnapshot(otherLaboratory.state)
    expect(can(snapshot, 3, 'reports', 'read', org(101))).toBe(true)
    expect(can(snapshot, 3, 'reports', 'read', org(102))).toBe(false)
    expect(can(snapshot, 3, 'reports', 'read', { type: 'corporation', corporationId: 1 })).toBe(false)
    expect(can(snapshot, 4, 'reports', 'read', org(102))).toBe(true)
    expect(can(snapshot, 4, 'reports', 'read', org(101))).toBe(false)
    expect(hasCorporateSuperadmin(snapshot, 3)).toBe(false)
    expect(hasCorporateSuperadmin(snapshot, 4)).toBe(false)

    const secondRole = createAssignment(otherLaboratory.state, owner.token, { userId: 3, roleId: localId, scope: org(101) })
    expect(secondRole.status).toBe(201)
    expect(can(toSnapshot(secondRole.state), 3, 'tasks', 'read', org(101))).toBe(true)
    expect(can(toSnapshot(secondRole.state), 3, 'tasks', 'read', org(102))).toBe(false)
    expect(secondRole.state.assignments.filter((item) => item.userId === 3).map((item) => item.roleId)).toEqual(expect.arrayContaining([corporateId, localId]))

    const directory = readDirectory(secondRole.state, owner.token, { scope: null, organization: '101' })
    const roles = (directory.body as { roles: Array<{ id: string; ownerScope: { type: string }; affectedUserCount: number }> }).roles
    const listedCorporate = roles.filter((role) => role.id === corporateId)
    expect(listedCorporate).toHaveLength(1)
    expect(listedCorporate[0]?.ownerScope.type).toBe('corporation')
    expect(listedCorporate[0]?.affectedUserCount).toBe(1)
    const otherDirectory = readDirectory(secondRole.state, owner.token, { scope: null, organization: '102' })
    const otherRoles = (otherDirectory.body as { roles: Array<{ id: string; affectedUserCount: number }> }).roles
    expect(otherRoles.filter((role) => role.id === corporateId)).toHaveLength(1)
    expect(otherRoles.find((role) => role.id === corporateId)?.affectedUserCount).toBe(1)
    expect(otherRoles.some((role) => role.id === localId)).toBe(false)

    const foreign = createRole(owner.state, owner.token, {
      displayName: 'Чужая корпорация',
      description: '',
      grantIds: [],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 2 },
    })
    expect(foreign.status).toBe(403)
    expect(foreign.body).toEqual({ code: 'invalid_scope' })
    expect(foreign.state.roles).toBe(owner.state.roles)
  })

  it('lets an organization administrator create only a local role', () => {
    const owner = ownerSession()
    const reports = grantId(owner.state, 'reports', 'read')
    const sharedRole = createRole(owner.state, owner.token, {
      displayName: 'Общий читатель',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
    })
    const sharedId = sharedRole.state.roles.find((role) => role.displayName === 'Общий читатель')?.id ?? ''
    const prepared: MockState = {
      ...sharedRole.state,
      roles: sharedRole.state.roles.map((role) => role.id === 'role-lab-admin'
        ? {
          ...role,
          grantIds: [
            ...role.grantIds,
            grantId(owner.state, 'roles', 'create'),
            grantId(owner.state, 'roles', 'update'),
            grantId(owner.state, 'access-users', 'read'),
          ],
          delegationGrantIds: [...(role.delegationGrantIds ?? []), reports, grantId(owner.state, 'delegations', 'delegate')],
        }
        : role),
    }
    const admin = adminSession(prepared)
    const shared = createAssignment(admin.state, admin.token, { userId: 3, roleId: sharedId, scope: org(101) })
    expect(shared.status).toBe(201)
    expect(can(toSnapshot(shared.state), 3, 'reports', 'read', org(101))).toBe(true)
    expect(can(toSnapshot(shared.state), 3, 'reports', 'read', org(102))).toBe(false)
    const sharedElsewhere = createAssignment(admin.state, admin.token, { userId: 4, roleId: sharedId, scope: org(102) })
    expect(sharedElsewhere.status).toBe(403)

    const corporate = createRole(admin.state, admin.token, {
      displayName: 'Корпоративный дворник',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
    })
    expect(corporate.status).toBe(403)
    expect(corporate.body).toEqual({ code: 'forbidden' })
    expect(corporate.state.roles).toEqual(admin.state.roles)
    expect(corporate.state.systemCapabilities).toEqual(admin.state.systemCapabilities)

    const local = createRole(admin.state, admin.token, {
      displayName: 'Местный дворник',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(local.status).toBe(201)
    const roleId = local.state.roles.find((role) => role.displayName === 'Местный дворник')?.id ?? ''
    const assigned = createAssignment(local.state, admin.token, { userId: 3, roleId, scope: org(101) })
    expect(assigned.status).toBe(201)
    const widened = createAssignment(local.state, admin.token, { userId: 4, roleId, scope: org(102) })
    expect(widened.status).toBe(403)
    expect(widened.body).toEqual({ code: 'scope_expansion' })
    const card = readUser(local.state, admin.token, 3)
    const choice = (card.body as { roleChoices: Array<{ id: string; scopes: Array<{ scope: { type: string; organizationId?: number }; assignable: boolean }> }> }).roleChoices.find((role) => role.id === roleId)
    expect(choice?.scopes.find((item) => item.scope.type === 'organization' && item.scope.organizationId === 101)?.assignable).toBe(true)
    expect(choice?.scopes.find((item) => item.scope.organizationId === 102)?.assignable).not.toBe(true)
  })

  it('changes the area of an unassigned role and refuses the change after an assignment', () => {
    const { state, token } = ownerSession()
    const reports = grantId(state, 'reports', 'read')
    const created = createRole(state, token, {
      displayName: 'Свободная роль',
      description: 'описание',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((role) => role.displayName === 'Свободная роль')?.id ?? ''
    const moved = updateRole(created.state, token, roleId, {
      displayName: 'Свободная роль',
      description: 'описание',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
    })
    expect(moved.status).toBe(200)
    expect(moved.state.roles.find((role) => role.id === roleId)?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    expect(moved.state.roles.find((role) => role.id === roleId)?.grantIds).toEqual([reports])
    expect(moved.state.assignments).toEqual(created.state.assignments)
    expect(hasCorporateSuperadmin(toSnapshot(moved.state), 3)).toBe(false)

    const assigned = createAssignment(moved.state, token, { userId: 3, roleId, scope: org(101) })
    expect(assigned.status).toBe(201)
    const blocked = updateRole(assigned.state, token, roleId, {
      displayName: 'Свободная роль',
      description: 'описание',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(blocked.status).toBe(403)
    expect(blocked.body).toEqual({ code: 'scope_locked' })
    expect(blocked.state.roles.find((role) => role.id === roleId)?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    expect(blocked.state.assignments).toEqual(assigned.state.assignments)
    expect(can(toSnapshot(blocked.state), 3, 'reports', 'read', org(101))).toBe(true)
    expect(can(toSnapshot(blocked.state), 3, 'reports', 'read', org(102))).toBe(false)
  })

  it('copies a role into a corporate area without assignments, wider grants or corporate_superadmin', () => {
    const { state, token } = ownerSession()
    const reports = grantId(state, 'reports', 'read')
    const legacy = grantId(state, 'test-resource', 'read')
    const created = createRole(state, token, {
      displayName: 'Дворник',
      description: 'территория',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const sourceId = created.state.roles.find((role) => role.displayName === 'Дворник')?.id ?? ''
    const marked: MockState = {
      ...created.state,
      roles: created.state.roles.map((role) => role.id === sourceId
        ? { ...role, grantIds: [...role.grantIds, legacy] }
        : role),
    }
    const assigned = createAssignment(marked, token, { userId: 3, roleId: sourceId, scope: org(101) })
    const copied = duplicateRole(assigned.state, token, {
      sourceRoleId: sourceId,
      displayName: 'Дворник (копия)',
      description: 'территория',
      grantIds: [reports],
      delegationGrantIds: [],
      omitGrantIds: [legacy],
      omitDelegationGrantIds: [],
      ownerScope: { type: 'corporation', corporationId: 1 },
    })
    expect(copied.status).toBe(201)
    const copy = copied.state.roles.find((role) => role.displayName === 'Дворник (копия)')
    expect(copy?.id).toBeTruthy()
    expect(copy?.id).not.toBe(sourceId)
    expect(copy?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    expect(copy?.grantIds).toEqual([reports])
    expect(copy?.grantIds).not.toBe(copied.state.roles.find((role) => role.id === sourceId)?.grantIds)
    expect(copied.state.assignments.filter((item) => item.roleId === copy?.id)).toEqual([])
    expect(copied.state.assignments.filter((item) => item.roleId === sourceId)).toHaveLength(1)
    expect(copied.state.systemCapabilities).toEqual(state.systemCapabilities)
    const placed = createAssignment(copied.state, token, { userId: 4, roleId: copy?.id ?? '', scope: org(102) })
    expect(placed.status).toBe(201)
    expect(can(toSnapshot(placed.state), 4, 'reports', 'read', org(102))).toBe(true)
    expect(can(toSnapshot(placed.state), 4, 'reports', 'read', org(101))).toBe(false)
    expect(hasCorporateSuperadmin(toSnapshot(placed.state), 4)).toBe(false)
    expect(placed.state.roles.find((role) => role.id === sourceId)?.grantIds).toEqual([reports, legacy])
  })

  it('loads stored roles after a schema migration and keeps their areas', () => {
    const seed = createSeed()
    const employeeGrants = seed.roles.find((role) => role.id === 'role-employee')?.grantIds ?? []
    const stored: MockState = {
      ...seed,
      schemaVersion: 11,
      roles: seed.roles.map((role) => role.id === 'role-employee' ? { ...role, ownerScope: org(101) } : role),
    }
    const migrated = migrateMockDocument(stored)
    expect(migrated?.changed).toBe(true)
    expect(migrated?.state.schemaVersion).toBe(12)
    expect(migrated?.state.roles.map((role) => role.id)).toEqual(stored.roles.map((role) => role.id))
    expect(migrated?.state.roles.find((role) => role.id === 'role-employee')?.ownerScope).toEqual(org(101))
    expect(migrated?.state.roles.find((role) => role.id === 'role-employee')?.grantIds).toEqual(employeeGrants)
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.ownerScope).toBeUndefined()
    expect(migrated?.state.assignments).toEqual(stored.assignments)
    expect(migrated?.state.systemCapabilities).toEqual(stored.systemCapabilities)
    expect(migrated?.state.grants.map((grant) => grant.id)).toEqual(stored.grants.map((grant) => grant.id))
  })

  it('keeps a corporate role area after the mock record is read again', async () => {
    const namespace = `inlog:mock:test-role-area-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const opened = await readMockState(namespace)
    if (!opened.ok) throw new Error('missing record')
    const login = loginWithPassword(opened.state, 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = login.state.sessions.at(-1)?.accessToken ?? ''
    await updateMockState(() => login.state, namespace)
    await updateMockState((current) => {
      const result = createRole(current, token, {
        displayName: 'Корпоративный дворник',
        description: 'после перезагрузки',
        grantIds: [],
        delegationGrantIds: [],
        ownerScope: { type: 'corporation', corporationId: 1 },
      })
      if (result.status !== 201) throw new Error('role was not saved')
      return result.state
    }, namespace)
    const again = await readMockState(namespace)
    const role = again.ok ? again.state.roles.find((item) => item.displayName === 'Корпоративный дворник') : undefined
    expect(role?.ownerScope).toEqual({ type: 'corporation', corporationId: 1 })
    expect(role?.id).not.toBe('role-owner')
    expect(again.ok && again.state.assignments.every((item) => item.roleId !== role?.id)).toBe(true)
    expect(again.ok && again.state.systemCapabilities).toEqual(opened.state.systemCapabilities)
  })
})
