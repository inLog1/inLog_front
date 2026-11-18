import { can } from '../../../entities/access/model/grants'
import { isSectionIcon, isSectionId, parseSectionConfig, sectionStatus } from '../../../entities/section/model/rules'
import type { SectionConfig, SectionDependency, SectionStatus } from '../../../entities/section/model/types'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockSection, MockSectionDraft, MockSectionVersion, MockState, MockUser } from '../db/types'

const RESOURCE_ID = /^[A-Za-z0-9_-]{8,80}$/

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string): FlowResult {
  return done(state, status, { code })
}

function allowedKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(body).every((key) => keys.includes(key))
}

function revisionOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function organizationIdOf(value: unknown): number | null {
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

function holds(state: MockState, userId: number, organizationId: number, resource: string, action: string): boolean {
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization) return false
  return can(toSnapshot(state), userId, resource, action, {
    type: 'organization',
    organizationId,
    corporationId: organization.corporationId,
  })
}

function sectionIn(state: MockState, organizationId: number, sectionId: string): MockSection | null {
  if (!isSectionId(sectionId)) return null
  return state.sections.find((item) => item.id === sectionId && item.organizationId === organizationId) ?? null
}

function draftOf(state: MockState, sectionId: string): MockSectionDraft | null {
  return state.sectionDrafts.find((item) => item.sectionId === sectionId) ?? null
}

function versionOf(state: MockState, versionId: string | null): MockSectionVersion | null {
  if (versionId == null) return null
  return state.sectionVersions.find((item) => item.id === versionId) ?? null
}

function personName(state: MockState, userId: number): string {
  const user = state.users.find((item) => item.id === userId)
  if (!user) return ''
  return [user.surname, user.name, user.patronymic].filter((part) => part.trim() !== '').join(' ')
}

function dependencyOf(state: MockState, organizationId: number, formId: string, tableViewId: string): SectionDependency | null {
  if (formId === '' && tableViewId === '') return null
  if (!RESOURCE_ID.test(formId) || !RESOURCE_ID.test(tableViewId)) return 'missing_form'
  const form = state.forms.find((item) => item.id === formId && item.organizationId === organizationId) ?? null
  if (!form) return 'missing_form'
  if (form.publishedVersionId == null) return 'unpublished_form'
  const view = state.tableViews.find((item) => item.id === tableViewId && item.organizationId === organizationId) ?? null
  if (!view) return 'missing_view'
  if (view.formId !== form.id) return 'view_form_mismatch'
  return null
}

function statusOf(section: MockSection, draft: MockSectionDraft, state: MockState): SectionStatus {
  const published = versionOf(state, section.publishedVersionId)
  return sectionStatus({
    active: section.active,
    publishedSourceRevision: published && published.sectionId === section.id ? published.sourceDraftRevision : null,
    draftRevision: draft.revision,
  })
}

function linkedTitle(state: MockState, organizationId: number, kind: 'form' | 'view', id: string, allowed: boolean): string | null {
  if (!allowed || id === '') return null
  if (kind === 'form') {
    return state.forms.find((item) => item.id === id && item.organizationId === organizationId)?.title ?? null
  }
  return state.tableViews.find((item) => item.id === id && item.organizationId === organizationId)?.title ?? null
}

function configOf(draft: MockSectionDraft): SectionConfig | null {
  if (!isSectionIcon(draft.iconKey) || draft.schemaVersion !== 1) return null
  return {
    schemaVersion: 1,
    title: draft.title,
    description: draft.description,
    iconKey: draft.iconKey,
    formId: draft.formId,
    tableViewId: draft.tableViewId,
    showCreate: draft.showCreate,
    createLabel: draft.createLabel,
    order: draft.order,
  }
}

function draftBody(state: MockState, section: MockSection, draft: MockSectionDraft, userId: number) {
  const published = versionOf(state, section.publishedVersionId)
  const same = published != null && published.sectionId === section.id
  return {
    id: section.id,
    organizationId: section.organizationId,
    revision: section.revision,
    draftRevision: draft.revision,
    schemaVersion: draft.schemaVersion,
    title: draft.title,
    description: draft.description,
    iconKey: draft.iconKey,
    formId: draft.formId,
    tableViewId: draft.tableViewId,
    showCreate: draft.showCreate,
    createLabel: draft.createLabel,
    order: draft.order,
    status: statusOf(section, draft, state),
    dependency: dependencyOf(state, section.organizationId, draft.formId, draft.tableViewId),
    formTitle: linkedTitle(state, section.organizationId, 'form', draft.formId, holds(state, userId, section.organizationId, 'forms', 'read')),
    viewTitle: linkedTitle(state, section.organizationId, 'view', draft.tableViewId, holds(state, userId, section.organizationId, 'table-views', 'read')),
    published: same && published ? {
      versionNumber: published.number,
      title: published.title,
      sourceDraftRevision: published.sourceDraftRevision,
      publishedAt: published.publishedAt,
    } : null,
  }
}

