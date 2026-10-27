import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import { deleteNotification, listNotifications, updateNotification } from './service'

export const notificationHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/notifications/notification/`, async ({ request }) => {
    const ready = await load('notifications/notification/')
    if (ready instanceof Response) return ready
    return reply(listNotifications(ready, bearer(request)))
  }),

  http.patch(`${MOCK_PREFIX}/notifications/notification/:id/`, async ({ request, params }) => {
    const ready = await load('notifications/notification/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateNotification(state, bearer(request), id, body))
  }),

  http.delete(`${MOCK_PREFIX}/notifications/notification/:id/`, async ({ request, params }) => {
    const ready = await load('notifications/notification/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteNotification(state, bearer(request), id))
  }),
]
