const CREDENTIAL_ENDPOINTS = [
  'auth/login/',
  'auth/registration/',
  'auth/password/reset/',
  'auth/password/reset/confirm/',
  'auth/registration/verify-email/',
  'auth/registration/resend-email/',
  'auth/mock-sso/complete/',
  'auth/dev/switch/',
]

export function normalizeEndpoint(url: string): string {
  const withoutQuery = url.split('?')[0] ?? url
  const mockMarker = '/mock-api/'
  const mockIndex = withoutQuery.indexOf(mockMarker)
  const relative = mockIndex >= 0
    ? withoutQuery.slice(mockIndex + mockMarker.length)
    : withoutQuery.replace(/^https?:\/\/[^/]+\/?/, '').replace(/^\/+/, '')
  const stripped = relative.replace(/^api\//, '')
  return stripped.endsWith('/') ? stripped : `${stripped}/`
}

export function isCredentialEndpoint(url: string): boolean {
  const relative = normalizeEndpoint(url)
  return CREDENTIAL_ENDPOINTS.some((endpoint) => relative === endpoint || relative.endsWith(endpoint))
}

export type HttpFailure = 'credential' | 'expired' | 'forbidden' | 'network' | 'server' | 'other'

export function classifyHttpFailure(url: string, status: number | string): HttpFailure {
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || status === 'PARSING_ERROR') {
    return status === 'PARSING_ERROR' ? 'other' : 'network'
  }
  if (status === 401) return isCredentialEndpoint(url) ? 'credential' : 'expired'
  if (status === 403) return 'forbidden'
  if (typeof status === 'number' && status >= 500) return 'server'
  return 'other'
}

export function shouldLogoutOnStatus(url: string, status: number): boolean {
  return status === 401 && !isCredentialEndpoint(url)
}

export function requestUrl(args: unknown): string {
  if (typeof args === 'string') return args
  if (args && typeof args === 'object' && 'url' in args) {
    const url = (args as { url?: unknown }).url
    return typeof url === 'string' ? url : ''
  }
  return ''
}
