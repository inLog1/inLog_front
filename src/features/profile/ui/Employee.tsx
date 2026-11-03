import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Loader2, Mail, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import * as z from 'zod'
import { selectUser, selectUserRole } from '../../../entities/user/model/selectors'
import type { User as UserType } from '../../../entities/user/model/types'
import { PlatformRoleBadge } from '../../../features/platform-admin/ui/PlatformRoleBadge'
import {
  useAddUserDocumentMutation,
  useDeleteUserDocumentMutation,
  useGetUserDocumentsQuery,
  useUpdateMeMutation,
} from '../../../entities/user/model/userSlice'
import { usePasswordResetMutation } from '../../../features/auth/model/authSlice'
import { DATE_REQUEST_FORMAT } from '../../../shared/config/constants'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'
import { Button } from '../../../shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card'
import { DatePicker } from '../../../shared/ui/date-picker'
import { FileAttachment } from '../../../shared/ui/file-attachment'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../shared/ui/form'
import { Input } from '../../../shared/ui/input'
import { Skeleton } from '../../../shared/ui/skeleton'

// Схема валидации Zod
const profileFormSchema = z.object({
    surname: z.string().min(1, 'required-field'),
    name: z.string().min(1, 'required-field'),
    patronymic: z.string().optional(),
    date_of_birth: z.date().optional(),
    mobile_phone: z.string().optional(),
    work_phone: z.string().optional(),
    email: z.string().email('invalid-email').optional().or(z.literal('')),
    organization: z.string().optional(),
    position: z.string().optional(),
    personnel_number: z.string().optional(),
    department: z.string().optional(),
    room: z.string().optional(),
    in_organization_since: z.date().optional(),
    workplace: z.string().optional(),
    experience: z.string().or(z.number()).optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

const Employee = () => {
    const { t } = useTranslation()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const userData = useSelector(selectUser)
    const userRole = useSelector(selectUserRole)
    const [updateMe] = useUpdateMeMutation()
    const { data: userDocuments, isLoading: isUserDocumentsLoading } = useGetUserDocumentsQuery()
    const [addUserDocument] = useAddUserDocumentMutation()
    const [deleteUserDocument] = useDeleteUserDocumentMutation()
    const [passwordReset] = usePasswordResetMutation()
    // const [changePassword] = useChangePasswordMutation()


    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            surname: '',
            name: '',
            patronymic: '',
            mobile_phone: '',
            work_phone: '',
            email: '',
            organization: '',
            position: '',
            personnel_number: '',
            department: '',
            room: '',
            workplace: '',
            experience: '',
        },
    })

    // Загрузка данных сотрудника
    useEffect(() => {
        const fetchEmployeeData = async () => {
            setIsLoading(true)
            try {
                form.reset({
                    name: userData?.name || '',
                    patronymic: userData?.patronymic || '',
                    surname: userData?.surname || '',
                    mobile_phone: userData?.mobile_phone || '',
                    work_phone: userData?.work_phone || '',
                    email: userData?.email || '',
                    organization: userData?.organization || '',
                    position: userData?.position || '',
                    personnel_number: userData?.personnel_number || '',
                    department: userData?.department || '',
                    room: userData?.room || '',
                    workplace: userData?.workplace || '',
                    experience: userData?.experience ? userData?.experience.toString() : undefined,
                    date_of_birth: userData?.date_of_birth ? new Date(userData?.date_of_birth) : undefined,
                    in_organization_since: userData?.in_organization_since ? new Date(userData?.in_organization_since) : undefined,
                })
            } catch (error) {
                console.error('Error fetching employee data:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchEmployeeData()
    }, [form])

    const addFile = async (file: File) => {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading(t('notice-list.adding-file'))
            const formData = new FormData()
            formData.append('file', file)
            await addUserDocument(formData)
            toast.success(t('notice-list.file-added-successfully'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }
    const deleteFile = async (fileId: number) => {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading(t('notice-list.deleting-file'))
            await deleteUserDocument(fileId)
            toast.success(t('notice-list.file-deleted-successfully'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleChangePassword = async () => {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading(t('notice-list.changing-password'))
            await passwordReset({ email: userData?.email ?? '' })
            toast.success(t('notice-list.mail-to-change-password-has-been-sent'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onSubmit = async (values: ProfileFormValues) => {
        setIsSaving(true)
        setIsLoading(true)
        let toastId: string | number | undefined;
        try {
            const result: Partial<UserType> = {}

            for (let field in values) {
                let validItem = '' as null | string
                const userDataField = userData?.[field as keyof UserType] ?? ''

                if (['in_organization_since', 'date_of_birth'].includes(field)) {
                    const formatedDateField = values[field as keyof ProfileFormValues] ? format(values[field as keyof ProfileFormValues] as Date,
                        DATE_REQUEST_FORMAT,
                    ) : ''
                    validItem =
                        userDataField === formatedDateField
                            ? null
                            : formatedDateField
                } else {
                    validItem =
                        userDataField === values[field as keyof ProfileFormValues]
                            ? null
                            : values[field as keyof ProfileFormValues] as string | null
                }

                if (validItem !== null) {
                    if (field === 'email') {
                        result.email = validItem
                    } else {
                        result[field as keyof UserType] = validItem as string | undefined as undefined
                    }
                }
            }
            if (Object.keys(result).length > 0) {
                const formData = new FormData()

                for (let field in result) {
                    formData.append(field, result[field as keyof typeof result] as string)
                }
                toastId = toast.loading(t('notice-list.saving-employee-data'))
                await updateMe(formData)
                toast.success(t('notice-list.employee-data-saved-successfully'))
            }

        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
            setIsSaving(false)
            setIsLoading(false)
        }
    }

    // Компонент скелетона для загрузки
    if (isLoading) {
        return (
            <div className="w-full max-w-4xl py-6">
                <div className="space-y-6">
                    {/* Заголовок */}
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>

                    {/* Скелетон формы */}
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-4xl py-6">
            <div className="space-y-6">
                <div className="flex items-start gap-8 pb-1">
                    <Avatar className="h-24 w-24 border-2 border-border">
                        <AvatarImage
                            src={userData?.avatar?.medium}
                            alt={`${userData?.surname} ${userData?.name}`}
                        />
                        <AvatarFallback className="bg-primary/10">
                            <User className="h-12 w-12 text-primary" />
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-1 flex-col gap-4 pt-1">
                        <h1 className="text-2xl font-bold tracking-tight">
                            {userData?.surname} {userData?.name} {userData?.patronymic}
                        </h1>
                        {userData?.position && (
                            <p className="text-muted-foreground">{userData.position}</p>
                        )}
                        {userRole && (
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-sm text-muted-foreground">
                                    {t('profile-page.user-role')}
                                </span>
                                <PlatformRoleBadge role={userRole} />
                            </div>
                        )}
                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>{userData?.email}</span>
                        </div>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                            <CardHeader>
                                <CardTitle>{t('profile-page.personal-information')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Фамилия */}
                                    <FormField
                                        control={form.control}
                                        name="surname"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.last-name')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Имя */}
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.first-name')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Отчество */}
                                    <FormField
                                        control={form.control}
                                        name="patronymic"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.middle-name')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Дата рождения */}
                                    <FormField
                                        control={form.control}
                                        name="date_of_birth"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>{t('fields.date-of-birth')}</FormLabel>
                                                <DatePicker
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    className="w-full"
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Мобильный телефон */}
                                    <FormField
                                        control={form.control}
                                        name="mobile_phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.mobile-phone')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Рабочий телефон */}
                                    <FormField
                                        control={form.control}
                                        name="work_phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.work-phone')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Email */}
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.email-address')}</FormLabel>
                                                <FormControl>
                                                    <Input type="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Организация */}
                                    <FormField
                                        control={form.control}
                                        name="organization"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.organization')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Должность */}
                                    <FormField
                                        control={form.control}
                                        name="position"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.position')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Табельный номер */}
                                    <FormField
                                        control={form.control}
                                        name="personnel_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.personnel-number')}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Отдел */}
                                    <FormField
                                        control={form.control}
                                        name="department"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.department')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Комната */}
                                    <FormField
                                        control={form.control}
                                        name="room"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.room')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Дата начала работы */}
                                    <FormField
                                        control={form.control}
                                        name="in_organization_since"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>{t('fields.in-organization-since')}</FormLabel>
                                                <DatePicker
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Рабочее место */}
                                    <FormField
                                        control={form.control}
                                        name="workplace"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.workplace')}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Опыт работы */}
                                    <FormField
                                        control={form.control}
                                        name="experience"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('fields.experience-years')}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Кнопка сохранения */}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                                        {t('buttons.saving')}
                                    </>
                                ) : (
                                    t('buttons.save')
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>

                <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {t('fields.password')}
                        </CardTitle>
                        <CardDescription>
                            {t('profile-page.tap-button-to-change-password')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {t('profile-page.password-security-description')}
                            </p>
                            <Button
                                onClick={handleChangePassword}
                                disabled={isLoading}
                                variant="outline"
                                className="ml-4"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('buttons.sending')}
                                    </>
                                ) : (
                                    t('buttons.change-password')
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Блок с файлами (заглушка) */}
                {
                    isUserDocumentsLoading ? (
                        <Skeleton className="h-12 w-12 rounded-full" />
                    ) : (
                        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                            <CardHeader>
                                <CardTitle>{t('fields.files')}</CardTitle>
                            </CardHeader>
                            <CardContent>   <FileAttachment files={userDocuments?.map((file) => ({
                                id: file.id,
                                file: file.file ?? '',
                                filename: file.filename ?? '',
                                size: file.size,
                            }))} onUpload={addFile} onDelete={deleteFile} /> </CardContent>
                        </Card>
                    )
                }

            </div>
        </div>
    )
}

export default Employee