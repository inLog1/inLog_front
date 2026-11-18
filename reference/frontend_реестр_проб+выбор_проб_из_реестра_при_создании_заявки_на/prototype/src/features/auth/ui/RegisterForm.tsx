import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as z from 'zod'

import { errorsHandler } from '../../../shared/lib/errors-handler'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader
} from '../../../shared/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from '../../../shared/ui/form'
import { Input } from '../../../shared/ui/input'
import { useRegisterMutation } from '../model/authSlice'
import { TermsAndPolicy } from './TermsAndPolicy'

interface RegisterFormProps {
    onSuccess?: () => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps = {}) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [register, { isLoading }] = useRegisterMutation()

    const [showPassword1, setShowPassword1] = useState(false)
    const [showPassword2, setShowPassword2] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [modalType, setModalType] = useState<'terms' | 'policy'>('terms')

    const formSchema = z
        .object({
            email: z
                .string()
                .min(1, { message: t('validation.required') })
                .email({ message: t('validation.email') }),
            password1: z
                .string()
                .min(8, { message: t('validation.password') }),
            password2: z.string(),
            receive_advertisement: z.boolean(),
            agreePolicy: z.boolean().refine((val) => val === true, {
                message: t('validation.required'),
            }),
        })
        .refine((data) => data.password1 === data.password2, {
            message: t('validation.password-not-match'),
            path: ['password2'],
        })

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: searchParams.get('email') || '',
            password1: '',
            password2: '',
            receive_advertisement: false,
            agreePolicy: false,
        },
    })

    const invitationToken = searchParams.get('invitation_token')

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const data = {
                email: values.email,
                password1: values.password1,
                password2: values.password2,
                receive_advertisement: values.receive_advertisement,
                receive_notifications: false,
                invitation_token: invitationToken || '',
                belonging: 'common',
            }
            await register(data).unwrap()
            navigate(routes.checkEmail())

            onSuccess?.()
        } catch (err: any) {
            errorsHandler(err, t)
        }
    }

    return (
        <>
            <div className="space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        {t('auth.registration')}
                    </h2>
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

                        <FormField
                            control={form.control}
                            name="password1"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                                            <Input
                                                {...field}
                                                type={showPassword1 ? 'text' : 'password'}
                                                placeholder={t('auth.password')}
                                                className="pl-10 pr-10 h-12 text-base"
                                                autoComplete="new-password"
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword1(!showPassword1)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                disabled={isLoading}
                                                aria-label={showPassword1 ? t('fields.hide-password') : t('fields.show-password')}
                                            >
                                                {showPassword1 ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Password 2 */}
                        <FormField
                            control={form.control}
                            name="password2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                                            <Input
                                                {...field}
                                                type={showPassword2 ? 'text' : 'password'}
                                                placeholder={t('fields.confirm-password')}
                                                className="pl-10 pr-10 h-12 text-base"
                                                autoComplete="new-password"
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword2(!showPassword2)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                disabled={isLoading}
                                                aria-label={showPassword2 ? t('fields.hide-password') : t('fields.show-password')}
                                            >
                                                {showPassword2 ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="agreePolicy"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-x-3 space-y-0">
                                        <div className="flex flex-row items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={isLoading}
                                                />
                                            </FormControl>



                                            <div className="space-y-1 leading-none">
                                                <p className="text-sm text-muted-foreground">
                                                    <div className="">
                                                        <span>
                                                            {t('auth.policy-agree.agree')}
                                                        </span>
                                                        <Button className="px-1" variant="link" onClick={() => {
                                                            setModalType('terms')
                                                            setModalOpen(true)
                                                        }}>
                                                            {t('auth.policy-agree.terms')}
                                                        </Button>
                                                        <span>
                                                            {t('auth.policy-agree.and')}
                                                        </span>
                                                        <Button className="px-1" variant="link" onClick={() => {
                                                            setModalType('policy')
                                                            setModalOpen(true)
                                                        }}>
                                                            {t('auth.policy-agree.policy')}
                                                        </Button>
                                                        <span className="font-medium">InLog</span>
                                                    </div>
                                                </p>
                                            </div>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="receive_advertisement"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={isLoading}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <p className="text-sm text-muted-foreground">
                                                {t('auth.agree-to-recieve-news-and-updates')}
                                            </p>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {form.formState.errors.root && (
                            <p className="text-sm text-destructive text-center">
                                {form.formState.errors.root.message}
                            </p>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 text-base font-medium bg-orange-500 hover:bg-orange-600 transition-colors"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {t('loading')}
                                </>
                            ) : (
                                t('auth.sign-up')
                            )}
                        </Button>
                    </form>
                </Form>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        {/* <DialogTitle>
                            {modalType === 'terms' ? t('auth.policy-agree.rules-of-use-title') : t('auth.policy-agree.privacy-policy-title')}
                        </DialogTitle> */}
                    </DialogHeader>
                    <div className="p-4">
                        <TermsAndPolicy type={modalType} />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setModalOpen(false)}>
                            {t('buttons.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}