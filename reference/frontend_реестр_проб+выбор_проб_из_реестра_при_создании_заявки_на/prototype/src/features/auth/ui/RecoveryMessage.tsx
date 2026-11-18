import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'

import { routes } from '../../../shared/lib/routes'
import { useSelector } from 'react-redux'
import { selectAuth } from '../model/selectors'

export function RecoveryMessage() {
  const { t } = useTranslation()
  const { email } = useSelector(selectAuth) || { email: '' }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t('auth.reset-password')}
          </CardTitle>
          <CardDescription className="text-base mt-3">
            {t('auth.instruction-sent-to-address', { value: email || 'ваш email' })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            {t('notice-list.resend-email-if-didnt-get-mail')}
          </p>

          <div className="flex flex-col gap-4">
            <Button
              asChild
              variant="default"
              className="h-12 text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Link to={routes.login()}>
                {t('auth.sign-in')}
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-12 text-base font-medium border-primary text-primary"
            >
              <Link to={routes.passwordRecovery()}>
                {t('auth.send-instruction-one-more-time')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}