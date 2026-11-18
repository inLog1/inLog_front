import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Loader2 } from 'lucide-react'

import { Button } from '../../../shared/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../../shared/ui/form'
import { Input } from '../../../shared/ui/input'

import { usePasswordResetMutation } from '../model/authSlice'
import { routes } from '../../../shared/lib/routes'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { toast } from 'sonner'

export function PasswordRecoveryForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [passwordReset, { isLoading }] = usePasswordResetMutation()

  const formSchema = z.object({
    email: z
      .string()
      .min(1, { message: t('validation.required') })
      .email({ message: t('validation.email') }),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await passwordReset({ email: values.email }).unwrap()

      // Сохраняем email для следующей страницы (как в старом коде)
    //   dispatch(
    //     authActions.setPasswordResetData({
    //       email: values.email,
    //       detail: response.detail,
    //     })
    //   )

      navigate(routes.recoveryMessage())

      toast.success(response.detail || t('notice-list.sent-message-to-reset-password'))
    } catch (err: any) {
      errorsHandler(err, t)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t('auth.password-recovery')}
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <Input
                      {...field}
                      type="email"
                      placeholder={t('fields.email')}
                      className="pl-10 h-12 text-base"
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('buttons.loading')}
              </>
            ) : (
              t('buttons.continue')
            )}
          </Button>

          <div className="text-center">
            <Link
              to={routes.login()}
              className="text-sm text-primary hover:underline"
            >
              {t('auth.sign-in')}
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}