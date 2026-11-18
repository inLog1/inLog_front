import type { User, UserSettings } from '../../../entities/user/model/types'
import type { LanguageType, RequestAction, RoleType } from '../enums'
import type { MemberResponse } from './project'

export type UserUpdateRequest = Partial<{
  name: string
  patronymic: string
  surname: string
  company_name: string
  position: string
  about_myself: string
  phone_number: string | null
  mobile_phone: string | null
  work_phone: string | null
  date_of_birth: string
  department: string
  experience: string
  in_organization_since: string
  organization: string
  personnel_number: string
  room: string
  workplace: string
  email: string
}>

export type UserSettingsUpdateRequest =
  | FormData
  | Partial<UserSettings>
  | { language: LanguageType }

export type UserSettingsResponse = UserSettings

export interface ChangeRoleRequest {
  role: RoleType
}

export interface ChangeRoleByUserRequest {
  role: RoleType
}

export interface ChangeRoleAdminResponseRequest {
  action: RequestAction
  role_request: number
}

export interface RoleRequestResponse {
  id: number
  role: RoleType
  user: number
  project: number
  status?: string
  created_at?: string
}

export interface SocialLoginResponse {
  user: User
  access_token: string
}

export type ChangeRoleResponse = MemberResponse
