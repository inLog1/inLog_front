import { describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { can, capabilityFromRoleDisplayName, hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import { shouldComposeTask } from '../../../features/tasks/model/compose-task'
import { createEmptyInstallation } from '../db/empty-installation'
import { migrateMockDocument } from '../db/migrate'
import {
  ensureMockState,
  MockWriterHeldError,
  readMockState,
  releaseMockWriter,
  setMockLockSource,
  setMockWriterId,
  updateMockState,
} from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { configureInstallation, createOrganization, createProject } from '../installation/service'
import { listOrganizations, listProjects, loginWithPassword, switchUser, toSnapshot } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { ORGANIZATION_READ_GRANT, ORGANIZATION_UPDATE_GRANT, PROJECT_UPDATE_GRANT } from '../db/organization-grants'
import {
  readDirectory,
  updateOrganizationRecord,
  updateProjectRecord,
  type DirectoryBody,
} from './service'

const corporation = { type: 'corporation' as const, corporationId: 1 }

function session(email: string, state = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  return { state: login.state, token: login.state.sessions[0]?.accessToken ?? '' }
}

function directory(email: string, state = createSeed()): DirectoryBody {
  const opened = session(email, state)
  const result = readDirectory(opened.state, opened.token)
  expect(result.status).toBe(200)
  return result.body as DirectoryBody
}

function withGrant(state: MockState, userId: number, grantId: string, scope: MockState['assignments'][number]['scope']): MockState {
  return {
    ...state,
    assignments: [
      ...state.assignments,
      { id: `asg-extra-${userId}-${grantId}`, userId, roleId: `role-extra-${grantId}`, scope },
    ],
    roles: [
      ...state.roles,
      { id: `role-extra-${grantId}`, displayName: 'Ограниченная роль', grantIds: [grantId], delegationGrantIds: [] },
    ],
  }
}

describe('organization directory', () => {
  it('lets the owner open management and create the first organization without a project', async () => {
    const ready = configureInstallation(createEmptyInstallation('personal-memory'), {
      corporationName: 'Север',
      givenName: 'Алина',
      surname: 'Власова',
      email: 'owner@personal.test',
      salt: 'salt',
      hash: 'hash',
    })
    const snapshot = toSnapshot(ready)
    expect(ready.organizations).toEqual([])
    expect(ready.projects).toEqual([])
    expect(hasCorporateSuperadmin(snapshot, 1)).toBe(true)
    expect(can(snapshot, 1, 'organizations', 'create', corporation)).toBe(true)
    expect(can(snapshot, 1, 'organizations', 'update', corporation)).toBe(true)
    expect(can(snapshot, 1, 'projects', 'create', corporation)).toBe(true)
    expect(can(snapshot, 1, 'organizations', 'delete', corporation)).toBe(false)
    expect(can(snapshot, 1, 'equipment', 'read', corporation)).toBe(false)
    expect(loginWithPassword(ready, 'owner@personal.test', PUBLIC_FIXTURE_PASSWORD).status).toBe(401)
    expect(readDirectory(ready, 'missing').status).toBe(401)
    const issued = switchUser(ready, 1)
    const token = issued.body && typeof issued.body === 'object' && 'access_token' in issued.body
      ? String(issued.body.access_token)
      : ''
    const emptyView = readDirectory(issued.state, token)
    expect(emptyView.status).toBe(200)
    const emptyBody = emptyView.body as DirectoryBody
    expect(emptyBody.corporation_empty).toBe(true)
    expect(emptyBody.organizations_hidden).toBe(false)
    expect(emptyBody.create_organization).toBe(true)
    expect(emptyBody.organizations).toEqual([])
    const created = createOrganization(ready, 1, {
      fullName: 'Лаборатория Север',
      shortName: 'Север',
      address: 'Полевая, 1',
      kind: 'laboratory',
    })
    if (!('organization' in created)) throw new Error('organization')
    expect(created.organization.id).toBeGreaterThan(0)
    expect(created.organization.revision).toBe(1)
    expect(created.state.memberships).toEqual(ready.memberships)
    expect(created.state.assignments).toEqual(ready.assignments)
    expect(created.state.systemCapabilities).toEqual(ready.systemCapabilities)
    expect(created.state.users.find((user) => user.id === 1)?.legacyRole).toBe('member')
  })

  it('keeps workspace lists for domain grants and hides full requisites from the directory', () => {
    const employee = session('employee.a@example.test')
    const workspace = listOrganizations(employee.state, employee.token)
    expect(JSON.stringify(workspace.body)).toContain('Лаборатория А')
    expect(JSON.stringify(workspace.body)).toContain('Демо, корпус А')
    const view = directory('employee.a@example.test')
    expect(view.organizations).toEqual([])
    expect(view.organizations_hidden).toBe(true)
    expect(view.corporation_empty).toBe(false)
    expect(view.create_organization).toBe(false)
    expect(view.projects.map((project) => project.name).sort()).toEqual(['Проект А-1', 'Проект А-2'])
    expect(JSON.stringify(view)).not.toContain('Демо, корпус')
    expect(JSON.stringify(view)).not.toContain('Лаборатория А')
    expect(view.projects[0]?.organization).toEqual({ id: 101, short_name: 'Лаб. А' })
    expect(listProjects(employee.state, employee.token, 101).status).toBe(200)
  })

  it('does not let create reveal existing organizations or turn read into update', () => {
    const createOnly = withGrant(createSeed(), 6, 'g-organizations-create', corporation)
    const view = directory('pending@example.test', createOnly)
    expect(view.create_organization).toBe(true)
    expect(view.organizations).toEqual([])
    expect(view.organizations_hidden).toBe(true)
    expect(view.corporation_empty).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Лаборатория')
    expect(JSON.stringify(view)).not.toMatch(/"count"/)

    const readOnly = withGrant(createSeed(), 4, ORGANIZATION_READ_GRANT.id, {
      type: 'organization',
      organizationId: 102,
      corporationId: 1,
    })
    const reader = session('employee.b@example.test', readOnly)
    const readable = readDirectory(reader.state, reader.token).body as DirectoryBody
    expect(readable.organizations.map((item) => item.id)).toEqual([102])
    expect(readable.organizations[0]?.can_update).toBe(false)
    const denied = updateOrganizationRecord(reader.state, reader.token, 102, {
      fullName: 'Чужое имя',
      expectedRevision: 1,
    })
    expect(denied.status).toBe(403)
    expect(denied.state.organizations.find((item) => item.id === 102)?.fullName).toBe('Лаборатория Б')

    const updateOnly = withGrant(createSeed(), 4, ORGANIZATION_UPDATE_GRANT.id, {
      type: 'organization',
      organizationId: 102,
      corporationId: 1,
    })
    const editor = session('employee.b@example.test', updateOnly)
    const hidden = readDirectory(editor.state, editor.token).body as DirectoryBody
    expect(hidden.organizations).toEqual([])
    const renamed = updateOrganizationRecord(editor.state, editor.token, 102, {
      fullName: 'Лаборатория Бэ',
      expectedRevision: 1,
    })
    expect(renamed.status).toBe(200)
    expect(renamed.state.organizations.find((item) => item.id === 102)?.fullName).toBe('Лаборатория Бэ')
  })

  it('keeps administrator A away from laboratory B and a project grant away from the whole organization', () => {
    const admin = session('admin.a@example.test')
    const view = readDirectory(admin.state, admin.token).body as DirectoryBody
    expect(view.organizations).toEqual([])
    expect(JSON.stringify(view)).not.toContain('Лаборатория Б')
    expect(JSON.stringify(view)).not.toContain('Проект Б-1')
    const blocked = updateOrganizationRecord(admin.state, admin.token, 102, {
      shortName: 'Чужая',
      expectedRevision: 1,
    })
    expect(blocked.status).toBe(403)
    expect(blocked.state.organizations.find((item) => item.id === 102)?.shortName).toBe('Лаб. Б')
    const moved = updateProjectRecord(admin.state, admin.token, 1002, {
      name: 'Перенос',
      expectedRevision: 1,
    })
    expect(moved.status).toBe(403)

    const projectUser = session('project.only@example.test')
    const scoped = readDirectory(projectUser.state, projectUser.token).body as DirectoryBody
    expect(scoped.organizations).toEqual([])
    expect(scoped.projects.map((project) => project.id)).toEqual([1001])
    expect(JSON.stringify(scoped)).not.toContain('Проект А-2')
    expect(JSON.stringify(scoped)).not.toContain('Демо, корпус')
    expect(scoped.projects[0]?.organization).toEqual({ id: 101, short_name: 'Лаб. А' })
    const workspaceProjects = listProjects(projectUser.state, projectUser.token, 101)
    expect(JSON.stringify(workspaceProjects.body)).toContain('Проект А-1')
    expect(JSON.stringify(workspaceProjects.body)).not.toContain('Проект А-2')
  })

  it('checks project creation against the organization and rejects a forged corporation, id or move', () => {
    const creator = withGrant(createSeed(), 3, 'g-projects-create', {
      type: 'organization',
      organizationId: 101,
      corporationId: 1,
    })
    const employee = session('employee.a@example.test', creator)
    const allowed = createProject(employee.state, 3, {
      organizationId: 101,
      name: 'Новый',
      reservoir: 'Пласт',
    })
    expect('project' in allowed && allowed.project.organizationId).toBe(101)
    expect(createProject(employee.state, 3, {
      organizationId: 102,
      name: 'Чужой',
      reservoir: 'Нет',
    })).toEqual({ error: 'forbidden' })
    const view = readDirectory(employee.state, employee.token).body as DirectoryBody
    expect(view.project_create_targets).toEqual([{ id: 101, short_name: 'Лаб. А' }])
    expect(view.projects.map((project) => project.id)).not.toContain(1002)

    const owner = session('owner@example.test')
    const forged = updateOrganizationRecord(owner.state, owner.token, 101, {
      fullName: 'Лаборатория А',
      corporationId: 99,
      expectedRevision: 1,
    })
    expect(forged.status).toBe(400)
    expect(forged.state.organizations.find((item) => item.id === 101)?.corporationId).toBe(1)
    const relabeled = updateOrganizationRecord(owner.state, owner.token, 101, {
      id: 500,
      expectedRevision: 1,
    })
    expect(relabeled.status).toBe(400)
    const moved = updateProjectRecord(owner.state, owner.token, 1001, {
      organizationId: 102,
      expectedRevision: 1,
    })
    expect(moved.status).toBe(400)
    expect(moved.state.projects.find((item) => item.id === 1001)?.organizationId).toBe(101)
    const mismatched: MockState = {
      ...owner.state,
      installationCorporationId: 2,
      corporation: { id: 1, name: owner.state.corporation.name },
    }
    const hidden = readDirectory(mismatched, owner.token)
    expect(hidden.status).toBe(403)
    expect(JSON.stringify(hidden.body)).not.toContain('Лаборатория')
    expect(updateOrganizationRecord(mismatched, owner.token, 101, {
      fullName: 'Подмена',
      expectedRevision: 1,
    }).status).toBe(403)
  })

  it('rejects a stale write, a blocked user and a role title that only looks like capability', () => {
    expect(capabilityFromRoleDisplayName('corporate_superadmin')).toEqual([])
    const decoy = withGrant(createSeed(), 4, 'role-decoy', corporation)
    const titled = {
      ...decoy,
      roles: decoy.roles.map((role) => role.id === 'role-extra-role-decoy'
        ? { ...role, displayName: 'corporate_superadmin', grantIds: [] }
        : role),
    }
    expect(hasCorporateSuperadmin(toSnapshot(titled), 4)).toBe(false)
    expect(can(toSnapshot(titled), 4, 'organizations', 'update', {
      type: 'organization',
      organizationId: 102,
      corporationId: 1,
    })).toBe(false)

    const owner = session('owner@example.test')
    const first = updateOrganizationRecord(owner.state, owner.token, 101, {
      fullName: 'Лаборатория А+',
      expectedRevision: 1,
    })
    expect(first.status).toBe(200)
    const stale = updateOrganizationRecord(first.state, owner.token, 101, {
      fullName: 'Стёрто',
      expectedRevision: 1,
    })
    expect(stale.status).toBe(409)
    expect(stale.state.organizations.find((item) => item.id === 101)?.fullName).toBe('Лаборатория А+')
    const ignoredVersion = updateOrganizationRecord(first.state, owner.token, 101, {
      fullName: 'По версии доступа',
      expectedRevision: null,
    })
    expect(ignoredVersion.status).toBe(400)
    expect(ignoredVersion.state.organizations.find((item) => item.id === 101)?.fullName).toBe('Лаборатория А+')

    const blockedState: MockState = {
      ...owner.state,
      users: owner.state.users.map((user) => user.id === 1 ? { ...user, status: 'blocked' } : user),
    }
    const blocked = updateProjectRecord(blockedState, owner.token, 1001, {
      name: 'Нельзя',
      expectedRevision: 1,
    })
    expect(blocked.status).toBe(403)
    expect((blocked.body as { code: string }).code).toBe('blocked')
    expect(blocked.state.projects.find((item) => item.id === 1001)?.name).toBe('Проект А-1')
  })

  it('renames a project without changing its id, tasks or forms', () => {
    const owner = session('owner@example.test')
    const taskIds = owner.state.tasks.filter((task) => task.projectId === 1001).map((task) => task.id)
    expect(taskIds.length).toBeGreaterThan(0)
    const withForm: MockState = {
      ...owner.state,
      forms: [{
        id: 'form-lab-a',
        organizationId: 101,
        title: 'Журнал',
        description: '',
        publishedVersionId: null,
        revision: 4,
      }],
    }
    const renamed = updateProjectRecord(withForm, owner.token, 1001, {
      name: 'Проект А-1 новое',
      expectedRevision: 1,
    })
    expect(renamed.status).toBe(200)
    const project = renamed.state.projects.find((item) => item.id === 1001)
    expect(project?.name).toBe('Проект А-1 новое')
    expect(project?.organizationId).toBe(101)
    expect(project?.revision).toBe(2)
    expect(renamed.state.tasks.filter((task) => task.projectId === 1001).map((task) => task.id)).toEqual(taskIds)
    expect(renamed.state.forms).toEqual(withForm.forms)
    const organization = updateOrganizationRecord(renamed.state, owner.token, 101, {
      fullName: 'Лаборатория А новое',
      expectedRevision: 1,
    })
    expect(organization.state.organizations.find((item) => item.id === 101)?.id).toBe(101)
    expect(organization.state.forms[0]?.organizationId).toBe(101)
    expect(organization.state.forms[0]?.revision).toBe(4)
  })

  it('does not copy the new catalog rows into stored roles', () => {
    const seed = createSeed()
    const storedRoles = seed.roles.map((role) => ({
      ...role,
      grantIds: role.grantIds.filter((id) => id !== ORGANIZATION_READ_GRANT.id && id !== ORGANIZATION_UPDATE_GRANT.id && id !== PROJECT_UPDATE_GRANT.id),
    }))
    const legacy: MockState = {
      ...seed,
      schemaVersion: 8,
      grants: seed.grants.filter((grant) =>
        grant.id !== ORGANIZATION_READ_GRANT.id
        && grant.id !== ORGANIZATION_UPDATE_GRANT.id
        && grant.id !== PROJECT_UPDATE_GRANT.id,
      ),
      roles: storedRoles,
      organizations: seed.organizations.map((organization) => ({ ...organization, revision: undefined })),
      projects: seed.projects.map((project) => ({ ...project, revision: undefined })),
    }
    const migrated = migrateMockDocument(legacy)
    expect(migrated?.state.grants.some((grant) => grant.id === ORGANIZATION_READ_GRANT.id)).toBe(true)
    expect(migrated?.state.grants.some((grant) => grant.id === ORGANIZATION_UPDATE_GRANT.id)).toBe(true)
    expect(migrated?.state.grants.some((grant) => grant.id === PROJECT_UPDATE_GRANT.id)).toBe(true)
    expect(migrated?.state.roles.map((role) => role.grantIds)).toEqual(storedRoles.map((role) => role.grantIds))
    expect(migrated?.state.organizations.every((organization) => organization.revision === 1)).toBe(true)
    expect(migrated?.state.projects.every((project) => project.revision === 1)).toBe(true)
    expect(migrated?.state.tasks).toEqual(seed.tasks)
    expect(migrated?.state.forms).toEqual(seed.forms)
  })

  it('does not compose a task without a project', () => {
    expect(shouldComposeTask(null)).toBe(false)
    expect(shouldComposeTask(1001)).toBe(true)
  })

  it('does not store an organization change while another tab holds the writer lock', async () => {
    globalThis.indexedDB = indexedDB
    const namespace = `inlog:mock:org-lock-${crypto.randomUUID()}`
    setMockWriterId(`tab-${crypto.randomUUID()}`)
    const ready = await ensureMockState(namespace)
    expect(ready.ok).toBe(true)
    if (!ready.ok) return
    const before = ready.state.organizations.find((item) => item.id === 101)?.fullName
    releaseMockWriter(namespace)
    setMockWriterId(`other-${crypto.randomUUID()}`)
    setMockLockSource(() => ({
      request: ((_name, _options, callback: (lock: null) => void) => {
        callback(null)
      }) as LockManager['request'],
    }))
    try {
      await expect(updateMockState((state) => ({
        ...state,
        organizations: state.organizations.map((item) => item.id === 101 ? { ...item, fullName: 'Подмена' } : item),
      }), namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
    } finally {
      setMockLockSource(null)
    }
    const stored = await readMockState(namespace)
    expect(stored.ok && stored.state.organizations.find((item) => item.id === 101)?.fullName).toBe(before)
  })
})
