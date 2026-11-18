import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useGetInstallationStatusQuery } from '../../entities/access'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { selectSession, sessionActions } from '../../entities/session'
import { requestLogout } from '../../shared/api/session-events'
import { routes } from '../../shared/lib/routes'
import { Button } from '../../shared/ui/button'
import { AuthTopBar } from '../../widgets/auth-layout/ui/AuthTopBar'
import type { AppDispatch } from '../store/store'

function Frame({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="auth-stage flex min-h-screen flex-col">
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-8 text-[var(--auth-text)] shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--auth-muted)]">{text}</p>
        <div className="mt-6 flex flex-wrap gap-3">{children}</div>
      </section>
      </div>
    </div>
  )
}

export function SessionSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <span className="sr-only">{t('login-page.loading-session')}</span>
    </div>
  )
}

export function PendingAccessScreen() {
  const { t } = useTranslation()
  return (
    <Frame title={t('login-page.pending-title')} text={t('login-page.pending-text')}>
      <Button type="button" onClick={() => void requestLogout({ reason: 'user', callApi: true })}>
        {t('login-page.logout')}
      </Button>
      <Button
        variant="outline"
        className="border-[var(--auth-border)] bg-[var(--auth-card)] text-[var(--auth-text)] hover:bg-[var(--color-accent)] hover:text-[var(--auth-text)]"
        asChild
      >
        <Link to={routes.passwordRecovery()}>{t('login-page.help')}</Link>
      </Button>
    </Frame>
  )
}

export function BlockedAccessScreen() {
  const { t } = useTranslation()
  return (
    <Frame title={t('login-page.blocked-title')} text={t('login-page.blocked-text')}>
      <Button type="button" onClick={() => void requestLogout({ reason: 'user', callApi: true })}>
        {t('login-page.logout')}
      </Button>
    </Frame>
  )
}

const InstallationSetupForm = import.meta.env.VITE_API_MODE === 'mock'
  ? lazy(() => import('../../features/installation-setup/ui/InstallationSetupForm'))
  : null

export function InstallationRequiredScreen() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const status = useGetInstallationStatusQuery(undefined, {
    skip: import.meta.env.VITE_API_MODE !== 'mock',
  })
  useEffect(() => {
    const phase = status.data?.phase
    if (phase === 'ready' || phase === 'uninitialized') {
      dispatch(sessionActions.setInstallationPhase(phase))
    }
  }, [dispatch, status.data?.phase])
  if (InstallationSetupForm && status.isLoading) return <SessionSpinner />
  if (InstallationSetupForm && status.data?.needsOwner) {
    return (
      <Suspense fallback={<SessionSpinner />}>
        <InstallationSetupForm />
      </Suspense>
    )
  }
  return (
    <Frame title={t('login-page.installation-title')} text={t('login-page.installation-text')} />
  )
}

export function SessionErrorScreen() {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const error = useSelector(selectSession).error
  return (
    <Frame title={t('login-page.session-error-title')} text={t(error === 'server' ? 'login-page.server' : 'login-page.network')}>
      <Button type="button" onClick={() => dispatch(sessionActions.bumpEpoch())}>
        {t('login-page.retry')}
      </Button>
    </Frame>
  )
}

export function SchemaMismatchScreen() {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const [resetError, setResetError] = useState<string | null>(null)

  const resetNamespace = async () => {
    if (import.meta.env.VITE_API_MODE !== 'mock') return
    if (!window.confirm(t('dev-panel.reset-confirm'))) return
    setResetError(null)
    const response = await fetch('/mock-api/auth/dev/reset/', { method: 'POST' })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : null
      setResetError(t(code === 'mock_writer_held' ? 'dev-panel.reset-blocked' : 'dev-panel.reset-failed'))
      return
    }
    await requestLogout({ reason: 'reset', callApi: false })
    dispatch(sessionActions.bumpEpoch())
  }

  return (
    <Frame title={t('login-page.schema-title')} text={t('login-page.schema-text')}>
      {import.meta.env.VITE_API_MODE === 'mock' && (
        <Button type="button" onClick={() => void resetNamespace()}>
          {t('dev-panel.reset')}
        </Button>
      )}
      {resetError && <p className="mt-3 text-sm text-[var(--auth-muted)]" role="status">{resetError}</p>}
    </Frame>
  )
}
