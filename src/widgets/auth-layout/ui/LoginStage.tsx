import { LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoginForm } from '../../../features/auth/ui/LoginForm'
import { AuthTopBar } from './AuthTopBar'

export function LoginStage() {
  const { t } = useTranslation()

  return (
    <div className="auth-stage flex h-dvh flex-col overflow-hidden">
      <AuthTopBar
        end={(
          <span className="hidden items-center gap-2 text-sm text-shell-muted sm:flex">
            <LayoutGrid className="h-4 w-4" />
            {t('login-page.corporate-system')}
          </span>
        )}
      />

      <main className="mx-auto grid min-h-0 w-full min-w-0 max-w-6xl flex-1 items-center gap-8 overflow-x-hidden px-4 lg:grid-cols-2 lg:px-8">
        <section className="hidden min-h-0 min-w-0 lg:block">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--auth-primary)]">
            {t('login-page.eyebrow')}
          </p>
          <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight text-[var(--auth-text)]">
            {t('login-page.title')}
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-[var(--auth-muted)]">
            {t('login-page.subtitle')}
          </p>
          <img
            src="/images/login-scheme.webp"
            alt=""
            className="login-scheme mt-4 max-h-[min(280px,34vh)] w-full max-w-xl object-contain object-left"
          />
        </section>

        <section className="flex min-w-0 justify-center lg:justify-end">
          <LoginForm />
        </section>
      </main>
    </div>
  )
}
