import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { sessionActions } from '../../../entities/session'
import { getApiMode } from '../../../shared/config/runtime'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { AuthTopBar } from '../../../widgets/auth-layout/ui/AuthTopBar'
import { useCompleteMockSsoMutation, useGetMockIdentitiesQuery } from '../../../features/auth/model/ssoApi'

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('code' in data)) return null
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

const MockProviderPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const mock = getApiMode() === 'mock'
  const identities = useGetMockIdentitiesQuery(undefined, { skip: !mock })
  const [complete, { isLoading }] = useCompleteMockSsoMutation()
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!mock) {
    return (
      <div className="auth-stage flex min-h-screen flex-col">
        <AuthTopBar />
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="max-w-md text-center text-sm" role="alert">{t('login-page.sso-unconfigured')}</p>
        </div>
      </div>
    )
  }

  const identity = identities.data?.find((item) => item.externalSubject === selected)

  const onContinue = async () => {
    if (!identity) return
    setError(null)
    try {
      await complete({ providerId: identity.providerId, externalSubject: identity.externalSubject }).unwrap()
      dispatch(sessionActions.beginBootstrap())
      dispatch(sessionActions.bumpEpoch())
      navigate(routes.dashboard())
    } catch (caught) {
      const code = readCode(caught)
      setError(code === 'blocked' ? t('login-page.blocked') : t('login-page.sso-failed'))
    }
  }

  return (
    <div className="auth-stage flex min-h-screen flex-col">
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-6 text-[var(--auth-text)]">
        <h1 className="text-2xl font-semibold">{t('login-page.mock-provider-title')}</h1>
        <p className="mt-2 text-sm text-[var(--auth-muted)]">{t('login-page.mock-provider-text')}</p>
        <div className="mt-6 space-y-2" role="radiogroup" aria-label={t('login-page.mock-provider-title')}>
          {identities.data?.map((item) => (
            <label key={item.externalSubject} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--auth-border)] p-3">
              <input
                type="radio"
                name="identity"
                value={item.externalSubject}
                checked={selected === item.externalSubject}
                onChange={() => setSelected(item.externalSubject)}
              />
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-[var(--auth-muted)]">
                  {item.email} · {item.externalSubject}
                  {!item.linked ? ` · ${t('login-page.unlinked')}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            className="bg-[var(--auth-primary)] text-white hover:bg-[var(--auth-primary)]/90"
            disabled={!identity || isLoading}
            onClick={() => void onContinue()}
          >
            {t('login-page.continue')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[var(--auth-border)] bg-[var(--auth-card)] text-[var(--auth-text)] hover:bg-[var(--color-accent)] hover:text-[var(--auth-text)]"
            onClick={() => navigate(`${routes.login()}?sso=cancelled`)}
          >
            {t('login-page.cancel')}
          </Button>
        </div>
      </section>
      </div>
    </div>
  )
}

export default MockProviderPage
