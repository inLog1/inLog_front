import { http, type HttpHandler } from 'msw'
import { bearer, json, load, MOCK_PREFIX, positiveId, reply } from '../http'
import { combinedConstructorData } from './service'

export const reportHandlers: HttpHandler[] = [
  http.post(`${MOCK_PREFIX}/organizations/:organizationId/get-combined-constructor-data/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/get-combined-constructor-data/')
    if (ready instanceof Response) return ready
    const organizationId = positiveId(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    let body: unknown = null
    try {
      body = await request.json()
    } catch {
      body = null
    }
    return reply(combinedConstructorData(ready, bearer(request), organizationId, body))
  }),
]
