import { buildColumnCatalog, columnKind, isCalendarDate, readCell, type ReadCell } from './columns'
import { classifyCreatedAtValue, matchesCreatedAt } from './created-at'
import {
  DEFAULT_PAGE_SIZE,
  FILTER_OPS,
  MAX_COLUMNS,
  MAX_DESCRIPTION,
  MAX_FILTERS,
  MAX_OFFSET,
  MAX_TEXT,
  MAX_TITLE,
  PAGE_SIZES,
  SYSTEM_COLUMN_IDS,
  TABLE_VIEW_SCHEMA_VERSION,
  type CatalogColumn,
  type FilterOp,
  type QueryConfig,
  type SourceRecord,
  type SourceVersion,
  type TableCell,
  type TableQueryResponse,
  type TableViewConfig,
  type ViewFilter,
  type ViewIssue,
  type ViewSort,
} from './types'

export type ConfigParse =
  | { ok: true; config: QueryConfig }
  | { ok: false; code: 'unknown_schema' | 'invalid_view'; issues: ViewIssue[] }

export type DocumentParse =
  | { ok: true; config: TableViewConfig }
  | { ok: false; code: 'unknown_schema' | 'invalid_view'; issues: ViewIssue[] }

const FILTER_OP_SET = new Set<string>(FILTER_OPS)

function issue(code: ViewIssue['code'], columnId?: string, op?: string): ViewIssue {
  const next: ViewIssue = { code }
  if (columnId != null) next.columnId = columnId
  if (op != null) next.op = op
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function allowedOps(column: CatalogColumn): FilterOp[] {
  const kind = columnKind(column)
  if (kind === 'text' || kind === 'author' || kind === 'recordId') return ['contains', 'eq', 'present', 'blank']
  if (kind === 'number' || kind === 'version') return ['eq', 'gt', 'lt', 'present', 'blank']
  if (kind === 'date' || kind === 'createdAt') return ['eq', 'gte', 'lte', 'present', 'blank']
  if (kind === 'choice' || kind === 'boolean') return ['eq', 'present', 'blank']
  return ['present', 'blank']
}

export function moveColumn(columns: readonly string[], id: string, direction: -1 | 1): string[] {
  const index = columns.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= columns.length) return [...columns]
  const next = [...columns]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function defaultSort(): ViewSort {
  return { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' }
}

export function defaultViewConfig(title = ''): TableViewConfig {
  return {
    schemaVersion: TABLE_VIEW_SCHEMA_VERSION,
    title,
    description: '',
    columns: [SYSTEM_COLUMN_IDS.createdAt],
    filters: [],
    sort: defaultSort(),
    pageSize: DEFAULT_PAGE_SIZE,
  }
}

function parseFilterValue(column: CatalogColumn, op: FilterOp, raw: unknown): ViewIssue | ViewFilter {
  if (op === 'present' || op === 'blank') {
    if (raw != null) return issue('invalid_value', column.id, op)
    return { columnId: column.id, op, value: null }
  }
  const kind = columnKind(column)
  if (kind === 'number' || kind === 'version') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return issue('invalid_value', column.id, op)
    return { columnId: column.id, op, value: raw }
  }
  if (kind === 'boolean') {
    if (typeof raw !== 'boolean') return issue('invalid_value', column.id, op)
    return { columnId: column.id, op, value: raw }
  }
  if (kind === 'date') {
    if (typeof raw !== 'string' || !isCalendarDate(raw)) return issue('invalid_value', column.id, op)
    return { columnId: column.id, op, value: raw }
  }
  if (kind === 'createdAt') {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_TEXT) return issue('invalid_value', column.id, op)
    const created = classifyCreatedAtValue(raw)
    if (created.kind === 'unsupported') return issue('legacy_created_at', column.id, op)
    return { columnId: column.id, op, value: raw }
  }
  if (kind === 'choice') {
    if (typeof raw !== 'string' || !column.options.some((option) => option.id === raw)) {
      return issue('unknown_option', column.id, op)
    }
    return { columnId: column.id, op, value: raw }
  }
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_TEXT) return issue('invalid_value', column.id, op)
  return { columnId: column.id, op, value: raw }
}

