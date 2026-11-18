import { describe, expect, it } from 'vitest'
import { can } from '../../../entities/access/model/grants'
import { directoryFieldId, directoryId, personnelFieldId } from '../../../entities/personnel/model/template'
import { createdOrganizationPersonnelPath } from '../../../features/organizations-and-projects/model/created-organization'
import { switchUser, toSnapshot } from '../auth/flow'
import { createEmptyInstallation } from '../db/empty-installation'
import { MOCK_SCHEMA_VERSION } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createSeed } from '../db/seed'
import type { Employee } from '../../../entities/personnel/model/types'
import { configureInstallation, createOrganization } from '../installation/service'
import { ORGANIZATION_ADMINISTRATOR_ROLE_NAME } from '../organizations/organization-admin-role'
import {
  archiveDirectoryRecord,
  createDirectoryDefinition,
  createDirectoryRecord,
  deleteDirectoryDefinition,
  deleteDirectoryRecord,
  listDirectories,
  updateDirectoryDefinition,
  updateDirectoryRecord,
} from './directories'
import {
  archiveEmployee,
  createEmployee,
  insertEmployee,
  linkEmployeeAccount,
  listEmployees,
  readEmployee,
  readPersonnelConfig,
  updateEmployee,
  updatePersonnelConfig,
} from './employees'
import { ensureOrganizationWorkspace } from './workspace'

const draft = {
  corporationName: 'Север',
  givenName: 'Алина',
  surname: 'Власова',
  email: 'owner@personal.test',
  salt: 'salt',
  hash: 'hash',
}

function installation() {
  return configureInstallation(createEmptyInstallation('personal-memory'), draft)
}

function tokenFor(state: ReturnType<typeof installation>, userId = 1) {
  const issued = switchUser(state, userId)
  const token = issued.body && typeof issued.body === 'object' && 'access_token' in issued.body
    ? String(issued.body.access_token)
    : ''
  return { state: issued.state, token }
}

function opened() {
  const ready = installation()
  const created = createOrganization(ready, 1, {
    fullName: 'Лаборатория Север',
    shortName: 'Север',
    address: 'Полевая, 1',
    kind: 'laboratory',
  })
  if (!('organization' in created)) throw new Error('organization')
  const session = tokenFor(created.state)
  return { ...session, organizationId: created.organization.id, before: ready }
}

function wireTab(tab: { id: string; label: string; order: number }) {
  return { id: tab.id, label: tab.label, order: tab.order }
}

function wireField(field: Record<string, unknown>) {
  return {
    id: field.id,
    label: field.label,
    tabId: field.tabId,
    group: field.group,
    type: field.type,
    directoryKey: field.directoryKey,
    required: field.required,
    visible: field.visible,
    archived: field.archived,
    order: field.order,
  }
}

function names(organizationId: number, surname: string, given: string, extra: Record<string, string | number | boolean | null> = {}) {
  return {
    [personnelFieldId(organizationId, 'last-name')]: surname,
    [personnelFieldId(organizationId, 'first-name')]: given,
    ...extra,
  }
}

