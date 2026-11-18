import { can } from '../../../entities/access/model/grants'
import { buildColumnCatalog } from '../../../entities/table-view/model/columns'
import { parseQueryConfig, parseViewDocument, parseWindow, runTableQuery } from '../../../entities/table-view/model/query'
import type { QueryConfig, SourceRecord, SourceVersion, ViewIssue } from '../../../entities/table-view/model/types'
import { TABLE_VIEW_SCHEMA_VERSION } from '../../../entities/table-view/model/types'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockForm, MockState, MockTableView, MockUser } from '../db/types'

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

type Gate = { ok: true; user: MockUser } | { ok: false; result: FlowResult }

function authorize(
  state: MockState,
  token: string | null,
  organizationId: number,
  mode: 'all' | 'any',
  checks: ReadonlyArray<readonly [string, string]>,
): Gate {
  const who = principal(state, token)
  if (!who.ok) return who
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) {
    return { ok: false, result: done(state, 404, { code: 'not_found' }) }
  }
  const snapshot = toSnapshot(state)
  const target = {
    type: 'organization' as const,
    organizationId: organization.id,
    corporationId: organization.corporationId,
  }
  const allowed = checks.map(([resource, action]) => can(snapshot, who.user.id, resource, action, target))
  const pass = mode === 'all' ? allowed.every(Boolean) : allowed.some(Boolean)
  if (!pass) return { ok: false, result: done(state, 403, { code: 'forbidden' }) }
  return { ok: true, user: who.user }
}

function formIn(state: MockState, organizationId: number, formId: string): MockForm | null {
  if (!ID_PATTERN.test(formId)) return null
  return state.forms.find((form) => form.id === formId && form.organizationId === organizationId) ?? null
}

function viewIn(state: MockState, organizationId: number, formId: string, viewId: string): MockTableView | null {
  if (!ID_PATTERN.test(viewId)) return null
  return state.tableViews.find((view) => view.id === viewId && view.formId === formId && view.organizationId === organizationId) ?? null
}

function personName(state: MockState, userId: number): string {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return ''
  return [user.surname, user.name, user.patronymic].filter((part) => part.trim() !== '').join(' ')
}

function publishedSources(state: MockState, form: MockForm): SourceVersion[] {
  return state.formVersions
    .filter((version) => version.formId === form.id && version.organizationId === form.organizationId)
    .map((version) => ({
      id: version.id,
      formId: version.formId,
      number: version.number,
      current: version.id === form.publishedVersionId,
      schema: version.schema,
    }))
}

function sourceRecords(state: MockState, form: MockForm): SourceRecord[] {
  return state.formRecords
    .filter((record) => record.formId === form.id && record.organizationId === form.organizationId)
    .map((record) => ({
      id: record.id,
      formId: record.formId,
      organizationId: record.organizationId,
      formVersionId: record.formVersionId,
      values: record.values,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
    }))
}

function authors(state: MockState): Map<number, string> {
  return new Map(state.users.map((user) => [user.id, personName(state, user.id)]))
}

function detail(state: MockState, view: MockTableView) {
  return {
    id: view.id,
    organizationId: view.organizationId,
    formId: view.formId,
    title: view.title,
    description: view.description,
    schemaVersion: view.schemaVersion,
    columns: view.columns,
    filters: view.filters,
    sort: view.sort,
    pageSize: view.pageSize,
    revision: view.revision,
    updatedAt: view.updatedAt,
    authorName: personName(state, view.updatedBy),
  }
}

function issuesOf(result: { issues: ViewIssue[] }): { issues: ViewIssue[] } {
  return { issues: result.issues }
}

export function listTableViews(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['forms', 'read'], ['table-views', 'read']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  const views = state.tableViews
    .filter((view) => view.formId === form.id && view.organizationId === organizationId)
    .map((view) => ({
      id: view.id,
      formId: view.formId,
      title: view.title,
      description: view.description,
      updatedAt: view.updatedAt,
      revision: view.revision,
    }))
  return done(state, 200, { views })
}

export function readTableView(state: MockState, token: string | null, organizationId: number, formId: string, viewId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['forms', 'read'], ['table-views', 'read']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  const view = form ? viewIn(state, organizationId, form.id, viewId) : null
  if (!form || !view) return problem(state, 404, 'not_found')
  if (view.schemaVersion !== TABLE_VIEW_SCHEMA_VERSION) return problem(state, 400, 'unknown_schema')
  return done(state, 200, detail(state, view))
}

