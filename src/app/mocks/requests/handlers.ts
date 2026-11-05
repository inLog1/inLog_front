import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import { createRequest, listExecutorLaboratories, listRequestCatalog, listRequests, readRequest, updateRequest } from './service'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

export const requestHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/requests/catalog/`, async ({ request }) => {
    const ready = await load('requests/catalog/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listRequestCatalog(ready, bearer(request), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/requests/laboratories/`, async ({ request }) => {
    const ready = await load('requests/laboratories/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listExecutorLaboratories(ready, bearer(request), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/requests/`, async ({ request }) => {
    const ready = await load('requests/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listRequests(ready, bearer(request), organizationId))
  }),
  http.post(`${MOCK_PREFIX}/requests/`, async ({ request }) => {
    const body = await readJson(request)
    return commit((state) => createRequest(state, bearer(request), body))
  }),
  http.get(`${MOCK_PREFIX}/requests/:requestId/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readRequest(ready, bearer(request), organizationId, String(params.requestId)))
  }),
  http.patch(`${MOCK_PREFIX}/requests/:requestId/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => updateRequest(state, bearer(request), String(params.requestId), body))
  }),
]
