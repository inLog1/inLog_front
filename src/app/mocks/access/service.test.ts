import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { accessManagementMode } from '../../../entities/access'
import {
  can,
  canDelegate,
  capabilityFromRoleDisplayName,
  hasCorporateSuperadmin,
} from '../../../entities/access/model/grants'
import { accessFor, loginWithPassword, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { ensureMockState, readMockState, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import {
  createAssignment,
  createRole,
  deleteRole,
  readAssignmentWrite,
  readDirectory,
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
    const seed = createSeed()
    const tasksRead = grantId(seed, 'tasks', 'read')
    const prepared: MockState = {
      ...seed,
      roles: seed.roles.map((role) => role.id === 'role-lab-admin'
        ? { ...role, delegationGrantIds: [...(role.delegationGrantIds ?? []), tasksRead] }
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
    expect(missingUser.status).toBe(403)
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

    const created = createRole(admin.state, admin.token, {
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
    const tooStrong = createRole(admin.state, admin.token, {
      displayName: 'Удаление задач',
      description: '',
      grantIds: [grantId(state, 'tasks', 'delete')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    expect(tooStrong.status).toBe(403)
    const otherOrganization = createRole(admin.state, admin.token, {
      displayName: 'Чужая лаборатория',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(102),
    })
    expect(otherOrganization.status).toBe(403)
    const edited = updateRole(admin.state, admin.token, 'role-employee', {
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

  it('reports that live mode does not call the access contract', () => {
    expect(accessManagementMode('live')).toBe('unavailable')
    expect(accessManagementMode(undefined)).toBe('unavailable')
    expect(accessManagementMode('mock')).toBe('mock')
  })
})
