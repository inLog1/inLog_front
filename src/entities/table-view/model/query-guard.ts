import type { TableQueryResponse, ViewFilter, ViewSort } from './types'

export type ExpectedTableResponse = {
  organizationId: number
  formId: string
  viewId: string | null
  offset: number
  limit: number
  filters: readonly ViewFilter[]
  sort: ViewSort
  columns: readonly string[]
}

/**
 * A late response is kept only when it is the request currently on screen.
 * A payload for another form, organization, page or filter set is ignored.
 */
export function acceptTableResponse(expected: ExpectedTableResponse, response: TableQueryResponse): boolean {
  return response.organizationId === expected.organizationId
    && response.formId === expected.formId
    && response.viewId === expected.viewId
    && response.offset === expected.offset
    && response.limit === expected.limit
    && JSON.stringify(response.appliedFilters) === JSON.stringify(expected.filters)
    && response.appliedSort.columnId === expected.sort.columnId
    && response.appliedSort.direction === expected.sort.direction
    && response.columns.map((column) => column.id).join('\n') === expected.columns.join('\n')
}
