import { platformApi } from '../../../shared/api/platformApi'
import type { CatalogColumn, TableQueryResponse, TableViewConfig, TableViewDetail, TableViewSummary, ViewFilter, ViewSort } from './types'

export type TableViewListResponse = { views: TableViewSummary[] }
export type ColumnCatalogResponse = { columns: CatalogColumn[] }

export type SaveTableViewBody = {
  organizationId: number
  formId: string
  viewId?: string
  expectedRevision?: number
  schemaVersion: number
  title: string
  description: string
  columns: string[]
  filters: ViewFilter[]
  sort: ViewSort
  pageSize: number
}

export type TableRowsArg = {
  organizationId: number
  formId: string
  viewId: string
  offset: number
  limit: number
  filters?: ViewFilter[]
  sort?: ViewSort
}

export type PreviewTableArg = {
  organizationId: number
  formId: string
  schemaVersion: number
  columns: string[]
  filters: ViewFilter[]
  sort: ViewSort
  pageSize: number
  offset: number
  limit: number
}

/**
 * Proposed mock contract. Pages call these hooks only when tableViewsMode is mock.
 * Preview does not invalidate the saved view.
 */
export const tableViewApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getTableViews: build.query<TableViewListResponse, { organizationId: number; formId: string }>({
      query: ({ organizationId, formId }) => `forms/${formId}/table-views/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'TableViews', id: `list-${arg.formId}` }],
    }),
    getTableView: build.query<TableViewDetail, { organizationId: number; formId: string; viewId: string }>({
      query: ({ organizationId, formId, viewId }) => `forms/${formId}/table-views/${viewId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'TableViews', id: arg.viewId }],
    }),
    getColumnCatalog: build.query<ColumnCatalogResponse, { organizationId: number; formId: string }>({
      query: ({ organizationId, formId }) => `forms/${formId}/columns/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'TableViews', id: `columns-${arg.formId}` }],
    }),
    createTableView: build.mutation<TableViewDetail, SaveTableViewBody>({
      query: ({ formId, ...body }) => ({ url: `forms/${formId}/table-views/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'TableViews', id: `list-${arg.formId}` }],
    }),
    updateTableView: build.mutation<TableViewDetail, SaveTableViewBody & { viewId: string; expectedRevision: number }>({
      query: ({ formId, viewId, ...body }) => ({ url: `forms/${formId}/table-views/${viewId}/`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'TableViews', id: arg.viewId },
        { type: 'TableViews', id: `list-${arg.formId}` },
        { type: 'TableViews', id: `rows-${arg.formId}` },
      ],
    }),
    deleteTableView: build.mutation<{ id: string }, { organizationId: number; formId: string; viewId: string }>({
      query: ({ formId, viewId, organizationId }) => ({
        url: `forms/${formId}/table-views/${viewId}/?organization=${organizationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'TableViews', id: `list-${arg.formId}` },
        { type: 'TableViews', id: arg.viewId },
      ],
    }),
    queryTableRows: build.query<TableQueryResponse, TableRowsArg>({
      query: ({ formId, viewId, ...body }) => ({
        url: `forms/${formId}/table-views/${viewId}/rows/`,
        method: 'POST',
        body,
      }),
      providesTags: (_result, _error, arg) => [{ type: 'TableViews', id: `rows-${arg.formId}` }],
    }),
    previewTable: build.mutation<TableQueryResponse, PreviewTableArg>({
      query: ({ formId, ...body }) => ({ url: `forms/${formId}/table-views/preview/`, method: 'POST', body }),
    }),
  }),
})

export const {
  useGetTableViewsQuery,
  useGetTableViewQuery,
  useGetColumnCatalogQuery,
  useCreateTableViewMutation,
  useUpdateTableViewMutation,
  useDeleteTableViewMutation,
  useQueryTableRowsQuery,
  usePreviewTableMutation,
} = tableViewApi

export function readTableError(error: unknown): { status: number | null; code: string | null; issues: { code: string; columnId?: string; op?: string }[] } {
  if (!error || typeof error !== 'object') return { status: null, code: null, issues: [] }
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null
  const data = 'data' in error ? error.data : null
  if (!data || typeof data !== 'object') return { status, code: null, issues: [] }
  const code = 'code' in data && typeof data.code === 'string' ? data.code : null
  const rawIssues = 'issues' in data && Array.isArray(data.issues) ? data.issues : []
  const issues = rawIssues.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('code' in item) || typeof item.code !== 'string') return []
    const columnId = 'columnId' in item && typeof item.columnId === 'string' ? item.columnId : undefined
    const op = 'op' in item && typeof item.op === 'string' ? item.op : undefined
    return [{ code: item.code, columnId, op }]
  })
  return { status, code, issues }
}

export type { TableViewConfig }