export function columnCatalog(state: MockState, token: string | null, organizationId: number, formId: string): FlowResult {
  const forms = authorize(state, token, organizationId, 'all', [['forms', 'read']])
  if (!forms.ok) return forms.result
  const tables = authorize(state, token, organizationId, 'any', [
    ['table-views', 'read'],
    ['table-views', 'create'],
    ['table-views', 'update'],
  ])
  if (!tables.ok) return tables.result
  const form = formIn(state, organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  const built = buildColumnCatalog(form.id, publishedSources(state, form))
  if (!built.ok) return problem(state, 400, 'unknown_schema')
  return done(state, 200, { columns: built.columns })
}

export function createTableView(state: MockState, token: string | null, formId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'schemaVersion', 'title', 'description', 'columns', 'filters', 'sort', 'pageSize'])) {
    return problem(state, 400, 'unknown_key')
  }
  if (typeof body.organizationId !== 'number' || !Number.isInteger(body.organizationId)) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, body.organizationId, 'all', [['forms', 'read'], ['table-views', 'create']])
  if (!access.ok) return access.result
  const form = formIn(state, body.organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  const built = buildColumnCatalog(form.id, publishedSources(state, form))
  if (!built.ok) return problem(state, 400, 'unknown_schema')
  const parsed = parseViewDocument(body, built.columns)
  if (!parsed.ok) return problem(state, 400, parsed.code, issuesOf(parsed))
  const view: MockTableView = {
    id: `view-${crypto.randomUUID()}`,
    organizationId: form.organizationId,
    formId: form.id,
    title: parsed.config.title,
    description: parsed.config.description,
    columns: parsed.config.columns,
    filters: parsed.config.filters,
    sort: parsed.config.sort,
    pageSize: parsed.config.pageSize,
    schemaVersion: parsed.config.schemaVersion,
    revision: 1,
    createdBy: access.user.id,
    updatedBy: access.user.id,
    updatedAt: new Date().toISOString(),
  }
  const next: MockState = { ...state, tableViews: [...state.tableViews, view] }
  return done(next, 201, detail(next, view))
}

export function updateTableView(state: MockState, token: string | null, formId: string, viewId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'schemaVersion', 'title', 'description', 'columns', 'filters', 'sort', 'pageSize'])) {
    return problem(state, 400, 'unknown_key')
  }
  if (typeof body.organizationId !== 'number' || !Number.isInteger(body.organizationId)) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, body.organizationId, 'all', [['forms', 'read'], ['table-views', 'update']])
  if (!access.ok) return access.result
  const form = formIn(state, body.organizationId, formId)
  const current = form ? viewIn(state, body.organizationId, form.id, viewId) : null
  if (!form || !current) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (current.schemaVersion !== TABLE_VIEW_SCHEMA_VERSION || body.schemaVersion !== TABLE_VIEW_SCHEMA_VERSION) {
    return problem(state, 400, 'unknown_schema')
  }
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  const built = buildColumnCatalog(form.id, publishedSources(state, form))
  if (!built.ok) return problem(state, 400, 'unknown_schema')
  const parsed = parseViewDocument(body, built.columns)
  if (!parsed.ok) return problem(state, 400, parsed.code, issuesOf(parsed))
  const view: MockTableView = {
    ...current,
    title: parsed.config.title,
    description: parsed.config.description,
    columns: parsed.config.columns,
    filters: parsed.config.filters,
    sort: parsed.config.sort,
    pageSize: parsed.config.pageSize,
    schemaVersion: parsed.config.schemaVersion,
    revision: current.revision + 1,
    updatedBy: access.user.id,
    updatedAt: new Date().toISOString(),
  }
  const next: MockState = {
    ...state,
    tableViews: state.tableViews.map((item) => item.id === current.id ? view : item),
  }
  return done(next, 200, detail(next, view))
}

export function deleteTableView(state: MockState, token: string | null, organizationId: number, formId: string, viewId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['table-views', 'delete']])
  if (!access.ok) return access.result
  const form = formIn(state, organizationId, formId)
  const view = form ? viewIn(state, organizationId, form.id, viewId) : null
  if (!form || !view) return problem(state, 404, 'not_found')
  const used = state.sections.some((section) => {
    if (!section.active || section.publishedVersionId == null) return false
    const version = state.sectionVersions.find((item) => item.id === section.publishedVersionId && item.sectionId === section.id)
    return version?.tableViewId === view.id
  })
  if (used) return problem(state, 409, 'view_in_use')
  return done({
    ...state,
    tableViews: state.tableViews.filter((item) => item.id !== view.id),
  }, 200, { id: view.id })
}

