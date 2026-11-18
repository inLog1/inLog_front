/** Settings schema for a saved table view. It is not a form schema. */
export const TABLE_VIEW_SCHEMA_VERSION = 1

/**
 * Published form schemas this reader understands.
 * A different version is refused and is not read as version 1.
 */
export const TABLE_SOURCE_SCHEMA_VERSION = 1

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
export const MAX_COLUMNS = 24
export const MAX_FILTERS = 12
export const MAX_TEXT = 200
export const MAX_TITLE = 200
export const MAX_DESCRIPTION = 2000
export const MAX_OFFSET = 100_000

export const SYSTEM_COLUMN_IDS = {
  createdAt: 'sys:createdAt',
  author: 'sys:author',
  version: 'sys:version',
  recordId: 'sys:recordId',
} as const

export type SystemColumnId = (typeof SYSTEM_COLUMN_IDS)[keyof typeof SYSTEM_COLUMN_IDS]

export const FILTER_OPS = ['contains', 'eq', 'gt', 'lt', 'gte', 'lte', 'present', 'blank'] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export type ViewDirection = 'asc' | 'desc'

export type ViewFilter = {
  columnId: string
  op: FilterOp
  value: string | number | boolean | null
}

export type ViewSort = {
  columnId: string
  direction: ViewDirection
}

/** What a view stores. Rows and form schemas are not part of it. */
export type TableViewConfig = {
  schemaVersion: number
  title: string
  description: string
  columns: string[]
  filters: ViewFilter[]
  sort: ViewSort
  pageSize: number
}

export type QueryConfig = {
  schemaVersion: typeof TABLE_VIEW_SCHEMA_VERSION
  columns: string[]
  filters: ViewFilter[]
  sort: ViewSort
  pageSize: number
}

export type SourceFieldType = 'text' | 'textarea' | 'number' | 'date' | 'single_choice' | 'boolean'

export type SourceField = {
  id: string
  type: SourceFieldType
  label: string
  options: { id: string; label: string }[]
}

export type SourceVersion = {
  id: string
  formId: string
  number: number
  current: boolean
  schema: {
    schemaVersion: number
    fields: SourceField[]
  }
}

export type SourceRecord = {
  id: string
  formId: string
  organizationId: number
  formVersionId: string
  values: Record<string, string | number | boolean | null | undefined>
  createdAt: string
  createdBy: number
}

export type CatalogColumn = {
  id: string
  source: 'field' | 'system'
  /** Empty for system columns. The screen translates those by id. */
  label: string
  types: SourceFieldType[]
  mixed: boolean
  /** True when the field is absent from the current published version. */
  retired: boolean
  sortable: boolean
  options: { id: string; label: string }[]
}

export type CatalogResult =
  | { ok: true; columns: CatalogColumn[] }
  | { ok: false; code: 'unknown_schema' }

export type CellState = 'value' | 'empty' | 'absent'

export type TableCell = {
  state: CellState
  type: SourceFieldType | 'createdAt' | 'author' | 'version' | 'recordId' | null
  value: string | number | boolean | null
  /** Label from the record's own version. Same text with another option id stays separate. */
  optionLabel: string | null
}

export type ViewIssueCode =
  | 'unknown_column'
  | 'mixed_column'
  | 'operator_not_allowed'
  | 'invalid_value'
  | 'unknown_option'
  | 'duplicate_column'
  | 'empty_columns'
  | 'too_many_columns'
  | 'too_many_filters'
  | 'invalid_page_size'
  | 'invalid_sort'
  | 'invalid_title'
  | 'invalid_description'
  | 'legacy_created_at'

export type ViewIssue = {
  code: ViewIssueCode
  columnId?: string
  op?: string
}

export type TableQueryResponse = {
  organizationId: number
  formId: string
  viewId: string | null
  columns: CatalogColumn[]
  rows: Array<{
    recordId: string
    formVersionId: string
    cells: Record<string, TableCell>
  }>
  total: number
  offset: number
  limit: number
  appliedFilters: ViewFilter[]
  appliedSort: ViewSort
}

export type TableViewSummary = {
  id: string
  formId: string
  title: string
  description: string
  updatedAt: string
  revision: number
}

export type TableViewDetail = TableViewSummary & {
  organizationId: number
  schemaVersion: number
  columns: string[]
  filters: ViewFilter[]
  sort: ViewSort
  pageSize: number
  authorName: string
}

/** Working query committed in the page URL. Null means "use the saved view". */
export type WorkQuery = {
  page: number
  pageSize: number | null
  sort: ViewSort | null
  filters: ViewFilter[] | null
}
