/** Configuration schema for a work section. It stores links, not copies of forms or rows. */
export const SECTION_SCHEMA_VERSION = 1

export const SECTION_ICON_KEYS = [
  'clipboard',
  'table',
  'layers',
  'box',
  'file-text',
  'list',
  'flask',
  'samples',
] as const

export type SectionIconKey = (typeof SECTION_ICON_KEYS)[number]

export const SECTION_ID_PATTERN = /^sec-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type SectionConfig = {
  schemaVersion: typeof SECTION_SCHEMA_VERSION
  title: string
  description: string
  iconKey: SectionIconKey
  formId: string
  tableViewId: string
  showCreate: boolean
  createLabel: string
  order: number
}

export type SectionStatus = 'draft' | 'published' | 'published-dirty' | 'unpublished'

export type SectionIssueCode =
  | 'invalid_title'
  | 'invalid_description'
  | 'invalid_icon'
  | 'invalid_order'
  | 'invalid_create_label'
  | 'invalid_link'
  | 'unknown_schema'

export type SectionDependency =
  | 'missing_form'
  | 'missing_view'
  | 'unpublished_form'
  | 'view_form_mismatch'

export type SectionNavItem = {
  id: string
  title: string
  description: string
  iconKey: string
  order: number
}

export type SectionListItem = {
  id: string
  organizationId: number
  organizationName: string
  title: string
  formId: string
  tableViewId: string
  formTitle: string | null
  viewTitle: string | null
  status: SectionStatus
  order: number
}

export type SectionDraftResponse = SectionConfig & {
  id: string
  organizationId: number
  revision: number
  draftRevision: number
  status: SectionStatus
  dependency: SectionDependency | null
  published: { versionNumber: number; title: string; sourceDraftRevision: number; publishedAt: string } | null
}

/** The working section. Draft edits are not included. */
export type PublishedSection = {
  id: string
  organizationId: number
  title: string
  description: string
  iconKey: SectionIconKey
  formId: string
  tableViewId: string
  showCreate: boolean
  createLabel: string
  order: number
  versionNumber: number
  publishedAt: string
  authorName: string
}

export type SectionPreview = SectionConfig & {
  id: string
  organizationId: number
  dependency: SectionDependency | null
  formTitle: string | null
  viewTitle: string | null
}

export type SectionOptionForm = { id: string; title: string }
export type SectionOptionView = { id: string; formId: string; title: string }
