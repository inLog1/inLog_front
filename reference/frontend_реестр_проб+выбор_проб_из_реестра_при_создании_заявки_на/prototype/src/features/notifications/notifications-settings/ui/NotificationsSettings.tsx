import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Switch } from '../../../../shared/ui/switch'
import { Skeleton } from '../../../../shared/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { cn } from '../../../../shared/lib/utils'
import { getDefaultRowsList, mocTimesData, weekDaysMoc } from './data'
import { SettingTypes } from './types'
import type { NotificationRow, WeekDay } from './types'
import { Card, CardContent } from '../../../../shared/ui/card'
import { useGetUserSettingsQuery, useUpdateUserSettingsMutation } from '../../../../entities/user/model/userSlice'
import { errorsHandler } from '../../../../shared/lib/errors-handler'

const toHHMM = (time: string) => time.split(':').slice(0, 2).join(':')

const NotificationsSettings = () => {
    const { t, i18n } = useTranslation()

    const [tableData, setTableData] = useState<NotificationRow[]>(() => getDefaultRowsList(t))
    const [allEmailOn, setAllEmailOn] = useState(true)
    const [allInlogOn, setAllInlogOn] = useState(true)
    const [weekDays, setWeekDays] = useState<WeekDay[]>(weekDaysMoc['en'])
    const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5])
    const [bouncingDay, setBouncingDay] = useState<number | null>(null)
    const [timeFrom, setTimeFrom] = useState('09:00')
    const [timeTo, setTimeTo] = useState('18:00')
    const { data: userSettings, isLoading: isUserSettingsLoading } = useGetUserSettingsQuery()
    const [updateUserSettings, { isLoading: isUpdateUserSettingsLoading }] = useUpdateUserSettingsMutation()



    const toggleDay = async (id: number) => {
        try {
            await updateUserSettings({
                notifiable_days_of_week: activeDays.includes(id) ? activeDays.filter(d => d !== id) : [...activeDays, id],
                notify_from_time: timeFrom,
                notify_to_time: timeTo
            })
            setActiveDays(prev =>
                prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
            )
        } catch (error) {
            errorsHandler(error, t)
        }
    }

    const toggleTime = async (time: string, type: 'from' | 'to') => {
        const newFrom = type === 'from' ? time : timeFrom
        const newTo   = type === 'to'   ? time : timeTo
        type === 'from' ? setTimeFrom(time) : setTimeTo(time)
        try {
            await updateUserSettings({ notify_from_time: newFrom, notify_to_time: newTo })
        } catch (error) {
            // revert on failure
            type === 'from' ? setTimeFrom(timeFrom) : setTimeTo(timeTo)
            errorsHandler(error, t)
        }
    }

    const changeFieldStatus = async (field: string, type: SettingTypes, status: boolean) => {
        let userForRequest = { ...userSettings, sound_notification: field === 'sound_notification' ? status : userSettings?.sound_notification }
        let disabled_email_notifications = userForRequest?.disabled_email_notifications ?? []
        let disabled_inlog_notifications = userForRequest?.disabled_inlog_notifications ?? []

        if (status) {
            if (type === SettingTypes.email_checked) {
                if (disabled_email_notifications?.includes(field)) {
                    disabled_email_notifications = disabled_email_notifications.filter(item => item !== field)
                }
            }
            if (type === SettingTypes.inLog_checked) {
                if (disabled_inlog_notifications?.includes(field)) {
                    disabled_inlog_notifications = disabled_inlog_notifications.filter(item => item !== field)
                }
            }
        } else {
            if (type === SettingTypes.email_checked) {
                if (!(disabled_email_notifications?.includes(field))) {
                    disabled_email_notifications = [...disabled_email_notifications, field]
                }
            }
            if (type === SettingTypes.inLog_checked) {
                if (!(disabled_inlog_notifications?.includes(field))) {
                    disabled_inlog_notifications = field !== 'sound_notification' ? [...disabled_inlog_notifications, field] : disabled_inlog_notifications
                }
            }
        }
        try {
            const sound_notification = field === 'sound_notification' ? status : userSettings?.sound_notification
            await updateUserSettings({
                disabled_email_notifications,
                disabled_inlog_notifications,
                sound_notification
            })
            // setUserSettings({ ...userSettings, disabled_email_notifications, disabled_inlog_notifications, sound_notification })
            // showNotice('changes-added-successfully', t)
        } catch (e) {
            errorsHandler(e, t)
        }
    }

    const toggleSwitch = async (status: boolean, field: string, type: SettingTypes) => {
        const changedData = tableData?.map(item => item?.value === field ? { ...item, [type]: status } : item)
        try {
            setTableData(changedData)
            await changeFieldStatus(field, type, status)
        } catch (e) {
            errorsHandler(e, t)
        }

    }

    const toggleAllEmail = async (status: boolean) => {
        try {
            await updateUserSettings({
                disabled_email_notifications: status ? [] : tableData?.filter(item => item.email_checked !== undefined).map(item => item.value),
                disabled_inlog_notifications: allInlogOn ? [] : tableData?.filter(item => item.inLog_checked !== undefined).map(item => item.value),
                notifiable_days_of_week: activeDays,
                notify_from_time: timeFrom,
                notify_to_time: timeTo
            })
            setAllEmailOn(status)
            setTableData(prev =>
                prev.map(row => row.email_checked !== undefined ? { ...row, email_checked: status } : row)
            )
        } catch (error) {
            errorsHandler(error, t)
        }

    }

    const toggleAllInlog = async (status: boolean) => {
        try {
            await updateUserSettings({
                disabled_email_notifications: allEmailOn ? [] : tableData?.filter(item => item.email_checked !== undefined).map(item => item.value),
                disabled_inlog_notifications: status ? [] : tableData?.filter(item => item.inLog_checked !== undefined).map(item => item.value),
                notifiable_days_of_week: activeDays,
                notify_from_time: timeFrom,
                notify_to_time: timeTo
            })
            setAllInlogOn(status)
            setTableData(prev =>
                prev.map(row => row.inLog_checked !== undefined ? { ...row, inLog_checked: status } : row)
            )
        } catch (error) {
            errorsHandler(error, t)
        }
    }

    useEffect(() => {
        if (!userSettings) return

        setTimeFrom(toHHMM(userSettings.notify_from_time))
        setTimeTo(toHHMM(userSettings.notify_to_time))
        setActiveDays(userSettings.notifiable_days_of_week)

        const disabledEmail = userSettings.disabled_email_notifications ?? []
        const disabledInlog = userSettings.disabled_inlog_notifications ?? []

        // apply server disabled lists to table rows
        const rows = getDefaultRowsList(t)
        const emailRowCount = rows.filter(r => r.email_checked !== undefined).length
        const inlogRowCount = rows.filter(r => r.inLog_checked !== undefined && r.value !== 'sound_notification').length

        setAllEmailOn(disabledEmail.length === 0)
        setAllInlogOn(disabledInlog.length === 0)
        // partial state: keep master toggle indeterminate-safe
        if (disabledEmail.length >= emailRowCount) setAllEmailOn(false)
        if (disabledInlog.length >= inlogRowCount) setAllInlogOn(false)

        setTableData(
            rows.map(row => ({
                ...row,
                ...(row.email_checked !== undefined && {
                    email_checked: !disabledEmail.includes(row.value),
                }),
                ...(row.inLog_checked !== undefined && {
                    inLog_checked: row.value === 'sound_notification'
                        ? Boolean(userSettings.sound_notification)
                        : !disabledInlog.includes(row.value),
                }),
            }))
        )
    }, [userSettings])

    useEffect(() => {
        setTableData(getDefaultRowsList(t))
    }, [i18n.language])

    useEffect(() => {
        setWeekDays(weekDaysMoc[i18n.language === 'ru' ? 'ru' : 'en'])
    }, [i18n.language])

    const isBusy = isUpdateUserSettingsLoading

    return (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
        <CardContent className="pt-6 space-y-6">
            {/* Time interval + week days */}
            <div className="flex items-center gap-5 flex-wrap">
                {isUserSettingsLoading ? (
                    <>
                        <Skeleton className="h-9 w-52" />
                        <div className="flex items-center gap-2">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <Skeleton key={i} className="w-10 h-10 rounded-full" />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {t('notifications-settings.time-from')}
                            </span>
                            <Select
                                value={timeFrom}
                                onValueChange={time => toggleTime(time, 'from')}
                                disabled={isBusy}
                            >
                                <SelectTrigger className="w-[88px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {mocTimesData.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <span className="text-sm text-muted-foreground">
                                {t('notifications-settings.time-to')}
                            </span>
                            <Select
                                value={timeTo}
                                onValueChange={time => toggleTime(time, 'to')}
                                disabled={isBusy}
                            >
                                <SelectTrigger className="w-[88px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {mocTimesData.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            {weekDays.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => { setBouncingDay(day.id); toggleDay(day.id) }}
                                    onAnimationEnd={() => setBouncingDay(null)}
                                    disabled={isBusy}
                                    className={cn(
                                        'w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border text-sm font-medium transition-colors',
                                        'disabled:pointer-events-none disabled:opacity-50',
                                        bouncingDay === day.id && 'animate-bounce-pop',
                                        activeDays.includes(day.id)
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : 'border-border text-foreground hover:border-primary/50'
                                    )}
                                >
                                    {day.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_120px_120px] bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground border-b">
                    <div className="flex items-center gap-2">
                        <span>{t('notifications-settings.notification-type')}</span>
                        {isBusy && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                        <span>{t('notifications-settings.email')}</span>
                        <Switch
                            checked={allEmailOn}
                            onCheckedChange={toggleAllEmail}
                            disabled={isBusy}
                        />
                    </div>

                    <div className="flex items-center gap-2 justify-center">
                        <span>inLog</span>
                        <Switch
                            checked={allInlogOn}
                            onCheckedChange={toggleAllInlog}
                            disabled={isBusy}
                        />
                    </div>
                </div>

                {/* Rows */}
                <ul className="divide-y">
                    {isUserSettingsLoading
                        ? Array.from({ length: 10 }).map((_, i) => (
                            <li key={i} className="grid grid-cols-[1fr_120px_120px] items-center px-4 py-3">
                                <Skeleton className="h-4 w-48" />
                                <div className="flex justify-center"><Skeleton className="h-5 w-9 rounded-full" /></div>
                                <div className="flex justify-center"><Skeleton className="h-5 w-9 rounded-full" /></div>
                            </li>
                        ))
                        : tableData.map(row => (
                            <li
                                key={row.id}
                                className="grid grid-cols-[1fr_120px_120px] items-center px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
                            >
                                <span className="text-foreground">{row.title}</span>

                                <div className="flex justify-center">
                                    {row.email_checked !== undefined ? (
                                        <Switch
                                            checked={row.email_checked}
                                            disabled={isBusy}
                                            onCheckedChange={status =>
                                                toggleSwitch(status, row.value, SettingTypes.email_checked)
                                            }
                                        />
                                    ) : (
                                        <span className="w-9" />
                                    )}
                                </div>

                                <div className="flex justify-center">
                                    {row.inLog_checked !== undefined ? (
                                        <Switch
                                            checked={row.inLog_checked}
                                            disabled={isBusy}
                                            onCheckedChange={status =>
                                                toggleSwitch(status, row.value, SettingTypes.inLog_checked)
                                            }
                                        />
                                    ) : (
                                        <span className="w-9" />
                                    )}
                                </div>
                            </li>
                        ))
                    }
                </ul>
            </div>
        </CardContent>
        </Card>
    )
}

export default NotificationsSettings
