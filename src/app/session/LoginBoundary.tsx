import { useEffect, type ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectSession, sessionActions } from '../../entities/session'
import { routes } from '../../shared/lib/routes'
import { InstallationRequiredScreen, SchemaMismatchScreen, SessionSpinner } from './SessionScreens'

export function LoginBoundary({ children }: { children: ReactNode }) {
  const session = useSelector(selectSession)
  const dispatch = useDispatch()

  useEffect(() => {
    if (session.omitWorkspaceReturn) dispatch(sessionActions.clearWorkspaceReturnOmission())
  }, [dispatch, session.omitWorkspaceReturn])

  if (session.schemaMismatch) return <SchemaMismatchScreen />
  if (session.installationPhase === 'uninitialized') return <InstallationRequiredScreen />
  if (session.phase === 'unknown' || session.phase === 'loading') return <SessionSpinner />
  if (session.phase === 'authenticated') return <Navigate to={routes.dashboard()} replace />
  return children
}
