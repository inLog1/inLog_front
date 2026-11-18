import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { routes } from '../../../shared/lib/routes'

export function SignHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const onLogin = pathname === routes.login()

  return (
    <header className="grid grid-cols-3 items-center px-6 py-4">
      <div />

      <h1 className="text-3xl md:text-4xl font-bold text-white text-center flex-1 tracking-tight">
        {t('auth.laboratory-information-system')}
      </h1>

      <div className="flex items-center gap-5 justify-end">
        {!onLogin && (
          <Link
            to={routes.login()}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {t('auth.login')}
          </Link>
        )}
      </div>
    </header>
  )
}