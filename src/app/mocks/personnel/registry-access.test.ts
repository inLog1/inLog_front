import { describe, expect, it } from 'vitest'
import { directoryFieldId, directoryId, personnelFieldId } from '../../../entities/personnel/model/template'
import { switchUser } from '../auth/flow'
import { createRole, updateRole } from '../access/service'
import { createEmptyInstallation } from '../db/empty-installation'
import { migrateMockDocument } from '../db/migrate'
import type { MockState, MockUser } from '../db/types'
import { configureInstallation, createOrganization } from '../installation/service'
import { referenceOptions } from './directories'
import {
  archiveDirectoryRecord,
  createDirectoryRecord,
  deleteDirectoryRecord,
  listDirectories,
  readDirectory,
  updateDirectoryDefinition,
  updateDirectoryRecord,
} from './directories'
import { createEmployee, readPersonnelConfig } from './employees'

const draft = {
  corporationName: 'Север',
  givenName: 'Алина',
  surname: 'Власова',
  email: 'owner@personal.test',
  salt: 'salt',
  hash: 'hash',
}

function installation() {
  return configureInstallation(createEmptyInstallation('registry-access'), draft)
}

function tokenFor(state: MockState, userId = 1) {
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
  return { ...session, organizationId: created.organization.id }
}

function grantId(state: MockState, resource: string, action: string) {
  const grant = state.grants.find((item) => item.resource === resource && item.action === action)
  if (!grant) throw new Error(`${resource}.${action}`)
  return grant.id
}

function withMember(
  state: MockState,
  organizationId: number,
  resources: Array<[string, string]>,
  userId = 40,
) {
  const user: MockUser = {
    id: userId,
    email: `member-${userId}@lab.test`,
    name: 'Пётр',
    patronymic: '',
    surname: 'Смирнов',
    position: 'Сотрудник',
    legacyRole: 'member',
    status: 'active',
  }
  const roleId = `role-member-${userId}`
  const ids = resources.map(([resource, action]) => grantId(state, resource, action))
  const next: MockState = {
    ...state,
    users: [...state.users, user],
    roles: [...state.roles, {
      id: roleId,
      displayName: 'Сотрудник лаборатории',
      description: '',
      grantIds: ids,
      delegationGrantIds: [...ids],
      ownerScope: { type: 'organization', organizationId, corporationId: state.corporation.id },
    }],
    assignments: [...state.assignments, {
      id: `assign-${userId}`,
      userId,
      roleId,
      scope: { type: 'organization', organizationId, corporationId: state.corporation.id },
    }],
    memberships: [...state.memberships, { id: `mem-${userId}`, userId, organizationId, kind: 'laboratory' }],
  }
  const session = tokenFor(next, userId)
  return { ...session, organizationId, roleId }
}

function fieldWrites(fields: Array<{ id: string; label: string; required: boolean; archived: boolean; type: 'text' }>) {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    required: field.required,
    archived: field.archived,
    type: field.type,
  }))
}

