import { describe, expect, it } from 'vitest'
import type { CorporateOverviewOrganization, CorporatePersonnelRow } from '../../../entities/personnel/model/overview'
import { organizationVisible, personnelVisible } from './corporate-filters'

const organization: CorporateOverviewOrganization = {
  id: 101,
  fullName: 'Лаборатория А',
  shortName: 'Лаб. А',
  address: 'Корпус А',
  kind: 'laboratory',
  revision: 1,
  canUpdate: true,
  canDelete: false,
  employeeCount: 1,
  inn: '7701000001',
  kpp: '770101001',
  requestCount: 0,
  administrator: null,
}

const row: CorporatePersonnelRow = {
  employeeId: 'emp-1',
  organizationId: 101,
  revision: 1,
  name: 'Иванов Иван',
  email: 'ivan@lab.test',
  position: 'Лаборант',
  department: 'Лаборатория',
  archived: false,
  roles: [{ id: 'role-1', displayName: 'Исполнитель' }],
  organizationName: 'Лаборатория А',
  organizationShortName: 'Лаб. А',
  organizationKind: 'laboratory',
  actions: { update: true, archive: false, openOrganization: true },
}

describe('corporate overview filters', () => {
  it('keeps a laboratory when the filter is laboratories and matches a person or an organization', () => {
    expect(organizationVisible(organization, 'корпус', 'laboratory')).toBe(true)
    expect(organizationVisible(organization, 'корпус', 'customer')).toBe(false)
    expect(personnelVisible(row, 'исполнитель', 'all')).toBe(true)
    expect(personnelVisible(row, 'иванов', 'customer')).toBe(false)
  })
})
