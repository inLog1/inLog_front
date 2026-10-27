import {
  SECTION_ICON_KEYS,
  SECTION_ID_PATTERN,
  SECTION_SCHEMA_VERSION,
  type SectionConfig,
  type SectionIconKey,
  type SectionIssueCode,
  type SectionNavItem,
  type SectionStatus,
} from './types'

const RESOURCE_ID = /^[A-Za-z0-9_-]{8,80}$/
const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000
const MAX_LABEL = 80
const MAX_ORDER = 100_000

export type SectionParse =
  | { ok: true; config: SectionConfig }
  | { ok: false; code: 'unknown_schema' | 'invalid_section'; issues: { code: SectionIssueCode }[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

export function isSectionId(value: string): boolean {
  return SECTION_ID_PATTERN.test(value)
}

export function isSectionIcon(value: string): value is SectionIconKey {
  return (SECTION_ICON_KEYS as readonly string[]).includes(value)
}

export function emptySectionConfig(): SectionConfig {
  return {
    schemaVersion: SECTION_SCHEMA_VERSION,
    title: '',
    description: '',
    iconKey: 'clipboard',
    formId: '',
    tableViewId: '',
    showCreate: false,
    createLabel: '',
    order: 0,
  }
}

/**
 * Draft may omit both links. Publish requires both.
 * A schema version other than 1 is refused and is not read as version 1.
 */
export function parseSectionConfig(raw: unknown, mode: 'draft' | 'publish'): SectionParse {
  if (!isRecord(raw)) return { ok: false, code: 'invalid_section', issues: [{ code: 'invalid_title' }] }
  if (!('schemaVersion' in raw) || typeof raw.schemaVersion !== 'number') {
    return { ok: false, code: 'invalid_section', issues: [{ code: 'unknown_schema' }] }
  }
  if (raw.schemaVersion !== SECTION_SCHEMA_VERSION) return { ok: false, code: 'unknown_schema', issues: [] }
  const issues: { code: SectionIssueCode }[] = []
  const title = text(raw.title, MAX_TITLE)
  const description = text(raw.description, MAX_DESCRIPTION)
  if (title == null || title.length === 0) issues.push({ code: 'invalid_title' })
  if (description == null) issues.push({ code: 'invalid_description' })
  if (typeof raw.iconKey !== 'string' || !isSectionIcon(raw.iconKey)) issues.push({ code: 'invalid_icon' })
  if (typeof raw.order !== 'number' || !Number.isInteger(raw.order) || raw.order < -MAX_ORDER || raw.order > MAX_ORDER) {
    issues.push({ code: 'invalid_order' })
  }
  if (typeof raw.showCreate !== 'boolean') issues.push({ code: 'invalid_create_label' })
  const createLabel = text(raw.createLabel, MAX_LABEL)
  if (createLabel == null) issues.push({ code: 'invalid_create_label' })
  else if (raw.showCreate === true && createLabel.length === 0) issues.push({ code: 'invalid_create_label' })
  const formId = typeof raw.formId === 'string' ? raw.formId : null
  const tableViewId = typeof raw.tableViewId === 'string' ? raw.tableViewId : null
  if (formId == null || tableViewId == null) issues.push({ code: 'invalid_link' })
  else if (mode === 'publish') {
    if (!RESOURCE_ID.test(formId) || !RESOURCE_ID.test(tableViewId)) issues.push({ code: 'invalid_link' })
  } else if (formId !== '' || tableViewId !== '') {
    if (!RESOURCE_ID.test(formId) || !RESOURCE_ID.test(tableViewId)) issues.push({ code: 'invalid_link' })
  }
  if (issues.length > 0 || title == null || description == null || createLabel == null || formId == null || tableViewId == null) {
    return { ok: false, code: 'invalid_section', issues }
  }
  if (typeof raw.iconKey !== 'string' || !isSectionIcon(raw.iconKey)) {
    return { ok: false, code: 'invalid_section', issues }
  }
  return {
    ok: true,
    config: {
      schemaVersion: SECTION_SCHEMA_VERSION,
      title,
      description,
      iconKey: raw.iconKey,
      formId,
      tableViewId,
      showCreate: raw.showCreate === true,
      createLabel,
      order: raw.order as number,
    },
  }
}

export function sectionStatus(input: {
  active: boolean
  publishedSourceRevision: number | null
  draftRevision: number
}): SectionStatus {
  if (!input.active) return 'unpublished'
  if (input.publishedSourceRevision == null) return 'draft'
  if (input.publishedSourceRevision !== input.draftRevision) return 'published-dirty'
  return 'published'
}

export function compareSectionOrder(left: { order: number; id: string }, right: { order: number; id: string }): number {
  if (left.order !== right.order) return left.order - right.order
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

/** Navigation items for one organization. A failed request or a missing organization yields nothing. */
export function visibleOrganizationSections(input: {
  organizationId: number | null
  failed: boolean
  items: readonly SectionNavItem[] | null
}): SectionNavItem[] {
  if (input.organizationId == null || input.failed || input.items == null) return []
  return [...input.items]
    .filter((item) => isSectionId(item.id))
    .sort(compareSectionOrder)
}

export function sectionPath(sectionId: string): string {
  return `/workspace/sections/${sectionId}`
}

const WORK_KEYS = ['page', 'size', 'sort', 'filters'] as const

/**
 * Table conditions apply only when they were written for this section.
 * Conditions stamped for another section are dropped.
 * An unstamped filter set is also dropped so it is not carried in by navigation.
 */
export function sectionTableSearch(sectionId: string, params: URLSearchParams): { params: URLSearchParams; changed: boolean } {
  const owner = params.get('for')
  const hasWork = WORK_KEYS.some((key) => params.has(key))
  if (owner === sectionId) return { params, changed: false }
  if (!hasWork && owner == null) return { params, changed: false }
  const next = new URLSearchParams(params)
  next.delete('for')
  for (const key of WORK_KEYS) next.delete(key)
  return { params: next, changed: true }
}