describe('system registry access', () => {
  it('lets the system superadmin create departments and workplaces without a personal grant', () => {
    const { state, token, organizationId } = opened()
    expect(state.systemCapabilities).toEqual([{ userId: 1, code: 'corporate_superadmin' }])
    expect(state.roles.every((role) => !role.grantIds.some((id) => id.startsWith('g-registry-')))).toBe(true)
    const department = createDirectoryRecord(state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'ХИМ',
      parentId: null,
    })
    expect(department.status).toBe(201)
    const departmentId = (department.body as { id: string }).id
    expect(department.state.departments.find((item) => item.id === departmentId)).toMatchObject({
      organizationId,
      name: 'Химия',
      code: 'ХИМ',
      parentId: null,
    })
    expect(referenceOptions(department.state, organizationId, 'departments').some((item) => item.id === departmentId)).toBe(true)
    const workplace = createDirectoryRecord(department.state, token, directoryId(organizationId, 'workplaces'), {
      organizationId,
      name: 'Стол 1',
      departmentId,
    })
    expect(workplace.status).toBe(201)
    const workplaceId = (workplace.body as { id: string }).id
    expect(workplace.state.workplaces.find((item) => item.id === workplaceId)).toMatchObject({
      organizationId,
      name: 'Стол 1',
      departmentId,
    })
    const config = readPersonnelConfig(workplace.state, token, organizationId)
    const options = (config.body as { options: Record<string, { records: Array<{ id: string }> }> }).options
    expect(options.departments?.records.some((item) => item.id === departmentId)).toBe(true)
    expect(options.workplaces?.records.some((item) => item.id === workplaceId)).toBe(true)
  })

  it('stores a custom attribute on the registry record and keeps it across migration', () => {
    const { state, token, organizationId } = opened()
    const dirId = directoryId(organizationId, 'workplaces')
    const listed = listDirectories(state, token, organizationId)
    const definition = (listed.body as { directories: Array<{ id: string; revision: number; title: string; description: string; archived: boolean; fields: Array<{ id: string; label: string; required: boolean; archived: boolean; type: 'text' }> }> }).directories
      .find((item) => item.id === dirId)
    if (!definition) throw new Error('workplaces')
    const added = updateDirectoryDefinition(state, token, dirId, {
      organizationId,
      expectedRevision: definition.revision,
      title: definition.title,
      description: definition.description,
      archived: definition.archived,
      fields: [...fieldWrites(definition.fields), { id: 'new:area', label: 'Площадь', required: false, archived: false, type: 'text' }],
    })
    expect(added.status).toBe(200)
    const area = (added.body as { fields: Array<{ id: string; key: string; label: string }> }).fields.find((field) => field.label === 'Площадь')
    expect(area?.key).toBe('custom')
    const department = createDirectoryRecord(added.state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    const departmentId = (department.body as { id: string }).id
    const created = createDirectoryRecord(department.state, token, dirId, {
      organizationId,
      name: 'Стол 1',
      departmentId,
      values: { [area?.id ?? '']: '12' },
    })
    expect(created.status).toBe(201)
    const workplaceId = (created.body as { id: string; values?: Record<string, string> }).id
    expect((created.body as { values?: Record<string, string> }).values?.[area?.id ?? '']).toBe('12')
    const renamed = updateDirectoryRecord(created.state, token, dirId, workplaceId, {
      organizationId,
      expectedRevision: 1,
      name: 'Стол 2',
      departmentId,
    })
    expect(renamed.status).toBe(200)
    expect((renamed.body as { name?: string; values?: Record<string, string> }).name).toBe('Стол 2')
    expect((renamed.body as { values?: Record<string, string> }).values?.[area?.id ?? '']).toBe('12')
    const migrated = migrateMockDocument({ ...renamed.state, schemaVersion: 10 })
    expect(migrated?.state.workplaces.find((item) => item.id === workplaceId)?.values?.[area?.id ?? '']).toBe('12')
    const read = readDirectory(migrated?.state ?? renamed.state, token, organizationId, dirId)
    const record = (read.body as { records: Array<{ id: string; values?: Record<string, string> }> }).records.find((item) => item.id === workplaceId)
    expect(record?.values?.[area?.id ?? '']).toBe('12')
    const blocked = updateDirectoryDefinition(added.state, token, dirId, {
      organizationId,
      expectedRevision: (added.body as { revision: number }).revision,
      title: definition.title,
      description: definition.description,
      archived: definition.archived,
      fields: fieldWrites((added.body as { fields: Array<{ id: string; key: string; label: string; required: boolean; archived: boolean; type: 'text' }> }).fields)
        .filter((field) => field.id !== definition.fields[0]?.id),
    })
    expect((blocked.body as { code: string }).code).toBe('system_field')
  })

  it('rejects unknown extension values and a required custom attribute left empty', () => {
    const { state, token, organizationId } = opened()
    const dirId = directoryId(organizationId, 'departments')
    const listed = listDirectories(state, token, organizationId)
    const definition = (listed.body as { directories: Array<{ id: string; revision: number; title: string; description: string; archived: boolean; fields: Array<{ id: string; label: string; required: boolean; archived: boolean; type: 'text' }> }> }).directories
      .find((item) => item.id === dirId)
    if (!definition) throw new Error('departments')
    const nameId = definition.fields[0]?.id ?? ''
    const added = updateDirectoryDefinition(state, token, dirId, {
      organizationId,
      expectedRevision: definition.revision,
      title: definition.title,
      description: definition.description,
      archived: definition.archived,
      fields: [...fieldWrites(definition.fields), { id: 'new:note', label: 'Комментарий', required: true, archived: false, type: 'text' }],
    })
    expect(added.status).toBe(200)
    const note = (added.body as { fields: Array<{ id: string; label: string }> }).fields.find((field) => field.label === 'Комментарий')
    const missing = createDirectoryRecord(added.state, token, dirId, {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect((missing.body as { code: string }).code).toBe('required')
    const unknown = createDirectoryRecord(added.state, token, dirId, {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
      values: { [note?.id ?? '']: 'текст', [nameId]: 'чужое' },
    })
    expect((unknown.body as { code: string }).code).toBe('unknown_field')
    expect(unknown.state.departments).toEqual(added.state.departments)
  })

  it('keeps record create, record update and schema create independent', () => {
    const { state, token, organizationId } = opened()
    const reader = withMember(state, organizationId, [['registry.departments.records', 'read']])
    const denied = createDirectoryRecord(reader.state, reader.token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect(denied.status).toBe(403)
    expect((denied.body as { code: string }).code).toBe('forbidden')
    const creator = withMember(state, organizationId, [
      ['registry.departments.records', 'read'],
      ['registry.departments.records', 'create'],
    ], 41)
    const created = createDirectoryRecord(creator.state, creator.token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect(created.status).toBe(201)
    const updated = updateDirectoryRecord(created.state, creator.token, directoryId(organizationId, 'departments'), (created.body as { id: string }).id, {
      organizationId,
      expectedRevision: 1,
      name: 'Физика',
      code: 'Ф',
      parentId: null,
    })
    expect(updated.status).toBe(403)
    const listed = listDirectories(state, token, organizationId)
    const definition = (listed.body as { directories: Array<{ id: string; revision: number; title: string; description: string; archived: boolean; fields: Array<{ id: string; label: string; required: boolean; archived: boolean; type: 'text' }> }> }).directories
      .find((item) => item.id === directoryId(organizationId, 'departments'))
    if (!definition) throw new Error('departments')
    const schema = updateDirectoryDefinition(creator.state, creator.token, definition.id, {
      organizationId,
      expectedRevision: definition.revision,
      title: definition.title,
      description: definition.description,
      archived: definition.archived,
      fields: [...fieldWrites(definition.fields), { id: 'new:note', label: 'Комментарий', required: false, archived: false, type: 'text' }],
    })
    expect(schema.status).toBe(403)
    const schemaEditor = withMember(state, organizationId, [
      ['registry.departments.schema', 'read'],
      ['registry.departments.schema', 'create'],
    ], 43)
    const added = updateDirectoryDefinition(schemaEditor.state, schemaEditor.token, definition.id, {
      organizationId,
      expectedRevision: definition.revision,
      title: definition.title,
      description: definition.description,
      archived: definition.archived,
      fields: [...fieldWrites(definition.fields), { id: 'new:note', label: 'Комментарий', required: false, archived: false, type: 'text' }],
    })
    expect(added.status).toBe(200)
    const renamed = updateDirectoryDefinition(added.state, schemaEditor.token, definition.id, {
      organizationId,
      expectedRevision: (added.body as { revision: number }).revision,
      title: 'Подразделения лаборатории',
      description: definition.description,
      archived: definition.archived,
      fields: fieldWrites((added.body as { fields: Array<{ id: string; label: string; required: boolean; archived: boolean; type: 'text' }> }).fields),
    })
    expect(renamed.status).toBe(403)
  })

  it('does not let a workplace grant open or change departments', () => {
    const { state, organizationId } = opened()
    const member = withMember(state, organizationId, [
      ['registry.workplaces.records', 'read'],
      ['registry.workplaces.records', 'create'],
      ['registry.workplaces.records', 'update'],
    ])
    const list = listDirectories(member.state, member.token, organizationId)
    expect(list.status).toBe(200)
    const keys = (list.body as { directories: Array<{ key: string }> }).directories.map((item) => item.key)
    expect(keys).toEqual(['workplaces'])
    const hidden = readDirectory(member.state, member.token, organizationId, directoryId(organizationId, 'departments'))
    expect(hidden.status).toBe(403)
    const created = createDirectoryRecord(member.state, member.token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect(created.status).toBe(403)
  })

  it('keeps another organization out of the registry and still allows a manual directory for the organization administrator', () => {
    const first = opened()
    const secondCreated = createOrganization(first.state, 1, {
      fullName: 'Лаборатория Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'laboratory',
    })
    if (!('organization' in secondCreated)) throw new Error('second')
    const member = withMember(secondCreated.state, first.organizationId, [['registry.departments.records', 'read']])
    const foreign = listDirectories(member.state, member.token, secondCreated.organization.id)
    expect(foreign.status).toBe(403)
    const foreignWrite = createDirectoryRecord(member.state, member.token, directoryId(secondCreated.organization.id, 'departments'), {
      organizationId: secondCreated.organization.id,
      name: 'Чужая',
      code: 'Ч',
      parentId: null,
    })
    expect(foreignWrite.status).toBe(403)
    const role = secondCreated.state.roles.find((item) =>
      item.origin?.template === 'organization-administrator'
      && item.ownerScope?.type === 'organization'
      && item.ownerScope.organizationId === first.organizationId,
    )
    expect(role?.grantIds.some((id) => id.startsWith('g-registry-'))).toBe(false)
    const admin = withMember(secondCreated.state, first.organizationId, [], 42)
    const assigned = {
      ...admin.state,
      assignments: admin.state.assignments.map((item) => item.userId === 42 ? { ...item, roleId: role?.id ?? '' } : item),
      roles: admin.state.roles.filter((item) => item.id !== admin.roleId),
    }
    const manual = createDirectoryRecord(assigned, admin.token, directoryId(first.organizationId, 'positions'), {
      organizationId: first.organizationId,
      values: { [directoryFieldId(first.organizationId, 'positions', 'title')]: 'Инженер' },
    })
    expect(manual.status).toBe(201)
    const registry = createDirectoryRecord(assigned, admin.token, directoryId(first.organizationId, 'departments'), {
      organizationId: first.organizationId,
      name: 'Химия',
      code: 'Х',
      parentId: null,
    })
    expect(registry.status).toBe(403)
  })

  it('blocks deletion of a used department or workplace and still archives an unused record', () => {
    const { state, token, organizationId } = opened()
    const parent = createDirectoryRecord(state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Лаборатория',
      code: 'Л',
      parentId: null,
    })
    const parentId = (parent.body as { id: string; revision: number }).id
    const child = createDirectoryRecord(parent.state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Химия',
      code: 'Х',
      parentId,
    })
    const removed = deleteDirectoryRecord(child.state, token, organizationId, directoryId(organizationId, 'departments'), parentId, 1)
    expect(removed.status).toBe(409)
    expect((removed.body as { code: string }).code).toBe('in_use')
    const childId = (child.body as { id: string }).id
    const workplace = createDirectoryRecord(child.state, token, directoryId(organizationId, 'workplaces'), {
      organizationId,
      name: 'Стол',
      departmentId: childId,
    })
    const workplaceId = (workplace.body as { id: string }).id
    const blockedDepartment = deleteDirectoryRecord(workplace.state, token, organizationId, directoryId(organizationId, 'departments'), childId, 1)
    expect((blockedDepartment.body as { code: string }).code).toBe('in_use')
    const employee = createEmployee(workplace.state, token, {
      organizationId,
      values: {
        [personnelFieldId(organizationId, 'last-name')]: 'Иванов',
        [personnelFieldId(organizationId, 'first-name')]: 'Иван',
        [personnelFieldId(organizationId, 'workplace')]: workplaceId,
      },
    })
    expect(employee.status).toBe(201)
    const blockedWorkplace = deleteDirectoryRecord(employee.state, token, organizationId, directoryId(organizationId, 'workplaces'), workplaceId, 1)
    expect((blockedWorkplace.body as { code: string }).code).toBe('in_use')
    const spare = createDirectoryRecord(employee.state, token, directoryId(organizationId, 'departments'), {
      organizationId,
      name: 'Архив',
      code: 'А',
      parentId: null,
    })
    const spareId = (spare.body as { id: string; revision: number }).id
    const archived = archiveDirectoryRecord(spare.state, token, directoryId(organizationId, 'departments'), spareId, {
      organizationId,
      expectedRevision: 1,
      archived: true,
    })
    expect(archived.status).toBe(200)
    expect(archived.state.departments.find((item) => item.id === spareId)?.archived).toBe(true)
  })

  it('stops a member from granting themselves a registry permission', () => {
    const { state, organizationId } = opened()
    const member = withMember(state, organizationId, [
      ['roles', 'update'],
      ['delegations', 'delegate'],
    ])
    const createGrant = grantId(member.state, 'registry.departments.records', 'create')
    const prepared = {
      ...member.state,
      roles: member.state.roles.map((role) => role.id === member.roleId
        ? { ...role, delegationGrantIds: [...(role.delegationGrantIds ?? []), createGrant] }
        : role),
    }
    const role = prepared.roles.find((item) => item.id === member.roleId)
    const denied = updateRole(prepared, member.token, member.roleId, {
      displayName: role?.displayName ?? '',
      description: '',
      grantIds: [...(role?.grantIds ?? []), createGrant],
      delegationGrantIds: role?.delegationGrantIds ?? [],
    })
    expect(denied.status).toBe(403)
    expect((denied.body as { code: string }).code).toBe('self_elevation')
    expect(denied.state.roles.find((item) => item.id === member.roleId)?.grantIds).toEqual(role?.grantIds)
    const owner = tokenFor(state)
    const granted = createRole(owner.state, owner.token, {
      displayName: 'Редактор рабочих мест',
      description: '',
      grantIds: [grantId(owner.state, 'registry.workplaces.records', 'update')],
      delegationGrantIds: [],
      ownerScope: { type: 'organization', organizationId, corporationId: owner.state.corporation.id },
    })
    expect(granted.status).toBe(201)
  })
})
