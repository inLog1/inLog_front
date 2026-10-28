import { Eye, EyeOff } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { sessionActions } from '../../../entities/session'
import { platformApi } from '../../../shared/api/platformApi'
import { writeSession } from '../../../shared/api/session-storage'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { AuthTopBar } from '../../../widgets/auth-layout/ui/AuthTopBar'

type SetupResult = {
  configured: boolean
  signedIn: boolean
  access_token?: string
  refresh_token?: string
  user?: { id?: number }
}

const setupApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    configureInstallation: build.mutation<SetupResult, {
      corporationName: string
      givenName: string
      surname: string
      email: string
      password: string
      passwordConfirmation: string
    }>({
      query: (body) => ({ url: 'installation/setup/', method: 'POST', body }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (!data.signedIn || !data.access_token) return
          writeSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            subjectId: typeof data.user?.id === 'number' ? data.user.id : null,
          })
        } catch {
          // The form shows the failure. A saved installation is not created again.
        }
      },
    }),
  }),
})

const { useConfigureInstallationMutation } = setupApi

export function InstallationSetupForm() {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [configure, state] = useConfigureInstallationMutation()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [form, setForm] = useState({
    corporationName: '',
    givenName: '',
    surname: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (form.password !== form.passwordConfirmation) {
      setError(t('validation.password-not-match'))
      return
    }
    try {
      const result = await configure(form).unwrap()
      dispatch(sessionActions.setInstallationPhase('ready'))
      dispatch(sessionActions.beginBootstrap())
      dispatch(sessionActions.bumpEpoch())
      if (result.signedIn) navigate(routes.dashboard())
      else navigate(routes.login())
    } catch (caught) {
      const code = readCode(caught)
      if (code === 'already_configured') {
        dispatch(sessionActions.setInstallationPhase('ready'))
        dispatch(sessionActions.bumpEpoch())
        navigate(routes.login())
        return
      }
      setError(t(code === 'invalid_setup' ? 'installation.invalid' : 'installation.failed'))
    }
  }

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  return (
    <div className="auth-stage flex min-h-screen flex-col">
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-8 text-[var(--auth-text)] shadow-sm">
          <h1 className="text-2xl font-semibold">{t('installation.title')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--auth-muted)]">{t('installation.lead')}</p>
          <div className="mt-6 space-y-4">
            <Field id="corporation" label={t('installation.corporation')} value={form.corporationName} onChange={set('corporationName')} />
            <Field id="given-name" label={t('fields.first-name')} value={form.givenName} onChange={set('givenName')} />
            <Field id="surname" label={t('fields.surname')} value={form.surname} onChange={set('surname')} />
            <Field id="email" label={t('login-page.work-email')} type="email" value={form.email} onChange={set('email')} />
            <Field
              id="password"
              label={t('fields.password')}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              revealed={showPassword}
              onToggleReveal={() => setShowPassword((value) => !value)}
              revealLabel={showPassword ? t('fields.hide-password') : t('fields.show-password')}
            />
            <Field
              id="confirm"
              label={t('fields.confirm-password')}
              type={showConfirmation ? 'text' : 'password'}
              value={form.passwordConfirmation}
              onChange={set('passwordConfirmation')}
              revealed={showConfirmation}
              onToggleReveal={() => setShowConfirmation((value) => !value)}
              revealLabel={showConfirmation ? t('fields.hide-password') : t('fields.show-password')}
            />
          </div>
          {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" className="mt-6" disabled={state.isLoading}>{t('installation.submit')}</Button>
        </form>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text', revealed = false, onToggleReveal, revealLabel }: {
  id: string
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  type?: string
  revealed?: boolean
  onToggleReveal?: () => void
  revealLabel?: string
}) {
  const secret = type === 'password' || onToggleReveal
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          required
          minLength={secret ? 8 : undefined}
          autoComplete={id === 'password' ? 'new-password' : id === 'confirm' ? 'new-password' : undefined}
          className={onToggleReveal ? 'pr-12' : undefined}
        />
        {onToggleReveal ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-muted)]"
            onClick={onToggleReveal}
            aria-pressed={revealed}
            aria-label={revealLabel}
          >
            {revealed ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: { code?: unknown } }).data
  return data && typeof data.code === 'string' ? data.code : null
}

export default InstallationSetupForm
