import { fetchBaseQuery, type FetchArgs } from '@reduxjs/toolkit/query'
import { getApiBaseUrl } from './api-base-url'
import { ensureCsrfToken, ensureFreshAccessToken, getAccessToken, redirectToLogin, refreshAccessToken } from './auth-session'

const baseQueryStart = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers) => {
    const token = getAccessToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  },
})

function requestUrl(args: string | FetchArgs) {
  return typeof args === 'string' ? args : args.url
}

function withCsrfHeader(args: string | FetchArgs, token: string): FetchArgs {
  const request = typeof args === 'string' ? { url: args } : args
  const headers = new Headers(request.headers as HeadersInit | undefined)
  headers.set('X-CSRFToken', token)
  return { ...request, headers }
}

function needsCsrfHeader(url: string) {
  return url.includes('auth/login/') || url.includes('auth/logout/')
}

async function attachCsrfHeader(args: string | FetchArgs) {
  if (!needsCsrfHeader(requestUrl(args))) return args
  const csrfToken = await ensureCsrfToken()
  return csrfToken ? withCsrfHeader(args, csrfToken) : args
}

function shouldRecoverSession(url: string) {
  return !['auth/login/', 'auth/token/refresh/', 'auth/registration/'].some((path) =>
    url.includes(path)
  )
}

function isSessionRejected(status: unknown) {
  return status === 401
}

export const baseQuery: typeof baseQueryStart = async (args, api, extraOptions) => {
  const url = requestUrl(args)
  if (shouldRecoverSession(url)) await ensureFreshAccessToken()

  let result = await baseQueryStart(await attachCsrfHeader(args), api, extraOptions)

  if (!isSessionRejected(result.error?.status)) return result

  if (!shouldRecoverSession(url)) return result

  const outcome = await refreshAccessToken()
  if (outcome === 'ok') {
    result = await baseQueryStart(await attachCsrfHeader(args), api, extraOptions)
  }

  if (isSessionRejected(result.error?.status) && outcome !== 'unavailable') {
    redirectToLogin()
  }

  return result
}
