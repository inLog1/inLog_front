import { describe, expect, it } from 'vitest'
import { hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import type { AccessDirectory, AccessUserDetail, AccessUsersPage } from '../../../entities/access/model/directory'
import { loginWithPassword, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { createAssignment, createRole, readDirectory, revokeAssignment } from './service'
import { readUser, readUsers } from './users'

const org = (organizationId: number) => ({ type: 'organization' as const, organizationId, corporationId: 1 })
const project = { type: 'project' as const, projectId: 1001, organizationId: 101, corporationId: 1 }

function sessionFor(state: MockState, email: string, userId: number) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = [...login.state.sessions].reverse().find((item) => item.userId === userId)?.accessToken ?? ''
  return { state: login.state, token }
}

function grantId(state: MockState, resource: string, action: string): string {
  const grant = state.grants.find((item) => item.resource === resource && item.action === action)
  if (!grant) throw new Error(`missing ${resource}.${action}`)
  return grant.id
}

function withDirectoryRead(state: MockState, options: { dropAssign?: boolean; delegation?: string[] } = {}): MockState {
  const readId = grantId(state, 'access-users', 'read')
  return {
    ...state,
    roles: state.roles.map((role) => {
      if (role.id !== 'role-lab-admin') return role
      const grantIds = role.grantIds.filter((id) => (options.dropAssign ? id !== 'g-assign' : true))
      return {
        ...role,
        grantIds: grantIds.includes(readId) ? grantIds : [...grantIds, readId],
        delegationGrantIds: [...(role.delegationGrantIds ?? []), ...(options.delegation ?? [])],
      }
    }),
  }
}

function page(result: { body: unknown }): AccessUsersPage {
  return result.body as AccessUsersPage
}

function detail(result: { body: unknown }): AccessUserDetail {
  return result.body as AccessUserDetail
}

describe('access user directory', () => {
  it('shows the owner every person in the corporation, including someone with no assignment', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const listed = readUsers(state, token, { organization: 'all', q: null, page: null, pageSize: null })
    expect(listed.status).toBe(200)
    const body = page(listed)
    expect(body.coverage).toBe('corporation')
    expect(body.count).toBe(state.users.length)
    expect(body.users.map((user) => user.id)).toContain(6)
    expect(body.users.find((user) => user.id === 6)?.assignments).toEqual([])
    expect(body.users.find((user) => user.id === 9)?.assignments).toEqual([])
    expect(body.users.find((user) => user.id === 1)?.corporateSuperadmin).toBe(true)
    expect(body.users.find((user) => user.id === 3)?.corporateSuperadmin).toBe(false)
    const employee = body.users.find((user) => user.id === 3)
    expect(employee?.assignments.map((item) => item.scope.type)).toContain('organization')
    expect(body.users.filter((user) => user.id === 3)).toHaveLength(1)
  })

  it('keeps the corporation directory limited to corporation assignments', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const directory = readDirectory(state, token, { scope: 'corporation', organization: null })
    const body = directory.body as AccessDirectory
    expect(body.assignments.every((item) => item.scope.type === 'corporation')).toBe(true)
    expect(body.assignments.some((item) => item.scope.type === 'organization')).toBe(false)
  })

  it('lists several roles and areas on one row and does not grant the new read right to stored roles', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    expect(state.roles.every((role) => !role.grantIds.includes('g-access-users-read'))).toBe(true)
    expect(state.roles.every((role) => !(role.delegationGrantIds ?? []).includes('g-access-users-read'))).toBe(true)
    const created = createRole(state, token, {
      displayName: 'Чтение отчётов проекта',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((role) => role.displayName === 'Чтение отчётов проекта')?.id ?? ''
    const assigned = createAssignment(created.state, token, { userId: 3, roleId, scope: project })
    const listed = readUsers(assigned.state, token, { organization: 'all', q: 'Соколова', page: '1', pageSize: '20' })
    const body = page(listed)
    expect(body.count).toBe(1)
    expect(body.users).toHaveLength(1)
    expect(body.users[0]?.assignments.map((item) => item.scope.type).sort()).toEqual(['organization', 'project'])
    expect(body.query).toEqual({ organization: 'all', q: 'Соколова', page: 1, pageSize: 20 })
  })

  it('lets a reader see the directory and refuses assignment changes', () => {
    const prepared = withDirectoryRead(createSeed(), { dropAssign: true })
    const { state, token } = sessionFor(prepared, 'admin.a@example.test', 2)
    const listed = readUsers(state, token, { organization: 'all', q: '', page: '1', pageSize: '20' })
    expect(listed.status).toBe(200)
    const body = page(listed)
    expect(body.coverage).toBe('granted')
    expect(body.users.find((user) => user.id === 3)?.assignments.every((item) => item.canRevoke === false)).toBe(true)
    const card = readUser(state, token, 3)
    expect(detail(card).canAssign).toBe(false)
    const created = createAssignment(state, token, { userId: 3, roleId: 'role-employee', scope: org(101) })
    expect(created.status).toBe(403)
    expect(created.state.assignments).toEqual(state.assignments)
    const revoked = revokeAssignment(state, token, 'asg-employee-a')
    expect(revoked.status).toBe(403)
    expect(revoked.state.assignments).toEqual(state.assignments)
  })

  it('hides the other laboratory from search, count, names and a direct read', () => {
    const prepared = withDirectoryRead(createSeed())
    const { state, token } = sessionFor(prepared, 'admin.a@example.test', 2)
    const listed = readUsers(state, token, { organization: 'all', q: 'Морозов', page: '1', pageSize: '20' })
    expect(page(listed).count).toBe(0)
    expect(page(listed).users).toEqual([])
    const byEmail = readUsers(state, token, { organization: 'all', q: 'employee.b@example.test', page: '1', pageSize: '2' })
    expect(page(byEmail).count).toBe(0)
    const everyone = readUsers(state, token, { organization: 'all', q: '', page: '1', pageSize: '50' })
    const text = JSON.stringify(everyone.body)
    expect(text).not.toContain('employee.b@example.test')
    expect(text).not.toContain('Морозов')
    expect(text).not.toContain('Лаб. Б')
    expect(text).not.toContain('Координатор')
    expect(page(everyone).count).toBeLessThan(state.users.length)
    expect(page(everyone).users.map((user) => user.id)).not.toContain(4)
    expect(page(everyone).users.map((user) => user.id)).not.toContain(6)
    const hidden = readUser(state, token, 4)
    expect(hidden.status).toBe(404)
    expect(hidden.body).toEqual({ code: 'not_found' })
    const other = readUsers(state, token, { organization: '102', q: '', page: '1', pageSize: '20' })
    expect(other.status).toBe(403)
    expect(other.body).toEqual({ code: 'forbidden' })
    const foreign = revokeAssignment(state, token, 'asg-employee-b')
    expect(foreign.status).toBe(403)
    expect(foreign.state.assignments.some((item) => item.id === 'asg-employee-b')).toBe(true)
  })

  it('does not treat an operational permission as delegation and rejects a wider scope and self-elevation', () => {
    const seed = createSeed()
    const reports = grantId(seed, 'reports', 'read')
    const tasksRead = grantId(seed, 'tasks', 'read')
    const owner = sessionFor(seed, 'owner@example.test', 1)
    const reportsRole = createRole(owner.state, owner.token, {
      displayName: 'Только отчёты',
      description: '',
      grantIds: [reports],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const reportsId = reportsRole.state.roles.find((role) => role.displayName === 'Только отчёты')?.id ?? ''
    const prepared = withDirectoryRead(reportsRole.state, { delegation: [tasksRead] })
    const admin = sessionFor(prepared, 'admin.a@example.test', 2)
    const card = detail(readUser(admin.state, admin.token, 3))
    const blocked = card.roleChoices.find((role) => role.id === reportsId)
    const laboratory = blocked?.scopes.find((item) => item.scope.type === 'organization')
    expect(laboratory?.assignable).toBe(false)
    expect(laboratory?.reason).toBe('forbidden')
    const denied = createAssignment(admin.state, admin.token, { userId: 3, roleId: reportsId, scope: org(101) })
    expect(denied.status).toBe(403)
    expect(denied.state.assignments).toEqual(admin.state.assignments)

    const tasksRole = createRole(owner.state, owner.token, {
      displayName: 'Чтение задач для себя',
      description: '',
      grantIds: [tasksRead],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const tasksId = tasksRole.state.roles.find((role) => role.displayName === 'Чтение задач для себя')?.id ?? ''
    const delegated = withDirectoryRead(tasksRole.state, { delegation: [tasksRead] })
    const actor = sessionFor(delegated, 'admin.a@example.test', 2)
    const selfCard = detail(readUser(actor.state, actor.token, 2))
    const selfChoice = selfCard.roleChoices.find((role) => role.id === tasksId)
    expect(selfChoice?.scopes.find((item) => item.scope.type === 'organization')?.reason).toBe('self_elevation')
    const self = createAssignment(actor.state, actor.token, { userId: 2, roleId: tasksId, scope: org(101) })
    expect(self.status).toBe(403)
    expect(self.body).toEqual({ code: 'self_elevation' })
    expect(self.state.assignments).toEqual(actor.state.assignments)

    const widened = createAssignment(actor.state, actor.token, {
      userId: 3,
      roleId: tasksId,
      scope: { type: 'corporation', corporationId: 1 },
    })
    expect(widened.status).toBe(403)
    expect(widened.state.assignments).toEqual(actor.state.assignments)
    const ownerCard = detail(readUser(tasksRole.state, owner.token, 3))
    const expansion = ownerCard.roleChoices.find((role) => role.id === tasksId)
    expect(expansion?.scopes.find((item) => item.scope.type === 'corporation')?.reason).toBe('scope_expansion')
  })

  it('keeps an exact assignment idempotent and removes only the chosen one', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const once = createAssignment(state, token, { userId: 3, roleId: 'role-customer', scope: org(101) })
    const twice = createAssignment(once.state, token, { userId: 3, roleId: 'role-customer', scope: org(101) })
    expect(twice.status).toBe(200)
    expect(twice.body).toMatchObject({ idempotent: true })
    expect(twice.state.assignments.filter((item) => item.userId === 3 && item.roleId === 'role-customer')).toHaveLength(1)
    const extra = twice.state.assignments.find((item) => item.userId === 3 && item.roleId === 'role-customer')
    const revoked = revokeAssignment(twice.state, token, extra?.id ?? '')
    expect(revoked.state.assignments.some((item) => item.id === 'asg-employee-a')).toBe(true)
    expect(revoked.state.assignments.some((item) => item.id === extra?.id)).toBe(false)
    expect(revoked.state.memberships).toEqual(state.memberships)
  })

  it('rejects a stale version without changing assignments or the capability', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const staleCreate = createAssignment(state, token, {
      userId: 3,
      roleId: 'role-customer',
      scope: org(101),
      expectedAccessVersion: state.accessVersion - 1,
    })
    expect(staleCreate.status).toBe(409)
    expect(staleCreate.body).toEqual({ code: 'stale_write' })
    expect(staleCreate.state.assignments).toEqual(state.assignments)
    expect(staleCreate.state.systemCapabilities).toEqual(state.systemCapabilities)
    const staleRevoke = revokeAssignment(state, token, 'asg-owner', state.accessVersion - 1)
    expect(staleRevoke.status).toBe(409)
    expect(staleRevoke.state.assignments).toEqual(state.assignments)
    expect(hasCorporateSuperadmin(toSnapshot(staleRevoke.state), 1)).toBe(true)
  })

  it('does not add or remove corporate_superadmin through a role assignment', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const copied = createAssignment(state, token, { userId: 3, roleId: 'role-decoy', scope: org(101) })
    expect(copied.status).toBe(201)
    expect(hasCorporateSuperadmin(toSnapshot(copied.state), 3)).toBe(false)
    expect(copied.state.systemCapabilities).toEqual(state.systemCapabilities)
    const removed = revokeAssignment(copied.state, token, 'asg-owner')
    expect(removed.status).toBe(200)
    expect(hasCorporateSuperadmin(toSnapshot(removed.state), 1)).toBe(true)
    expect(removed.state.systemCapabilities).toEqual(state.systemCapabilities)
    expect(removed.state.memberships).toEqual(state.memberships)
  })

  it('leaves the previous assignment in place when a second one is refused', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const created = createRole(state, token, {
      displayName: 'Узкая',
      description: '',
      grantIds: [grantId(state, 'reports', 'read')],
      delegationGrantIds: [],
      ownerScope: org(101),
    })
    const roleId = created.state.roles.find((role) => role.displayName === 'Узкая')?.id ?? ''
    const first = createAssignment(created.state, token, { userId: 3, roleId, scope: org(101) })
    expect(first.status).toBe(201)
    const second = createAssignment(first.state, token, {
      userId: 3,
      roleId,
      scope: { type: 'corporation', corporationId: 1 },
    })
    expect(second.status).toBe(403)
    expect(second.state.assignments).toEqual(first.state.assignments)
    expect(second.state.memberships).toEqual(first.state.memberships)
  })

  it('pages inside the visible set and echoes the query that produced the page', () => {
    const { state, token } = sessionFor(createSeed(), 'owner@example.test', 1)
    const first = readUsers(state, token, { organization: '101', q: '', page: '1', pageSize: '2' })
    const second = readUsers(state, token, { organization: '101', q: '', page: '2', pageSize: '2' })
    expect(page(first).count).toBe(page(second).count)
    expect(page(first).count).toBeGreaterThan(2)
    expect(page(first).users.map((user) => user.id)).not.toEqual(page(second).users.map((user) => user.id))
    expect(page(first).query).toEqual({ organization: 101, q: '', page: 1, pageSize: 2 })
    expect(page(second).query.page).toBe(2)
    const missing = readUsers(state, token, { organization: '101', q: '', page: '0', pageSize: '2' })
    expect(missing.status).toBe(400)
    expect(missing.body).toEqual({ code: 'invalid_page' })
  })
})
