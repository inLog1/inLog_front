import { toast } from 'sonner'
import { t } from 'i18next'
import { stopNotificationSocket } from '../../entities/notification/model/socket-control'
import { sessionActions } from '../../entities/session'
import { getApiBaseUrl } from '../../shared/config/runtime'
import type { LogoutRequest } from '../../shared/api/session-events'
import { clearSession, clearSessionDrafts, readAccessToken } from '../../shared/api/session-storage'
import { store } from '../store/store'
import { resetAllApiCaches } from '../store/api-registry'

export async function performLogout(request: LogoutRequest) {
  store.dispatch(sessionActions.advanceGeneration())
  stopNotificationSocket()
  const token = readAccessToken()
  resetAllApiCaches(store.dispatch)

  if (request.callApi !== false && token && request.reason === 'user') {
    try {
      await fetch(`${getApiBaseUrl()}auth/logout/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // Local session still ends when the logout endpoint is unavailable.
    }
  }

  clearSession()
  clearSessionDrafts()

  if (request.reason === 'switch' || request.reason === 'preset') {
    store.dispatch(sessionActions.beginBootstrap())
  } else {
    store.dispatch(sessionActions.setAnonymous())
  }

  if (request.reason === 'expired') {
    toast.error(t('errors.session-expired'))
  }
}
