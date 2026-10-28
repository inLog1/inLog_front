import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { loginWithPassword } from '../auth/flow'
import { migrateMockDocument } from '../db/migrate'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { ensureMockState, MockWriterHeldError, StaleMockWriteError, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { persistenceFailure } from '../http'
import { deleteNotification, listNotifications, updateNotification } from '../notifications/service'
import { combinedConstructorData } from '../reports/service'
import {
  createField,
  createNode,
  createRecord,
  createTab,
  deleteField,
  deleteNode,
  deleteTab,
  listFields,
  listNodes,
  updateField,
  updateRecord,
  updateTabs,
} from './service'

function session(email: string, state = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function codeOf(result: { body: unknown }) {
  return (result.body as { code?: string }).code
}

function withoutGrant(state: MockState, grantId: string): MockState {
  return {
    ...state,
    roles: state.roles.map((role) => ({
      ...role,
      grantIds: role.grantIds.filter((id) => id !== grantId),
      delegationGrantIds: (role.delegationGrantIds ?? []).filter((id) => id !== grantId),
    })),
  }
}

describe('constructor and report mocks', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
  })

  it('creates a node, tab, field and record, then keeps the value when the field is renamed', () => {
    const admin = session('admin.a@example.test')
    const node = createNode(admin.state, admin.token, 101, { name_en: 'Sample', name_ru: 'Образец', parent: 0, organization: 101 })
    expect(node.status).toBe(201)
    const nodeId = (node.body as { id: number }).id
    const tab = createTab(node.state, admin.token, 101, { name_en: 'Sheet', name_ru: 'Лист', group: nodeId, organizationId: 101 })
    expect(tab.status).toBe(201)
    const tabId = (tab.body as { id: number }).id
    const field = createField(tab.state, admin.token, 101, {
      name_en: 'Mass',
      name_ru: 'Масса',
      type: 'string',
      structure_element: tabId,
      organizationId: 101,
    })
    expect(field.status).toBe(201)
    const fieldId = (field.body as { id: number }).id
    const row = createRecord(field.state, admin.token, 101, {
      group: nodeId,
      structure_element: tabId,
      data: { Mass: { type: 'string', value: '12' } },
    })
    expect(row.status).toBe(201)
    const renamed = updateField(row.state, admin.token, 101, fieldId, {
      name_en: 'Weight',
      name_ru: 'Вес',
      type: 'string',
      structure_element: tabId,
      organizationId: 101,
    })
    expect(renamed.status).toBe(200)
    expect(renamed.state.constructorFields.find((item) => item.id === fieldId)?.nameEn).toBe('Weight')
    expect(renamed.state.constructorRecords[0]?.values).toEqual([{ fieldId, value: '12' }])
    const blocked = updateField(renamed.state, admin.token, 101, fieldId, {
      name_en: 'Weight',
      name_ru: 'Вес',
      type: 'integer',
      structure_element: tabId,
    })
    expect(blocked.status).toBe(409)
    expect(codeOf(blocked)).toBe('type_change_blocked')
    expect(blocked.state.constructorFields.find((item) => item.id === fieldId)?.type).toBe('string')
    expect(blocked.state.constructorRecords[0]?.values[0]?.value).toBe('12')

    const report = combinedConstructorData(renamed.state, admin.token, 101, [{ element: tabId, group: nodeId, fields: [fieldId] }])
    expect(report.status).toBe(200)
    const reports = report.body as Array<{ data: { objects: Array<{ data: Record<string, { value: string }> }> } }>
    expect(Array.isArray(reports)).toBe(true)
    expect(reports[0]?.data.objects[0]?.data.Weight?.value).toBe('12')
    expect(reports[0]?.data.objects[0]?.data.Mass).toBeUndefined()
    expect(Array.isArray((reports[0] as { columns?: unknown }).columns)).toBe(false)
  })

  it('rejects another laboratory, a customer, and a substituted parent without writing', () => {
    const owner = session('owner@example.test')
    const foreign = createNode(owner.state, owner.token, 102, { name_en: 'Lab B', name_ru: 'Лаб Б', parent: 0 })
    const foreignId = (foreign.body as { id: number }).id
    const admin = session('admin.a@example.test', foreign.state)
    const deniedList = listNodes(admin.state, admin.token, 102)
    expect(deniedList.status).toBe(403)
    expect(JSON.stringify(deniedList.body)).not.toContain('Lab B')
    expect(deniedList.state.sessions).toEqual(admin.state.sessions)
    const customer = session('customer@example.test', admin.state)
    const customerList = listNodes(customer.state, customer.token, 101)
    expect(customerList.status).toBe(403)
    expect(JSON.stringify(customerList.body)).not.toContain('Лаб')
    const substituted = createNode(admin.state, admin.token, 101, { name_en: 'Stolen', name_ru: 'Чужой', parent: foreignId, organization: 102 })
    expect(substituted.status).toBe(400)
    expect(codeOf(substituted)).toBe('invalid_relation')
    expect(substituted.state.constructorNodes).toEqual(admin.state.constructorNodes)
    const query = listFields(admin.state, admin.token, 101, { group: foreignId })
    expect(query.status).toBe(400)
    expect(JSON.stringify(query.body)).not.toContain('Lab B')
  })

  it('keeps schema, record and report permissions separate', () => {
    const admin = session('admin.a@example.test')
    const node = createNode(admin.state, admin.token, 101, { name_en: 'Node', name_ru: 'Узел' })
    const nodeId = (node.body as { id: number }).id
    const schemaOnly = withoutGrant(
      withoutGrant(withoutGrant(withoutGrant(node.state, 'g-constructor-records-read'), 'g-constructor-records-create'), 'g-constructor-records-update'),
      'g-reports-generate',
    )
    const reader = session('admin.a@example.test', schemaOnly)
    const field = createField(reader.state, reader.token, 101, { name_en: 'Note', name_ru: 'Заметка', type: 'string', group: nodeId })
    expect(field.status).toBe(201)
    const record = createRecord(field.state, reader.token, 101, { group: nodeId, data: { Note: { type: 'string', value: 'a' } } })
    expect(record.status).toBe(403)
    expect(record.state.constructorRecords).toEqual(field.state.constructorRecords)
    const reportDenied = combinedConstructorData(field.state, reader.token, 101, [{ group: nodeId, fields: [] }])
    expect(reportDenied.status).toBe(403)

    const recordsOnly: MockState = {
      ...field.state,
      roles: withoutGrant(withoutGrant(node.state, 'g-constructor-schema-create'), 'g-constructor-schema-update').roles,
    }
    const recorder = session('admin.a@example.test', recordsOnly)
    const anotherField = createField(recorder.state, recorder.token, 101, { name_en: 'Other', name_ru: 'Другое', type: 'string', group: nodeId })
    expect(anotherField.status).toBe(403)
    const saved = createRecord(recorder.state, recorder.token, 101, { group: nodeId, data: { Note: { type: 'string', value: 'a' } } })
    expect(saved.status).toBe(201)
    const report = combinedConstructorData(saved.state, recorder.token, 101, [{ group: nodeId, fields: [(field.body as { id: number }).id] }])
    expect(report.status).toBe(200)
  })

  it('rolls back a multiple tab update when one relation is outside the organization', () => {
    const admin = session('admin.a@example.test')
    const node = createNode(admin.state, admin.token, 101, { name_en: 'Node', name_ru: 'Узел' })
    const nodeId = (node.body as { id: number }).id
    const first = createTab(node.state, admin.token, 101, { name_en: 'One', name_ru: 'Один', group: nodeId })
    const second = createTab(first.state, admin.token, 101, { name_en: 'Two', name_ru: 'Два', group: nodeId })
    const firstId = (first.body as { id: number }).id
    const secondId = (second.body as { id: number }).id
    const failed = updateTabs(second.state, admin.token, 101, {
      id: firstId,
      group: nodeId,
      organizationId: 101,
      structure_elements: [
        { id: firstId, name_en: 'Changed', name_ru: 'Изменён' },
        { id: secondId, name_en: 'Also', name_ru: 'Тоже', related_structure_elements: [999] },
      ],
    })
    expect(failed.status).toBe(400)
    expect(failed.state.constructorTabs.map((tab) => tab.nameEn)).toEqual(['One', 'Two'])
    const saved = updateTabs(second.state, admin.token, 101, {
      id: firstId,
      group: nodeId,
      structure_elements: [
        { id: firstId, name_en: 'Changed', name_ru: 'Изменён' },
        { id: secondId, name_en: 'Also', name_ru: 'Тоже' },
      ],
    })
    expect(saved.status).toBe(200)
    expect(saved.state.constructorTabs.map((tab) => tab.nameEn).sort()).toEqual(['Also', 'Changed'])
  })

  it('refuses to delete a node, tab, or field that still has user data', () => {
    const admin = session('admin.a@example.test')
    const node = createNode(admin.state, admin.token, 101, { name_en: 'Node', name_ru: 'Узел' })
    const nodeId = (node.body as { id: number }).id
    const tab = createTab(node.state, admin.token, 101, { name_en: 'Sheet', name_ru: 'Лист', group: nodeId })
    const tabId = (tab.body as { id: number }).id
    const blockedNode = deleteNode(tab.state, admin.token, 101, nodeId)
    expect(blockedNode.status).toBe(409)
    expect(blockedNode.state.constructorNodes).toHaveLength(1)
    expect(blockedNode.state.constructorTabs).toHaveLength(1)
    const field = createField(tab.state, admin.token, 101, { name_en: 'Mass', name_ru: 'Масса', type: 'integer', structure_element: tabId })
    const fieldId = (field.body as { id: number }).id
    const row = createRecord(field.state, admin.token, 101, {
      group: nodeId,
      structure_element: tabId,
      data: { Mass: { type: 'integer', value: 0 } },
    })
    expect(row.state.constructorRecords[0]?.values[0]?.value).toBe('0')
    const blockedField = deleteField(row.state, admin.token, 101, fieldId)
    expect(blockedField.status).toBe(409)
    expect(blockedField.state.constructorRecords[0]?.values[0]?.value).toBe('0')
    const blockedTab = deleteTab(row.state, admin.token, 101, tabId)
    expect(blockedTab.status).toBe(409)
    const empty = createField(row.state, admin.token, 101, { name_en: 'Empty', name_ru: 'Пусто', type: 'string', group: nodeId })
    const removed = deleteField(empty.state, admin.token, 101, (empty.body as { id: number }).id)
    expect(removed.status).toBe(204)
    expect(removed.state.constructorFields.map((item) => item.nameEn)).toEqual(['Mass'])
    expect(removed.state.constructorRecords).toHaveLength(1)
  })

  it('migrates a version-3 snapshot without new permissions or lost tasks', () => {
    const seed = createSeed()
    const { constructorNodes, constructorTabs, constructorFields, constructorRecords, notifications, ...rest } = seed
    void constructorNodes
    void constructorTabs
    void constructorFields
    void constructorRecords
    void notifications
    const snapshot = {
      ...rest,
      schemaVersion: 3,
      tasks: rest.tasks.map((task) => task.projectId === 1001 && task.slug === 'shared-sample' ? { ...task, name: 'Сохранено' } : task),
      assignments: rest.assignments.map((item) => item.id === 'asg-employee-a' ? { ...item, roleId: 'role-lab-admin' } : item),
      roles: rest.roles.map((role) => role.id === 'role-owner' ? { ...role, grantIds: ['g-projects'] } : role),
    } as MockState
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.state.schemaVersion).toBe(9)
    expect(migrated?.state.forms).toEqual([])
    expect(migrated?.state.formDrafts).toEqual([])
    expect(migrated?.state.formVersions).toEqual([])
    expect(migrated?.state.formRecords).toEqual([])
    expect(migrated?.state.tableViews).toEqual([])
    expect(migrated?.state.sections).toEqual([])
    expect(migrated?.state.sectionDrafts).toEqual([])
    expect(migrated?.state.sectionVersions).toEqual([])
    expect(migrated?.state.roles.every((role) => role.grantIds.every((id) => !id.startsWith('g-forms') && !id.startsWith('g-form-records') && !id.startsWith('g-sections')))).toBe(true)
    expect(migrated?.state.tasks.find((task) => task.projectId === 1001 && task.slug === 'shared-sample')?.name).toBe('Сохранено')
    expect(migrated?.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-lab-admin')
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.grantIds).toEqual(['g-projects'])
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.ownerScope).toBeUndefined()
    expect(migrated?.state.accessAudit).toEqual([])
    expect(migrated?.state.constructorNodes).toEqual([])
    expect(migrated?.state.constructorRecords).toEqual([])
    expect(migrateMockDocument({ ...snapshot, schemaVersion: 99 })).toBeNull()

    const kept = migrateMockDocument({
      ...seed,
      schemaVersion: 3,
      constructorNodes: [{ id: 7, organizationId: 101, parentId: null, nameEn: 'Kept', nameRu: 'Сохранён', relatedNodeIds: [] }],
    })
    expect(kept?.state.constructorNodes[0]?.nameRu).toBe('Сохранён')
    expect(kept?.state.tasks.find((task) => task.slug === 'shared-sample' && task.projectId === 1002)?.name).toBe('Образец Б-1')
  })

  it('keeps a record after the database is opened again and does not report success for a locked write', async () => {
    const namespace = `inlog:mock:test-constructor-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    const box: { token?: string } = {}
    await updateMockState((state) => {
      const login = loginWithPassword(state, 'admin.a@example.test', PUBLIC_FIXTURE_PASSWORD)
      box.token = login.state.sessions.at(-1)?.accessToken
      return login.state
    }, namespace)
    await updateMockState((state) => {
      const created = createNode(state, box.token ?? '', 101, { name_en: 'Stored', name_ru: 'Сохранено' })
      expect(created.status).toBe(201)
      return created.state
    }, namespace)
    const opened = await ensureMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.constructorNodes.map((node) => node.nameRu)).toEqual(['Сохранено'])
    expect(opened.state.tasks.some((task) => task.slug === 'shared-sample')).toBe(true)

    const held = persistenceFailure(new MockWriterHeldError())
    const stale = persistenceFailure(new StaleMockWriteError())
    const quota = persistenceFailure(new DOMException('full', 'QuotaExceededError'))
    expect(held?.status).toBe(409)
    expect(stale?.status).toBe(409)
    expect(quota?.status).toBe(507)
    expect(JSON.stringify(await held?.json())).not.toContain('success')
  })

  it('returns only the current user notifications', () => {
    const seed = createSeed()
    const withNotes: MockState = {
      ...seed,
      notifications: [
        { id: 1, userId: 2, type: 'note', isRead: false, isDeleted: false, createdAt: '2026-10-27T00:00:00.000Z', data: { text: 'для администратора' } },
        { id: 2, userId: 3, type: 'note', isRead: false, isDeleted: false, createdAt: '2026-10-27T00:00:00.000Z', data: { text: 'для сотрудника' } },
      ],
    }
    const admin = session('admin.a@example.test', withNotes)
    const list = listNotifications(admin.state, admin.token)
    expect(list.status).toBe(200)
    expect(JSON.stringify(list.body)).toContain('для администратора')
    expect(JSON.stringify(list.body)).not.toContain('для сотрудника')
    const patched = updateNotification(admin.state, admin.token, 2, { is_read: true })
    expect(patched.status).toBe(404)
    expect(patched.state.notifications[1]?.isRead).toBe(false)
    const removed = deleteNotification(admin.state, admin.token, 1)
    expect(removed.status).toBe(204)
    const again = listNotifications(removed.state, admin.token)
    expect(again.body).toEqual([])
  })

  it('keeps an omitted record value when another field is edited', () => {
    const admin = session('admin.a@example.test')
    const node = createNode(admin.state, admin.token, 101, { name_en: 'Node', name_ru: 'Узел' })
    const nodeId = (node.body as { id: number }).id
    const first = createField(node.state, admin.token, 101, { name_en: 'Mass', name_ru: 'Масса', type: 'string', group: nodeId })
    const second = createField(first.state, admin.token, 101, { name_en: 'Note', name_ru: 'Заметка', type: 'date', group: nodeId })
    const row = createRecord(second.state, admin.token, 101, {
      group: nodeId,
      data: {
        Mass: { type: 'string', value: '' },
        Note: { type: 'date', value: '2026-10-27' },
      },
    })
    const rowId = (row.body as { id: number }).id
    const edited = updateRecord(row.state, admin.token, 101, rowId, {
      group: nodeId,
      data: { Mass: { type: 'string', value: '5' } },
    })
    expect(edited.status).toBe(200)
    const values = edited.state.constructorRecords[0]?.values
    expect(values?.find((value) => value.fieldId === (first.body as { id: number }).id)?.value).toBe('5')
    expect(values?.find((value) => value.fieldId === (second.body as { id: number }).id)?.value).toBe('2026-10-27')
    const wrong = createRecord(edited.state, admin.token, 101, {
      group: nodeId,
      data: { Note: { type: 'date', value: 'blob:http://local/1' } },
    })
    expect(wrong.status).toBe(400)
    expect(wrong.state.constructorRecords).toHaveLength(1)
  })
})
