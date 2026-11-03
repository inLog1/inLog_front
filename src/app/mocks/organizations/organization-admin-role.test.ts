import { describe, expect, it } from 'vitest'
import { can, capabilityFromRoleDisplayName, hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import { deleteRole, readDirectory as readAccessDirectory } from '../access/service'
import { switchUser, toSnapshot } from '../auth/flow'
import { createEmptyInstallation } from '../db/empty-installation'
import { configureInstallation, createOrganization } from '../installation/service'
import { readDirectory } from './service'
import {
  ORGANIZATION_ADMINISTRATOR_GRANTS,
  ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
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
})
