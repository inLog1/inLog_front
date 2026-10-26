import { useEffect, type ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { accessApi } from '../../entities/access/model/accessApi'
import { selectSession, sessionActions } from '../../entities/session'
import { userApi } from '../../entities/user/model/userSlice'
import { useVerifyTokenMutation } from '../../features/auth/model/authSlice'
import { registerLogoutHandler, requestLogout } from '../../shared/api/session-events'
import { readAccessToken, writeSessionSubject } from '../../shared/api/session-storage'
import type { AppDispatch } from '../store/store'
import { store } from '../store/store'
import { performLogout } from './perform-logout'

function isFetchError(error: unknown): error is FetchBaseQueryError {
  return Boolean(error) && typeof error === 'object' && error != null && 'status' in error
}

function errorCode(error: unknown): string | null {
  if (!isFetchError(error) || typeof error.data !== 'object' || error.data == null) return null
  const code = (error.data as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const epoch = useSelector(selectSession).epoch
  const [verifyToken] = useVerifyTokenMutation()

  useEffect(() => {
    registerLogoutHandler(performLogout)
  }, [])

  useEffect(() => {
    let cancelled = false
    const stamp = store.getState().session.generation
    const current = (token?: string | null) =>
      !cancelled
      && store.getState().session.generation === stamp
      && (token === undefined || readAccessToken() === token)

    async function bootstrap() {
      dispatch(sessionActions.beginBootstrap())

      if (import.meta.env.VITE_API_MODE === 'mock') {
        try {
          const installation = await dispatch(
            accessApi.endpoints.getInstallationStatus.initiate(undefined, { forceRefetch: true }),
          ).unwrap()
          if (!current()) return
          dispatch(sessionActions.setInstallationPhase(installation.phase))
          dispatch(sessionActions.setSchemaMismatch(false))
        } catch (error) {
          if (!current()) return
          if (errorCode(error) === 'schema_mismatch') {
            dispatch(sessionActions.setSchemaMismatch(true))
            dispatch(sessionActions.setAnonymous())
            return
          }
          const status = isFetchError(error) ? error.status : undefined
          dispatch(sessionActions.setBootstrapError(status === 'FETCH_ERROR' ? 'network' : 'server'))
          return
        }
      } else {
        if (!current()) return
        dispatch(sessionActions.setInstallationPhase('ready'))
        dispatch(sessionActions.setSchemaMismatch(false))
      }

      const token = readAccessToken()
      if (!token) {
        if (current()) dispatch(sessionActions.setAnonymous())
        return
      }

      try {
        await verifyToken({ token }).unwrap()
        if (!current(token)) return
        const user = await dispatch(
          userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }),
        ).unwrap()
        if (!current(token)) return

        let accessState: 'ready' | 'pending' | 'blocked' = 'ready'
        if (import.meta.env.VITE_API_MODE === 'mock') {
          const access = await dispatch(
            accessApi.endpoints.getSessionAccess.initiate(undefined, { forceRefetch: true }),
          ).unwrap()
          if (!current(token)) return
          accessState = access.accessState
        }
        if (typeof user.id === 'number') writeSessionSubject(user.id)
        dispatch(sessionActions.setAuthenticated({
          subjectId: typeof user.id === 'number' ? user.id : null,
          accessState,
        }))
      } catch (error) {
        if (!current(token)) return
        const status = isFetchError(error) ? error.status : undefined
        if (status === 401 || errorCode(error) === 'stale_session') {
          if (status === 401) await requestLogout({ reason: 'expired', callApi: false, navigate: true })
          return
        }
        if (!current(token)) return
        dispatch(sessionActions.setBootstrapError(status === 'FETCH_ERROR' ? 'network' : 'server'))
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [dispatch, epoch, verifyToken])

  return children
}