function publishedBody(state: MockState, section: MockSection, version: MockSectionVersion) {
  return {
    id: section.id,
    organizationId: section.organizationId,
    title: version.title,
    description: version.description,
    iconKey: version.iconKey,
    formId: version.formId,
    tableViewId: version.tableViewId,
    showCreate: version.showCreate,
    createLabel: version.createLabel,
    order: version.order,
    versionNumber: version.number,
    publishedAt: version.publishedAt,
    authorName: personName(state, version.publishedBy),
  }
}

function replaceSection(state: MockState, section: MockSection, draft?: MockSectionDraft, version?: MockSectionVersion): MockState {
  return {
    ...state,
    sections: state.sections.map((item) => item.id === section.id ? section : item),
    sectionDrafts: draft ? state.sectionDrafts.map((item) => item.sectionId === section.id ? draft : item) : state.sectionDrafts,
    sectionVersions: version ? [...state.sectionVersions, version] : state.sectionVersions,
  }
}

export function listSections(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = authorize(state, token, organizationId, 'any', [['sections', 'create'], ['sections', 'update']])
  if (!access.ok) return access.result
  const organization = state.organizations.find((item) => item.id === organizationId)
  const canForms = holds(state, access.user.id, organizationId, 'forms', 'read')
  const canViews = holds(state, access.user.id, organizationId, 'table-views', 'read')
  const sections = state.sections
    .filter((section) => section.organizationId === organizationId)
    .flatMap((section) => {
      const draft = draftOf(state, section.id)
      if (!draft) return []
      return [{
        id: section.id,
        organizationId,
        organizationName: organization?.shortName ?? '',
        title: draft.title,
        formId: draft.formId,
        tableViewId: draft.tableViewId,
        formTitle: linkedTitle(state, organizationId, 'form', draft.formId, canForms),
        viewTitle: linkedTitle(state, organizationId, 'view', draft.tableViewId, canViews),
        status: statusOf(section, draft, state),
        order: draft.order,
      }]
    })
  return done(state, 200, { sections })
}

export function sectionOptions(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = authorize(state, token, organizationId, 'any', [['sections', 'create'], ['sections', 'update']])
  if (!access.ok) return access.result
  const formsRead = authorize(state, token, organizationId, 'all', [['forms', 'read']])
  const viewsRead = authorize(state, token, organizationId, 'all', [['table-views', 'read']])
  if (!formsRead.ok || !viewsRead.ok) return done(state, 200, { forms: [], views: [] })
  const forms = state.forms
    .filter((form) => form.organizationId === organizationId && form.publishedVersionId != null)
    .map((form) => ({ id: form.id, title: form.title }))
  const formIds = new Set(forms.map((form) => form.id))
  const views = state.tableViews
    .filter((view) => view.organizationId === organizationId && formIds.has(view.formId))
    .map((view) => ({ id: view.id, formId: view.formId, title: view.title }))
  return done(state, 200, { forms, views })
}

export function createSection(state: MockState, token: string | null, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'title', 'description'])) return problem(state, 400, 'unknown_key')
  const organizationId = organizationIdOf(body.organizationId)
  if (organizationId == null) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, organizationId, 'all', [['sections', 'create']])
  if (!access.ok) return access.result
  const parsed = parseSectionConfig({
    schemaVersion: 1,
    title: body.title,
    description: body.description ?? '',
    iconKey: 'clipboard',
    formId: '',
    tableViewId: '',
    showCreate: false,
    createLabel: '',
    order: 0,
  }, 'draft')
  if (!parsed.ok) return problem(state, 400, 'invalid_section')
  const section: MockSection = {
    id: `sec-${crypto.randomUUID()}`,
    organizationId,
    publishedVersionId: null,
    revision: 1,
    active: true,
  }
  const draft: MockSectionDraft = {
    sectionId: section.id,
    ...parsed.config,
    revision: 1,
  }
  return done({
    ...state,
    sections: [...state.sections, section],
    sectionDrafts: [...state.sectionDrafts, draft],
  }, 201, { id: section.id, revision: 1, draftRevision: 1 })
}

