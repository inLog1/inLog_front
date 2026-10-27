import { describe, expect, it } from 'vitest'
import { can, hasCorporateSuperadmin } from '../../../entities/access/model/grants'
import type { FormSchema } from '../../../entities/form/model/types'
import { sectionsMode } from '../../../entities/section/model/availability'
import { SYSTEM_COLUMN_IDS } from '../../../entities/table-view/model/types'
import { toSnapshot, loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createSeed } from '../db/seed'
import type { MockState, MockTableView } from '../db/types'
import { createForm, publishForm, saveDraft } from '../forms/service'
import { createTableView, deleteTableView, updateTableView } from '../table-views/service'
import {
  createSection,
  listSections,
  publishSection,
  readPreview,
  readPublished,
  saveDraft as saveSectionDraft,
  sectionNavigation,
  sectionOptions,
  unpublishSection,
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
  const roleId = `role-sections-${userId}-${organizationId}`
  return {
    ...state,
    roles: [...state.roles, {
      id: roleId,
      displayName: 'Проверка разделов',
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

function publishSample(state: MockState, token: string) {
  const created = createForm(state, token, { organizationId: 101, title: 'Приём образца', description: 'Форма' })
  const formId = (created.body as { id: string }).id
  const schema: FormSchema = {
    schemaVersion: 1,
    fields: [{
      id: 'field-sample-name', type: 'text', label: 'Название образца', help: '', required: true,
      minLength: null, maxLength: null, min: null, max: null, options: [],
    }],
  }
  const form = created.state.forms.find((item) => item.id === formId)!
  const draft = created.state.formDrafts.find((item) => item.formId === formId)!
  const saved = saveDraft(created.state, token, formId, {
    organizationId: 101,
    title: 'Приём образца',
    description: 'Форма',
    schema,
    expectedFormRevision: form.revision,
    expectedDraftRevision: draft.revision,
  })
  const nextForm = saved.state.forms.find((item) => item.id === formId)!
  const nextDraft = saved.state.formDrafts.find((item) => item.formId === formId)!
  const published = publishForm(saved.state, token, formId, {
    organizationId: 101,
    expectedFormRevision: nextForm.revision,
    expectedDraftRevision: nextDraft.revision,
  })
  const view = createTableView(published.state, token, formId, {
    organizationId: 101,
    schemaVersion: 1,
    title: 'Реестр образцов',
    description: 'Таблица',
    columns: [SYSTEM_COLUMN_IDS.createdAt],
    filters: [],
    sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
    pageSize: 25,
  })
  return {
    state: view.state,
    formId,
    viewId: (view.body as { id: string }).id,
  }
}

const authorPairs: Array<[string, string]> = [
  ['forms', 'read'], ['forms', 'create'], ['forms', 'update'], ['forms', 'publish'],
  ['form-records', 'read'], ['form-records', 'create'],
  ['table-views', 'read'], ['table-views', 'create'], ['table-views', 'update'], ['table-views', 'delete'],
  ['sections', 'read'], ['sections', 'create'], ['sections', 'update'], ['sections', 'publish'],
]

function config(formId: string, viewId: string, title = 'Образцы') {
  return {
    organizationId: 101,
    schemaVersion: 1,
    title,
    description: 'Раздел приёма',
    iconKey: 'samples',
    formId,
    tableViewId: viewId,
    showCreate: true,
    createLabel: 'Добавить запись',
    order: 20,
  }
}

describe('section service', () => {
  it('publishes a link, keeps the draft independent, and refuses a broken or foreign resource', () => {
    const author = session('employee.a@example.test', withGrants(createSeed(), 3, 101, authorPairs))
    const sample = publishSample(author.state, author.token)
    const created = createSection(sample.state, author.token, { organizationId: 101, title: 'Образцы', description: 'Раздел приёма' })
    expect(created.status).toBe(201)
    const sectionId = (created.body as { id: string }).id
    expect(sectionNavigation(created.state, author.token, 101).body).toEqual({ sections: [] })
    expect(codeOf(readPublished(created.state, author.token, 101, sectionId))).toBe('not_published')
    const current = created.state.sections.find((item) => item.id === sectionId)!
    const draft = created.state.sectionDrafts.find((item) => item.sectionId === sectionId)!
    const saved = saveSectionDraft(created.state, author.token, sectionId, {
      ...config(sample.formId, sample.viewId),
      expectedRevision: current.revision,
      expectedDraftRevision: draft.revision,
    })
    expect(saved.status).toBe(200)
    expect(sectionNavigation(saved.state, author.token, 101).body).toEqual({ sections: [] })
    const preview = readPreview(saved.state, author.token, 101, sectionId)
    expect(preview.status).toBe(200)
    expect(preview.state.formRecords).toEqual(saved.state.formRecords)
    expect((preview.body as { showCreate: boolean }).showCreate).toBe(true)
    const ready = saved.state.sections.find((item) => item.id === sectionId)!
    const readyDraft = saved.state.sectionDrafts.find((item) => item.sectionId === sectionId)!
    const first = publishSection(saved.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: ready.revision,
      expectedDraftRevision: readyDraft.revision,
    })
    expect(first.status).toBe(201)
    const again = publishSection(first.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: ready.revision,
      expectedDraftRevision: readyDraft.revision,
    })
    expect(again.status).toBe(200)
    expect(again.state).toBe(first.state)
    expect(again.state.sectionVersions.filter((item) => item.sectionId === sectionId)).toHaveLength(1)
    const nav = sectionNavigation(first.state, author.token, 101)
    const navBody = JSON.stringify(nav.body)
    expect(navBody).toContain('Образцы')
    expect(navBody).not.toContain('Приём образца')
    expect(navBody).not.toContain('Реестр образцов')
    expect(navBody).not.toContain(sample.formId)
    const published = readPublished(first.state, author.token, 101, sectionId)
    expect((published.body as { title: string; formId: string }).formId).toBe(sample.formId)
    const edited = saveSectionDraft(first.state, author.token, sectionId, {
      ...config(sample.formId, sample.viewId, 'Образцы новые'),
      expectedRevision: first.state.sections.find((item) => item.id === sectionId)?.revision,
      expectedDraftRevision: first.state.sectionDrafts.find((item) => item.sectionId === sectionId)?.revision,
    })
    expect((readPublished(edited.state, author.token, 101, sectionId).body as { title: string }).title).toBe('Образцы')
    expect((sectionNavigation(edited.state, author.token, 101).body as { sections: { title: string }[] }).sections[0].title).toBe('Образцы')
    const stale = publishSection(edited.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: ready.revision,
      expectedDraftRevision: edited.state.sectionDrafts.find((item) => item.sectionId === sectionId)?.revision,
    })
    expect(codeOf(stale)).toBe('stale_write')
    expect(stale.state.sectionVersions.filter((item) => item.sectionId === sectionId)).toHaveLength(1)
    const second = publishSection(edited.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: edited.state.sections.find((item) => item.id === sectionId)?.revision,
      expectedDraftRevision: edited.state.sectionDrafts.find((item) => item.sectionId === sectionId)?.revision,
    })
    expect(second.status).toBe(201)
    expect((readPublished(second.state, author.token, 101, sectionId).body as { title: string }).title).toBe('Образцы новые')
    const blocked = deleteTableView(second.state, author.token, 101, sample.formId, sample.viewId)
    expect(codeOf(blocked)).toBe('view_in_use')
    expect(blocked.state.tableViews.some((view) => view.id === sample.viewId)).toBe(true)
    const moved = updateTableView(second.state, author.token, 'form-otherid', sample.viewId, {
      organizationId: 101,
      expectedRevision: 1,
      schemaVersion: 1,
      title: 'Чужая форма',
      description: '',
      columns: [SYSTEM_COLUMN_IDS.createdAt],
      filters: [],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 25,
    })
    expect(moved.status).toBe(404)
    expect(moved.state.tableViews.find((view) => view.id === sample.viewId)?.formId).toBe(sample.formId)
    const withdrawn = unpublishSection(second.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: second.state.sections.find((item) => item.id === sectionId)?.revision,
    })
    expect(withdrawn.status).toBe(200)
    expect(sectionNavigation(withdrawn.state, author.token, 101).body).toEqual({ sections: [] })
    expect(codeOf(readPublished(withdrawn.state, author.token, 101, sectionId))).toBe('not_published')
    expect(withdrawn.state.forms.some((form) => form.id === sample.formId)).toBe(true)
    expect(withdrawn.state.tableViews.some((view) => view.id === sample.viewId)).toBe(true)
    const repeat = unpublishSection(withdrawn.state, author.token, sectionId, { organizationId: 101, expectedRevision: 1 })
    expect(repeat.status).toBe(200)
    expect(repeat.state).toBe(withdrawn.state)
    const restored = publishSection(withdrawn.state, author.token, sectionId, {
      organizationId: 101,
      expectedRevision: withdrawn.state.sections.find((item) => item.id === sectionId)?.revision,
      expectedDraftRevision: withdrawn.state.sectionDrafts.find((item) => item.sectionId === sectionId)?.revision,
    })
    expect(restored.status).toBe(200)
    expect((readPublished(restored.state, author.token, 101, sectionId).body as { title: string }).title).toBe('Образцы новые')
    const foreign = session('employee.b@example.test', withGrants(restored.state, 4, 102, [['sections', 'read'], ['forms', 'read'], ['table-views', 'read'], ['form-records', 'read']]))
    expect(foreign.state.sections.some((item) => item.id === sectionId && item.organizationId === 102)).toBe(false)
    expect(sectionNavigation(foreign.state, foreign.token, 102).body).toEqual({ sections: [] })
    expect(JSON.stringify(sectionNavigation(foreign.state, foreign.token, 102).body)).not.toContain('Образцы')
    expect(codeOf(readPublished(foreign.state, foreign.token, 101, sectionId))).toBe('forbidden')
    expect(JSON.stringify(readPublished(foreign.state, foreign.token, 101, sectionId).body)).not.toContain('Образцы')
    const partial = session('project.only@example.test', withGrants(restored.state, 7, 101, [['sections', 'read'], ['forms', 'read'], ['table-views', 'read']]))
    expect(sectionNavigation(partial.state, partial.token, 101).body).toEqual({ sections: [] })
    expect(JSON.stringify(sectionNavigation(partial.state, partial.token, 101).body)).not.toContain('Приём образца')
    expect(JSON.stringify(sectionNavigation(partial.state, partial.token, 101).body)).not.toContain('Реестр образцов')
    expect(codeOf(readPublished(partial.state, partial.token, 101, sectionId))).toBe('forbidden')
    const removed = deleteTableView(withdrawn.state, author.token, 101, sample.formId, sample.viewId)
    expect(removed.status).toBe(200)
    const options = sectionOptions(second.state, author.token, 101)
    expect((options.body as { forms: { title: string }[] }).forms.some((form) => form.title === 'Приём образца')).toBe(true)
    const draftOnly = createSection(second.state, author.token, { organizationId: 101, title: 'Черновик', description: '' })
    const draftId = (draftOnly.body as { id: string }).id
    const linked = saveSectionDraft(draftOnly.state, author.token, draftId, {
      ...config(sample.formId, sample.viewId, 'Черновик'),
      expectedRevision: 1,
      expectedDraftRevision: 1,
    })
    expect(deleteTableView(linked.state, author.token, 101, sample.formId, sample.viewId).status).toBe(409)
    expect(hasCorporateSuperadmin(toSnapshot(createSeed()), 1)).toBe(true)
    expect(can(toSnapshot(createSeed()), 1, 'sections', 'read', laboratory)).toBe(false)
    expect(can(toSnapshot(createSeed()), 3, 'sections', 'publish', laboratory)).toBe(false)
    expect(sectionsMode('live')).toBe('unavailable')
    expect(sectionsMode('mock')).toBe('mock')
    const owner = session('owner@example.test')
    expect(listSections(owner.state, owner.token, 101).status).toBe(403)
    expect(codeOf(sectionNavigation(owner.state, owner.token, 101))).toBe('forbidden')
    expect(codeOf(readPublished(owner.state, owner.token, 101, sectionId))).toBe('forbidden')
  })

  it('migrates section collections and a bare created-at day without granting roles or dropping records', () => {
    const seed = createSeed()
    const keptView: MockTableView = {
      id: 'view-kept01',
      organizationId: 101,
      formId: 'form-kept01',
      title: 'Сохранённое',
      description: '',
      columns: [SYSTEM_COLUMN_IDS.createdAt],
      filters: [
        { columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'eq', value: '2026-10-01' },
        { columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'gte', value: '2026-10-01T00:00:00.000Z' },
        { columnId: 'field-date', op: 'eq', value: '2026-10-01' },
      ],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 25,
      schemaVersion: 1,
      revision: 3,
      createdBy: 3,
      updatedBy: 3,
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    const snapshot = {
      ...seed,
      schemaVersion: 7,
      grants: seed.grants.filter((grant) => !grant.id.startsWith('g-sections')),
      roles: seed.roles.map((role) => ({
        ...role,
        grantIds: role.grantIds.filter((id) => !id.startsWith('g-sections')),
        delegationGrantIds: (role.delegationGrantIds ?? []).filter((id) => !id.startsWith('g-sections')),
      })),
      tableViews: [keptView],
      sections: undefined,
      sectionDrafts: undefined,
      sectionVersions: undefined,
    }
    const migrated = migrateMockDocument(snapshot as unknown as MockState)
    expect(migrated?.state.schemaVersion).toBe(8)
    expect(migrated?.state.sections).toEqual([])
    expect(migrated?.state.sectionDrafts).toEqual([])
    expect(migrated?.state.sectionVersions).toEqual([])
    expect(migrated?.state.users).toEqual(seed.users)
    expect(migrated?.state.forms).toEqual(seed.forms)
    expect(migrated?.state.formRecords).toEqual(seed.formRecords)
    expect(migrated?.state.tasks).toEqual(seed.tasks)
    expect(migrated?.state.tableViews[0]?.filters).toEqual([
      { columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'eq', value: 'utc-day:2026-10-01' },
      { columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'gte', value: '2026-10-01T00:00:00.000Z' },
      { columnId: 'field-date', op: 'eq', value: '2026-10-01' },
    ])
    expect(migrated?.state.tableViews[0]?.revision).toBe(3)
    const owner = migrated?.state.roles.find((role) => role.id === 'role-owner')
    expect(owner?.grantIds).not.toContain('g-sections-read')
    expect(owner?.delegationGrantIds).not.toContain('g-sections-read')
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-sections-read')).toBe(true)
    expect(can(toSnapshot(migrated!.state), 1, 'sections', 'publish', laboratory)).toBe(false)
  })
})
