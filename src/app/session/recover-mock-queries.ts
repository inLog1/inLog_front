import { registeredApis } from '../store/api-registry'
import { shouldRecoverMockQuery } from '../../shared/api/mock-worker-wake'

type QueryEntry = {
  status?: string
  endpointName?: string
  originalArgs?: unknown
  error?: { status?: unknown }
}

type Endpoint = {
  initiate: (args: unknown, options: { forceRefetch: boolean; subscribe: false }) => unknown
}

/**
 * Refetches mock reads that failed because the worker stopped intercepting.
 * Subscribed screens keep their last good payload until the new response arrives.
 * Mutations are not in this cache, so a failed save is not sent again.
 */
export function recoverRejectedMockQueries(dispatch: (action: never) => unknown, getState: () => unknown): void {
  const root = getState()
  if (!root || typeof root !== 'object') return
  const slices = root as Record<string, { queries?: Record<string, QueryEntry | undefined> } | undefined>
  for (const api of registeredApis) {
    const queries = slices[api.reducerPath]?.queries
    if (!queries) continue
    const endpoints = api.endpoints as Record<string, Endpoint | undefined>
    for (const query of Object.values(queries)) {
      if (!query || query.status !== 'rejected' || !shouldRecoverMockQuery(query.error?.status)) continue
      const endpoint = query.endpointName ? endpoints[query.endpointName] : undefined
      if (!endpoint) continue
      const started = dispatch(endpoint.initiate(query.originalArgs, { forceRefetch: true, subscribe: false }) as never)
      if (started && typeof started === 'object' && 'unsubscribe' in started) {
        const unsubscribe = (started as { unsubscribe?: unknown }).unsubscribe
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    }
  }
}
