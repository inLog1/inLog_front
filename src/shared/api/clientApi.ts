import { fetchBaseQuery } from '@reduxjs/toolkit/query'
import { getApiBaseUrl } from '../config/runtime'
import { classifyHttpFailure, requestUrl, sameSessionView, shouldLogoutOnStatus } from './endpoint-policy'
import { isReadRequest, responseBypassedWorker, wakeMockWorker } from './mock-worker-wake'
import { readAccessToken } from './session-storage'
import { requestLogout } from './session-events'

export const baseQueryStart = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers) => {
    const token = readAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

function sessionGeneration(getState: () => unknown): number {
  const state = getState()
  if (!state || typeof state !== 'object' || !('session' in state)) return 0
  const generation = (state as { session?: { generation?: unknown } }).session?.generation
  return typeof generation === 'number' ? generation : 0
}

function unmockedRead() {
  return {
    error: {
      status: 'PARSING_ERROR' as const,
      originalStatus: 200,
      error: 'mock-worker-inactive',
      data: 'mock-worker-inactive',
    },
  }
}

export const baseQuery: typeof baseQueryStart = async (args, api, extraOptions) => {
  const before = { token: readAccessToken(), generation: sessionGeneration(api.getState) }
  let result = await baseQueryStart(args, api, extraOptions)
  if (
    import.meta.env.VITE_API_MODE === 'mock'
    && isReadRequest(args)
    && responseBypassedWorker(result)
  ) {
    await wakeMockWorker()
    result = await baseQueryStart(args, api, extraOptions)
    if (responseBypassedWorker(result)) return unmockedRead()
  }
  const after = { token: readAccessToken(), generation: sessionGeneration(api.getState) }
  if (!sameSessionView(before, after)) {
    return {
      error: {
        status: 'CUSTOM_ERROR',
        error: 'stale-session',
        data: { code: 'stale_session' },
      },
    }
  }
  const url = requestUrl(args)
  const status = result.error?.status

  if (typeof status === 'number' && shouldLogoutOnStatus(url, status)) {
    void requestLogout({ reason: 'expired', callApi: false, navigate: true })
  }

  if (status != null && classifyHttpFailure(url, status) === 'forbidden') {
    return result
  }

  return result
}
