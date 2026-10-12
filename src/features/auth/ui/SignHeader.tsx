import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthLangPanel } from './AuthLangPanel'
import { routes } from '../../../shared/lib/routes'
import { useLocation } from 'react-router-dom'

export function SignHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <header className="flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-6">
      <div className="hidden sm:block" />

      <h1 className="text-center text-xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
        {t('auth.laboratory-information-system')}
      </h1>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <AuthLangPanel />
        <Link
          to={pathname === routes.register() ? routes.login() : routes.register()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-6"
        >
          { pathname === routes.register() ? t('auth.login') : t('auth.registration')}
        </Link>
      </div>
    </header>
  )
}