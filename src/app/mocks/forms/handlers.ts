import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  createForm,
  createRecord,
  listForms,
  listRecords,
  publishForm,
  readDraft,
  readPublished,
  readRecord,
  saveDraft,
} from './service'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

export const formHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/forms/`, async ({ request }) => {
    const ready = await load('forms/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listForms(ready, bearer(request), organizationId))
  }),
  http.post(`${MOCK_PREFIX}/forms/`, async ({ request }) => {
    const body = await readJson(request)
    return commit((state) => createForm(state, bearer(request), body))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/draft/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/draft/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readDraft(ready, bearer(request), organizationId, String(params.formId)))
  }),
  http.put(`${MOCK_PREFIX}/forms/:formId/draft/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => saveDraft(state, bearer(request), String(params.formId), body))
  }),
  http.post(`${MOCK_PREFIX}/forms/:formId/publish/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => publishForm(state, bearer(request), String(params.formId), body))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/published/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/published/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readPublished(ready, bearer(request), organizationId, String(params.formId)))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/records/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/records/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listRecords(ready, bearer(request), organizationId, String(params.formId)))
  }),
  http.post(`${MOCK_PREFIX}/forms/:formId/records/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => createRecord(state, bearer(request), String(params.formId), body))
  }),
  http.get(`${MOCK_PREFIX}/forms/:formId/records/:recordId/`, async ({ request, params }) => {
    const ready = await load('forms/:formId/records/:recordId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readRecord(ready, bearer(request), organizationId, String(params.formId), String(params.recordId)))
  }),
]
