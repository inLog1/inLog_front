import { http, passthrough, type HttpHandler } from 'msw'
import { accessHandlers } from './access/handlers'
import { authHandlers } from './auth/handlers'
import { constructorHandlers } from './constructor/handlers'
import { formHandlers } from './forms/handlers'
import { guardOutboundRequest } from './outbound-guard'
import { json, MOCK_PREFIX } from './http'
import { notificationHandlers } from './notifications/handlers'
import { reportHandlers } from './reports/handlers'
import { taskHandlers } from './tasks/handlers'

export const handlers: HttpHandler[] = [
  ...accessHandlers,
  ...authHandlers,
  ...taskHandlers,
  ...constructorHandlers,
  ...formHandlers,
  ...reportHandlers,
  ...notificationHandlers,
  http.all(`${MOCK_PREFIX}/*`, () => json({
    code: 'mock_coverage_gap',
    detail: 'This legacy endpoint has no mock handler yet.',
  }, 501)),
  http.all('*', ({ request }) => {
    const blocked = guardOutboundRequest(request)
    if (blocked) return blocked
    return passthrough()
  }),
]
