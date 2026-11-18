import type { LanguageType, RoleType } from '../../../shared/types/enums'

export type UserUpdateDTO = Partial<User>

/**
 * Аватар пользователя (разные размеры)
 */
export interface Avatar {
  small?: string
  medium?: string
  large?: string
  original?: string
}

/**
 * Настройки пользователя (язык, уведомления, время и т.д.)
 */
export interface UserSettings {
  language: LanguageType
  timezone: string
  sound_notification: boolean | string
  disabled_email_notifications: string[]
  disabled_inlog_notifications: string[]
  notifiable_days_of_week: number[]
  notify_from_time: string
  notify_to_time: string
}

/**
 * Основная модель пользователя
 */
export interface User {
  id?: number
  email: string
  name: string
  patronymic: string
  surname: string
  full_name?: string
  company_name: string
  position: string
  about_myself: string
  role?: RoleType | string
  avatar: Avatar
  phone_number: string | null
  settings: UserSettings
  belonging: string
  files?: UserFile[]

  date_of_birth?: string
  department?: string
  experience?: string
  in_organization_since?: string
  mobile_phone?: string | null
  organization?: string
  personnel_number?: string
  room?: string
  work_phone?: string | null
  workplace?: string
}

/**
 * Участник проекта
 */
export interface ProjectMember {
  id?: number
  user: User
  role: RoleType | string
  created_at?: string
  project: number | string
  name?: string
  color?: string
}

/**
 * Расширенный участник (с дополнительными полями для таблицы/списка)
 */
export interface ExtendedMember extends ProjectMember {
  color: string
}

/**
 * Надзиратель / Supervisor
 */
export interface Supervisor {
  id: number
  task?: number
  project?: number
  file?: string
  filename?: string
  size?: number
  created_at?: string
  user?: User
}

/**
 * Исполнитель задачи
 */
export interface TaskDoer {
  id: number
  user?: User
}

/**
 * Минимальная информация о пользователе (для списков, карточек)
 */
export interface SmallUser {
  id?: number
  email: string
  full_name?: string
  company_name?: string
  position?: string
  avatar?: Avatar
}

/**
 * Документ пользователя
 */
export interface UserFile {
  id: number
  name?: string
  url?: string
  size?: number
  mime_type?: string
  created_at?: string
  task?: number
  filename?: string
  file?: string
}
