import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useVerifyEmailMutation } from '../model/authSlice'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card'

type ConfirmationStatus = 'loading' | 'success' | 'error'

export function EmailConfirmationForm() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [verifyEmail] = useVerifyEmailMutation()
  const [status, setStatus] = useState<ConfirmationStatus>('loading')
  const startedRef = useRef(false)

  const uid = searchParams.get('uid')
  const key = searchParams.get('key')

  useEffect(() => {
    if (startedRef.current) {
      return
    }

    if (!key) {
      setStatus('error')
      return
    }

    startedRef.current = true

    verifyEmail({ key, uid: uid ?? undefined })
      .unwrap()
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [key, uid, verifyEmail])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground text-center">{t('auth.email-confirming')}</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {t('auth.email-confirmation-title')}
            </CardTitle>
            <CardDescription className="text-base mt-3">
              {t('auth.email-confirmation-success')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              asChild
              className="w-full h-12 text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              <Link to={routes.login()}>{t('auth.sign-in')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 bg-destructive/10 rounded-full">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t('auth.email-confirmation-title')}
          </CardTitle>
          <CardDescription className="text-base mt-3">
            {key ? t('auth.email-confirmation-error') : t('auth.email-confirmation-invalid-link')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            asChild
            variant="outline"
            className="w-full h-12 text-base font-medium"
          >
            <Link to={routes.checkEmail()}>{t('auth.email-confirmation-resend')}</Link>
          </Button>

          <Button asChild variant="link" className="w-full">
            <Link to={routes.login()}>{t('auth.sign-in')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
