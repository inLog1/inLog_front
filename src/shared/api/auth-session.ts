import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { t } from 'i18next'
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config/constants'
import { routes } from '../lib/routes'

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'
type RefreshOutcome = 'ok' | 'unauthorized' | 'unavailable'

type RefreshResponse = {
  access?: string
  access_token?: string
  refresh?: string
  refresh_token?: string
  access_expiration?: string
  access_token_expiration?: string
}

type AuthSession = {
  accessToken: string
  refreshToken?: string | null
  accessTokenExpiration?: string | null
}

let accessToken: string | null = null
let refreshToken: string | null = null
let csrfToken: string | null = null
let csrfInFlight: Promise<string | null> | null = null
let status: AuthStatus = 'unknown'
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let refreshInFlight: Promise<RefreshOutcome> | null = null
let bootstrapPromise: Promise<void> | null = null
let loggingOut = false
let redirecting = false

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return refreshToken
}

export function getCsrfToken() {
  return csrfToken
}

function trackCsrfRequest(request: Promise<string | null>) {
  csrfInFlight = request
  return request.finally(() => {
    if (csrfInFlight === request) csrfInFlight = null
  })
}

async function requestCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}auth/csrf/`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return csrfToken

    const data = (await response.json()) as { csrf_token?: unknown }
    if (typeof data.csrf_token === 'string' && data.csrf_token) {
      csrfToken = data.csrf_token
    }
    return csrfToken
  } catch {
    return csrfToken
  }
}

export function ensureCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken)
  if (csrfInFlight) return csrfInFlight
  return trackCsrfRequest(requestCsrfToken())
}

export function getAuthStatus() {
  return status
}

export function isLoggingOut() {
  return loggingOut
}

export function useAuthStatus() {
  return useSyncExternalStore(subscribeAuth, getAuthStatus, getAuthStatus)
}

export function useAccessToken() {
  return useSyncExternalStore(subscribeAuth, getAccessToken, getAccessToken)
}

function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/'
  return base.endsWith('/') ? base : `${base}/`
}

function readJwtExpiry(token: string) {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(normalized)) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function isExpired(token: string) {
  const expiry = readJwtExpiry(token)
  return expiry != null && expiry <= Date.now()
}

function readStoredToken(key: string) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'string' && parsed ? parsed : null
  } catch {
    return null
  }
}

function purgeLegacyStorage() {
  try {
    localStorage.removeItem(ACCESS_TOKEN)
    localStorage.removeItem(REFRESH_TOKEN)
  } catch {
    // Приватный режим не должен ломать сессию в памяти.
  }
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

function scheduleRefresh(expiresAt: number | null) {
  clearRefreshTimer()
  if (!expiresAt) return

  const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000)
  refreshTimer = setTimeout(() => {
    void refreshAccessToken().then((outcome) => {
      if (outcome === 'unauthorized') redirectToLogin()
      if (outcome === 'unavailable') scheduleRefresh(Date.now() + 90_000)
    })
  }, delay)
}

function applyAccessToken(token: string, expiration?: string | null) {
  accessToken = token
  const parsedExpiration = expiration ? Date.parse(expiration) : NaN
  const expiresAt = Number.isFinite(parsedExpiration) ? parsedExpiration : readJwtExpiry(token)
  status = 'authenticated'
  scheduleRefresh(expiresAt)
  emit()
}

export function setAuthSession({ accessToken: nextAccessToken, refreshToken: nextRefreshToken, accessTokenExpiration }: AuthSession) {
  refreshToken = nextRefreshToken || null
  purgeLegacyStorage()
  applyAccessToken(nextAccessToken, accessTokenExpiration)
}

export function beginLogout() {
  loggingOut = true
}

export function clearAuthSession() {
  accessToken = null
  refreshToken = null
  clearRefreshTimer()
  purgeLegacyStorage()
  status = 'anonymous'
  emit()
}

export function redirectToLogin() {
  if (redirecting || loggingOut) return
  redirecting = true
  clearAuthSession()
  toast.error(t('errors.session-expired'))
  window.location.replace(routes.login())
}

function adoptLegacyRefreshToken() {
  if (refreshToken) return
  refreshToken = readStoredToken(REFRESH_TOKEN)
}

async function requestRefresh(explicitRefresh?: string): Promise<RefreshOutcome> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    const csrf = await ensureCsrfToken()
    if (csrf) headers['X-CSRFToken'] = csrf

    const response = await fetch(`${getApiBaseUrl()}auth/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(explicitRefresh ? { refresh: explicitRefresh } : {}),
    })

    if (response.status === 400 || response.status === 401) return 'unauthorized'
    if (!response.ok) return 'unavailable'

    const data = (await response.json()) as RefreshResponse
    const nextAccess = data.access || data.access_token
    if (!nextAccess) return 'unauthorized'

    if (explicitRefresh) {
      refreshToken = data.refresh || data.refresh_token || explicitRefresh
    } else {
      refreshToken = data.refresh || data.refresh_token || null
    }

    applyAccessToken(nextAccess, data.access_expiration || data.access_token_expiration)
    return 'ok'
  } catch {
    return 'unavailable'
  }
}

async function performRefresh(): Promise<RefreshOutcome> {
  adoptLegacyRefreshToken()

  const cookieResult = await requestRefresh()
  if (cookieResult === 'ok') {
    purgeLegacyStorage()
    return 'ok'
  }

  if (refreshToken && cookieResult !== 'unavailable') {
    const bodyResult = await requestRefresh(refreshToken)
    if (bodyResult === 'ok') purgeLegacyStorage()
    return bodyResult
  }

  if (cookieResult === 'unavailable' && refreshToken) {
    const bodyResult = await requestRefresh(refreshToken)
    if (bodyResult === 'ok') purgeLegacyStorage()
    return bodyResult
  }

  return cookieResult
}

export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export function bootstrapAuth() {
  if (accessToken) {
    status = 'authenticated'
    return Promise.resolve()
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const outcome = await refreshAccessToken()
      if (outcome === 'ok' || accessToken) return

      const legacyAccess = readStoredToken(ACCESS_TOKEN)
      if (legacyAccess && !isExpired(legacyAccess)) {
        applyAccessToken(legacyAccess)
        return
      }

      status = 'anonymous'
      emit()
    })()
  }

  return bootstrapPromise
}
