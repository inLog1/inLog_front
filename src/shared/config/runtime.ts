export type ApiMode = 'mock' | 'live'
export type AuthMode = 'local' | 'sso' | 'mixed'

export const MOCK_API_PREFIX = '/mock-api/'
export const MOCK_DATA_NAMESPACE = 'inlog:mock:corporate-v2'
export const LIVE_DATA_NAMESPACE = 'live'

export function getApiMode(): ApiMode {
  return import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'live'
}

export function getConfiguredAuthMode(): AuthMode {
  const value = import.meta.env.VITE_AUTH_MODE
  if (value === 'local' || value === 'sso' || value === 'mixed') return value
  return 'local'
}

export function getLiveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (typeof configured === 'string' && configured.trim()) {
    return configured.endsWith('/') ? configured : `${configured}/`
  }
  return 'http://localhost:8000/'
}

export function getApiBaseUrl(): string {
  if (getApiMode() === 'mock') return MOCK_API_PREFIX
  return getLiveApiBaseUrl()
}

export function getSsoStartUrl(): string | null {
  const value = import.meta.env.VITE_SSO_START_URL
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getSsoProviderLabel(): string {
  const value = import.meta.env.VITE_SSO_PROVIDER_LABEL
  if (typeof value === 'string' && value.trim()) return value.trim()
  return 'Corporate account'
}
