import { fetchBaseQuery } from '@reduxjs/toolkit/query'
import { getApiBaseUrl } from '../config/runtime'
import { classifyHttpFailure, requestUrl, sameSessionView, shouldLogoutOnStatus } from './endpoint-policy'
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

export const baseQuery: typeof baseQueryStart = async (args, api, extraOptions) => {
  const before = { token: readAccessToken(), generation: sessionGeneration(api.getState) }
  const result = await baseQueryStart(args, api, extraOptions)
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
