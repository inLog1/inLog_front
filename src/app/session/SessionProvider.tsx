import { useEffect, useRef, type ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { accessApi, useGetSessionAccessQuery } from '../../entities/access/model/accessApi'
import { adminApi } from '../../entities/admin/model/adminSlice'
import { organizationApi } from '../../entities/organization/model/organizationSlice'
import { projectApi } from '../../entities/project/model/projectSlice'
import { taskApi } from '../../entities/task/model/taskSlice'
import { selectSession, sessionActions } from '../../entities/session'
import { userApi } from '../../entities/user/model/userSlice'
import { useVerifyTokenMutation } from '../../features/auth/model/authSlice'
import { registerLogoutHandler, requestLogout } from '../../shared/api/session-events'
import { readAccessToken, writeSessionSubject } from '../../shared/api/session-storage'
import type { AppDispatch } from '../store/store'
import { store } from '../store/store'
import { performLogout } from './perform-logout'
import { releaseQuerySubscriptions, type QuerySubscription } from './query-subscriptions'

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
  const phase = useSelector(selectSession).phase
  const accessState = useSelector(selectSession).accessState
  const [verifyToken] = useVerifyTokenMutation()
  const sessionAccess = useGetSessionAccessQuery(undefined, {
    skip: import.meta.env.VITE_API_MODE !== 'mock' || phase !== 'authenticated',
  })
  const seenAccessVersion = useRef<number | null>(null)

  useEffect(() => {
    const next = sessionAccess.data?.accessState
    if (!next || phase !== 'authenticated' || next === accessState) return
    dispatch(sessionActions.setAccessState(next))
  }, [accessState, dispatch, phase, sessionAccess.data?.accessState])

  useEffect(() => {
    const version = sessionAccess.data?.accessVersion
    if (version == null || phase !== 'authenticated') return
    if (seenAccessVersion.current == null) {
      seenAccessVersion.current = version
      return
    }
    if (seenAccessVersion.current === version) return
    seenAccessVersion.current = version
    dispatch(organizationApi.util.invalidateTags(['Organization']))
    dispatch(projectApi.util.invalidateTags(['Project']))
    dispatch(taskApi.util.invalidateTags(['Tasks', 'Task']))
    dispatch(adminApi.util.invalidateTags(['Nodes', 'Node', 'NodeTabs', 'NodeGroups']))
  }, [dispatch, phase, sessionAccess.data?.accessVersion])

  useEffect(() => {
    registerLogoutHandler(performLogout)
  }, [])

  useEffect(() => {
    let cancelled = false
    const subscriptions: QuerySubscription[] = []
    const track = <T extends QuerySubscription>(query: T): T => {
      subscriptions.push(query)
      return query
    }
    const stamp = store.getState().session.generation
    const current = (token?: string | null) =>
      !cancelled
      && store.getState().session.generation === stamp
      && (token === undefined || readAccessToken() === token)

    async function bootstrap() {
      try {
        dispatch(sessionActions.beginBootstrap())

        if (import.meta.env.VITE_API_MODE === 'mock') {
          try {
            const installation = await track(dispatch(
              accessApi.endpoints.getInstallationStatus.initiate(undefined, { forceRefetch: true }),
            )).unwrap()
            if (!current()) return
            dispatch(sessionActions.setInstallationPhase(installation.phase))
            dispatch(sessionActions.setSchemaMismatch(false))
            dispatch(sessionActions.setMockWriteLocked(installation.writeLocked === true))
            dispatch(sessionActions.setMockWritesUnavailable(installation.writesUnavailable === true))
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
          const user = await track(dispatch(
            userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }),
          )).unwrap()
          if (!current(token)) return

          let accessState: 'ready' | 'pending' | 'blocked' = 'ready'
          if (import.meta.env.VITE_API_MODE === 'mock') {
            const access = await track(dispatch(
              accessApi.endpoints.getSessionAccess.initiate(undefined, { forceRefetch: true }),
            )).unwrap()
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
      } finally {
        releaseQuerySubscriptions(subscriptions)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
      releaseQuerySubscriptions(subscriptions)
    }
  }, [dispatch, epoch, verifyToken])

  useEffect(() => {
    if (import.meta.env.VITE_API_MODE !== 'mock') return
    let active = true
    const refreshLease = () => {
      const query = dispatch(accessApi.endpoints.getInstallationStatus.initiate(undefined, { forceRefetch: true }))
      void query.unwrap().then((installation) => {
        if (!active) return
        dispatch(sessionActions.setMockWriteLocked(installation.writeLocked === true))
        dispatch(sessionActions.setMockWritesUnavailable(installation.writesUnavailable === true))
      }).catch(() => undefined).finally(() => {
        query.unsubscribe()
      })
      if (store.getState().session.phase !== 'authenticated') return
      const access = dispatch(accessApi.endpoints.getSessionAccess.initiate(undefined, { forceRefetch: true }))
      void access.finally(() => {
        access.unsubscribe()
      })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshLease()
    }
    // Shorter than the 60s writer lease, so an open tab keeps the lock and a second tab stays read-only.
    // The same timer re-reads session access. It is not a push channel to other tabs.
    const timer = window.setInterval(refreshLease, 20_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [dispatch])

  return children
}
