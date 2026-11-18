import { isCalendarDate } from './columns'
import { SYSTEM_COLUMN_IDS, type FilterOp } from './types'

const UTC_DAY_PREFIX = 'utc-day:'

export type CreatedAtClass =
  | { kind: 'utc-day'; day: string }
  | { kind: 'legacy-text' }
  | { kind: 'unsupported' }

/**
 * A calendar day for the system created-at column is explicit.
 * A bare YYYY-MM-DD is the old text filter and is not read as a day.
 * Any other string keeps the previous exact timestamp comparison.
 */
export function classifyCreatedAtValue(value: string): CreatedAtClass {
  if (value.startsWith(UTC_DAY_PREFIX)) {
    const day = value.slice(UTC_DAY_PREFIX.length)
    if (isCalendarDate(day)) return { kind: 'utc-day', day }
    return { kind: 'unsupported' }
  }
  if (isCalendarDate(value)) return { kind: 'unsupported' }
  return { kind: 'legacy-text' }
}

export function createdAtToken(day: string): string {
  return `${UTC_DAY_PREFIX}${day}`
}

export function createdAtDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = classifyCreatedAtValue(value)
  return parsed.kind === 'utc-day' ? parsed.day : null
}

/** Inclusive start and exclusive start of the next UTC day. */
export function utcDayBounds(day: string): { start: string; next: string } | null {
  if (!isCalendarDate(day)) return null
  const [year, month, date] = day.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, date))
  const next = new Date(Date.UTC(year, month - 1, date + 1))
  return { start: start.toISOString(), next: next.toISOString() }
}

export function matchesCreatedAt(timestamp: string, op: FilterOp, expected: string): boolean {
  const parsed = classifyCreatedAtValue(expected)
  if (parsed.kind === 'unsupported') return false
  if (parsed.kind === 'utc-day') {
    const bounds = utcDayBounds(parsed.day)
    if (!bounds) return false
    if (op === 'eq') return timestamp >= bounds.start && timestamp < bounds.next
    if (op === 'gte') return timestamp >= bounds.start
    if (op === 'lte') return timestamp < bounds.next
    return false
  }
  if (op === 'eq') return timestamp === expected
  if (op === 'gte') return timestamp >= expected
  if (op === 'lte') return timestamp <= expected
  return false
}

/**
 * Explicit migration of a stored created-at filter that is only a calendar day.
 * ISO timestamps and other text stay exact comparisons.
 */
export function migrateCreatedAtFilters<T extends { columnId: string; value: unknown }>(
  filters: readonly T[],
): { filters: T[]; changed: boolean } {
  let changed = false
  const next = filters.map((filter) => {
    if (filter.columnId !== SYSTEM_COLUMN_IDS.createdAt || typeof filter.value !== 'string') return filter
    if (!isCalendarDate(filter.value)) return filter
    changed = true
    return { ...filter, value: createdAtToken(filter.value) }
  })
  return { filters: next, changed }
}
