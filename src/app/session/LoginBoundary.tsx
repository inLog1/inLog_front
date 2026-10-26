import type { ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectSession } from '../../entities/session'
import { routes } from '../../shared/lib/routes'
import { InstallationRequiredScreen, SchemaMismatchScreen, SessionSpinner } from './SessionScreens'

export function LoginBoundary({ children }: { children: ReactNode }) {
  const session = useSelector(selectSession)

  if (session.schemaMismatch) return <SchemaMismatchScreen />
  if (session.installationPhase === 'uninitialized') return <InstallationRequiredScreen />
  if (session.phase === 'unknown' || session.phase === 'loading') return <SessionSpinner />
  if (session.phase === 'authenticated') return <Navigate to={routes.dashboard()} replace />
  return children
}
