import { can } from '../../../entities/access/model/grants'
import { hasInputFields, parseSchema } from '../../../entities/form/model/schema'
import { publicationStatus } from '../../../entities/form/model/summary'
import { validateAnswers } from '../../../entities/form/model/values'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockForm, MockFormDraft, MockFormVersion, MockState, MockUser } from '../db/types'

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string, extra?: Record<string, unknown>): FlowResult {
  return done(state, status, extra ? { code, ...extra } : { code })
}

function allowedKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(body).every((key) => keys.includes(key))
}

function revisionOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function textOf(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

type Gate = { ok: true; user: MockUser } | { ok: false; result: FlowResult }

function enter(
  state: MockState,
  token: string | null,
  organizationId: number,
  checks: ReadonlyArray<readonly [string, string]>,
): Gate {
  const who = principal(state, token)
  if (!who.ok) return who
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) {
    return { ok: false, result: done(state, 404, { code: 'not_found' }) }
  }
  const snapshot = toSnapshot(state)
  const allowed = checks.some(([resource, action]) => can(snapshot, who.user.id, resource, action, {
    type: 'organization',
    organizationId: organization.id,
    corporationId: organization.corporationId,
  }))
  if (!allowed) return { ok: false, result: done(state, 403, { code: 'forbidden' }) }
  return { ok: true, user: who.user }
}

function formIn(state: MockState, organizationId: number, formId: string): MockForm | null {
  if (!ID_PATTERN.test(formId)) return null
  return state.forms.find((form) => form.id === formId && form.organizationId === organizationId) ?? null
}

function draftOf(state: MockState, formId: string): MockFormDraft | null {
  return state.formDrafts.find((draft) => draft.formId === formId) ?? null
}

function versionOf(state: MockState, versionId: string): MockFormVersion | null {
  return state.formVersions.find((version) => version.id === versionId) ?? null
}

function personName(state: MockState, userId: number): string {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return String(userId)
  return [user.surname, user.name, user.patronymic].filter((part) => part.trim() !== '').join(' ')
}

function publishedView(version: MockFormVersion) {
  return {
    versionId: version.id,
    versionNumber: version.number,
    title: version.title,
    description: version.description,
    schema: clone(version.schema),
    publishedAt: version.publishedAt,
  }
}

function listItem(state: MockState, form: MockForm, revealDraft: boolean) {
  const draft = draftOf(state, form.id)
  const published = form.publishedVersionId ? versionOf(state, form.publishedVersionId) : null
  const status = revealDraft && draft
    ? publicationStatus(form.title, form.description, draft.schema, published ? {
      title: published.title,
      description: published.description,
      schema: published.schema,
      versionNumber: published.number,
    } : null)
    : 'published'
  return {
    id: form.id,
    organizationId: form.organizationId,
    title: form.title,
    description: form.description,
    status,
    publishedVersionNumber: published?.number ?? null,
    publishedVersionId: form.publishedVersionId,
  }
}

function draftBody(state: MockState, form: MockForm, draft: MockFormDraft) {
  const published = form.publishedVersionId ? versionOf(state, form.publishedVersionId) : null
  const base = published ? {
    title: published.title,
    description: published.description,
    schema: published.schema,
    versionNumber: published.number,
  } : null
  return {
    form: {
      id: form.id,
      organizationId: form.organizationId,
      title: form.title,
      description: form.description,
      revision: form.revision,
      publishedVersionId: form.publishedVersionId,
      publishedVersionNumber: published?.number ?? null,
      status: publicationStatus(form.title, form.description, draft.schema, base),
    },
    draft: {
      schema: clone(draft.schema),
      baseVersionId: draft.baseVersionId,
      revision: draft.revision,
    },
    published: published ? publishedView(published) : null,
  }
}

export function listForms(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = enter(state, token, organizationId, [['forms', 'read'], ['forms', 'update']])
  if (!access.ok) return access.result
  const revealDraft = can(toSnapshot(state), access.user.id, 'forms', 'update', {
    type: 'organization',
    organizationId,
    corporationId: state.corporation.id,
  })
  const forms = state.forms
    .filter((form) => form.organizationId === organizationId)
    .filter((form) => revealDraft || form.publishedVersionId != null)
    .map((form) => listItem(state, form, revealDraft))
  return done(state, 200, { forms })
}

export function createForm(state: MockState, token: string | null, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'title', 'description'])) return problem(state, 400, 'unknown_key')
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number' || !Number.isInteger(organizationId)) return problem(state, 400, 'invalid_organization')
  const access = enter(state, token, organizationId, [['forms', 'create']])
  if (!access.ok) return access.result
  const title = textOf(body.title, 200)
  const description = textOf(body.description ?? '', 2000)
  if (title == null || title === '' || description == null) return problem(state, 400, 'invalid_name')
  const form: MockForm = {
    id: `form-${crypto.randomUUID()}`,
    organizationId,
    title,
    description,
    publishedVersionId: null,
    revision: 1,
  }
  const draft: MockFormDraft = {
    formId: form.id,
    schema: { schemaVersion: 1, fields: [] },
    baseVersionId: null,
    revision: 1,
  }
  return done({
    ...state,
    forms: [...state.forms, form],
    formDrafts: [...state.formDrafts, draft],
  }, 201, { id: form.id, revision: form.revision, draftRevision: draft.revision })
}

