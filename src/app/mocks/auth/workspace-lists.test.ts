import { describe, expect, it } from 'vitest'
import { grantAllows } from '../../../entities/access/model/grants'
import { resolveProject } from '../../../features/org-project-selector/model/workspace-context'
import { createSeed } from '../db/seed'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import type { MockState } from '../db/types'
import {
  accessFor,
  listOrganizations,
  listProjects,
  loginWithPassword,
  readOrganization,
  readProject,
} from './flow'

function session(email: string) {
  const login = loginWithPassword(createSeed(), email, PUBLIC_FIXTURE_PASSWORD)
  const token = login.state.sessions[0]?.accessToken ?? ''
  return { state: login.state, token }
}

function names(body: unknown): string {
  return JSON.stringify(body)
}

describe('workspace organization and project lists', () => {
  it('shows each laboratory only its own organization and projects', () => {
    const admin = session('admin.a@example.test')
    const organizations = listOrganizations(admin.state, admin.token)
    expect(organizations.status).toBe(200)
    expect(names(organizations.body)).toContain('Лаборатория А')
    expect(names(organizations.body)).not.toContain('Лаборатория Б')
    expect(names(organizations.body)).not.toContain('Заказчик')

    const projects = listProjects(admin.state, admin.token, 101)
    expect(projects.status).toBe(200)
    expect(names(projects.body)).toContain('Проект А-1')
    expect(names(projects.body)).toContain('Проект А-2')
    expect(names(projects.body)).not.toContain('Проект Б-1')
    expect(listProjects(admin.state, admin.token, 102).status).toBe(403)
    expect(names(listProjects(admin.state, admin.token, 102).body)).not.toContain('Проект')
  })

  it('keeps employees inside their own laboratory', () => {
    const employeeA = session('employee.a@example.test')
    const employeeB = session('employee.b@example.test')
    expect(names(listOrganizations(employeeA.state, employeeA.token).body)).toContain('Лаборатория А')
    expect(names(listOrganizations(employeeA.state, employeeA.token).body)).not.toContain('Лаборатория Б')
    expect(names(listProjects(employeeB.state, employeeB.token, 102).body)).toContain('Проект Б-1')
    expect(listProjects(employeeB.state, employeeB.token, 101).status).toBe(403)
    expect(readOrganization(employeeA.state, employeeA.token, 102).status).toBe(403)
    expect(readProject(employeeA.state, employeeA.token, 1002).status).toBe(403)
    expect(names(readProject(employeeA.state, employeeA.token, 1002).body)).not.toContain('Лаборатория')
    expect(names(readProject(employeeA.state, employeeA.token, 1002).body)).not.toContain('Проект Б-1')
  })

  it('lets a single project grant select that project and not the other project of the organization', () => {
    const only = session('project.only@example.test')
    const organizations = listOrganizations(only.state, only.token)
    expect(names(organizations.body)).toContain('Лаборатория А')
    expect(names(organizations.body)).not.toContain('Лаборатория Б')
    const projects = listProjects(only.state, only.token, 101)
    expect(projects.status).toBe(200)
    expect(names(projects.body)).toContain('Проект А-1')
    expect(names(projects.body)).not.toContain('Проект А-2')
    expect(readProject(only.state, only.token, 1003).status).toBe(403)
    expect(readProject(only.state, only.token, 9999).status).toBe(404)
  })

  it('shows the customer organization without its laboratory projects', () => {
    const customer = session('customer@example.test')
    const organizations = listOrganizations(customer.state, customer.token)
    expect(names(organizations.body)).toContain('Организация-заказчик')
    expect(names(organizations.body)).not.toContain('Лаборатория')
    const projects = listProjects(customer.state, customer.token, 201)
    expect(projects.status).toBe(200)
    expect(projects.body).toEqual([])
    expect(listProjects(customer.state, customer.token, 101).status).toBe(403)
    const access = accessFor(customer.state, customer.state.users.find((item) => item.id === 5)!)
    expect(grantAllows(access.effectiveGrants, 'tasks', 'read', { organizationId: 201, projectId: null })).toBe(false)
    expect(grantAllows(access.effectiveGrants, 'constructor.schema', 'read', { organizationId: 201, projectId: null })).toBe(false)
    expect(grantAllows(access.effectiveGrants, 'reports', 'read', { organizationId: 201, projectId: null })).toBe(false)
  })

  it('rejects an unknown id, a foreign organization, and a project paired with the wrong organization', () => {
    const owner = session('owner@example.test')
    expect(readOrganization(owner.state, owner.token, 999).status).toBe(404)
    expect(listProjects(owner.state, owner.token, 999).status).toBe(404)
    expect(listProjects(owner.state, owner.token, 101).status).toBe(200)
    const foreignProject = readProject(owner.state, owner.token, 1002)
    expect(foreignProject.status).toBe(200)
    expect(foreignProject.body).toMatchObject({ id: 1002, organization: 102, name: 'Проект Б-1' })
    const ownProject = readProject(owner.state, owner.token, 1003)
    expect(ownProject.status).toBe(200)
    expect(ownProject.body).toMatchObject({ id: 1003, organization: 101, name: 'Проект А-2' })
    const listed = listProjects(owner.state, owner.token, 101)
    expect(names(listed.body)).not.toContain('Проект Б-1')
    const rows = listed.body as { id: number; organization: number }[]
    const catalog = {
      status: 'ready' as const,
      items: rows.map((row) => ({ id: row.id, organizationId: row.organization })),
    }
    expect(resolveProject(101, catalog, '1003', { status: 'idle' })).toMatchObject({
      status: 'ready',
      projectId: 1003,
    })
    expect(resolveProject(101, catalog, '1002', { status: 'ready', organizationId: 102 })).toMatchObject({
      status: 'forbidden',
      reason: 'project-organization-mismatch',
      projectId: null,
    })
  })

  it('does not give the laboratory administrator corporate or task rights from the role name', () => {
    const admin = session('admin.a@example.test')
    const user = admin.state.users.find((item) => item.email === 'admin.a@example.test')
    expect(user?.legacyRole).toBe('member')
    const access = accessFor(admin.state, user!)
    expect(access.systemCapabilities).toEqual([])
    expect(access.effectiveGrants.some((grant) => grant.resource === 'tasks' && grant.action === 'read')).toBe(false)
    expect(access.effectiveGrants.some((grant) => grant.resource === 'constructor.schema' && grant.action === 'update')).toBe(true)
    expect(access.effectiveGrants.some((grant) => grant.resource === 'reports' && grant.action === 'generate')).toBe(true)
    expect(grantAllows(access.effectiveGrants, 'constructor.schema', 'read', { organizationId: 102, projectId: null })).toBe(false)
  })

  it('closes the previous context after the assignment is removed', () => {
    const employee = session('employee.a@example.test')
    expect(listProjects(employee.state, employee.token, 101).status).toBe(200)
    const revoked: MockState = {
      ...employee.state,
      accessVersion: employee.state.accessVersion + 1,
      assignments: employee.state.assignments.filter((item) => item.userId !== 3),
      delegations: employee.state.delegations.filter((item) => item.toUserId !== 3),
    }
    const user = revoked.users.find((item) => item.id === 3)!
    expect(accessFor(revoked, user).accessState).toBe('pending')
    expect(listOrganizations(revoked, employee.token).status).toBe(403)
    expect(listProjects(revoked, employee.token, 101).status).toBe(403)
    expect(names(listOrganizations(revoked, employee.token).body)).not.toContain('Лаборатория')
  })

  it('does not copy proposed section grants into a saved snapshot that never had them', () => {
    const seed = createSeed()
    expect(seed.roles.find((role) => role.id === 'role-owner')?.grantIds).toContain('g-constructor-schema-read')
    const snapshot = {
      ...seed,
      schemaVersion: 1,
      recordRevision: undefined,
      roles: seed.roles.map((role) => role.id === 'role-owner'
        ? { id: role.id, displayName: role.displayName, grantIds: ['g-projects'] }
        : role),
    } as MockState
    const migrated = migrateMockDocument(snapshot)
    const owner = migrated?.state.roles.find((role) => role.id === 'role-owner')
    expect(owner?.grantIds).toEqual(['g-projects'])
    expect(owner?.delegationGrantIds).toEqual([])
    expect(owner?.grantIds).not.toContain('g-constructor-schema-read')
  })
})
