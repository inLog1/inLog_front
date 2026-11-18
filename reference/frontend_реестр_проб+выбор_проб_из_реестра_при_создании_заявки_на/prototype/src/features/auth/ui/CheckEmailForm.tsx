import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MailCheck, Loader2 } from 'lucide-react'

import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'

import { useResendEmailMutation } from '../model/authSlice'
import { routes } from '../../../shared/lib/routes'
import { toast } from 'sonner'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { useSelector } from 'react-redux'
import { selectAuth } from '../model/selectors'

export function CheckEmailForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { email } = useSelector(selectAuth) || { email: '' }

//   const { email } = useSelector(selectPasswordResetData) || { email: '' }

  const [resendEmail, { isLoading }] = useResendEmailMutation()

  const handleResend = async () => {
    if (!email) {
      toast.error(t('errors.email-not-found'))
      return
    }

    try {
      await resendEmail({ email }).unwrap()
      toast.success(t('notice-list.mail-sent-successfully'))
    } catch (err) {
      errorsHandler(err, t)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t('auth.check-email-please')}
          </CardTitle>
          <CardDescription className="text-base mt-3">
            {t('auth.we-sent-you-email-with-confirmation') }
            <br />
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            {t('notice-list.resend-letter-if-didnt-get-mail') }
          </p>

          <Button
            onClick={handleResend}
            disabled={isLoading || !email}
            className="w-full h-12 text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loading')}
              </>
            ) : (
              t('notice-list.send-mail-repeatedly')
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="link"
              onClick={() => navigate(routes.login())}
              className="text-primary hover:underline"
            >
              {t('auth.sign-in')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}