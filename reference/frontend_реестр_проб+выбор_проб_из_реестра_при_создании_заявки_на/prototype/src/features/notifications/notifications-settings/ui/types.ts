export const SettingTypes = {
    email_checked: 'email_checked',
    inLog_checked: 'inLog_checked',
} as const

export type SettingTypes = typeof SettingTypes[keyof typeof SettingTypes]

export interface NotificationRow {
    id: number
    title: string
    value: string
    email_checked?: boolean
    inLog_checked?: boolean
}

export interface WeekDay {
    id: number
    name: string
}
