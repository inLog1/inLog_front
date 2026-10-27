import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { selectSession } from '../../entities/session'
import { sanitizeReturnTo } from '../../shared/api/return-to'
import { searchWithoutWorkspace } from '../../features/org-project-selector/model/workspace-context'
import { routes } from '../../shared/lib/routes'
import {
  BlockedAccessScreen,
  InstallationRequiredScreen,
  PendingAccessScreen,
  SchemaMismatchScreen,
  SessionErrorScreen,
  SessionSpinner,
} from './SessionScreens'

export function RequireWorkspace() {
  const session = useSelector(selectSession)
  const location = useLocation()
  const navigate = useNavigate()
  const omitWorkspace = useRef(false)

  useEffect(() => {
    if (session.phase === 'authenticated') {
      omitWorkspace.current = false
      return
    }
    if (session.omitWorkspaceReturn) omitWorkspace.current = true
    if (session.schemaMismatch || session.installationPhase === 'uninitialized') return
    if (session.phase !== 'anonymous') return
    const search = omitWorkspace.current ? searchWithoutWorkspace(location.search) : location.search
    const returnTo = sanitizeReturnTo(`${location.pathname}${search}`)
    const target = returnTo
      ? `${routes.login()}?returnTo=${encodeURIComponent(returnTo)}`
      : routes.login()
    navigate(target, { replace: true })
  }, [location.pathname, location.search, navigate, session.installationPhase, session.omitWorkspaceReturn, session.phase, session.schemaMismatch])

  if (session.schemaMismatch) return <SchemaMismatchScreen />
  if (session.installationPhase === 'uninitialized') return <InstallationRequiredScreen />
  if (session.phase === 'unknown' || session.phase === 'loading') return <SessionSpinner />
  if (session.phase === 'error') return <SessionErrorScreen />
  if (session.phase === 'anonymous') return <SessionSpinner />
  if (session.accessState === 'pending') return <PendingAccessScreen />
  if (session.accessState === 'blocked') return <BlockedAccessScreen />
  if (session.accessState !== 'ready') return <SessionSpinner />

  return <Outlet />
}
