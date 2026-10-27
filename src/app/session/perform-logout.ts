import { toast } from 'sonner'
import { t } from 'i18next'
import { stopNotificationSocket } from '../../entities/notification/model/socket-control'
import { invalidateAuthAttempts, sessionActions } from '../../entities/session'
import { getApiBaseUrl } from '../../shared/config/runtime'
import type { LogoutRequest } from '../../shared/api/session-events'
import { clearSession, clearSessionDrafts, readAccessToken } from '../../shared/api/session-storage'
import { store } from '../store/store'
import { resetAllApiCaches } from '../store/api-registry'

export async function performLogout(request: LogoutRequest) {
  store.dispatch(sessionActions.advanceGeneration())
  const generation = store.getState().session.generation
  invalidateAuthAttempts()
  const token = readAccessToken()
  clearSession()
  clearSessionDrafts()
  stopNotificationSocket()
  resetAllApiCaches(store.dispatch)

  if (store.getState().session.generation !== generation) return

  if (request.reason === 'switch' || request.reason === 'preset') {
    store.dispatch(sessionActions.beginBootstrap())
  } else {
    if (request.reason === 'user') store.dispatch(sessionActions.noteUserLogout())
    store.dispatch(sessionActions.setAnonymous())
  }

  if (request.reason === 'expired') {
    toast.error(t('errors.session-expired'))
  }

  if (request.callApi === false || !token || request.reason !== 'user') return

  try {
    await fetch(`${getApiBaseUrl()}auth/logout/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // The remote call is best-effort and uses the token captured before local cleanup.
  }
}
