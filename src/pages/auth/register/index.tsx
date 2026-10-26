import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../../widgets/auth-layout'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'

const RegisterPage = () => {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold">{t('login-page.registration-closed-title')}</h2>
        <p className="text-sm text-muted-foreground">{t('login-page.registration-closed-text')}</p>
        <Button asChild>
          <Link to={routes.login()}>{t('login-page.back-to-login')}</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}

export default RegisterPage
