import { can } from '../../../entities/access/model/grants'
import { organizationRequestTotal } from '../../../entities/request/model/count'
import type { PersonnelConfig, PersonnelValue } from '../../../entities/personnel/model/types'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockOrganization, MockState } from '../db/types'
import { organizationAdministratorLabel } from '../organizations/organization-admin-role'
import { verifiedInstallationId } from '../organizations/service'
import { findReference } from './directories'
import { assignedRoles, personnelPermissions } from './employees'
import { allows, done, problem } from './gate'

/**
 * Cross-organization projection for the corporation screen.
 * A row carries only the fields and action flags the caller may use.
 * It does not load a full employee card, and a role title is not a permission.
 */
export function readCorporateOverview(state: MockState, token: string | null): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const corporationId = verifiedInstallationId(state)
  if (corporationId == null) return problem(state, 403, 'forbidden')
  const organizations = state.organizations.filter((item) => item.corporationId === corporationId)
  const userId = who.user.id
  const cards = []
  const createTargets = []
  const personnel = []
  for (const organization of organizations) {
    const readOrganization = allows(state, userId, organization.id, 'organizations', 'read')
    const readPersonnel = allows(state, userId, organization.id, 'personnel', 'read')
    const createPersonnel = allows(state, userId, organization.id, 'personnel', 'create')
    const employees = (state.employees ?? []).filter((item) => item.organizationId === organization.id)
    const active = employees.filter((item) => !item.archived)
    if (readOrganization) {
      cards.push({
        id: organization.id,
        fullName: organization.fullName,
        shortName: organization.shortName,
        address: organization.address,
        kind: organization.kind,
        revision: positiveRevision(organization.revision),
        canUpdate: allows(state, userId, organization.id, 'organizations', 'update'),
        canDelete: allows(state, userId, organization.id, 'organizations', 'delete'),
        employeeCount: readPersonnel ? active.length : null,
        inn: organization.inn ?? '',
        kpp: organization.kpp ?? '',
        requestCount: organizationRequestCount(state, organization.id),
        administrator: organizationAdministratorLabel(state, organization.id),
      })
    }
    if (createPersonnel) {
      createTargets.push({
        id: organization.id,
        fullName: organization.fullName,
        shortName: organization.shortName,
        kind: organization.kind,
      })
    }
    if (!readPersonnel) continue
    const config = (state.personnelConfigs ?? []).find((item) => item.organizationId === organization.id)
    if (!config) continue
    for (const employee of employees) {
      personnel.push(projectRow(state, userId, organization, config, employee))
    }
  }
  personnel.sort((left, right) => left.name.localeCompare(right.name, 'ru') || left.organizationId - right.organizationId)
  return done(state, 200, {
    corporationEmpty: organizations.length === 0,
    createOrganization: can(toSnapshot(state), userId, 'organizations', 'create', { type: 'corporation', corporationId }),
    organizationCount: cards.length,
    personnelCount: personnel.filter((row) => !row.archived).length,
    organizations: cards,
    createTargets,
    personnel,
  })
}

/** Every stored request of this organization, regardless of status. The request collection wins over the legacy list. */
function organizationRequestCount(state: MockState, organizationId: number): number {
  return organizationRequestTotal(state.requests, state.serviceRequests, organizationId)
}

function positiveRevision(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1
}

function textValue(config: PersonnelConfig, values: Record<string, PersonnelValue>, key: string): string {
  const field = config.fields.find((item) => item.key === key)
  if (!field) return ''
  const value = values[field.id]
  return typeof value === 'string' ? value.trim() : ''
}

function projectRow(
  state: MockState,
  userId: number,
  organization: MockOrganization,
  config: PersonnelConfig,
  employee: { id: string; organizationId: number; revision: number; archived: boolean; accountId: number | null; values: Record<string, PersonnelValue> },
) {
  const permissions = personnelPermissions(state, userId, organization.id)
  const name = ['last-name', 'first-name', 'patronymic'].map((key) => textValue(config, employee.values, key)).filter(Boolean).join(' ')
  const positionField = config.fields.find((item) => item.key === 'position')
  const positionId = positionField ? employee.values[positionField.id] : null
  const position = positionField?.type === 'directory' && typeof positionId === 'string' && positionId
    ? findReference(state, organization.id, positionField.directoryKey, positionId)?.label ?? ''
    : textValue(config, employee.values, 'position')
  const departmentField = config.fields.find((item) => item.key === 'department')
  const departmentId = departmentField ? employee.values[departmentField.id] : null
  const department = departmentField?.type === 'directory' && typeof departmentId === 'string' && departmentId
    ? findReference(state, organization.id, departmentField.directoryKey, departmentId)?.label ?? ''
    : ''
  return {
    employeeId: employee.id,
    organizationId: organization.id,
    revision: positiveRevision(employee.revision),
    name,
    email: textValue(config, employee.values, 'email'),
    position,
    department,
    archived: employee.archived === true,
    roles: permissions.roles
      ? assignedRoles(state, employee.accountId, organization.id).map((role) => ({ id: role.id, displayName: role.displayName }))
      : null,
    organizationName: organization.fullName,
    organizationShortName: organization.shortName,
    organizationKind: organization.kind,
    actions: {
      update: permissions.update,
      archive: permissions.archive,
      openOrganization: allows(state, userId, organization.id, 'organizations', 'read'),
    },
  }
}
