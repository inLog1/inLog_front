import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { can } from '../../../entities/access/model/grants'
import type { FormSchema } from '../../../entities/form/model/types'
import { tableViewsMode } from '../../../entities/table-view/model/availability'
import { SYSTEM_COLUMN_IDS } from '../../../entities/table-view/model/types'
import { toSnapshot, loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { createForm, createRecord, publishForm, saveDraft } from '../forms/service'
import {
  columnCatalog,
  createTableView,
  deleteTableView,
  listTableViews,
  previewTableRows,
  queryTableRows,
  updateTableView,
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
  const roleId = `role-views-${userId}-${organizationId}`
  return {
    ...state,
    roles: [...state.roles, {
      id: roleId,
      displayName: 'Проверка представлений',
      grantIds: pairs.map(([resource, action]) => grantId(state, resource, action)),
      delegationGrantIds: [],
      ownerScope: { type: 'organization' as const, organizationId, corporationId: 1 },
    }],
    assignments: [...state.assignments, {
      id: `asg-${roleId}`,
      userId,
      roleId,
      scope: { type: 'organization' as const, organizationId, corporationId: 1 },
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

const authorPairs: Array<[string, string]> = [
  ['forms', 'read'],
  ['forms', 'create'],
  ['forms', 'update'],
  ['forms', 'publish'],
  ['form-records', 'create'],
  ['form-records', 'read'],
  ['table-views', 'read'],
  ['table-views', 'create'],
  ['table-views', 'update'],
  ['table-views', 'delete'],
]

function publishSchema(state: MockState, token: string, formId: string, schema: FormSchema, title: string) {
  const form = state.forms.find((item) => item.id === formId)
  const draft = state.formDrafts.find((item) => item.formId === formId)
  if (!form || !draft) throw new Error('missing form')
  const saved = saveDraft(state, token, formId, {
    organizationId: 101,
    title,
    description: 'Описание',
    schema,
    expectedFormRevision: form.revision,
    expectedDraftRevision: draft.revision,
  })
  expect(saved.status).toBe(200)
  const nextForm = saved.state.forms.find((item) => item.id === formId)
  const nextDraft = saved.state.formDrafts.find((item) => item.formId === formId)
  const published = publishForm(saved.state, token, formId, {
    organizationId: 101,
    expectedFormRevision: nextForm?.revision,
    expectedDraftRevision: nextDraft?.revision,
  })
  expect(published.status).toBe(201)
  return published
}

describe('table view service', () => {
  it('keeps field identity, hides drafts and refuses an incompatible saved comparison', () => {
    const author = session('employee.a@example.test', withGrants(createSeed(), 3, 101, authorPairs))
    const created = createForm(author.state, author.token, { organizationId: 101, title: 'Приём образца', description: 'Описание' })
    const formId = (created.body as { id: string }).id
    const first = publishSchema(created.state, author.token, formId, {
      schemaVersion: 1,
      fields: [
        field('field-sample-name', 'text', 'Название образца', { required: true }),
        field('field-sample-mass', 'number', 'Масса', { min: 0 }),
        field('field-sample-kind', 'single_choice', 'Вид', { options: [{ id: 'option-core', label: 'Керн' }] }),
      ],
    }, 'Приём образца')
    const version1 = (first.body as { versionId: string }).versionId
    const row = createRecord(first.state, author.token, formId, {
      organizationId: 101,
      formVersionId: version1,
      values: { 'field-sample-name': 'Керн А', 'field-sample-mass': 0, 'field-sample-kind': 'option-core' },
    })
    expect(row.status).toBe(201)
    const drafted = saveDraft(row.state, author.token, formId, {
      organizationId: 101,
      title: 'Приём образца',
      description: 'Описание',
      schema: {
        schemaVersion: 1,
        fields: [
          field('field-sample-name', 'text', 'Наименование образца', { required: true }),
          field('field-sample-mass', 'text', 'Масса'),
          field('field-sample-kind', 'single_choice', 'Вид', { options: [{ id: 'option-core', label: 'Керн свежий' }] }),
          field('field-draft-only', 'text', 'Черновик'),
        ],
      },
      expectedFormRevision: row.state.forms.find((item) => item.id === formId)?.revision,
      expectedDraftRevision: row.state.formDrafts.find((item) => item.formId === formId)?.revision,
    })
    const catalogBefore = columnCatalog(drafted.state, author.token, 101, formId)
    const beforeIds = (catalogBefore.body as { columns: { id: string; label: string }[] }).columns.map((column) => column.id)
    expect(beforeIds).toContain('field-sample-name')
    expect(beforeIds).not.toContain('field-draft-only')
    expect((catalogBefore.body as { columns: { id: string; label: string }[] }).columns.find((column) => column.id === 'field-sample-name')?.label).toBe('Название образца')
    const second = publishSchema(drafted.state, author.token, formId, {
      schemaVersion: 1,
      fields: [
        field('field-sample-name', 'text', 'Наименование образца', { required: true }),
        field('field-sample-mass', 'text', 'Масса'),
        field('field-sample-kind', 'single_choice', 'Вид', { options: [{ id: 'option-core', label: 'Керн свежий' }] }),
        field('field-draft-only', 'text', 'Черновик'),
      ],
    }, 'Приём образца')
    const version2 = (second.body as { versionId: string }).versionId
    const later = createRecord(second.state, author.token, formId, {
      organizationId: 101,
      formVersionId: version2,
      values: { 'field-sample-name': 'Почва', 'field-sample-mass': '10', 'field-sample-kind': 'option-core', 'field-draft-only': 'не в таблице' },
    })
    const catalog = columnCatalog(later.state, author.token, 101, formId)
    const columns = (catalog.body as { columns: { id: string; label: string; mixed: boolean }[] }).columns
    expect(columns.filter((column) => column.id === 'field-sample-name')).toHaveLength(1)
    expect(columns.find((column) => column.id === 'field-sample-name')?.label).toBe('Наименование образца')
    expect(columns.find((column) => column.id === 'field-sample-mass')?.mixed).toBe(true)
    const saved = createTableView(later.state, author.token, formId, {
      organizationId: 101,
      schemaVersion: 1,
      title: 'Реестр образцов',
      description: '',
      columns: ['field-sample-name', SYSTEM_COLUMN_IDS.recordId],
      filters: [],
      sort: { columnId: 'field-sample-mass', direction: 'asc' },
      pageSize: 10,
    })
    expect(codeOf(saved)).toBe('invalid_view')
    expect(saved.state.tableViews).toHaveLength(0)
    const view = createTableView(later.state, author.token, formId, {
      organizationId: 101,
      schemaVersion: 1,
      title: 'Реестр образцов',
      description: '',
      columns: ['field-sample-name'],
      filters: [{ columnId: 'field-sample-mass', op: 'present', value: null }],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 10,
    })
    expect(view.status).toBe(201)
    const viewId = (view.body as { id: string }).id
    const queried = queryTableRows(view.state, author.token, formId, viewId, { organizationId: 101, offset: 0 })
    expect(queried.status).toBe(200)
    const payload = queried.body as { total: number; rows: { recordId: string; formVersionId: string; cells: Record<string, { optionLabel: string | null; value: unknown }> }[] }
    expect(payload.total).toBe(2)
    expect(payload.rows.map((item) => item.formVersionId).sort()).toEqual([version1, version2].sort())
    const old = payload.rows.find((item) => item.formVersionId === version1)
    expect(old?.cells['field-sample-kind']).toBeUndefined()
    const renamed = updateTableView(view.state, author.token, formId, viewId, {
      organizationId: 101,
      expectedRevision: 1,
      schemaVersion: 1,
      title: 'Реестр переименован',
      description: '',
      columns: ['field-sample-name', 'field-sample-kind'],
      filters: [],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 10,
    })
    expect((renamed.body as { id: string }).id).toBe(viewId)
    const conflict = updateTableView(renamed.state, author.token, formId, viewId, {
      organizationId: 101,
      expectedRevision: 1,
      schemaVersion: 1,
      title: 'Чужая правка',
      description: '',
      columns: ['field-sample-name'],
      filters: [],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 10,
    })
    expect(codeOf(conflict)).toBe('stale_write')
    expect(conflict.state.tableViews[0]?.title).toBe('Реестр переименован')
    const shown = queryTableRows(renamed.state, author.token, formId, viewId, { organizationId: 101, offset: 0, limit: 10 })
    const shownRows = (shown.body as { rows: { formVersionId: string; cells: Record<string, { optionLabel: string | null }> }[] }).rows
    expect(shownRows.find((item) => item.formVersionId === version1)?.cells['field-sample-kind']?.optionLabel).toBe('Керн')
    expect(shownRows.find((item) => item.formVersionId === version2)?.cells['field-sample-kind']?.optionLabel).toBe('Керн свежий')
    const typed = queryTableRows(renamed.state, author.token, formId, viewId, {
      organizationId: 101,
      offset: 0,
      filters: [{ columnId: 'field-sample-mass', op: 'gt', value: 0 }],
    })
    expect(codeOf(typed)).toBe('invalid_query')
    expect(JSON.stringify(typed.body)).not.toContain('Керн А')
    const removed = deleteTableView(renamed.state, author.token, 101, formId, viewId)
    expect(removed.state.tableViews).toHaveLength(0)
    expect(removed.state.formRecords).toBe(renamed.state.formRecords)
    const preview = previewTableRows(removed.state, author.token, formId, {
      organizationId: 101,
      schemaVersion: 1,
      columns: ['field-sample-name'],
      filters: [],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 10,
      offset: 0,
      limit: 10,
    })
    expect(preview.status).toBe(200)
    expect(preview.state.tableViews).toHaveLength(0)
    expect(preview.state.formRecords).toBe(removed.state.formRecords)
  })

  it('separates view rights from record rights and organizations', () => {
    const author = session('employee.a@example.test', withGrants(createSeed(), 3, 101, authorPairs))
    const created = createForm(author.state, author.token, { organizationId: 101, title: 'Секретная форма', description: '' })
    const formId = (created.body as { id: string }).id
    const published = publishSchema(created.state, author.token, formId, {
      schemaVersion: 1,
      fields: [field('field-secret', 'text', 'Секрет', { required: true })],
    }, 'Секретная форма')
    const versionId = (published.body as { versionId: string }).versionId
    const row = createRecord(published.state, author.token, formId, {
      organizationId: 101,
      formVersionId: versionId,
      values: { 'field-secret': 'значение-а' },
    })
    const view = createTableView(row.state, author.token, formId, {
      organizationId: 101,
      schemaVersion: 1,
      title: 'Секретный реестр',
      description: '',
      columns: ['field-secret'],
      filters: [],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 10,
    })
    const viewId = (view.body as { id: string }).id
    const reader = session('customer@example.test', withGrants(view.state, 5, 101, [
      ['forms', 'read'],
      ['table-views', 'read'],
    ]))
    const deniedRows = queryTableRows(reader.state, reader.token, formId, viewId, { organizationId: 101, offset: 0 })
    expect(deniedRows.status).toBe(403)
    expect(deniedRows.state).toBe(reader.state)
    expect(JSON.stringify(deniedRows.body)).not.toContain('значение-а')
    expect(listTableViews(reader.state, reader.token, 101, formId).status).toBe(200)
    const recordsOnly = session('employee.b@example.test', withGrants(view.state, 4, 102, [
      ['forms', 'read'],
      ['form-records', 'read'],
      ['table-views', 'read'],
    ]))
    const foreign = queryTableRows(recordsOnly.state, recordsOnly.token, formId, viewId, { organizationId: 101, offset: 0 })
    expect(foreign.status).toBe(403)
    expect(JSON.stringify(foreign.body)).not.toContain('Секретный реестр')
    expect(JSON.stringify(foreign.body)).not.toContain('значение-а')
    const missing = listTableViews(recordsOnly.state, recordsOnly.token, 102, formId)
    expect(missing.status).toBe(404)
    expect(JSON.stringify(missing.body)).not.toContain('Секретная форма')
    const owner = session('owner@example.test', view.state)
    const listed = listTableViews(owner.state, owner.token, 101, formId)
    expect(listed.status).toBe(200)
    expect(listed.state.sessions).toEqual(owner.state.sessions)
    expect(can(toSnapshot(owner.state), 1, 'table-views', 'read', laboratory)).toBe(true)
  })

  it('migrates an empty view collection without granting the codes or dropping records', () => {
    const seed = createSeed()
    const snapshot = {
      ...seed,
      schemaVersion: 6,
      formRecords: [{
        id: 'rec-kept-01',
        organizationId: 101,
        formId: 'form-kept-01',
        formVersionId: 'ver-kept-01',
        values: { 'field-kept': 'сохранено' },
        createdBy: 3,
        createdAt: '2026-10-01T00:00:00.000Z',
      }],
      roles: seed.roles.map((role) => ({
        ...role,
        grantIds: role.grantIds.filter((id) => !id.startsWith('g-table-views')),
        delegationGrantIds: (role.delegationGrantIds ?? []).filter((id) => !id.startsWith('g-table-views')),
      })),
      grants: seed.grants.filter((grant) => !grant.id.startsWith('g-table-views')),
    } as MockState
    delete (snapshot as { tableViews?: unknown }).tableViews
    const migrated = migrateMockDocument(snapshot)
    expect(migrated?.state.schemaVersion).toBe(9)
    expect(migrated?.state.tableViews).toEqual([])
    expect(migrated?.state.sections).toEqual([])
    expect(migrated?.state.formRecords).toEqual(snapshot.formRecords)
    expect(migrated?.state.forms).toEqual(seed.forms)
    expect(migrated?.state.constructorNodes).toEqual(seed.constructorNodes)
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.grantIds).not.toContain('g-table-views-read')
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.grantIds).not.toContain('g-sections-read')
    expect(migrated?.state.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).not.toContain('g-table-views-read')
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-table-views-read')).toBe(true)
    expect(can(toSnapshot(migrated!.state), 1, 'table-views', 'read', laboratory)).toBe(true)
    expect(can(toSnapshot(migrated!.state), 2, 'table-views', 'read', laboratory)).toBe(false)
    expect(tableViewsMode('live')).toBe('unavailable')
    const handlers = readFileSync(resolve('src/app/mocks/table-views/handlers.ts'), 'utf8')
    expect(handlers).toContain('commit')
    expect(handlers).toContain('preview')
    const page = readFileSync(resolve('src/pages/app/forms/ui/FormViewsPage.tsx'), 'utf8')
    expect(page).not.toContain('repository')
    expect(page).not.toContain('mocks/db')
  })
})
