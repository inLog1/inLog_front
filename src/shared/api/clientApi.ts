import { fetchBaseQuery } from '@reduxjs/toolkit/query'
import { getApiBaseUrl } from '../config/runtime'
import { classifyHttpFailure, requestUrl, shouldLogoutOnStatus } from './endpoint-policy'
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

export const baseQuery: typeof baseQueryStart = async (args, api, extraOptions) => {
  const tokenAtStart = readAccessToken()
  const result = await baseQueryStart(args, api, extraOptions)
  if (readAccessToken() !== tokenAtStart) {
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
