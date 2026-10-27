import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

export async function startMockWorker() {
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url)
      if (!url.pathname.startsWith('/mock-api/')) return
      print.error()
    },
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
    quiet: true,
  })
}
