import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, EyeOff, Eye } from 'lucide-react'

import { Button } from '../../../shared/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../../shared/ui/form'
import { Input } from '../../../shared/ui/input'

import { useLoginMutation } from '../model/authSlice'
import { routes } from '../../../shared/lib/routes'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { useState } from 'react'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const formSchema = z.object({
    email: z
      .string()
      .min(1, { message: t('validation.required') })
      .email({ message: t('validation.email') }),
    password: z
      .string()
      .min(8, { message: t('validation.password') }),
  })

  const [login, { isLoading }] = useLoginMutation()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await login(values).unwrap()
      onSuccess?.()
      navigate(routes.dashboard())
    } catch (err: any) {
      errorsHandler(err, t)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t('auth.entrance')}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t('fields.enter-email-address')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('fields.password')}
                      className="pl-10 pr-10 h-12 text-base"
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      disabled={isLoading}
                      aria-label={showPassword ? t('fields.hide-password') : t('fields.show-password')}
                    >
                      {showPassword ? (
                        <Eye className="h-5 w-5" />
                      ) : (
                        <EyeOff className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Link
              to={routes.passwordRecovery()}
              className="text-sm text-primary hover:underline"
            >
              {t('fields.forgot-password')}
            </Link>
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive text-center">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            variant="default"
            size="lg"

            className="w-full cursor-pointer text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('buttons.loading')}
              </>
            ) : (
              t('auth.sign-in')
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}