function parseFilters(raw: unknown, catalog: readonly CatalogColumn[]): { filters: ViewFilter[]; issues: ViewIssue[] } {
  if (!Array.isArray(raw)) return { filters: [], issues: [issue('invalid_value')] }
  if (raw.length > MAX_FILTERS) return { filters: [], issues: [issue('too_many_filters')] }
  const filters: ViewFilter[] = []
  const issues: ViewIssue[] = []
  for (const item of raw) {
    if (!isRecord(item) || Object.keys(item).some((key) => !['columnId', 'op', 'value'].includes(key))) {
      issues.push(issue('invalid_value'))
      continue
    }
    if (typeof item.columnId !== 'string') {
      issues.push(issue('unknown_column'))
      continue
    }
    const column = catalog.find((entry) => entry.id === item.columnId)
    if (!column) {
      issues.push(issue('unknown_column', item.columnId))
      continue
    }
    if (typeof item.op !== 'string' || !FILTER_OP_SET.has(item.op)) {
      issues.push(issue('operator_not_allowed', column.id, typeof item.op === 'string' ? item.op : undefined))
      continue
    }
    const op = item.op as FilterOp
    if (!allowedOps(column).includes(op)) {
      issues.push(issue(column.mixed ? 'mixed_column' : 'operator_not_allowed', column.id, op))
      continue
    }
    const parsed = parseFilterValue(column, op, item.value ?? null)
    if ('code' in parsed) issues.push(parsed)
    else filters.push(parsed)
  }
  return { filters, issues }
}

function parseSort(raw: unknown, catalog: readonly CatalogColumn[]): { sort: ViewSort | null; issues: ViewIssue[] } {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !['columnId', 'direction'].includes(key))) {
    return { sort: null, issues: [issue('invalid_sort')] }
  }
  if (typeof raw.columnId !== 'string') return { sort: null, issues: [issue('unknown_column')] }
  const column = catalog.find((entry) => entry.id === raw.columnId)
  if (!column) return { sort: null, issues: [issue('unknown_column', raw.columnId)] }
  if (!column.sortable || column.mixed) return { sort: null, issues: [issue('mixed_column', column.id)] }
  if (raw.direction !== 'asc' && raw.direction !== 'desc') return { sort: null, issues: [issue('invalid_sort', column.id)] }
  return { sort: { columnId: column.id, direction: raw.direction }, issues: [] }
}

function parseColumns(raw: unknown, catalog: readonly CatalogColumn[]): { columns: string[]; issues: ViewIssue[] } {
  if (!Array.isArray(raw)) return { columns: [], issues: [issue('empty_columns')] }
  if (raw.length === 0) return { columns: [], issues: [issue('empty_columns')] }
  if (raw.length > MAX_COLUMNS) return { columns: [], issues: [issue('too_many_columns')] }
  const columns: string[] = []
  const issues: ViewIssue[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string' || !catalog.some((column) => column.id === item)) {
      issues.push(issue('unknown_column', typeof item === 'string' ? item : undefined))
      continue
    }
    if (seen.has(item)) {
      issues.push(issue('duplicate_column', item))
      continue
    }
    seen.add(item)
    columns.push(item)
  }
  return { columns, issues }
}

/**
 * Reads a query configuration.
 * schemaVersion other than 1 returns unknown_schema and does not inspect columns as version 1.
 */
export function parseQueryConfig(raw: unknown, catalog: readonly CatalogColumn[]): ConfigParse {
  if (!isRecord(raw)) return { ok: false, code: 'invalid_view', issues: [issue('invalid_sort')] }
  if (!('schemaVersion' in raw) || typeof raw.schemaVersion !== 'number') {
    return { ok: false, code: 'invalid_view', issues: [issue('invalid_sort')] }
  }
  if (raw.schemaVersion !== TABLE_VIEW_SCHEMA_VERSION) return { ok: false, code: 'unknown_schema', issues: [] }
  if (!('columns' in raw) || !('filters' in raw) || !('sort' in raw) || !('pageSize' in raw)) {
    return { ok: false, code: 'invalid_view', issues: [issue('invalid_sort')] }
  }
  const columns = parseColumns(raw.columns, catalog)
  const filters = parseFilters(raw.filters, catalog)
  const sort = parseSort(raw.sort, catalog)
  const issues = [...columns.issues, ...filters.issues, ...sort.issues]
  const pageSize = raw.pageSize
  if (typeof pageSize !== 'number' || !(PAGE_SIZES as readonly number[]).includes(pageSize)) {
    issues.push(issue('invalid_page_size'))
  }
  if (issues.length > 0 || sort.sort == null) return { ok: false, code: 'invalid_view', issues }
  return {
    ok: true,
    config: {
      schemaVersion: TABLE_VIEW_SCHEMA_VERSION,
      columns: columns.columns,
      filters: filters.filters,
      sort: sort.sort,
      pageSize: pageSize as QueryConfig['pageSize'],
    },
  }
}

