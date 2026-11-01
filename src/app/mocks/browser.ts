import { setupWorker } from 'msw/browser'
import { MOCK_WORKER_WAKE_EVENT, registerMockWorkerWake } from '../../shared/api/mock-worker-wake'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

const WAKE_WAIT_MS = 30
let recoveryBound = false

function postActivate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
}

function bindMockWorkerRecovery(): void {
  if (recoveryBound || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  recoveryBound = true
  registerMockWorkerWake(async () => {
    postActivate()
    await new Promise((resolve) => window.setTimeout(resolve, WAKE_WAIT_MS))
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    postActivate()
    window.dispatchEvent(new Event(MOCK_WORKER_WAKE_EVENT))
  })
}

export async function startMockWorker() {
  bindMockWorkerRecovery()
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