describe('personnel and directories', () => {
  it('creates the starter in the same organization write and does not repeat it', () => {
    const { state, organizationId, before } = opened()
    expect(state.users).toEqual(before.users)
    expect(state.assignments).toEqual(before.assignments)
    expect(state.memberships).toEqual(before.memberships)
    expect(state.systemCapabilities).toEqual(before.systemCapabilities)
    expect(state.employees).toEqual([])
    expect(state.departments).toEqual([])
    expect(state.workplaces).toEqual([])
    const workspace = state.organizationWorkspaces.filter((item) => item.organizationId === organizationId)
    expect(workspace).toEqual([{ organizationId, templateId: 'personnel-starter', templateVersion: 1 }])
    expect(state.directoryDefinitions.filter((item) => item.organizationId === organizationId).map((item) => item.key)).toEqual([
      'departments', 'positions', 'workplaces', 'qualification-status',
    ])
    const statuses = state.directoryEntries.filter((item) => item.organizationId === organizationId)
    expect(statuses.map((item) => Object.values(item.values)[0])).toEqual(['Не указано', 'Подтверждена', 'Требует подтверждения'])
    const role = state.roles.find((item) => item.origin?.template === 'organization-administrator' && item.ownerScope?.type === 'organization' && item.ownerScope.organizationId === organizationId)
    expect(role?.grantIds).toContain('g-personnel-read')
    expect(role?.grantIds).not.toContain('g-organizations-create')
    expect(role?.displayName).toBe(ORGANIZATION_ADMINISTRATOR_ROLE_NAME)

    const removedId = statuses[0]?.id ?? ''
    const stripped = {
      ...state,
      directoryEntries: state.directoryEntries.filter((item) => item.id !== removedId),
    }
    const renamed = {
      ...stripped,
      directoryDefinitions: stripped.directoryDefinitions.map((item) => item.key === 'positions' && item.organizationId === organizationId
        ? { ...item, title: 'Роли в лаборатории' }
        : item),
    }
    const again = ensureOrganizationWorkspace(renamed, organizationId)
    expect(again).toBe(renamed)
    expect(again?.directoryEntries.some((item) => item.id === removedId)).toBe(false)
    expect(again?.directoryDefinitions.find((item) => item.key === 'positions' && item.organizationId === organizationId)?.title).toBe('Роли в лаборатории')
  })

  it('keeps two organizations independent', () => {
    const first = opened()
    const secondCreated = createOrganization(first.state, 1, {
      fullName: 'Лаборатория Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'laboratory',
    })
    if (!('organization' in secondCreated)) throw new Error('second')
    const session = tokenFor(secondCreated.state)
    const created = createDirectoryRecord(session.state, session.token, directoryId(first.organizationId, 'departments'), {
      organizationId: first.organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect(created.status).toBe(201)
    expect(created.state.departments.filter((item) => item.organizationId === secondCreated.organization.id)).toEqual([])
    expect(created.state.directoryDefinitions.filter((item) => item.organizationId === first.organizationId).map((item) => item.id))
      .not.toEqual(created.state.directoryDefinitions.filter((item) => item.organizationId === secondCreated.organization.id).map((item) => item.id))
  })

  it('saves an employee without an account and does not grant application access', () => {
    const { state, token, organizationId } = opened()
    const beforeUsers = state.users
    const beforeAssignments = state.assignments
    const beforeMemberships = state.memberships
    const created = createEmployee(state, token, {
      organizationId,
      values: names(organizationId, 'Иванов', 'Иван', { [personnelFieldId(organizationId, 'email')]: 'ivanov@lab.test' }),
    })
    expect(created.status).toBe(201)
    const employee = created.state.employees[0]
    expect(employee?.accountId).toBeNull()
    expect(employee?.source).toBe('manual')
    expect(created.state.users).toBe(beforeUsers)
    expect(created.state.assignments).toBe(beforeAssignments)
    expect(created.state.memberships).toBe(beforeMemberships)
    expect(created.state.systemCapabilities).toEqual(state.systemCapabilities)
    const body = created.body as { employee: { account: null; accountVisible: boolean } }
    expect(body.employee.account).toBeNull()
    expect(can(toSnapshot(created.state), 1, 'personnel', 'read', {
      type: 'organization', organizationId, corporationId: 1,
    })).toBe(true)
  })

  it('checks permissions on a direct call and blocks a second active account link', () => {
    const openedState = opened()
    const other = createOrganization(openedState.state, 1, {
      fullName: 'Лаборатория Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'laboratory',
    })
    if (!('organization' in other)) throw new Error('other')
    const scope = { type: 'organization' as const, organizationId: openedState.organizationId, corporationId: 1 }
    const withPeople = {
      ...other.state,
      users: [
        ...other.state.users,
        { id: 8, email: 'limited@lab.test', name: 'Лев', patronymic: '', surname: 'Ограниченный', position: '', legacyRole: 'member' as const, status: 'active' as const },
        { id: 9, email: 'member@lab.test', name: 'Мария', patronymic: '', surname: 'Член', position: '', legacyRole: 'member' as const, status: 'active' as const },
      ],
      roles: [
        ...other.state.roles,
        { id: 'role-read', displayName: 'Только чтение кадров', grantIds: ['g-personnel-read', 'g-tasks'], delegationGrantIds: [], ownerScope: scope },
        { id: 'role-titled', displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME, grantIds: [], delegationGrantIds: [], ownerScope: scope },
      ],
      assignments: [
        ...other.state.assignments,
        { id: 'asg-read', userId: 8, roleId: 'role-read', scope },
        { id: 'asg-title', userId: 8, roleId: 'role-titled', scope },
      ],
      memberships: [
        ...other.state.memberships,
        { id: 'mem-9', userId: 9, organizationId: openedState.organizationId, kind: 'laboratory' as const },
        { id: 'mem-9-other', userId: 9, organizationId: other.organization.id, kind: 'laboratory' as const },
      ],
    }
    const reader = tokenFor(withPeople, 8)
    const listed = listEmployees(reader.state, reader.token, openedState.organizationId, false, '')
    expect(listed.status).toBe(200)
    const denied = createEmployee(reader.state, reader.token, {
      organizationId: openedState.organizationId,
      values: names(openedState.organizationId, 'Петров', 'Пётр'),
    })
    expect(denied.status).toBe(403)
    expect(denied.state.employees).toEqual(reader.state.employees)
    expect(can(toSnapshot(withPeople), 8, 'personnel', 'create', scope)).toBe(false)
    const owner = tokenFor(withPeople, 1)
    const first = createEmployee(owner.state, owner.token, {
      organizationId: openedState.organizationId,
      values: names(openedState.organizationId, 'Иванов', 'Иван', {
        [personnelFieldId(openedState.organizationId, 'email')]: 'member@lab.test',
      }),
    })
    expect(first.status).toBe(201)
    const firstId = first.state.employees[0]?.id ?? ''
    expect(first.state.employees[0]?.accountId).toBeNull()
    const linked = linkEmployeeAccount(first.state, owner.token, firstId, {
      organizationId: openedState.organizationId,
      expectedRevision: 1,
      accountId: 9,
    })
    expect(linked.status).toBe(200)
    expect(linked.state.assignments).toEqual(first.state.assignments)
    expect(linked.state.memberships).toEqual(first.state.memberships)
    expect(linked.state.users).toBe(first.state.users)
    const second = createEmployee(linked.state, owner.token, {
      organizationId: openedState.organizationId,
      values: names(openedState.organizationId, 'Сидоров', 'Сидор'),
    })
    const secondId = second.state.employees.find((item) => item.id !== firstId)?.id ?? ''
    const taken = linkEmployeeAccount(second.state, owner.token, secondId, {
      organizationId: openedState.organizationId,
      expectedRevision: 1,
      accountId: 9,
    })
    expect(taken.status).toBe(409)
    expect(taken.state.employees.find((item) => item.id === secondId)?.accountId).toBeNull()
    const elsewhere = createEmployee(taken.state, owner.token, {
      organizationId: other.organization.id,
      values: names(other.organization.id, 'Южный', 'Юрий'),
    })
    const elsewhereId = elsewhere.state.employees.find((item) => item.organizationId === other.organization.id)?.id ?? ''
    const otherLink = linkEmployeeAccount(elsewhere.state, owner.token, elsewhereId, {
      organizationId: other.organization.id,
      expectedRevision: 1,
      accountId: 9,
    })
    expect(otherLink.status).toBe(200)
    const readerLater = tokenFor(otherLink.state, 8)
    const foreign = readEmployee(readerLater.state, readerLater.token, other.organization.id, elsewhereId)
    expect(foreign.status).toBe(403)
    expect(JSON.stringify(foreign.body)).not.toContain('Южный')
    const archived = archiveEmployee(otherLink.state, owner.token, firstId, {
      organizationId: openedState.organizationId,
      expectedRevision: 2,
      archived: true,
    })
    expect(archived.status).toBe(200)
    expect(archived.state.assignments).toEqual(otherLink.state.assignments)
    expect(archived.state.users.find((item) => item.id === 9)?.status).toBe('active')
  })

  it('keeps directory references after rename and refuses to delete a used record', () => {
    const { state, token, organizationId } = opened()
    const titleId = directoryFieldId(organizationId, 'positions', 'title')
    const created = createDirectoryRecord(state, token, directoryId(organizationId, 'positions'), {
      organizationId,
      values: { [titleId]: 'Лаборант' },
    })
    expect(created.status).toBe(201)
    const positionId = (created.body as { id: string }).id
    const hired = createEmployee(created.state, token, {
      organizationId,
      values: names(organizationId, 'Иванов', 'Иван', { [personnelFieldId(organizationId, 'position')]: positionId }),
    })
    const renamed = updateDirectoryRecord(hired.state, token, directoryId(organizationId, 'positions'), positionId, {
      organizationId,
      expectedRevision: 1,
      values: { [titleId]: 'Инженер' },
    })
    expect(renamed.status).toBe(200)
    const employeeId = hired.state.employees[0]?.id ?? ''
    const read = readEmployee(renamed.state, token, organizationId, employeeId)
    const body = read.body as { employee: { values: Record<string, string>; references: Record<string, { id: string; label: string; archived: boolean }> } }
    const fieldId = personnelFieldId(organizationId, 'position')
    expect(body.employee.values[fieldId]).toBe(positionId)
    expect(body.employee.references[fieldId]).toMatchObject({ id: positionId, label: 'Инженер', archived: false })
    const archived = archiveDirectoryRecord(renamed.state, token, directoryId(organizationId, 'positions'), positionId, {
      organizationId,
      expectedRevision: 2,
      archived: true,
    })
    const kept = updateEmployee(archived.state, token, employeeId, {
      organizationId,
      expectedRevision: 1,
      values: names(organizationId, 'Иванов', 'Иван', { [fieldId]: positionId }),
    })
    expect(kept.status).toBe(200)
    const spare = createDirectoryRecord(kept.state, token, directoryId(organizationId, 'positions'), {
      organizationId,
      values: { [titleId]: 'Архивная' },
    })
    const spareId = (spare.body as { id: string }).id
    const spareArchived = archiveDirectoryRecord(spare.state, token, directoryId(organizationId, 'positions'), spareId, {
      organizationId,
      expectedRevision: 1,
      archived: true,
    })
    const rejected = updateEmployee(spareArchived.state, token, employeeId, {
      organizationId,
      expectedRevision: 2,
      values: names(organizationId, 'Иванов', 'Иван', { [fieldId]: spareId }),
    })
    expect(rejected.status).toBe(400)
    expect((rejected.body as { code: string }).code).toBe('archived_value')
    expect(rejected.state.employees.find((item) => item.id === employeeId)?.values[fieldId]).toBe(positionId)
    const removed = deleteDirectoryRecord(rejected.state, token, organizationId, directoryId(organizationId, 'positions'), positionId, 3)
    expect(removed.status).toBe(409)
    expect(removed.state.directoryEntries.some((item) => item.id === positionId)).toBe(true)
    const unused = createDirectoryRecord(removed.state, token, directoryId(organizationId, 'positions'), {
      organizationId,
      values: { [titleId]: 'Свободная' },
    })
    const unusedId = (unused.body as { id: string }).id
    const deleted = deleteDirectoryRecord(unused.state, token, organizationId, directoryId(organizationId, 'positions'), unusedId, 1)
    expect(deleted.status).toBe(200)
    expect(deleted.state.directoryEntries.some((item) => item.id === unusedId)).toBe(false)
  })

  it('rejects a department cycle and a parent from another organization', () => {
    const first = opened()
    const second = createOrganization(first.state, 1, {
      fullName: 'Лаборатория Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'laboratory',
    })
    if (!('organization' in second)) throw new Error('second')
    const session = tokenFor(second.state)
    const parent = createDirectoryRecord(session.state, session.token, directoryId(first.organizationId, 'departments'), {
      organizationId: first.organizationId,
      name: 'Лаборатория',
      code: 'Л',
      parentId: null,
    })
    const parentId = (parent.body as { id: string }).id
    const child = createDirectoryRecord(parent.state, session.token, directoryId(first.organizationId, 'departments'), {
      organizationId: first.organizationId,
      name: 'Группа',
      code: 'Г',
      parentId,
    })
    const childId = (child.body as { id: string }).id
    const cycle = updateDirectoryRecord(child.state, session.token, directoryId(first.organizationId, 'departments'), parentId, {
      organizationId: first.organizationId,
      expectedRevision: 1,
      name: 'Лаборатория',
      code: 'Л',
      parentId: childId,
    })
    expect((cycle.body as { code: string }).code).toBe('cycle')
    expect(cycle.state.departments.find((item) => item.id === parentId)?.parentId).toBeNull()
    const foreign = createDirectoryRecord(cycle.state, session.token, directoryId(second.organization.id, 'departments'), {
      organizationId: second.organization.id,
      name: 'Чужое',
      code: 'Ч',
      parentId: null,
    })
    const foreignId = (foreign.body as { id: string }).id
    const crossed = updateDirectoryRecord(foreign.state, session.token, directoryId(first.organizationId, 'departments'), childId, {
      organizationId: first.organizationId,
      expectedRevision: 1,
      name: 'Группа',
      code: 'Г',
      parentId: foreignId,
    })
    expect((crossed.body as { code: string }).code).toBe('invalid_parent')
    expect(crossed.state.departments.find((item) => item.id === childId)?.parentId).toBe(parentId)
  })

  it('deletes a custom directory definition and blocks starter directories', () => {
    const { state, token, organizationId } = opened()
    const created = createDirectoryDefinition(state, token, {
      organizationId,
      title: 'Станки',
      description: '',
      section: 'equipment',
    })
    expect(created.status).toBe(201)
    const body = created.body as { id: string; revision: number }
    const removed = deleteDirectoryDefinition(created.state, token, organizationId, body.id, body.revision)
    expect(removed.status).toBe(200)
    expect(removed.state.directoryDefinitions?.some((item) => item.id === body.id)).toBe(false)
    const blocked = deleteDirectoryDefinition(removed.state, token, organizationId, directoryId(organizationId, 'positions'), 1)
    expect((blocked.body as { code?: string }).code).toBe('system_directory')
  })

  it('stores section on create and update for a custom directory definition', () => {
    const { state, token, organizationId } = opened()
    const created = createDirectoryDefinition(state, token, {
      organizationId,
      title: 'Станки',
      description: '',
      section: 'equipment',
    })
    expect(created.status).toBe(201)
    const body = created.body as { id: string; sections?: string[]; revision: number }
    expect(body.sections).toEqual(['equipment'])
    const stored = created.state.directoryDefinitions?.find((item) => item.id === body.id)
    if (!stored) throw new Error('created directory')
    const updated = updateDirectoryDefinition(created.state, token, body.id, {
      organizationId,
      expectedRevision: body.revision,
      title: 'Станки',
      description: '',
      archived: false,
      fields: stored.fields.map((field) => ({
        id: field.id,
        label: field.label,
        required: field.required,
        archived: field.archived,
        type: field.type,
      })),
      section: 'measurements',
    })
    expect(updated.status).toBe(200)
    expect((updated.body as { sections?: string[] }).sections).toEqual(['measurements'])
  })

  it('adds a custom attribute to a registry directory and keeps system columns intact', () => {
    const { state, token, organizationId } = opened()
    const dirId = directoryId(organizationId, 'departments')
    const listed = listDirectories(state, token, organizationId)
    const definition = (listed.body as { directories: Array<{ id: string; revision: number; fields: Array<{ id: string; key: string; label: string; required: boolean; archived: boolean; type: 'text' }> }> }).directories
      .find((item) => item.id === dirId)
    if (!definition) throw new Error('departments definition')
    const fields = definition.fields.map((field) => ({
      id: field.id,
      label: field.label,
      required: field.required,
      archived: field.archived,
      type: field.type,
    }))
    const added = updateDirectoryDefinition(state, token, dirId, {
      organizationId,
      expectedRevision: definition.revision,
      title: 'Подразделения',
      description: '',
      archived: false,
      fields: [...fields, { id: 'new:short', label: 'Краткое название', required: false, archived: false, type: 'text' }],
    })
    expect(added.status).toBe(200)
    const next = (added.body as { fields: Array<{ key: string; label: string }> }).fields
    expect(next.some((field) => field.key === 'custom' && field.label === 'Краткое название')).toBe(true)
    expect(next.filter((field) => field.key !== 'custom')).toHaveLength(definition.fields.length)
    const stored = added.state.directoryDefinitions?.find((item) => item.id === dirId)
    if (!stored) throw new Error('stored departments')
    const blocked = updateDirectoryDefinition(added.state, token, dirId, {
      organizationId,
      expectedRevision: stored.revision,
      title: stored.title,
      description: stored.description,
      archived: stored.archived,
      fields: stored.fields
        .filter((field) => field.key !== 'name')
        .map((field) => ({
          id: field.id,
          label: field.label,
          required: field.required,
          archived: field.archived,
          type: field.type,
        })),
    })
    expect((blocked.body as { code?: string }).code).toBe('system_field')
  })

  it('keeps stored values when the structure changes and rejects a lossy type change', () => {
    const { state, token, organizationId } = opened()
    const config = readPersonnelConfig(state, token, organizationId)
    const current = (config.body as { config: { revision: number; tabs: { id: string; label: string; order: number }[]; fields: Array<Record<string, unknown>>; columns: string[] } }).config
    const patronymic = personnelFieldId(organizationId, 'patronymic')
    const hired = createEmployee(state, token, {
      organizationId,
      values: names(organizationId, 'Иванов', 'Иван', { [patronymic]: 'Петрович' }),
    })
    const hidden = updatePersonnelConfig(hired.state, token, {
      organizationId,
      expectedRevision: current.revision,
      tabs: current.tabs.map(wireTab),
      columns: current.columns,
      fields: current.fields.map((field) => wireField(field.id === patronymic ? { ...field, visible: false, required: false } : field)),
    })
    expect(hidden.status).toBe(200)
    const employeeId = hired.state.employees[0]?.id ?? ''
    expect(hidden.state.employees.find((item) => item.id === employeeId)?.values[patronymic]).toBe('Петрович')
    const hiddenConfig = (hidden.body as { config: typeof current }).config
    const blocked = updatePersonnelConfig(hidden.state, token, {
      organizationId,
      expectedRevision: hiddenConfig.revision,
      tabs: hiddenConfig.tabs.map(wireTab),
      columns: hiddenConfig.columns,
      fields: hiddenConfig.fields.map((field) => wireField(field.id === personnelFieldId(organizationId, 'birth-date') ? { ...field, type: 'text' } : field)),
    })
    expect((blocked.body as { code: string }).code).toBe('system_field')
    const added = updatePersonnelConfig(hidden.state, token, {
      organizationId,
      expectedRevision: hiddenConfig.revision,
      tabs: hiddenConfig.tabs.map(wireTab),
      columns: hiddenConfig.columns,
      fields: [...hiddenConfig.fields.map((field) => wireField(field)), {
        id: 'new:score',
        label: 'Балл',
        tabId: hiddenConfig.tabs[0]?.id,
        group: 'work',
        type: 'number',
        directoryKey: null,
        required: false,
        visible: true,
        archived: false,
        order: 40,
      }],
    })
    expect(added.status).toBe(200)
    const score = (added.body as { config: { fields: { id: string; key: string }[] } }).config.fields.find((field) => field.key === 'custom')
    const withScore = updateEmployee(added.state, token, employeeId, {
      organizationId,
      expectedRevision: 1,
      values: names(organizationId, 'Иванов', 'Иван', { [score?.id ?? '']: 4 }),
    })
    expect(withScore.status).toBe(200)
    const scoredConfig = (added.body as { config: typeof current }).config
    const typeChange = updatePersonnelConfig(withScore.state, token, {
      organizationId,
      expectedRevision: scoredConfig.revision,
      tabs: scoredConfig.tabs.map(wireTab),
      columns: scoredConfig.columns,
      fields: scoredConfig.fields.map((field) => wireField(field.id === score?.id ? { ...field, type: 'text', directoryKey: null } : field)),
    })
    expect((typeChange.body as { code: string }).code).toBe('type_change_blocked')
    expect(typeChange.state.employees.find((item) => item.id === employeeId)?.values[score?.id ?? '']).toBe(4)
    const required = updatePersonnelConfig(withScore.state, token, {
      organizationId,
      expectedRevision: scoredConfig.revision,
      tabs: scoredConfig.tabs.map(wireTab),
      columns: scoredConfig.columns,
      fields: [...scoredConfig.fields.map((field) => wireField(field)), {
        id: 'new:note',
        label: 'Примечание',
        tabId: scoredConfig.tabs[0]?.id,
        group: 'work',
        type: 'text',
        directoryKey: null,
        required: true,
        visible: true,
        archived: false,
        order: 41,
      }],
    })
    const viewed = readEmployee(required.state, token, organizationId, employeeId)
    const viewedEmployee = (viewed.body as { employee: { values: Record<string, unknown> } }).employee
    const note = (required.body as { config: { fields: { id: string; label: string }[] } }).config.fields.find((field) => field.label === 'Примечание')
    expect(viewedEmployee.values[note?.id ?? '']).toBeUndefined()
    const missing = updateEmployee(required.state, token, employeeId, {
      organizationId,
      expectedRevision: 2,
      values: names(organizationId, 'Иванов', 'Иван', { [score?.id ?? '']: 4 }),
    })
    expect((missing.body as { code: string }).code).toBe('required')
    expect(missing.state.employees.find((item) => item.id === employeeId)?.values[patronymic]).toBe('Петрович')
    const stale = updateEmployee(required.state, token, employeeId, {
      organizationId,
      expectedRevision: 1,
      values: names(organizationId, 'Иванов', 'Иван', { [score?.id ?? '']: 4, [note?.id ?? '']: 'есть' }),
    })
    expect((stale.body as { code: string }).code).toBe('stale_write')
  })

  it('does not treat a display name as the administrator template during migration', () => {
    const seed = createSeed()
    const snapshot = {
      ...seed,
      schemaVersion: 9,
      departments: [],
      workplaces: [],
      directoryDefinitions: [],
      directoryEntries: [],
      personnelConfigs: [],
      employees: [],
      organizationWorkspaces: [],
      grants: seed.grants.filter((grant) => !grant.id.startsWith('g-personnel') && !grant.id.startsWith('g-directories')),
      roles: [...seed.roles, {
        id: 'role-named',
        displayName: ORGANIZATION_ADMINISTRATOR_ROLE_NAME,
        grantIds: ['g-projects'],
        delegationGrantIds: [],
        ownerScope: { type: 'organization' as const, organizationId: 101, corporationId: 1 },
      }],
    }
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(migrated?.state.roles.find((role) => role.id === 'role-named')?.grantIds).toEqual(['g-projects'])
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-registry-departments-records-read')).toBe(true)
    expect(migrated?.state.roles.every((role) => !role.grantIds.some((id) => id.startsWith('g-registry-')))).toBe(true)
    expect(migrated?.state.roles.find((role) => role.id === 'role-named')?.origin).toBeUndefined()
    expect(migrated?.state.organizationWorkspaces.some((item) => item.organizationId === 101)).toBe(true)
    expect(migrated?.state.employees).toEqual([])
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-personnel-read')).toBe(true)
    const repeated = migrateMockDocument(migrated?.state ?? snapshot)
    expect(repeated?.state.directoryDefinitions.filter((item) => item.organizationId === 101)).toHaveLength(
      migrated?.state.directoryDefinitions.filter((item) => item.organizationId === 101).length ?? 0,
    )
  })

  it('keeps external identity unique and refuses a manual edit of a source-owned field', () => {
    const { state, token, organizationId } = opened()
    const base: Employee = {
      id: 'emp-ext-1',
      organizationId,
      accountId: null,
      revision: 1,
      archived: false,
      source: 'integration',
      sourceId: '1c',
      externalId: 'abc',
      values: names(organizationId, 'Иванов', 'Иван'),
    }
    const first = insertEmployee(state, base)
    if ('error' in first) throw new Error('insert')
    const clash = insertEmployee(first.state, { ...base, id: 'emp-ext-2' })
    expect(clash).toEqual({ error: 'external_id_taken' })
    const other = insertEmployee(first.state, { ...base, id: 'emp-ext-3', organizationId: organizationId + 50, externalId: 'abc' })
    expect('state' in other).toBe(true)
    const owned = personnelFieldId(organizationId, 'last-name')
    const prepared = {
      ...first.state,
      personnelConfigs: first.state.personnelConfigs.map((config) => config.organizationId !== organizationId ? config : {
        ...config,
        fields: config.fields.map((field) => field.id === owned ? { ...field, sourceOwned: true } : field),
      }),
    }
    const session = tokenFor(prepared)
    const rejected = updateEmployee(session.state, session.token, base.id, {
      organizationId,
      expectedRevision: 1,
      values: names(organizationId, 'Петров', 'Иван'),
    })
    expect((rejected.body as { code: string }).code).toBe('source_owned')
    expect(rejected.state.employees.find((item) => item.id === base.id)?.values[owned]).toBe('Иванов')
    const local = personnelFieldId(organizationId, 'office')
    const accepted = updateEmployee(session.state, token, base.id, {
      organizationId,
      expectedRevision: 1,
      values: names(organizationId, 'Иванов', 'Иван', { [local]: '12' }),
    })
    expect(accepted.status).toBe(200)
    expect(accepted.state.employees.find((item) => item.id === base.id)?.values[owned]).toBe('Иванов')
    expect(accepted.state.employees.find((item) => item.id === base.id)?.values[local]).toBe('12')
  })

  it('opens the created organization personnel route without a project', () => {
    const path = createdOrganizationPersonnelPath(44)
    expect(path.startsWith('/settings/organizations/44/personnel?')).toBe(true)
    expect(path).toContain('org=44')
    expect(path).toContain('directoryOrg=44')
    expect(path).not.toContain('project')
    const seed = createSeed()
    const session = tokenFor(seed)
    const listed = listDirectories(session.state, session.token, 101)
    expect(listed.status).toBe(200)
    expect((listed.body as { directories: unknown[] }).directories.length).toBeGreaterThan(0)
  })

  it('keeps a personnel number unique among active cards and rejects a workplace from another department', () => {
    const { state, token, organizationId } = opened()
    const department = createDirectoryRecord(state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Керн',
      code: 'К',
      parentId: null,
    })
    const departmentId = (department.body as { id: string }).id
    const other = createDirectoryRecord(department.state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Флюиды',
      code: 'Ф',
      parentId: null,
    })
    const otherId = (other.body as { id: string }).id
    const workplace = createDirectoryRecord(other.state, token, directoryId(organizationId, 'workplaces'), {
      organizationId,
      name: 'Стол 1',
      departmentId: otherId,
    })
    const workplaceId = (workplace.body as { id: string }).id
    const first = createEmployee(workplace.state, token, {
      organizationId,
      values: names(organizationId, 'Иванов', 'Иван', {
        [personnelFieldId(organizationId, 'personnel-number')]: 'T-1',
        [personnelFieldId(organizationId, 'department')]: departmentId,
      }),
    })
    expect(first.status).toBe(201)
    const listed = listEmployees(first.state, token, organizationId, false, '')
    const row = (listed.body as { employees: Array<{ summary: { personnelNumber: string; departmentId: string; name: string } }> }).employees[0]
    expect(row?.summary).toMatchObject({ personnelNumber: 'T-1', departmentId, name: 'Иванов Иван' })
    const duplicate = createEmployee(first.state, token, {
      organizationId,
      values: names(organizationId, 'Петров', 'Пётр', {
        [personnelFieldId(organizationId, 'personnel-number')]: 't-1',
      }),
    })
    expect((duplicate.body as { code: string }).code).toBe('duplicate_value')
    const mismatched = createEmployee(first.state, token, {
      organizationId,
      values: names(organizationId, 'Сидоров', 'Сидор', {
        [personnelFieldId(organizationId, 'personnel-number')]: 'T-2',
        [personnelFieldId(organizationId, 'department')]: departmentId,
        [personnelFieldId(organizationId, 'workplace')]: workplaceId,
      }),
    })
    expect((mismatched.body as { code: string }).code).toBe('workplace_department')
    const created = first.body as { employee: { id: string; revision: number } }
    const archived = archiveEmployee(first.state, token, created.employee.id, {
      organizationId,
      expectedRevision: created.employee.revision,
      archived: true,
    })
    const reused = createEmployee(archived.state, token, {
      organizationId,
      values: names(organizationId, 'Петров', 'Пётр', {
        [personnelFieldId(organizationId, 'personnel-number')]: 'T-1',
        [personnelFieldId(organizationId, 'department')]: otherId,
        [personnelFieldId(organizationId, 'workplace')]: workplaceId,
      }),
    })
    expect(reused.status).toBe(201)
  })
})