export function readDraft(state: MockState, token: string | null, organizationId: number, sectionId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['sections', 'update']])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  const draft = section ? draftOf(state, section.id) : null
  if (!section || !draft) return problem(state, 404, 'not_found')
  if (draft.schemaVersion !== 1) return problem(state, 400, 'unknown_schema')
  return done(state, 200, draftBody(state, section, draft, access.user.id))
}

export function saveDraft(state: MockState, token: string | null, sectionId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'expectedDraftRevision', 'schemaVersion', 'title', 'description', 'iconKey', 'formId', 'tableViewId', 'showCreate', 'createLabel', 'order'])) {
    return problem(state, 400, 'unknown_key')
  }
  const organizationId = organizationIdOf(body.organizationId)
  if (organizationId == null) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, organizationId, 'all', [['sections', 'update']])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  const draft = section ? draftOf(state, section.id) : null
  if (!section || !draft) return problem(state, 404, 'not_found')
  const expectedRevision = revisionOf(body.expectedRevision)
  const expectedDraftRevision = revisionOf(body.expectedDraftRevision)
  if (expectedRevision == null || expectedDraftRevision == null) return problem(state, 400, 'invalid_version')
  if (section.revision !== expectedRevision || draft.revision !== expectedDraftRevision) return problem(state, 409, 'stale_write')
  if (draft.schemaVersion !== 1) return problem(state, 400, 'unknown_schema')
  const parsed = parseSectionConfig(body, 'draft')
  if (!parsed.ok) return problem(state, 400, parsed.code)
  const dependency = dependencyOf(state, organizationId, parsed.config.formId, parsed.config.tableViewId)
  if (dependency) return problem(state, 400, dependency)
  const nextSection: MockSection = { ...section, revision: section.revision + 1 }
  const nextDraft: MockSectionDraft = { ...draft, ...parsed.config, revision: draft.revision + 1 }
  const next = replaceSection(state, nextSection, nextDraft)
  return done(next, 200, draftBody(next, nextSection, nextDraft, access.user.id))
}

function publishSnapshot(version: MockSectionVersion, section: MockSection) {
  return {
    versionId: version.id,
    versionNumber: version.number,
    revision: section.revision,
    publishedAt: version.publishedAt,
  }
}

export function publishSection(state: MockState, token: string | null, sectionId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'expectedDraftRevision'])) return problem(state, 400, 'unknown_key')
  const organizationId = organizationIdOf(body.organizationId)
  if (organizationId == null) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, organizationId, 'all', [['sections', 'publish']])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  const draft = section ? draftOf(state, section.id) : null
  if (!section || !draft) return problem(state, 404, 'not_found')
  const expectedRevision = revisionOf(body.expectedRevision)
  const expectedDraftRevision = revisionOf(body.expectedDraftRevision)
  if (expectedRevision == null || expectedDraftRevision == null) return problem(state, 400, 'invalid_version')
  const existing = state.sectionVersions.find((version) => version.sectionId === section.id && version.sourceDraftRevision === expectedDraftRevision) ?? null
  if (existing && section.publishedVersionId === existing.id && section.active) {
    return done(state, 200, publishSnapshot(existing, section))
  }
  if (section.revision !== expectedRevision || draft.revision !== expectedDraftRevision) return problem(state, 409, 'stale_write')
  const config = configOf(draft)
  if (!config) return problem(state, 400, draft.schemaVersion === 1 ? 'invalid_section' : 'unknown_schema')
  const parsed = parseSectionConfig(config, 'publish')
  if (!parsed.ok) return problem(state, 400, parsed.code)
  const dependency = dependencyOf(state, organizationId, parsed.config.formId, parsed.config.tableViewId)
  if (dependency) return problem(state, 400, dependency)
  if (existing) {
    const nextSection: MockSection = {
      ...section,
      publishedVersionId: existing.id,
      active: true,
      revision: section.revision + 1,
    }
    const next = replaceSection(state, nextSection)
    return done(next, 200, publishSnapshot(existing, nextSection))
  }
  const number = state.sectionVersions.filter((version) => version.sectionId === section.id).reduce((max, version) => Math.max(max, version.number), 0) + 1
  const version: MockSectionVersion = {
    id: `secver-${crypto.randomUUID()}`,
    sectionId: section.id,
    organizationId: section.organizationId,
    number,
    schemaVersion: parsed.config.schemaVersion,
    title: parsed.config.title,
    description: parsed.config.description,
    iconKey: parsed.config.iconKey,
    formId: parsed.config.formId,
    tableViewId: parsed.config.tableViewId,
    showCreate: parsed.config.showCreate,
    createLabel: parsed.config.createLabel,
    order: parsed.config.order,
    publishedAt: new Date().toISOString(),
    publishedBy: access.user.id,
    sourceDraftRevision: draft.revision,
  }
  const nextSection: MockSection = {
    ...section,
    publishedVersionId: version.id,
    active: true,
    revision: section.revision + 1,
  }
  const next = replaceSection(state, nextSection, undefined, version)
  return done(next, 201, publishSnapshot(version, nextSection))
}

