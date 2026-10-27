import { describe, expect, it } from 'vitest'
import { createSeed } from '../db/seed'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import {
  currentUser,
  listOrganizations,
  listProjects,
  loginWithPassword,
  mutateAssignment,
  readTestResource,
  reviseRoleGrants,
  sessionAccess,
  toSnapshot,
  verifyToken,
} from './flow'
import {
  can,
  canDelegate,
  capabilityFromRoleDisplayName,
  hasCorporateSuperadmin,
  scopeCovers,
} from '../../../entities/access/model/grants'

const org = (organizationId: number) => ({
  type: 'organization' as const,
  organizationId,
  corporationId: 1,
})

function tokenOf(email: string) {
  const login = loginWithPassword(createSeed(), email, PUBLIC_FIXTURE_PASSWORD)
  const token = login.state.sessions[0]?.accessToken ?? ''
  return { login, token }
}

describe('access boundaries', () => {
  it('lets an administrator grant a permission they are allowed to delegate', () => {
    const { login, token } = tokenOf('admin.a@example.test')
    const before = toSnapshot(login.state)
    expect(can(before, 3, 'members', 'read', org(101))).toBe(false)
    expect(canDelegate(before, 3, 'members', 'read', org(101))).toBe(true)

    const granted = mutateAssignment(login.state, token, 'asg-employee-a', 'role-members-reader')
    expect(granted.status).toBe(200)
    expect(can(toSnapshot(granted.state), 3, 'members', 'read', org(101))).toBe(true)

    const widened = mutateAssignment(login.state, token, 'asg-employee-a', 'role-owner')
    expect(widened.status).toBe(403)
    expect(widened.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-employee')
  })

  it('rejects self-elevation, forged scope, and delegation of further authority', () => {
    const admin = tokenOf('admin.a@example.test')
    const elevated = mutateAssignment(admin.login.state, admin.token, 'asg-admin', 'role-members-reader')
    expect(elevated.status).toBe(403)
    expect(elevated.body).toEqual({ code: 'self_elevation' })
    expect(elevated.state.assignments.find((item) => item.id === 'asg-admin')?.roleId).toBe('role-lab-admin')

    const owner = tokenOf('owner@example.test')
    const forged = {
      ...owner.login.state,
      assignments: owner.login.state.assignments.map((item) => item.id === 'asg-employee-a'
        ? {
          ...item,
          scope: { type: 'project' as const, projectId: 1002, organizationId: 101, corporationId: 1 },
        }
        : item),
    }
    const rejected = mutateAssignment(forged, owner.token, 'asg-employee-a', 'role-decoy')
    expect(rejected.status).toBe(403)
    expect(rejected.body).toEqual({ code: 'invalid_scope' })
    expect(rejected.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-employee')

    const passingRole = {
      id: 'role-pass-members',
      displayName: 'Передача состава',
      grantIds: ['g-members-read'],
      delegationGrantIds: ['g-members-read'],
    }
    const adminPass = mutateAssignment({
      ...admin.login.state,
      roles: [...admin.login.state.roles, passingRole],
    }, admin.token, 'asg-employee-a', 'role-pass-members')
    expect(adminPass.status).toBe(403)
    expect(adminPass.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-employee')

    const ownerPass = mutateAssignment({
      ...owner.login.state,
      roles: [...owner.login.state.roles, passingRole],
    }, owner.token, 'asg-employee-a', 'role-pass-members')
    expect(ownerPass.status).toBe(200)
  })

  it('rechecks every assignment when a role definition changes', () => {
    const admin = tokenOf('admin.a@example.test')
    const denied = reviseRoleGrants(admin.login.state, admin.token, 'role-employee', ['g-tasks', 'g-projects', 'g-test'])
    expect(denied.status).toBe(403)
    expect(denied.state.roles.find((item) => item.id === 'role-employee')?.grantIds)
      .toEqual(createSeed().roles.find((item) => item.id === 'role-employee')?.grantIds)
    expect(can(toSnapshot(denied.state), 3, 'test-resource', 'read', org(101))).toBe(false)

    const owner = tokenOf('owner@example.test')
    const allowed = reviseRoleGrants(owner.login.state, owner.token, 'role-employee', ['g-tasks', 'g-projects', 'g-test'])
    expect(allowed.status).toBe(200)
    expect(can(toSnapshot(allowed.state), 3, 'test-resource', 'read', org(101))).toBe(true)
    expect(can(toSnapshot(allowed.state), 4, 'test-resource', 'read', org(102))).toBe(true)
  })

  it('does not turn the installation capability or a role title into a wildcard', () => {
    const snapshot = toSnapshot(createSeed())
    expect(capabilityFromRoleDisplayName('corporate_superadmin')).toEqual([])
    expect(hasCorporateSuperadmin(snapshot, 1)).toBe(true)
    expect(can(snapshot, 1, 'requests', 'create', { type: 'corporation', corporationId: 1 })).toBe(false)
    expect(can(snapshot, 1, 'tasks', 'delete', { type: 'corporation', corporationId: 1 })).toBe(true)
    expect(can(snapshot, 2, 'tasks', 'read', { type: 'organization', organizationId: 101, corporationId: 1 })).toBe(false)

    const admin = tokenOf('admin.a@example.test')
    const copied = {
      ...admin.login.state,
      assignments: [
        ...admin.login.state.assignments,
        {
          id: 'asg-copied-owner',
          userId: 2,
          roleId: 'role-owner',
          scope: { type: 'corporation' as const, corporationId: 1 },
        },
      ],
    }
    const takeover = mutateAssignment(copied, admin.token, 'asg-owner', 'role-decoy')
    expect(takeover.status).toBe(403)
    expect(takeover.state.assignments.find((item) => item.id === 'asg-owner')?.roleId).toBe('role-owner')
    expect(hasCorporateSuperadmin(toSnapshot(copied), 2)).toBe(false)
  })

  it('accepts a real project link and rejects unknown or contradictory registry links', () => {
    const snapshot = toSnapshot(createSeed())
    expect(scopeCovers(
      org(101),
      { type: 'project', projectId: 1001, organizationId: 101, corporationId: 1 },
      snapshot.projects,
      snapshot.organizations,
    )).toBe(true)
    expect(scopeCovers(
      org(101),
      { type: 'project', projectId: 9999, organizationId: 101, corporationId: 1 },
      snapshot.projects,
      snapshot.organizations,
    )).toBe(false)
    expect(scopeCovers(
      { type: 'corporation', corporationId: 1 },
      { type: 'project', projectId: 1002, organizationId: 101, corporationId: 1 },
      snapshot.projects,
      snapshot.organizations,
    )).toBe(false)
    expect(scopeCovers(
      { type: 'corporation', corporationId: 1 },
      { type: 'organization', organizationId: 999, corporationId: 1 },
      snapshot.projects,
      snapshot.organizations,
    )).toBe(false)
  })

  it('keeps identity endpoints for a blocked session and hides organization data', () => {
    const { login, token } = tokenOf('admin.a@example.test')
    expect(readTestResource(login.state, token, 101).status).toBe(200)
    const blocked = {
      ...login.state,
      users: login.state.users.map((user) => user.id === 2 ? { ...user, status: 'blocked' as const } : user),
    }
    expect(verifyToken(blocked, token).status).toBe(200)
    expect(currentUser(blocked, token).status).toBe(200)
    const access = sessionAccess(blocked, token)
    expect(access.status).toBe(200)
    expect(access.body).toMatchObject({
      accessState: 'blocked',
      memberships: [],
      effectiveGrants: [],
      delegationGrants: [],
    })
    const resource = readTestResource(blocked, token, 101)
    const organizations = listOrganizations(blocked, token)
    const projects = listProjects(blocked, token, 101)
    expect(resource.status).toBe(403)
    expect(organizations.status).toBe(403)
    expect(projects.status).toBe(403)
    const leaked = JSON.stringify([resource.body, organizations.body, projects.body, access.body])
    expect(leaked).not.toContain('Лаборатория')
    expect(leaked).not.toContain('Проект')
  })

  it('does not list organizations or projects for a pending account', () => {
    const { login, token } = tokenOf('pending@example.test')
    expect(listOrganizations(login.state, token).status).toBe(403)
    expect(listProjects(login.state, token, null).status).toBe(403)
    const access = sessionAccess(login.state, token)
    expect(access.status).toBe(200)
    expect(access.body).toMatchObject({ accessState: 'pending', memberships: [], effectiveGrants: [] })
    expect(JSON.stringify(access.body)).not.toContain('Лаборатория')
  })

  it('still returns the active employee their own laboratory', () => {
    const { login, token } = tokenOf('employee.a@example.test')
    const organizations = listOrganizations(login.state, token)
    expect(organizations.status).toBe(200)
    expect(JSON.stringify(organizations.body)).toContain('Лаборатория А')
    expect(JSON.stringify(organizations.body)).not.toContain('Лаборатория Б')
  })
})
