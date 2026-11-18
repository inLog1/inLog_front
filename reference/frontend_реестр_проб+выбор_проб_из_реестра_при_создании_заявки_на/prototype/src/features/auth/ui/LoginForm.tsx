import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LayoutGrid, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as z from 'zod'
import { sessionActions } from '../../../entities/session'
import { useGetAuthCapabilitiesQuery } from '../../../entities/access'
import {
  getApiMode,
  getConfiguredAuthMode,
  getSsoStartUrl,
  type AuthMode,
} from '../../../shared/config/runtime'
import { sanitizeReturnTo } from '../../../shared/api/return-to'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../shared/ui/form'
import { Input } from '../../../shared/ui/input'
import { useLoginMutation } from '../model/authSlice'
import { resolveSsoStart } from '../model/sso'

function readCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  if (!data || typeof data !== 'object' || !('code' in data)) return null
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function readStatus(error: unknown): number | string | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' || typeof status === 'string' ? status : null
}

export function LoginForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [params] = useSearchParams()
  const mock = getApiMode() === 'mock'
  const capabilities = useGetAuthCapabilitiesQuery(undefined, { skip: !mock })
  const authMode: AuthMode = mock
    ? capabilities.data?.authMode ?? 'mixed'
    : getConfiguredAuthMode()
  const [login, { isLoading }] = useLoginMutation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(
    params.get('sso') === 'cancelled' ? t('login-page.sso-cancelled') : null,
  )

  const formSchema = z.object({
    email: z.string().min(1, { message: t('validation.required') }).email({ message: t('validation.email') }),
    password: z.string().min(1, { message: t('validation.required') }),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  const finish = () => {
    const returnTo = sanitizeReturnTo(params.get('returnTo'))
    dispatch(sessionActions.beginBootstrap())
    dispatch(sessionActions.bumpEpoch())
    navigate(returnTo ?? routes.dashboard())
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setFormError(null)
    try {
      await login(values).unwrap()
      finish()
    } catch (error) {
      const status = readStatus(error)
      const code = readCode(error)
      if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
        setFormError(t('login-page.network'))
        return
      }
      if (typeof status === 'number' && status >= 500) {
        setFormError(t('login-page.server'))
        return
      }
      if (code === 'blocked' || status === 403) {
        setFormError(t('login-page.blocked'))
        return
      }
      setFormError(t('login-page.invalid-credentials'))
    }
  }

  const startSso = () => {
    const start = resolveSsoStart(getApiMode(), mock ? '/auth/mock-provider' : getSsoStartUrl())
    if (start.kind === 'mock') {
      navigate(routes.mockProvider())
      return
    }
    if (start.kind === 'live') {
      window.location.assign(start.href)
      return
    }
    setFormError(t('login-page.sso-unconfigured'))
  }

  const showLocal = authMode === 'local' || authMode === 'mixed'
  const showSso = authMode === 'sso' || authMode === 'mixed'

  return (
    <div className="w-full min-w-0 max-w-[440px] rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-card)] p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold text-[var(--auth-text)]">{t('login-page.card-title')}</h2>
      <p className="mt-2 text-sm text-[var(--auth-muted)]">
        {authMode === 'sso' ? t('login-page.sso-only-text') : t('login-page.card-subtitle')}
      </p>

      {showLocal && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="work-email">{t('login-page.work-email')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="work-email"
                      type="email"
                      autoComplete="username"
                      placeholder={t('login-page.work-email-placeholder')}
                      className="h-12 rounded-[10px] border-[var(--auth-border)]"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="password">{t('login-page.password')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder={t('login-page.password-placeholder')}
                        className="h-12 rounded-[10px] border-[var(--auth-border)] pr-12"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--auth-muted)]"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? t('fields.hide-password') : t('fields.show-password')}
                      >
                        {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Link to={routes.passwordRecovery()} className="text-sm text-[var(--auth-primary)] hover:underline">
                {t('login-page.cannot-sign-in')}
              </Link>
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-[10px] bg-[var(--auth-primary)] text-white hover:bg-[var(--auth-primary)]/90"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('login-page.submit')}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </Form>
      )}

      {showLocal && showSso && (
        <div className="my-4 flex items-center gap-3 text-xs text-[var(--auth-muted)]">
          <span className="h-px flex-1 bg-[var(--auth-border)]" />
          {t('login-page.or')}
          <span className="h-px flex-1 bg-[var(--auth-border)]" />
        </div>
      )}

      {showSso && (
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-12 w-full whitespace-normal rounded-[10px] border-[var(--auth-primary)] bg-[var(--auth-card)] px-3 text-center leading-5 text-[var(--auth-primary)] hover:bg-[var(--color-accent)] hover:text-[var(--auth-primary)]"
          onClick={startSso}
        >
          <LayoutGrid className="h-4 w-4" />
          {t('login-page.sso')}
        </Button>
      )}

      {formError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {formError}
        </p>
      )}

      <p className="mt-6 text-center text-xs text-[var(--auth-muted)]">{t('login-page.no-access')}</p>
    </div>
  )
}