export function unpublishSection(state: MockState, token: string | null, sectionId: string, body: Record<string, unknown>): FlowResult {
  if (!allowedKeys(body, ['organizationId', 'expectedRevision'])) return problem(state, 400, 'unknown_key')
  const organizationId = organizationIdOf(body.organizationId)
  if (organizationId == null) return problem(state, 400, 'invalid_organization')
  const access = authorize(state, token, organizationId, 'all', [['sections', 'publish']])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  if (!section) return problem(state, 404, 'not_found')
  if (!section.active) return done(state, 200, { id: section.id, active: false, revision: section.revision })
  const expectedRevision = revisionOf(body.expectedRevision)
  if (expectedRevision == null) return problem(state, 400, 'invalid_version')
  if (section.revision !== expectedRevision) return problem(state, 409, 'stale_write')
  const nextSection: MockSection = { ...section, active: false, revision: section.revision + 1 }
  return done(replaceSection(state, nextSection), 200, { id: section.id, active: false, revision: nextSection.revision })
}

const NAV_RIGHTS = [
  ['sections', 'read'],
  ['forms', 'read'],
  ['table-views', 'read'],
  ['form-records', 'read'],
] as const

export function sectionNavigation(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['sections', 'read']])
  if (!access.ok) return access.result
  const canOpen = NAV_RIGHTS.every(([resource, action]) => holds(state, access.user.id, organizationId, resource, action))
  if (!canOpen) return done(state, 200, { sections: [] })
  const sections = state.sections
    .filter((section) => section.organizationId === organizationId && section.active && section.publishedVersionId != null)
    .flatMap((section) => {
      const version = versionOf(state, section.publishedVersionId)
      if (!version || version.sectionId !== section.id) return []
      if (dependencyOf(state, organizationId, version.formId, version.tableViewId)) return []
      return [{
        id: section.id,
        title: version.title,
        description: version.description,
        iconKey: version.iconKey,
        order: version.order,
      }]
    })
  return done(state, 200, { sections })
}

export function readPublished(state: MockState, token: string | null, organizationId: number, sectionId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [...NAV_RIGHTS])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  if (!section) return problem(state, 404, 'not_found')
  if (!section.active || section.publishedVersionId == null) return problem(state, 404, 'not_published')
  const version = versionOf(state, section.publishedVersionId)
  if (!version || version.sectionId !== section.id) return problem(state, 404, 'not_published')
  if (version.schemaVersion !== 1) return problem(state, 400, 'unknown_schema')
  const dependency = dependencyOf(state, organizationId, version.formId, version.tableViewId)
  if (dependency) return problem(state, 400, dependency)
  return done(state, 200, publishedBody(state, section, version))
}

export function readPreview(state: MockState, token: string | null, organizationId: number, sectionId: string): FlowResult {
  const access = authorize(state, token, organizationId, 'all', [['sections', 'update']])
  if (!access.ok) return access.result
  const section = sectionIn(state, organizationId, sectionId)
  const draft = section ? draftOf(state, section.id) : null
  if (!section || !draft) return problem(state, 404, 'not_found')
  if (draft.schemaVersion !== 1 || !isSectionIcon(draft.iconKey)) return problem(state, 400, 'unknown_schema')
  return done(state, 200, {
    id: section.id,
    organizationId: section.organizationId,
    schemaVersion: 1 as const,
    title: draft.title,
    description: draft.description,
    iconKey: draft.iconKey,
    formId: draft.formId,
    tableViewId: draft.tableViewId,
    showCreate: draft.showCreate,
    createLabel: draft.createLabel,
    order: draft.order,
    dependency: dependencyOf(state, organizationId, draft.formId, draft.tableViewId),
    formTitle: linkedTitle(state, organizationId, 'form', draft.formId, holds(state, access.user.id, organizationId, 'forms', 'read')),
    viewTitle: linkedTitle(state, organizationId, 'view', draft.tableViewId, holds(state, access.user.id, organizationId, 'table-views', 'read')),
  })
}
