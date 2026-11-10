import { http, HttpResponse, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  createRequest,
  deleteRequestBasis,
  approveRequestProgram,
  deriveRequest,
  listExecutorLaboratories,
  listRequestCatalog,
  listRequests,
  readRequest,
  readRequestBasisContent,
  rejectRequest,
  returnRequest,
  returnRequestProgram,
  saveRequestProgram,
  sendRequest,
  submitRequestProgram,
  startRequestReview,
  updateRequest,
  uploadRequestBasis,
  withdrawRequest,
} from './service'

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
  http.post(`${MOCK_PREFIX}/requests/:requestId/basis/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/basis/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    const form = await request.formData()
    const entry = form.get('file')
    if (!(entry instanceof File)) return json({ code: 'invalid_file' }, 400)
    const bytes = new Uint8Array(await entry.arrayBuffer())
    return commit((state) => uploadRequestBasis(state, bearer(request), String(params.requestId), organizationId, {
      filename: entry.name,
      mimeType: entry.type,
      bytes,
    }))
  }),
  http.delete(`${MOCK_PREFIX}/requests/:requestId/basis/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/basis/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return commit((state) => deleteRequestBasis(state, bearer(request), String(params.requestId), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/requests/:requestId/basis/:fileId/content/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/basis/:fileId/content/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    const result = readRequestBasisContent(ready, bearer(request), String(params.requestId), String(params.fileId), organizationId)
    if (result.status !== 200 || !result.bytes) return reply(result)
    return new HttpResponse(result.bytes, {
      status: 200,
      headers: { 'Content-Type': result.mimeType || 'application/octet-stream' },
    })
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/send/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/send/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => sendRequest(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/review/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/review/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => startRequestReview(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/return/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/return/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => returnRequest(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/reject/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/reject/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => rejectRequest(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/withdraw/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/withdraw/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => withdrawRequest(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/derive/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/derive/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => deriveRequest(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/program/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/program/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => saveRequestProgram(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/program/submit/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/program/submit/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => submitRequestProgram(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/program/approve/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/program/approve/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => approveRequestProgram(state, bearer(request), String(params.requestId), body))
  }),
  http.post(`${MOCK_PREFIX}/requests/:requestId/program/return/`, async ({ request, params }) => {
    const ready = await load('requests/:requestId/program/return/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => returnRequestProgram(state, bearer(request), String(params.requestId), body))
  }),
]