function storedConfig(view: MockTableView): QueryConfig {
  return {
    schemaVersion: TABLE_VIEW_SCHEMA_VERSION,
    columns: view.columns,
    filters: view.filters,
    sort: view.sort,
    pageSize: view.pageSize,
  }
}

export function queryTableRows(state: MockState, token: string | null, formId: string, viewId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'offset', 'limit', 'filters', 'sort'])) return problem(state, 400, 'unknown_key')
  if (typeof body.organizationId !== 'number' || !Number.isInteger(body.organizationId)) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, body.organizationId, 'all', [
    ['forms', 'read'],
    ['table-views', 'read'],
    ['form-records', 'read'],
  ])
  if (!access.ok) return access.result
  const form = formIn(state, body.organizationId, formId)
  const view = form ? viewIn(state, body.organizationId, form.id, viewId) : null
  if (!form || !view) return problem(state, 404, 'not_found')
  if (view.schemaVersion !== TABLE_VIEW_SCHEMA_VERSION) return problem(state, 400, 'unknown_schema')
  const versions = publishedSources(state, form)
  const built = buildColumnCatalog(form.id, versions)
  if (!built.ok) return problem(state, 400, 'unknown_schema')
  const hasOverride = 'filters' in body || 'sort' in body
  const effective = {
    ...storedConfig(view),
    filters: 'filters' in body ? body.filters : view.filters,
    sort: 'sort' in body ? body.sort : view.sort,
  }
  const parsed = parseQueryConfig(effective, built.columns)
  if (!parsed.ok) {
    if (!hasOverride && parsed.code === 'invalid_view') return problem(state, 409, 'incompatible_view', issuesOf(parsed))
    return problem(state, parsed.code === 'unknown_schema' ? 400 : 400, parsed.code === 'unknown_schema' ? 'unknown_schema' : (hasOverride ? 'invalid_query' : 'incompatible_view'), issuesOf(parsed))
  }
  const window = parseWindow(body.offset, 'limit' in body ? body.limit : view.pageSize, view.pageSize)
  if (!window.ok) return problem(state, 400, 'invalid_query')
  const result = runTableQuery({
    organizationId: form.organizationId,
    formId: form.id,
    viewId: view.id,
    versions,
    records: sourceRecords(state, form),
    authors: authors(state),
    config: parsed.config,
    offset: window.offset,
    limit: window.limit,
  })
  if (!result.ok) return problem(state, result.code === 'unknown_schema' ? 400 : 409, result.code === 'unknown_schema' ? 'unknown_schema' : 'incompatible_view', issuesOf(result))
  return done(state, 200, result.body)
}

export function previewTableRows(state: MockState, token: string | null, formId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'schemaVersion', 'columns', 'filters', 'sort', 'pageSize', 'offset', 'limit'])) {
    return problem(state, 400, 'unknown_key')
  }
  if (typeof body.organizationId !== 'number' || !Number.isInteger(body.organizationId)) return problem(state, 400, 'invalid_organization')
  const forms = authorize(state, token, body.organizationId, 'all', [['forms', 'read'], ['form-records', 'read']])
  if (!forms.ok) return forms.result
  const editor = authorize(state, token, body.organizationId, 'any', [['table-views', 'create'], ['table-views', 'update']])
  if (!editor.ok) return editor.result
  const form = formIn(state, body.organizationId, formId)
  if (!form) return problem(state, 404, 'not_found')
  const versions = publishedSources(state, form)
  const built = buildColumnCatalog(form.id, versions)
  if (!built.ok) return problem(state, 400, 'unknown_schema')
  const parsed = parseQueryConfig(body, built.columns)
  if (!parsed.ok) return problem(state, 400, parsed.code, issuesOf(parsed))
  const window = parseWindow(body.offset, body.limit, parsed.config.pageSize)
  if (!window.ok) return problem(state, 400, 'invalid_query')
  const result = runTableQuery({
    organizationId: form.organizationId,
    formId: form.id,
    viewId: null,
    versions,
    records: sourceRecords(state, form),
    authors: authors(state),
    config: parsed.config,
    offset: window.offset,
    limit: window.limit,
  })
  if (!result.ok) return problem(state, 400, result.code, issuesOf(result))
  return done(state, 200, result.body)
}
