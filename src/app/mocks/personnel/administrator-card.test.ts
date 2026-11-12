import { describe, expect, it } from 'vitest'
import { personnelFieldId } from '../../../entities/personnel/model/template'
import { switchUser } from '../auth/flow'
import { createEmptyInstallation } from '../db/empty-installation'
import { migrateMockDocument } from '../db/migrate'
import { configureInstallation, createOrganization } from '../installation/service'
import { ORGANIZATION_ADMINISTRATOR_ROLE_NAME } from '../organizations/organization-admin-role'
import {
  ensureAssignedAdministratorStaff,
  ensureOrganizationAdministratorStaff,
} from './administrator-card'
import { listEmployees } from './employees'

const draft = {
  corporationName: 'Север',
  givenName: 'Алина',
  surname: 'Власова',
  email: 'owner@admin-card.test',
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

function opened() {
  const ready = configureInstallation(createEmptyInstallation('admin-card-memory'), draft)
  const created = createOrganization(ready, 1, {
    fullName: 'Лаборатория Север',
    shortName: 'Север',
    address: 'Полевая, 1',
    kind: 'laboratory',
  })
  if (!('organization' in created)) throw new Error('organization')
  const staffed = {
    ...created.state,
    users: [
      ...created.state.users,
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
  return { state: staffed, organizationId: created.organization.id, roleId: created.administratorRoleId }
}

describe('organization administrator personnel card', () => {
  it('creates one linked card, membership and position, and does not rewrite them', () => {
    const started = opened()
    const first = ensureOrganizationAdministratorStaff(started.state, started.organizationId, 2)
    const card = first.employees.find((item) => item.accountId === 2 && item.organizationId === started.organizationId)
    expect(card?.archived).toBe(false)
    expect(card?.values[personnelFieldId(started.organizationId, 'last-name')]).toBe('Лебедев')
    expect(card?.values[personnelFieldId(started.organizationId, 'email')]).toBe('lab@example.test')
    expect(first.memberships.some((item) => item.userId === 2 && item.organizationId === started.organizationId)).toBe(true)
    const renamed = {
      ...first,
      employees: first.employees.map((item) => item.id === card?.id
        ? { ...item, values: { ...item.values, [personnelFieldId(started.organizationId, 'last-name')]: 'Сидоров' } }
        : item),
    }
    const second = ensureOrganizationAdministratorStaff(renamed, started.organizationId, 2)
    expect(second.employees.filter((item) => item.accountId === 2 && item.organizationId === started.organizationId)).toHaveLength(1)
    expect(second.employees.find((item) => item.id === card?.id)?.values[personnelFieldId(started.organizationId, 'last-name')]).toBe('Сидоров')
    expect(second).toBe(renamed)
  })

  it('restores an archived card and skips a blocked account', () => {
    const started = opened()
    const hired = ensureOrganizationAdministratorStaff(started.state, started.organizationId, 2)
    const cardId = hired.employees.find((item) => item.accountId === 2)?.id
    const archived = {
      ...hired,
      employees: hired.employees.map((item) => item.id === cardId ? { ...item, archived: true } : item),
    }
    const restored = ensureOrganizationAdministratorStaff(archived, started.organizationId, 2)
    expect(restored.employees.find((item) => item.id === cardId)?.archived).toBe(false)
    const blocked = {
      ...started.state,
      users: started.state.users.map((item) => item.id === 2 ? { ...item, status: 'blocked' as const } : item),
    }
    const skipped = ensureOrganizationAdministratorStaff(blocked, started.organizationId, 2)
    expect(skipped.employees).toEqual([])
    expect(skipped).toBe(blocked)
  })

  it('backfills a stored assignment and leaves a non-administrator assignment alone', () => {
    const started = opened()
    const assigned = {
      ...started.state,
      assignments: [
        ...started.state.assignments,
        {
          id: 'asg-admin',
          userId: 2,
          roleId: started.roleId,
          scope: { type: 'organization' as const, organizationId: started.organizationId, corporationId: 1 },
        },
      ],
    }
    const migrated = migrateMockDocument(assigned)
    const filled = migrated?.state ?? assigned
    expect(filled.employees.filter((item) => item.accountId === 2 && item.organizationId === started.organizationId)).toHaveLength(1)
    const again = migrateMockDocument(filled)
    expect(again?.state.employees.filter((item) => item.accountId === 2 && item.organizationId === started.organizationId)).toHaveLength(1)

    const other = {
      ...started.state,
      roles: [
        ...started.state.roles,
        { id: 'role-staff', displayName: 'Сотрудник', grantIds: [], delegationGrantIds: [], ownerScope: { type: 'organization' as const, organizationId: started.organizationId, corporationId: 1 } },
      ],
      assignments: [
        ...started.state.assignments,
        {
          id: 'asg-staff',
          userId: 2,
          roleId: 'role-staff',
          scope: { type: 'organization' as const, organizationId: started.organizationId, corporationId: 1 },
        },
      ],
    }
    expect(ensureAssignedAdministratorStaff(other).employees).toEqual([])
    const owner = tokenFor(filled, 1)
    const listed = listEmployees(owner.state, owner.token, started.organizationId, false, '')
    const body = listed.body as { employees: Array<{ summary: { name: string; position: string } }> }
    expect(body.employees[0]?.summary).toMatchObject({
      name: 'Лебедев Борис Ильич',
      position: 'Заведующий лабораторией',
    })
    expect(ORGANIZATION_ADMINISTRATOR_ROLE_NAME).toBeTruthy()
  })
})
