/** Fired when a new worker takes control of this page. */
export const MOCK_WORKER_WAKE_EVENT = 'inlog-mock-worker'

type Wake = () => Promise<void> | void

let wake: Wake = () => undefined

/** The mock browser registers this. Live mode leaves it as a no-op. */
export function registerMockWorkerWake(next: Wake): void {
  wake = next
}

export function wakeMockWorker(): Promise<void> {
  return Promise.resolve(wake())
}

/** Queries and HEAD reads. Mutations are not replayed: a second POST would write twice. */
export function isReadRequest(args: unknown): boolean {
  if (typeof args === 'string') return true
  if (!args || typeof args !== 'object' || !('method' in args)) return true
  const method = (args as { method?: unknown }).method
  if (typeof method !== 'string' || method.length === 0) return true
  const normalized = method.toUpperCase()
  return normalized === 'GET' || normalized === 'HEAD'
}

export function looksLikeMarkup(value: unknown): boolean {
  return typeof value === 'string' && /^\s*</.test(value)
}

/**
 * The service worker restarted and forgot this page, so the request hit the
 * static host and came back as a document. A real mock error is JSON.
 */
export function responseBypassedWorker(result: {
  data?: unknown
  error?: { status?: unknown; data?: unknown }
}): boolean {
  if (looksLikeMarkup(result.data)) return true
  const error = result.error
  if (!error) return false
  if (error.status === 'PARSING_ERROR') return true
  return typeof error.status === 'number' && looksLikeMarkup(error.data)
}

/** A failed read worth another attempt after the worker is asked to mock again. */
export function shouldRecoverMockQuery(status: unknown): boolean {
  return status === 'PARSING_ERROR' || status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR'
}
