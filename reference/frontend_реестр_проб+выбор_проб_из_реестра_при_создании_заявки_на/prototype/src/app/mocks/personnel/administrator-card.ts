import type { Employee, PersonnelConfig, PersonnelValue } from '../../../entities/personnel/model/types'
import type { MockOrganization, MockState, MockUser } from '../db/types'
import { referenceOptions } from './directories'
import { insertEmployee } from './employees'
import { ensureOrganizationWorkspace } from './workspace'

function employeesOf(state: MockState): Employee[] {
  return state.employees ?? []
}

function configOf(state: MockState, organizationId: number): PersonnelConfig | undefined {
  return (state.personnelConfigs ?? []).find((item) => item.organizationId === organizationId)
}

function withMembership(state: MockState, organization: MockOrganization, userId: number): MockState {
  if (state.memberships.some((item) => item.userId === userId && item.organizationId === organization.id)) return state
  return {
    ...state,
    memberships: [
      ...state.memberships,
      {
        id: `mem-${userId}-${organization.id}`,
        userId,
        organizationId: organization.id,
        kind: organization.kind,
      },
    ],
  }
}

function fieldValue(config: PersonnelConfig, key: string, value: string): { id: string; value: string } | null {
  const field = config.fields.find((item) => item.key === key && item.visible && !item.archived)
  if (!field) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return { id: field.id, value: trimmed }
}

function withPosition(state: MockState, organizationId: number, title: string): { state: MockState; id: string | null } {
  const label = title.trim()
  if (!label) return { state, id: null }
  const definition = (state.directoryDefinitions ?? []).find((item) => (
    item.organizationId === organizationId && item.key === 'positions' && !item.archived
  ))
  if (!definition || definition.source.type !== 'manual') return { state, id: null }
  const needle = label.toLocaleLowerCase('ru')
  const options = referenceOptions(state, organizationId, 'positions')
  const existing = options.find((item) => !item.archived && item.label.trim().toLocaleLowerCase('ru') === needle)
    ?? options.find((item) => item.label.trim().toLocaleLowerCase('ru') === needle)
  if (existing) return { state, id: existing.id }
  const titleField = definition.fields.find((item) => item.key === 'title' && !item.archived)
  if (!titleField) return { state, id: null }
  const row = {
    id: `de-${crypto.randomUUID()}`,
    organizationId,
    directoryId: definition.id,
    values: { [titleField.id]: label },
    revision: 1,
    archived: false,
  }
  return {
    state: { ...state, directoryEntries: [...(state.directoryEntries ?? []), row] },
    id: row.id,
  }
}

function valuesFromUser(config: PersonnelConfig, user: MockUser, positionId: string | null): Record<string, PersonnelValue> | null {
  const last = fieldValue(config, 'last-name', user.surname)
  const first = fieldValue(config, 'first-name', user.name)
  if (!last || !first) return null
  const values: Record<string, PersonnelValue> = {
    [last.id]: last.value,
    [first.id]: first.value,
  }
  const patronymic = fieldValue(config, 'patronymic', user.patronymic)
  if (patronymic) values[patronymic.id] = patronymic.value
  const email = fieldValue(config, 'email', user.email)
  if (email) values[email.id] = email.value
  const positionField = config.fields.find((item) => item.key === 'position' && item.visible && !item.archived)
  if (positionField && positionId) values[positionField.id] = positionId
  return values
}

/**
 * An organization administrator is staff of that organization.
 * The card is created once from the account. An existing card is not rewritten.
 * Membership is added with the assignment, not by the personnel form.
 */
export function ensureOrganizationAdministratorStaff(state: MockState, organizationId: number, userId: number): MockState {
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization) return state
  const user = state.users.find((item) => item.id === userId)
  if (!user || user.status === 'blocked') return state
  const ready = ensureOrganizationWorkspace(state, organizationId) ?? state
  const config = configOf(ready, organizationId)
  if (!config) return ready
  const membered = withMembership(ready, organization, userId)
  const cards = employeesOf(membered).filter((item) => item.organizationId === organizationId && item.accountId === userId)
  const active = cards.find((item) => !item.archived)
  if (active) return membered
  const archived = cards.find((item) => item.archived)
  if (archived) {
    return {
      ...membered,
      employees: employeesOf(membered).map((item) => item.id === archived.id
        ? { ...archived, archived: false, revision: archived.revision + 1 }
        : item),
    }
  }
  const positioned = withPosition(membered, organizationId, user.position)
  const values = valuesFromUser(config, user, positioned.id)
  if (!values) return positioned.state
  const employee: Employee = {
    id: `emp-${crypto.randomUUID()}`,
    organizationId,
    accountId: userId,
    revision: 1,
    archived: false,
    source: 'manual',
    sourceId: null,
    externalId: null,
    values,
  }
  const saved = insertEmployee(positioned.state, employee)
  return 'error' in saved ? positioned.state : saved.state
}

/** One card per assigned organization administrator. Existing cards keep their values. */
export function ensureAssignedAdministratorStaff(state: MockState): MockState {
  const seen = new Set<string>()
  let next = state
  for (const assignment of state.assignments) {
    const organizationId = assignment.scope.type === 'organization' || assignment.scope.type === 'project'
      ? assignment.scope.organizationId
      : null
    if (organizationId == null) continue
    const role = next.roles.find((item) => item.id === assignment.roleId)
    if (role?.origin?.template !== 'organization-administrator') continue
    const key = `${organizationId}:${assignment.userId}`
    if (seen.has(key)) continue
    seen.add(key)
    next = ensureOrganizationAdministratorStaff(next, organizationId, assignment.userId)
  }
  return next
}