export function parseViewDocument(raw: unknown, catalog: readonly CatalogColumn[]): DocumentParse {
  if (!isRecord(raw)) return { ok: false, code: 'invalid_view', issues: [issue('invalid_title')] }
  const query = parseQueryConfig(raw, catalog)
  if (!query.ok) return query
  const issues: ViewIssue[] = []
  if (typeof raw.title !== 'string') issues.push(issue('invalid_title'))
  else {
    const title = raw.title.trim()
    if (title.length === 0 || title.length > MAX_TITLE) issues.push(issue('invalid_title'))
  }
  if (typeof raw.description !== 'string') issues.push(issue('invalid_description'))
  else if (raw.description.trim().length > MAX_DESCRIPTION) issues.push(issue('invalid_description'))
  if (issues.length > 0) return { ok: false, code: 'invalid_view', issues }
  return {
    ok: true,
    config: {
      ...query.config,
      title: (raw.title as string).trim(),
      description: (raw.description as string).trim(),
    },
  }
}

export function parseWindow(offset: unknown, limit: unknown, fallbackLimit: number): { ok: true; offset: number; limit: number } | { ok: false } {
  const resolvedLimit = limit == null ? fallbackLimit : limit
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return { ok: false }
  if (typeof resolvedLimit !== 'number' || !(PAGE_SIZES as readonly number[]).includes(resolvedLimit)) return { ok: false }
  return { ok: true, offset, limit: resolvedLimit }
}

function textIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function matches(cell: ReadCell, filter: ViewFilter): boolean {
  if (filter.op === 'blank') return cell.state === 'absent' || cell.state === 'empty'
  if (filter.op === 'present') return cell.state === 'value'
  if (cell.state !== 'value' || !cell.comparable) return false
  const expected = filter.value
  if (cell.type === 'number' || cell.type === 'version') {
    if (typeof cell.value !== 'number' || typeof expected !== 'number') return false
    if (filter.op === 'eq') return cell.value === expected
    if (filter.op === 'gt') return cell.value > expected
    if (filter.op === 'lt') return cell.value < expected
    return false
  }
  if (cell.type === 'boolean') return filter.op === 'eq' && cell.value === expected
  if (cell.type === 'date') {
    if (typeof cell.value !== 'string' || typeof expected !== 'string') return false
    if (filter.op === 'eq') return cell.value === expected
    if (filter.op === 'gte') return cell.value >= expected
    if (filter.op === 'lte') return cell.value <= expected
    return false
  }
  if (cell.type === 'createdAt') {
    if (typeof cell.value !== 'string' || typeof expected !== 'string') return false
    return matchesCreatedAt(cell.value, filter.op, expected)
  }
  if (cell.type === 'single_choice') return filter.op === 'eq' && cell.value === expected
  if (typeof cell.value !== 'string' || typeof expected !== 'string') return false
  if (filter.op === 'eq') return cell.value.toLowerCase() === expected.toLowerCase()
  if (filter.op === 'contains') return textIncludes(cell.value, expected)
  return false
}

function rankOf(cell: ReadCell): { empty: true } | { empty: false; kind: 'number'; value: number } | { empty: false; kind: 'text'; value: string } {
  if (cell.state !== 'value') return { empty: true }
  if ((cell.type === 'number' || cell.type === 'version') && typeof cell.value === 'number') {
    return { empty: false, kind: 'number', value: cell.value }
  }
  if (cell.type === 'boolean') return { empty: false, kind: 'number', value: cell.value === true ? 1 : 0 }
  if (cell.type === 'single_choice') return { empty: false, kind: 'text', value: (cell.optionLabel ?? String(cell.value ?? '')).toLowerCase() }
  return { empty: false, kind: 'text', value: String(cell.value ?? '').toLowerCase() }
}

