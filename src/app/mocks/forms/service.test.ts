import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { can, canDelegate } from '../../../entities/access/model/grants'
import type { FormSchema } from '../../../entities/form/model/types'
import { formsMode } from '../../../entities/form/model/availability'
import { validateAnswers } from '../../../entities/form/model/values'
import { createAssignment, createRole } from '../access/service'
import { toSnapshot, loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { MockWriterHeldError, readMockState, replaceMockRecord, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { persistenceFailure } from '../http'
import {
  createForm,
  createRecord,
  deleteForm,
  listForms,
  publishForm,
  readDraft,
  readPublished,
  readRecord,
  saveDraft,
} from './service'

const laboratory = { type: 'organization' as const, organizationId: 101, corporationId: 1 }

function session(email: string, state = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function codeOf(result: { body: unknown }) {
  return (result.body as { code?: string }).code
}

function grantId(state: MockState, resource: string, action: string): string {
  const grant = state.grants.find((item) => item.resource === resource && item.action === action)
  if (!grant) throw new Error(`missing ${resource}.${action}`)
  return grant.id
}

function withGrants(state: MockState, userId: number, organizationId: number, pairs: Array<[string, string]>): MockState {
  const roleId = `role-forms-${userId}-${organizationId}`
  return {
    ...state,
    roles: [...state.roles, {
      id: roleId,
      displayName: 'Проверка форм',
      grantIds: pairs.map(([resource, action]) => grantId(state, resource, action)),
      delegationGrantIds: [],
      ownerScope: { type: 'organization', organizationId, corporationId: 1 },
    }],
    assignments: [...state.assignments, {
      id: `asg-${roleId}`,
      userId,
      roleId,
      scope: { type: 'organization', organizationId, corporationId: 1 },
    }],
  }
}

function field(id: string, type: FormSchema['fields'][number]['type'], label: string, extra: Partial<FormSchema['fields'][number]> = {}): FormSchema['fields'][number] {
  return {
    id,
    type,
    label,
    help: '',
    required: false,
    minLength: null,
    maxLength: null,
    min: null,
    max: null,
    options: [],
    ...extra,
  }
}

const sampleSchema: FormSchema = {
  schemaVersion: 1,
  fields: [
    field('field-sample-name', 'text', 'Название образца', { required: true }),
    field('field-sample-mass', 'number', 'Масса', { required: true, min: 0 }),
    field('field-sample-date', 'date', 'Дата поступления'),
    field('field-sample-kind', 'single_choice', 'Вид образца', {
      required: true,
      options: [{ id: 'option-core', label: 'Керн' }, { id: 'option-soil', label: 'Грунт' }],
    }),
    field('field-sample-flag', 'boolean', 'Повтор', { required: true }),
  ],
}

const authorPairs: Array<[string, string]> = [
  ['forms', 'read'],
  ['forms', 'create'],
  ['forms', 'update'],
  ['forms', 'publish'],
  ['form-records', 'read'],
]
const employeePairs: Array<[string, string]> = [
  ['forms', 'read'],
  ['form-records', 'create'],
  ['form-records', 'read'],
]

describe('form mock service', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
  })

  it('keeps form codes off stored roles and lets installation capability use and delegate them', () => {
    const seed = createSeed()
    const snapshot = toSnapshot(seed)
    expect(seed.roles.find((role) => role.id === 'role-owner')?.grantIds).not.toContain('g-forms-read')
    expect(seed.roles.find((role) => role.id === 'role-lab-admin')?.grantIds).not.toContain('g-forms-read')
    expect(can(snapshot, 1, 'forms', 'read', laboratory)).toBe(true)
    expect(can(snapshot, 1, 'forms', 'publish', laboratory)).toBe(true)
    expect(can(snapshot, 2, 'forms', 'update', laboratory)).toBe(false)
    expect(can(snapshot, 3, 'form-records', 'create', laboratory)).toBe(false)
    expect(canDelegate(snapshot, 1, 'forms', 'publish', laboratory)).toBe(true)
    expect(canDelegate(snapshot, 1, 'form-records', 'read', laboratory)).toBe(true)
    expect(canDelegate(snapshot, 2, 'forms', 'read', laboratory)).toBe(false)
    const owner = session('owner@example.test', seed)
    const created = createRole(owner.state, owner.token, {
      displayName: 'Автор форм',
      description: '',
      grantIds: authorPairs.map(([resource, action]) => grantId(owner.state, resource, action)),
      delegationGrantIds: [],
      ownerScope: laboratory,
      expectedAccessVersion: owner.state.accessVersion,
    })
    expect(created.status).toBe(201)
    const roleId = (created.body as { role: { id: string } }).role.id
    const assigned = createAssignment(created.state, owner.token, {
      userId: 2,
      roleId,
      scope: laboratory,
      expectedAccessVersion: created.state.accessVersion,
    })
    expect(assigned.status).toBe(201)
    expect(can(toSnapshot(assigned.state), 2, 'forms', 'publish', laboratory)).toBe(true)
    expect(can(toSnapshot(assigned.state), 2, 'constructor.schema', 'read', laboratory)).toBe(true)
  })

  it('publishes a version, keeps a record on that version, and rejects a stale submission', () => {
    let state = withGrants(createSeed(), 2, 101, authorPairs)
    state = withGrants(state, 3, 101, employeePairs)
    const author = session('admin.a@example.test', state)
    const created = createForm(author.state, author.token, {
      organizationId: 101,
      title: 'Приём образца',
      description: 'Первая',
    })
    expect(created.status).toBe(201)
    const formId = (created.body as { id: string }).id
    const saved = saveDraft(created.state, author.token, formId, {
      organizationId: 101,
      title: 'Приём образца',
      description: 'Первая',
      schema: sampleSchema,
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    expect(saved.status).toBe(200)
    const again = readDraft(saved.state, author.token, 101, formId)
    const draftBody = again.body as { draft: { schema: FormSchema; revision: number }; form: { revision: number } }
    expect(draftBody.draft.schema.fields.map((item) => item.id)).toEqual(sampleSchema.fields.map((item) => item.id))
    const published = publishForm(saved.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: draftBody.form.revision,
      expectedDraftRevision: draftBody.draft.revision,
    })
    expect(published.status).toBe(201)
    expect(published.state.formVersions).toHaveLength(1)
    expect(published.state.formDrafts[0]?.schema.fields[0]?.label).toBe('Название образца')
    const repeat = publishForm(published.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: draftBody.form.revision,
      expectedDraftRevision: draftBody.draft.revision,
    })
    expect(repeat.status).toBe(200)
    expect(repeat.state.formVersions).toBe(published.state.formVersions)
    const versionId = (published.body as { versionId: string }).versionId
    const employee = session('employee.a@example.test', published.state)
    const reviewed = validateAnswers(sampleSchema, {
      'field-sample-name': '',
      'field-sample-mass': null,
      'field-sample-date': null,
      'field-sample-kind': null,
      'field-sample-flag': false,
    })
    expect(reviewed.ok).toBe(false)
    expect(employee.state.formRecords).toHaveLength(0)
    const record = createRecord(employee.state, employee.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: {
        'field-sample-name': 'Керн А',
        'field-sample-mass': 0,
        'field-sample-date': '2026-10-27',
        'field-sample-kind': 'option-core',
        'field-sample-flag': false,
      },
    })
    expect(record.status).toBe(201)
    const recordId = (record.body as { id: string }).id
    const opened = readRecord(record.state, employee.token, 101, formId, recordId)
    const openedBody = opened.body as { values: Record<string, unknown>; schema: FormSchema; authorName: string }
    expect(openedBody.values['field-sample-mass']).toBe(0)
    expect(openedBody.values['field-sample-flag']).toBe(false)
    expect(openedBody.values['field-sample-date']).toBe('2026-10-27')
    expect(openedBody.values['field-sample-kind']).toBe('option-core')
    expect(openedBody.schema.fields[0]?.label).toBe('Название образца')
    expect(openedBody.authorName).not.toContain('@')

    const renamedSchema: FormSchema = {
      ...sampleSchema,
      fields: sampleSchema.fields.map((item) => item.id === 'field-sample-name' ? { ...item, label: 'Имя образца' } : item),
    }
    const draftNow = readDraft(record.state, author.token, 101, formId).body as { form: { revision: number }; draft: { revision: number } }
    const renamed = saveDraft(record.state, author.token, formId, {
      organizationId: 101,
      title: 'Приём образца',
      description: 'Первая',
      schema: renamedSchema,
      expectedFormRevision: draftNow.form.revision,
      expectedDraftRevision: draftNow.draft.revision,
    })
    expect(renamed.status).toBe(200)
    const stale = saveDraft(renamed.state, author.token, formId, {
      organizationId: 101,
      title: 'Чужое',
      description: '',
      schema: sampleSchema,
      expectedFormRevision: draftNow.form.revision,
      expectedDraftRevision: draftNow.draft.revision,
    })
    expect(codeOf(stale)).toBe('stale_write')
    expect(stale.state.forms.find((item) => item.id === formId)?.title).toBe('Приём образца')
    const renamedBody = renamed.body as { form: { revision: number }; draft: { revision: number } }
    const second = publishForm(renamed.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: renamedBody.form.revision,
      expectedDraftRevision: renamedBody.draft.revision,
    })
    expect(second.status).toBe(201)
    expect(second.state.formVersions).toHaveLength(2)
    expect(second.state.formVersions[0]?.schema.fields[0]?.label).toBe('Название образца')
    const oldRecord = readRecord(second.state, employee.token, 101, formId, recordId)
    expect((oldRecord.body as { schema: FormSchema }).schema.fields[0]?.label).toBe('Название образца')
    const current = readPublished(second.state, employee.token, 101, formId)
    expect((current.body as { schema: FormSchema; versionNumber: number }).schema.fields[0]?.label).toBe('Имя образца')
    expect((current.body as { draft?: unknown }).draft).toBeUndefined()
    const conflict = createRecord(second.state, employee.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: {
        'field-sample-name': 'Керн Б',
        'field-sample-mass': 2,
        'field-sample-date': null,
        'field-sample-kind': 'option-soil',
        'field-sample-flag': true,
      },
    })
    expect(conflict.status).toBe(409)
    expect(codeOf(conflict)).toBe('version_conflict')
    expect(conflict.state.formRecords).toHaveLength(1)
    expect(conflict.state.formRecords[0]?.values['field-sample-name']).toBe('Керн А')
  })

  it('hides the draft from the published dto and from a reader', () => {
    let state = withGrants(createSeed(), 2, 101, authorPairs)
    state = withGrants(state, 3, 101, [['forms', 'read']])
    const author = session('admin.a@example.test', state)
    const created = createForm(author.state, author.token, { organizationId: 101, title: 'Скрытая', description: '' })
    const formId = (created.body as { id: string }).id
    const saved = saveDraft(created.state, author.token, formId, {
      organizationId: 101,
      title: 'Скрытая',
      description: '',
      schema: sampleSchema,
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    const published = publishForm(saved.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    const extra: FormSchema = {
      ...sampleSchema,
      fields: [...sampleSchema.fields, field('field-secret', 'text', 'Секрет')],
    }
    const hidden = saveDraft(published.state, author.token, formId, {
      organizationId: 101,
      title: 'Скрытая',
      description: '',
      schema: extra,
      expectedFormRevision: 3,
      expectedDraftRevision: 2,
    })
    const reader = session('employee.a@example.test', hidden.state)
    expect(readDraft(reader.state, reader.token, 101, formId).status).toBe(403)
    const visible = readPublished(reader.state, reader.token, 101, formId)
    expect(visible.status).toBe(200)
    const ids = (visible.body as { schema: FormSchema }).schema.fields.map((item) => item.id)
    expect(ids).not.toContain('field-secret')
    expect(JSON.stringify(visible.body)).not.toContain('Секрет')
    const listed = listForms(reader.state, reader.token, 101)
    expect((listed.body as { forms: Array<{ status: string }> }).forms[0]?.status).toBe('published')
  })

  it('rejects another organization, a direct publish without the right, and unknown keys', () => {
    let state = withGrants(createSeed(), 2, 101, authorPairs.filter((pair) => pair[1] !== 'publish'))
    state = withGrants(state, 4, 102, [['forms', 'read'], ['form-records', 'read']])
    const author = session('admin.a@example.test', state)
    const created = createForm(author.state, author.token, { organizationId: 101, title: 'Лаборатория А', description: '' })
    const formId = (created.body as { id: string }).id
    const saved = saveDraft(created.state, author.token, formId, {
      organizationId: 101,
      title: 'Лаборатория А',
      description: '',
      schema: sampleSchema,
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    const denied = publishForm(saved.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    expect(denied.status).toBe(403)
    expect(denied.state.formVersions).toBe(saved.state.formVersions)
    const outsider = session('employee.b@example.test', saved.state)
    expect(listForms(outsider.state, outsider.token, 101).status).toBe(403)
    expect(readPublished(outsider.state, outsider.token, 102, formId).status).toBe(404)
    expect(JSON.stringify(readPublished(outsider.state, outsider.token, 102, formId).body)).not.toContain('Лаборатория А')
    const unknown = createRecord(saved.state, author.token, formId, {
      organizationId: 101,
      formVersionId: 'ver-missing-version',
      values: { extra: true },
      unexpected: 1,
    })
    expect(codeOf(unknown)).toBe('unknown_key')
    expect(unknown.state.formRecords).toHaveLength(0)
  })

  it('migrates empty form collections without granting the new codes or dropping constructor data', () => {
    const seed = createSeed()
    const namespace = `inlog:mock:forms-migrate-${crypto.randomUUID()}`
    const snapshot = {
      ...seed,
      namespace,
      schemaVersion: 5,
      grants: seed.grants.filter((grant) => !grant.id.startsWith('g-forms') && !grant.id.startsWith('g-form-records')),
      roles: seed.roles.map((role) => ({
        ...role,
        grantIds: role.grantIds.filter((id) => !id.startsWith('g-forms') && !id.startsWith('g-form-records')),
        delegationGrantIds: (role.delegationGrantIds ?? []).filter((id) => !id.startsWith('g-forms') && !id.startsWith('g-form-records')),
      })),
      constructorNodes: [{ id: 7, organizationId: 101, parentId: null, nameEn: 'Kept', nameRu: 'Сохранён', relatedNodeIds: [] }],
      tasks: seed.tasks,
    } as MockState
    delete (snapshot as { forms?: unknown }).forms
    delete (snapshot as { formDrafts?: unknown }).formDrafts
    delete (snapshot as { formVersions?: unknown }).formVersions
    delete (snapshot as { formRecords?: unknown }).formRecords
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.state.schemaVersion).toBe(9)
    expect(migrated?.state.forms).toEqual([])
    expect(migrated?.state.formRecords).toEqual([])
    expect(migrated?.state.tableViews).toEqual([])
    expect(migrated?.state.sections).toEqual([])
    expect(migrated?.state.constructorNodes[0]?.nameRu).toBe('Сохранён')
    expect(migrated?.state.tasks.length).toBe(seed.tasks.length)
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.grantIds).not.toContain('g-forms-read')
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.grantIds).not.toContain('g-sections-read')
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).not.toContain('g-forms-publish')
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-forms-read')).toBe(true)
    expect(can(toSnapshot(migrated!.state), 1, 'forms', 'read', laboratory)).toBe(true)
    expect(can(toSnapshot(migrated!.state), 2, 'forms', 'read', laboratory)).toBe(false)
  })

  it('keeps the previous document when a write throws and does not call forms from live pages', async () => {
    const namespace = `inlog:mock:forms-fail-${crypto.randomUUID()}`
    await replaceMockRecord(namespace, { ...createSeed(), namespace, constructorNodes: [{ id: 1, organizationId: 101, parentId: null, nameEn: 'A', nameRu: 'А', relatedNodeIds: [] }] })
    await expect(updateMockState(() => {
      throw new DOMException('full', 'QuotaExceededError')
    }, namespace)).rejects.toMatchObject({ name: 'QuotaExceededError' })
    await expect(updateMockState(() => {
      throw new MockWriterHeldError()
    }, namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
    const read = await readMockState(namespace)
    expect(read.ok && read.state.formVersions).toEqual([])
    expect(read.ok && read.state.constructorNodes).toHaveLength(1)
    expect(read.ok && read.state.tasks.length).toBeGreaterThan(0)
    const held = persistenceFailure(new MockWriterHeldError())
    const quota = persistenceFailure(new DOMException('full', 'QuotaExceededError'))
    expect(held?.status).toBe(409)
    expect(quota?.status).toBe(507)
    const editor = readFileSync(resolve('src/features/form-builder/ui/FormEditor.tsx'), 'utf8')
    const page = readFileSync(resolve('src/pages/app/forms/ui/FormsPage.tsx'), 'utf8')
    const handlers = readFileSync(resolve('src/app/mocks/forms/handlers.ts'), 'utf8')
    expect(editor).not.toContain('createFormRecord')
    expect(page).not.toContain('mocks/db')
    expect(page).not.toContain('repository')
    expect(handlers).not.toContain('preview')
    expect(formsMode('live')).toBe('unavailable')
    expect(formsMode('mock')).toBe('mock')
  })

  it('saves an empty draft, rejects an empty publication, and still reads an older empty record', () => {
    let state = withGrants(createSeed(), 2, 101, authorPairs)
    state = withGrants(state, 3, 101, employeePairs)
    state = withGrants(state, 4, 102, [['forms', 'read'], ['form-records', 'read']])
    const author = session('admin.a@example.test', state)
    const created = createForm(author.state, author.token, {
      organizationId: 101,
      title: 'Пустая форма',
      description: 'Без полей',
    })
    expect(created.status).toBe(201)
    const formId = (created.body as { id: string }).id
    const saved = saveDraft(created.state, author.token, formId, {
      organizationId: 101,
      title: 'Пустая форма',
      description: 'Без полей',
      schema: { schemaVersion: 1, fields: [] },
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    expect(saved.status).toBe(200)
    expect(saved.state.formVersions).toHaveLength(0)
    const blocked = publishForm(saved.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    expect(blocked.status).toBe(400)
    expect(codeOf(blocked)).toBe('empty_schema')
    expect(blocked.state).toBe(saved.state)

    const versionId = 'ver-empty-history'
    const recordId = 'rec-empty-history'
    const historical: MockState = {
      ...saved.state,
      forms: saved.state.forms.map((form) => form.id === formId ? { ...form, publishedVersionId: versionId } : form),
      formVersions: [...saved.state.formVersions, {
        id: versionId,
        formId,
        organizationId: 101,
        number: 1,
        title: 'Пустая форма',
        description: 'Без полей',
        schema: { schemaVersion: 1, fields: [] },
        publishedAt: '2026-01-01T00:00:00.000Z',
        publishedBy: 2,
        sourceDraftRevision: 2,
      }],
      formRecords: [...saved.state.formRecords, {
        id: recordId,
        organizationId: 101,
        formId,
        formVersionId: versionId,
        values: {},
        createdBy: 3,
        createdAt: '2026-01-02T00:00:00.000Z',
      }],
    }
    const employee = session('employee.a@example.test', historical)
    const rejected = createRecord(employee.state, employee.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: {},
    })
    expect(rejected.status).toBe(400)
    expect(codeOf(rejected)).toBe('empty_schema')
    expect(rejected.state.formRecords.map((item) => item.id)).toEqual([recordId])
    const opened = readRecord(employee.state, employee.token, 101, formId, recordId)
    expect(opened.status).toBe(200)
    const openedBody = opened.body as { schema: FormSchema; values: Record<string, unknown>; title: string; versionNumber: number }
    expect(openedBody.schema.fields).toEqual([])
    expect(openedBody.values).toEqual({})
    expect(openedBody.title).toBe('Пустая форма')
    expect(openedBody.versionNumber).toBe(1)
    const outsider = session('employee.b@example.test', employee.state)
    const hidden = readRecord(outsider.state, outsider.token, 102, formId, recordId)
    expect(hidden.status).toBe(404)
    expect(JSON.stringify(hidden.body)).not.toContain('Пустая форма')
    const sameRevision = publishForm(employee.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    expect(sameRevision.status).toBe(200)
    expect(sameRevision.state.formVersions).toBe(employee.state.formVersions)
    expect(sameRevision.state.formVersions[0]?.schema.fields).toEqual([])
    const bumped = saveDraft(sameRevision.state, author.token, formId, {
      organizationId: 101,
      title: 'Пустая форма',
      description: 'Без полей',
      schema: { schemaVersion: 1, fields: [] },
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    expect(bumped.status).toBe(200)
    const again = publishForm(bumped.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 3,
      expectedDraftRevision: 3,
    })
    expect(again.status).toBe(400)
    expect(codeOf(again)).toBe('empty_schema')
    expect(again.state.formVersions).toHaveLength(1)
    expect(again.state.formRecords).toHaveLength(1)
    expect(again.state.formVersions[0]?.schema.fields).toEqual([])
  })

  it('publishes a normal form, keeps an empty optional answer, and refuses a missing required value', () => {
    let state = withGrants(createSeed(), 2, 101, authorPairs)
    state = withGrants(state, 3, 101, employeePairs)
    const author = session('admin.a@example.test', state)
    const created = createForm(author.state, author.token, {
      organizationId: 101,
      title: 'Образцы',
      description: 'Учёт',
    })
    const formId = (created.body as { id: string }).id
    const schema: FormSchema = {
      schemaVersion: 1,
      fields: [
        field('field-number', 'text', 'Номер образца', { required: true }),
        field('field-note', 'text', 'Примечание'),
        field('field-mass', 'number', 'Масса'),
        field('field-repeat', 'boolean', 'Повтор'),
      ],
    }
    const saved = saveDraft(created.state, author.token, formId, {
      organizationId: 101,
      title: 'Образцы',
      description: 'Учёт',
      schema,
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    expect(saved.status).toBe(200)
    const published = publishForm(saved.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    expect(published.status).toBe(201)
    const versionId = (published.body as { versionId: string }).versionId
    const employee = session('employee.a@example.test', published.state)
    const missing = createRecord(employee.state, employee.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: { 'field-number': '', 'field-note': '', 'field-mass': null, 'field-repeat': false },
    })
    expect(missing.status).toBe(400)
    expect(codeOf(missing)).toBe('invalid_payload')
    expect(missing.state.formRecords).toHaveLength(0)
    const stored = createRecord(employee.state, employee.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: { 'field-number': 'ОБ-001', 'field-note': '', 'field-mass': 0, 'field-repeat': false },
    })
    expect(stored.status).toBe(201)
    const recordId = (stored.body as { id: string }).id
    const opened = readRecord(stored.state, employee.token, 101, formId, recordId)
    const values = (opened.body as { values: Record<string, unknown>; schema: FormSchema }).values
    const openedSchema = (opened.body as { schema: FormSchema }).schema
    expect(values['field-number']).toBe('ОБ-001')
    expect(values['field-note']).toBe('')
    expect(values['field-mass']).toBe(0)
    expect(values['field-repeat']).toBe(false)
    expect(openedSchema.fields[0]?.label).toBe('Номер образца')
    const renamed = saveDraft(stored.state, author.token, formId, {
      organizationId: 101,
      title: 'Образцы',
      description: 'Учёт',
      schema: {
        ...schema,
        fields: schema.fields.map((item) => item.id === 'field-number' ? { ...item, label: 'Код образца' } : item),
      },
      expectedFormRevision: 3,
      expectedDraftRevision: 2,
    })
    expect(renamed.status).toBe(200)
    const renamedBody = renamed.body as { form: { revision: number }; draft: { revision: number } }
    const second = publishForm(renamed.state, author.token, formId, {
      organizationId: 101,
      expectedFormRevision: renamedBody.form.revision,
      expectedDraftRevision: renamedBody.draft.revision,
    })
    expect(second.status).toBe(201)
    const oldRecord = readRecord(second.state, employee.token, 101, formId, recordId)
    expect((oldRecord.body as { schema: FormSchema }).schema.fields[0]?.label).toBe('Номер образца')
    expect((oldRecord.body as { values: Record<string, unknown> }).values['field-number']).toBe('ОБ-001')
  })

  it('deletes a form together with its records and keeps a form that a section still uses', () => {
    const owner = session('owner@example.test')
    expect(can(toSnapshot(owner.state), 1, 'forms', 'delete', laboratory)).toBe(true)
    const created = createForm(owner.state, owner.token, { organizationId: 101, title: 'Лишняя', description: '' })
    const formId = (created.body as { id: string }).id
    const kept = createForm(created.state, owner.token, { organizationId: 101, title: 'Оставить', description: '' })
    const keptId = (kept.body as { id: string }).id
    const saved = saveDraft(kept.state, owner.token, formId, {
      organizationId: 101,
      title: 'Лишняя',
      description: '',
      schema: { schemaVersion: 1, fields: [field('field-number', 'text', 'Номер', { required: true })] },
      expectedFormRevision: 1,
      expectedDraftRevision: 1,
    })
    const published = publishForm(saved.state, owner.token, formId, {
      organizationId: 101,
      expectedFormRevision: 2,
      expectedDraftRevision: 2,
    })
    const versionId = (published.body as { versionId: string }).versionId
    const stored = createRecord(published.state, owner.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: { 'field-number': 'ОБ-001' },
    })
    expect(stored.status).toBe(201)
    const withView: MockState = {
      ...stored.state,
      tableViews: [...stored.state.tableViews, {
        id: 'view-extra-delete',
        organizationId: 101,
        formId,
        title: 'Таблица',
        description: '',
        columns: [],
        filters: [],
        sort: { columnId: 'createdAt', direction: 'asc' },
        pageSize: 20,
        schemaVersion: 1,
        revision: 1,
        createdBy: 1,
        updatedBy: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }
    const limited = withGrants(withView, 2, 101, [['forms', 'update'], ['forms', 'publish']])
    const admin = session('admin.a@example.test', limited)
    const denied = deleteForm(admin.state, admin.token, 101, formId)
    expect(denied.status).toBe(403)
    expect(codeOf(denied)).toBe('forbidden')
    expect(denied.state.forms.some((form) => form.id === formId)).toBe(true)
    const linked: MockState = {
      ...denied.state,
      sections: [...denied.state.sections, {
        id: 'sec-form-use',
        organizationId: 101,
        publishedVersionId: null,
        revision: 1,
        active: true,
      }],
      sectionDrafts: [...denied.state.sectionDrafts, {
        sectionId: 'sec-form-use',
        schemaVersion: 1,
        title: 'Раздел',
        description: '',
        iconKey: 'file',
        formId,
        tableViewId: '',
        showCreate: false,
        createLabel: '',
        order: 1,
        revision: 1,
      }],
    }
    const blocked = deleteForm(linked, owner.token, 101, formId)
    expect(blocked.status).toBe(409)
    expect(codeOf(blocked)).toBe('form_in_use')
    expect(blocked.state.forms.some((form) => form.id === formId)).toBe(true)
    expect(blocked.state.formRecords.some((record) => record.formId === formId)).toBe(true)
    const released: MockState = {
      ...blocked.state,
      sections: blocked.state.sections.filter((section) => section.id !== 'sec-form-use'),
      sectionDrafts: blocked.state.sectionDrafts.filter((draft) => draft.sectionId !== 'sec-form-use'),
    }
    const removed = deleteForm(released, owner.token, 101, formId)
    expect(removed.status).toBe(200)
    expect(removed.state.forms.map((form) => form.id)).toEqual([keptId])
    expect(removed.state.formDrafts.some((draft) => draft.formId === formId)).toBe(false)
    expect(removed.state.formVersions.some((version) => version.formId === formId)).toBe(false)
    expect(removed.state.formRecords.some((record) => record.formId === formId)).toBe(false)
    expect(removed.state.tableViews.some((view) => view.formId === formId)).toBe(false)
    const foreign = deleteForm(removed.state, owner.token, 102, keptId)
    expect(foreign.status).toBe(404)
    expect(foreign.state.forms.some((form) => form.id === keptId)).toBe(true)
  })
})
