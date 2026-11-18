import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  columnCatalog,
  createTableView,
  deleteTableView,
  listTableViews,
  previewTableRows,
  queryTableRows,
  readTableView,
  updateTableView,
} from './service'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

export const tableViewHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/forms/:formId/columns/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/columns/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(columnCatalog(ready, bearer(request), organizationId, String(params.formId)))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/table-views/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/table-views/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listTableViews(ready, bearer(request), organizationId, String(params.formId)))
  }),
  http.post(`${MOCK_PREFIX}/forms/:formId/table-views/preview/`, async ({ request, params }) => {
    const body = await readJson(request)
    const ready = await load('forms/:formId/table-views/preview/')
    if (ready instanceof Response) return ready
    return reply(previewTableRows(ready, bearer(request), String(params.formId), body))
  }),
  http.post(`${MOCK_PREFIX}/forms/:formId/table-views/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => createTableView(state, bearer(request), String(params.formId), body))
  }),
  http.post(`${MOCK_PREFIX}/forms/:formId/table-views/:viewId/rows/`, async ({ request, params }) => {
    const body = await readJson(request)
    const ready = await load('forms/:formId/table-views/:viewId/rows/')
    if (ready instanceof Response) return ready
    return reply(queryTableRows(ready, bearer(request), String(params.formId), String(params.viewId), body))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/table-views/:viewId/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/table-views/:viewId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readTableView(ready, bearer(request), organizationId, String(params.formId), String(params.viewId)))
  }),
  http.put(`${MOCK_PREFIX}/forms/:formId/table-views/:viewId/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => updateTableView(state, bearer(request), String(params.formId), String(params.viewId), body))
  }),
  http.delete(`${MOCK_PREFIX}/forms/:formId/table-views/:viewId/`, async ({ request, params }) => {
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return commit((state) => deleteTableView(state, bearer(request), organizationId, String(params.formId), String(params.viewId)))
  }),
]
