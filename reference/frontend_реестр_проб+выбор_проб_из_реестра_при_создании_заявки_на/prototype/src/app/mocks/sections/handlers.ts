import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  createSection,
  listSections,
  publishSection,
  readDraft,
  readPreview,
  readPublished,
  saveDraft,
  sectionNavigation,
  sectionOptions,
  unpublishSection,
} from './service'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

export const sectionHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/sections/navigation/`, async ({ request }) => {
    const ready = await load('sections/navigation/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(sectionNavigation(ready, bearer(request), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/sections/options/`, async ({ request }) => {
    const ready = await load('sections/options/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(sectionOptions(ready, bearer(request), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/sections/`, async ({ request }) => {
    const ready = await load('sections/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listSections(ready, bearer(request), organizationId))
  }),
  http.post(`${MOCK_PREFIX}/sections/`, async ({ request }) => {
    const body = await readJson(request)
    return commit((state) => createSection(state, bearer(request), body))
  }),
  http.get(`${MOCK_PREFIX}/sections/:sectionId/draft/`, async ({ request, params }) => {
    const ready = await load('sections/:sectionId/draft/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readDraft(ready, bearer(request), organizationId, String(params.sectionId)))
  }),
  http.put(`${MOCK_PREFIX}/sections/:sectionId/draft/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => saveDraft(state, bearer(request), String(params.sectionId), body))
  }),
  http.post(`${MOCK_PREFIX}/sections/:sectionId/publish/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => publishSection(state, bearer(request), String(params.sectionId), body))
  }),
  http.post(`${MOCK_PREFIX}/sections/:sectionId/unpublish/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => unpublishSection(state, bearer(request), String(params.sectionId), body))
  }),
  http.get(`${MOCK_PREFIX}/sections/:sectionId/preview/`, async ({ request, params }) => {
    const ready = await load('sections/:sectionId/preview/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readPreview(ready, bearer(request), organizationId, String(params.sectionId)))
  }),
  http.get(`${MOCK_PREFIX}/sections/:sectionId/`, async ({ request, params }) => {
    const ready = await load('sections/:sectionId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readPublished(ready, bearer(request), organizationId, String(params.sectionId)))
  }),
]
