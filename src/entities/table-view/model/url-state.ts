import { FILTER_OPS, PAGE_SIZES, type FilterOp, type ViewFilter, type ViewSort, type WorkQuery } from './types'

const OPS = new Set<string>(FILTER_OPS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function filterValue(value: unknown): string | number | boolean | null | undefined {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

/**
 * The committed working query lives only in the URL search params.
 * Typing in the filter form is not a query until it is written here.
 * Redux and localStorage are not a second copy.
 * A present but unreadable param is an error, so the saved view is not substituted.
 */
export function readWorkQuery(params: URLSearchParams): { ok: true; work: WorkQuery } | { ok: false; code: 'invalid_work' } {
  const pageRaw = params.get('page')
  let page = 1
  if (pageRaw != null) {
    if (!/^[1-9]\d*$/.test(pageRaw)) return { ok: false, code: 'invalid_work' }
    page = Number(pageRaw)
  }
  const sizeRaw = params.get('size')
  let pageSize: number | null = null
  if (sizeRaw != null) {
    const size = Number(sizeRaw)
    if (!(PAGE_SIZES as readonly number[]).includes(size)) return { ok: false, code: 'invalid_work' }
    pageSize = size
  }
  const sortRaw = params.get('sort')
  let sort: ViewSort | null = null
  if (sortRaw != null) {
    const dot = sortRaw.lastIndexOf('.')
    if (dot <= 0) return { ok: false, code: 'invalid_work' }
    const direction = sortRaw.slice(dot + 1)
    if (direction !== 'asc' && direction !== 'desc') return { ok: false, code: 'invalid_work' }
    let columnId = ''
    try {
      columnId = decodeURIComponent(sortRaw.slice(0, dot))
    } catch {
      return { ok: false, code: 'invalid_work' }
    }
    if (columnId.length === 0) return { ok: false, code: 'invalid_work' }
    sort = { columnId, direction }
  }
  const filtersRaw = params.get('filters')
  let filters: ViewFilter[] | null = null
  if (filtersRaw != null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(filtersRaw)
    } catch {
      return { ok: false, code: 'invalid_work' }
    }
    if (!Array.isArray(parsed)) return { ok: false, code: 'invalid_work' }
    const next: ViewFilter[] = []
    for (const item of parsed) {
      if (!isRecord(item) || Object.keys(item).some((key) => !['columnId', 'op', 'value'].includes(key))) {
        return { ok: false, code: 'invalid_work' }
      }
      if (typeof item.columnId !== 'string' || item.columnId.length === 0) return { ok: false, code: 'invalid_work' }
      if (typeof item.op !== 'string' || !OPS.has(item.op)) return { ok: false, code: 'invalid_work' }
      const value = filterValue(item.value ?? null)
      if (value === undefined) return { ok: false, code: 'invalid_work' }
      next.push({ columnId: item.columnId, op: item.op as FilterOp, value })
    }
    filters = next
  }
  return { ok: true, work: { page, pageSize, sort, filters } }
}

export function sameSort(left: ViewSort, right: ViewSort): boolean {
  return left.columnId === right.columnId && left.direction === right.direction
}

export function sameFilters(left: readonly ViewFilter[], right: readonly ViewFilter[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Writes only the working-query keys and leaves org and other params in place. */
export function writeWorkQuery(
  params: URLSearchParams,
  work: WorkQuery,
  saved: { pageSize: number; sort: ViewSort; filters: readonly ViewFilter[] },
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (work.page <= 1) next.delete('page')
  else next.set('page', String(work.page))
  if (work.pageSize == null || work.pageSize === saved.pageSize) next.delete('size')
  else next.set('size', String(work.pageSize))
  if (work.sort == null || sameSort(work.sort, saved.sort)) next.delete('sort')
  else next.set('sort', `${encodeURIComponent(work.sort.columnId)}.${work.sort.direction}`)
  if (work.filters == null || sameFilters(work.filters, saved.filters)) next.delete('filters')
  else next.set('filters', JSON.stringify(work.filters))
  return next
}

export function workDiffers(
  work: WorkQuery,
  saved: { pageSize: number; sort: ViewSort; filters: readonly ViewFilter[] },
): boolean {
  if (work.pageSize != null && work.pageSize !== saved.pageSize) return true
  if (work.sort != null && !sameSort(work.sort, saved.sort)) return true
  if (work.filters != null && !sameFilters(work.filters, saved.filters)) return true
  return false
}

export function effectiveWork(
  work: WorkQuery,
  saved: { pageSize: number; sort: ViewSort; filters: readonly ViewFilter[] },
): { page: number; pageSize: number; sort: ViewSort; filters: ViewFilter[] } {
  return {
    page: work.page,
    pageSize: work.pageSize ?? saved.pageSize,
    sort: work.sort ?? saved.sort,
    filters: work.filters ?? [...saved.filters],
  }
}