export function readDraft(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const access = enter(state, token, organizationId, [['forms', 'update']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  const draft = form ? draftOf(state, form.id) : null
  if (!form || !draft) return problem(state, 404, 'not_found')
  return done(state, 200, draftBody(state, form, draft))
}

export function saveDraft(state: MockState, token: string | null, formId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'title', 'description', 'schema', 'expectedFormRevision', 'expectedDraftRevision'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number') return problem(state, 400, 'invalid_organization')
  const access = enter(state, token, organizationId, [['forms', 'update']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  const draft = form ? draftOf(state, form.id) : null
  if (!form || !draft) return problem(state, 404, 'not_found')
  const expectedFormRevision = revisionOf(body.expectedFormRevision)
  const expectedDraftRevision = revisionOf(body.expectedDraftRevision)
  if (expectedFormRevision == null || expectedDraftRevision == null) return problem(state, 400, 'invalid_version')
  if (form.revision !== expectedFormRevision || draft.revision !== expectedDraftRevision) return problem(state, 409, 'stale_write')
  const title = textOf(body.title, 200)
  const description = textOf(body.description ?? '', 2000)
  if (title == null || title === '' || description == null) return problem(state, 400, 'invalid_name')
  const parsed = parseSchema(body.schema, 'draft')
  if (!parsed.ok) return problem(state, 400, parsed.issues.some((issue) => issue.code === 'unknown_schema') ? 'unknown_schema' : 'invalid_schema', { issues: parsed.issues })
  const nextForm: MockForm = { ...form, title, description, revision: form.revision + 1 }
  const nextDraft: MockFormDraft = {
    ...draft,
    schema: clone(parsed.schema),
    revision: draft.revision + 1,
  }
  const next: MockState = {
    ...state,
    forms: state.forms.map((item) => item.id === form.id ? nextForm : item),
    formDrafts: state.formDrafts.map((item) => item.formId === form.id ? nextDraft : item),
  }
  return done(next, 200, draftBody(next, nextForm, nextDraft))
}

export function publishForm(state: MockState, token: string | null, formId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedFormRevision', 'expectedDraftRevision'])) return problem(state, 400, 'unknown_key')
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number') return problem(state, 400, 'invalid_organization')
  const access = enter(state, token, organizationId, [['forms', 'publish']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  const draft = form ? draftOf(state, form.id) : null
  if (!form || !draft) return problem(state, 404, 'not_found')
  const expectedFormRevision = revisionOf(body.expectedFormRevision)
  const expectedDraftRevision = revisionOf(body.expectedDraftRevision)
  if (expectedFormRevision == null || expectedDraftRevision == null) return problem(state, 400, 'invalid_version')
  const existing = state.formVersions.find((version) => version.formId === form.id && version.sourceDraftRevision === expectedDraftRevision)
  if (existing) {
    return done(state, 200, {
      versionId: existing.id,
      versionNumber: existing.number,
      formRevision: form.revision,
      publishedAt: existing.publishedAt,
    })
  }
  if (form.revision !== expectedFormRevision || draft.revision !== expectedDraftRevision) return problem(state, 409, 'stale_write')
  const parsed = parseSchema(draft.schema, 'publish')
  if (!parsed.ok) {
    const codes = parsed.issues.map((issue) => issue.code)
    const code = codes.includes('unknown_schema') ? 'unknown_schema' : codes.includes('empty_schema') ? 'empty_schema' : 'invalid_schema'
    return problem(state, 400, code, { issues: parsed.issues })
  }
  const number = state.formVersions.filter((version) => version.formId === form.id).reduce((max, version) => Math.max(max, version.number), 0) + 1
  const version: MockFormVersion = {
    id: `ver-${crypto.randomUUID()}`,
    formId: form.id,
    organizationId: form.organizationId,
    number,
    title: form.title,
    description: form.description,
    schema: clone(parsed.schema),
    publishedAt: new Date().toISOString(),
    publishedBy: access.user.id,
    sourceDraftRevision: draft.revision,
  }
  const nextForm: MockForm = { ...form, publishedVersionId: version.id, revision: form.revision + 1 }
  const next: MockState = {
    ...state,
    forms: state.forms.map((item) => item.id === form.id ? nextForm : item),
    formVersions: [...state.formVersions, version],
    formDrafts: state.formDrafts,
  }
  return done(next, 201, {
    versionId: version.id,
    versionNumber: version.number,
    formRevision: nextForm.revision,
    publishedAt: version.publishedAt,
  })
}

export function readPublished(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const access = enter(state, token, organizationId, [['forms', 'read']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  if (!form || form.publishedVersionId == null) return problem(state, 404, 'not_found')
  const version = versionOf(state, form.publishedVersionId)
  if (!version || version.formId !== form.id) return problem(state, 404, 'not_found')
  const body = {
    formId: form.id,
    organizationId: form.organizationId,
    title: version.title,
    description: version.description,
    versionId: version.id,
    versionNumber: version.number,
    schema: clone(version.schema),
    publishedAt: version.publishedAt,
  }
  return done(state, 200, body)
}

function formReferencedBySection(state: MockState, formId: string): boolean {
  const viewIds = new Set(state.tableViews.filter((view) => view.formId === formId).map((view) => view.id))
  const linked = (candidateFormId: string, tableViewId: string) =>
    candidateFormId === formId || viewIds.has(tableViewId)
  return state.sectionDrafts.some((draft) => linked(draft.formId, draft.tableViewId))
    || state.sectionVersions.some((version) => linked(version.formId, version.tableViewId))
}

/** Removes the form, its draft, versions, records and table views. A section that still points at them blocks the delete. */
export function deleteForm(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const access = enter(state, token, organizationId, [['forms', 'delete']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  if (formReferencedBySection(state, form.id)) return problem(state, 409, 'form_in_use')
  return done({
    ...state,
    forms: state.forms.filter((item) => item.id !== form.id),
    formDrafts: state.formDrafts.filter((item) => item.formId !== form.id),
    formVersions: state.formVersions.filter((item) => item.formId !== form.id),
    formRecords: state.formRecords.filter((item) => item.formId !== form.id),
    tableViews: state.tableViews.filter((item) => item.formId !== form.id),
  }, 200, { id: form.id })
}

export function listRecords(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const access = enter(state, token, organizationId, [['form-records', 'read']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  const records = state.formRecords
    .filter((record) => record.formId === form.id && record.organizationId === organizationId)
    .map((record) => {
      const version = versionOf(state, record.formVersionId)
      return {
        id: record.id,
        createdAt: record.createdAt,
        authorName: personName(state, record.createdBy),
        versionNumber: version?.number ?? 0,
        formVersionId: record.formVersionId,
      }
    })
  return done(state, 200, { records })
}

export function createRecord(state: MockState, token: string | null, formId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'formVersionId', 'values'])) return problem(state, 400, 'unknown_key')
  const organizationId = body.organizationId
  if (typeof organizationId !== 'number') return problem(state, 400, 'invalid_organization')
  const access = enter(state, token, organizationId, [['form-records', 'create']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  if (!form || form.publishedVersionId == null) return problem(state, 404, 'not_found')
  if (typeof body.formVersionId !== 'string' || !ID_PATTERN.test(body.formVersionId)) return problem(state, 400, 'invalid_version')
  const version = versionOf(state, body.formVersionId)
  if (!version || version.formId !== form.id || version.organizationId !== organizationId) return problem(state, 404, 'not_found')
  if (!hasInputFields(version.schema)) return problem(state, 400, 'empty_schema')
  if (version.id !== form.publishedVersionId) return problem(state, 409, 'version_conflict')
  if (version.schema.schemaVersion !== 1) return problem(state, 400, 'unknown_schema')
  const reviewed = validateAnswers(version.schema, body.values)
  if (!reviewed.ok) {
    return problem(state, 400, reviewed.code, reviewed.code === 'invalid_payload' ? { fields: reviewed.fields } : undefined)
  }
  const record = {
    id: `rec-${crypto.randomUUID()}`,
    organizationId,
    formId: form.id,
    formVersionId: version.id,
    values: clone(reviewed.values),
    createdBy: access.user.id,
    createdAt: new Date().toISOString(),
  }
  return done({ ...state, formRecords: [...state.formRecords, record] }, 201, {
    id: record.id,
    formVersionId: record.formVersionId,
    createdAt: record.createdAt,
  })
}

export function readRecord(state: MockState, token: string | null, organizationId: number, formId: string, recordId: string): FlowResult {
  const access = enter(state, token, organizationId, [['form-records', 'read']])
  if (!access.ok) return access.result
  if (!ID_PATTERN.test(formId) || !ID_PATTERN.test(recordId)) return problem(state, 404, 'not_found')
  const record = state.formRecords.find((item) => item.id === recordId && item.organizationId === organizationId && item.formId === formId)
  if (!record) return problem(state, 404, 'not_found')
  const version = versionOf(state, record.formVersionId)
  if (!version || version.formId !== record.formId) return problem(state, 404, 'not_found')
  return done(state, 200, {
    id: record.id,
    organizationId: record.organizationId,
    formId: record.formId,
    formVersionId: version.id,
    versionNumber: version.number,
    title: version.title,
    description: version.description,
    schema: clone(version.schema),
    values: clone(record.values),
    authorName: personName(state, record.createdBy),
    createdAt: record.createdAt,
  })
}
