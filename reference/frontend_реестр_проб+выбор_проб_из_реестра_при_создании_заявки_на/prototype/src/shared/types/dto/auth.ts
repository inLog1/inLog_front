import type { User } from "../../../entities/user/model/types"

export type LoginRequest = {
  username?: string
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  refresh_token: string
  user: User
}

export type RegistrationRequest = {
  username?: string
  email: string
  password1: string
  password2: string
  receive_notifications?: boolean
  receive_advertisement: boolean
}

export type RegistrationResponse = RegistrationRequest // если это действительно зеркально

export type PasswordResetConfirmRequest = {
  new_password1: string
  new_password2: string
  uid: string
  token: string
}

export type PasswordResetConfirmResponse = {
  detail?: string
}

export type ConfirmEmailChangeRequest = {
  email: string
  uid: string
  token: string
}