function compareRank(
  left: ReturnType<typeof rankOf>,
  right: ReturnType<typeof rankOf>,
): number {
  if (left.empty || right.empty) return 0
  if (left.kind === 'number' && right.kind === 'number') return left.value - right.value
  const leftText = left.kind === 'text' ? left.value : String(left.value)
  const rightText = right.kind === 'text' ? right.value : String(right.value)
  if (leftText < rightText) return -1
  if (leftText > rightText) return 1
  return 0
}

function compareRecords(
  left: SourceRecord,
  right: SourceRecord,
  sort: ViewSort,
  column: CatalogColumn,
  versions: ReadonlyMap<string, SourceVersion>,
  authors: ReadonlyMap<number, string>,
): number {
  const leftCell = readCell(column, left, versions.get(left.formVersionId) ?? null, authors.get(left.createdBy) ?? '')
  const rightCell = readCell(column, right, versions.get(right.formVersionId) ?? null, authors.get(right.createdBy) ?? '')
  const leftRank = rankOf(leftCell)
  const rightRank = rankOf(rightCell)
  if (leftRank.empty !== rightRank.empty) return leftRank.empty ? 1 : -1
  if (!leftRank.empty && !rightRank.empty) {
    const base = compareRank(leftRank, rightRank)
    if (base !== 0) return sort.direction === 'asc' ? base : -base
  }
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

function projectCell(cell: ReadCell): TableCell {
  return { state: cell.state, type: cell.type, value: cell.value, optionLabel: cell.optionLabel }
}

export type QueryRun =
  | { ok: true; body: TableQueryResponse }
  | { ok: false; code: 'unknown_schema' | 'invalid_view'; issues: ViewIssue[] }

/**
 * Filters, sorts and pages records of one form.
 * Records of another form or organization are left out.
 * Count is the filtered length before the page slice.
 */
export function runTableQuery(input: {
  organizationId: number
  formId: string
  viewId: string | null
  versions: readonly SourceVersion[]
  records: readonly SourceRecord[]
  authors: ReadonlyMap<number, string>
  config: QueryConfig
  offset: number
  limit: number
}): QueryRun {
  const built = buildColumnCatalog(input.formId, input.versions)
  if (!built.ok) return { ok: false, code: 'unknown_schema', issues: [] }
  const checked = parseQueryConfig(input.config, built.columns)
  if (!checked.ok) return checked
  const config = checked.config
  const byId = new Map(built.columns.map((column) => [column.id, column]))
  const selected = config.columns.map((id) => byId.get(id)).filter((column): column is CatalogColumn => column != null)
  const sortColumn = byId.get(config.sort.columnId)
  if (!sortColumn) return { ok: false, code: 'invalid_view', issues: [issue('unknown_column', config.sort.columnId)] }
  const versions = new Map(input.versions.filter((version) => version.formId === input.formId).map((version) => [version.id, version]))
  const scoped = input.records.filter((record) => record.formId === input.formId && record.organizationId === input.organizationId)
  const filtered = scoped.filter((record) => config.filters.every((filter) => {
    const column = byId.get(filter.columnId)
    if (!column) return false
    const cell = readCell(column, record, versions.get(record.formVersionId) ?? null, input.authors.get(record.createdBy) ?? '')
    return matches(cell, filter)
  }))
  const sorted = [...filtered].sort((left, right) => compareRecords(left, right, config.sort, sortColumn, versions, input.authors))
  const page = sorted.slice(input.offset, input.offset + input.limit)
  return {
    ok: true,
    body: {
      organizationId: input.organizationId,
      formId: input.formId,
      viewId: input.viewId,
      columns: selected,
      rows: page.map((record) => ({
        recordId: record.id,
        formVersionId: record.formVersionId,
        cells: Object.fromEntries(selected.map((column) => [
          column.id,
          projectCell(readCell(column, record, versions.get(record.formVersionId) ?? null, input.authors.get(record.createdBy) ?? '')),
        ])),
      })),
      total: filtered.length,
      offset: input.offset,
      limit: input.limit,
      appliedFilters: config.filters,
      appliedSort: config.sort,
    },
  }
}
