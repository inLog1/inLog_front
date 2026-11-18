import type { RequestAction } from '../../../shared/types/enums'

export interface NotificationUser {
  first_name?: string
  last_name?: string
  name?: string
  surname?: string
  avatar?: string
  email?: string
}

export interface NotificationRoleRequest {
  id: number
  role?: string
}

export interface NotificationProjectUserInvitation {
  id: number
  role?: string
}

export interface NotificationProjectLeaving {
  role?: string
}

export interface NotificationData {
  project?: { id: number; name?: string }
  role_request?: NotificationRoleRequest
  project_user_invitation?: NotificationProjectUserInvitation
  project_leaving?: NotificationProjectLeaving
  html?: string
  role?: string
  accepted?: boolean
  action?: string
  status?: string
  message?: string
  description?: string
  text?: string
  [key: string]: unknown
}

export interface Notification {
  id: number
  type: string
  is_read: boolean
  is_deleted?: boolean
  deleted?: boolean
  data: NotificationData
  created_at?: string
  sender?: NotificationUser
  receiver?: NotificationUser
}

export interface NotificationDescriptionProps {
  item: Notification
}

export interface NotificationProps {
  item: Notification
  isModalItem?: boolean
  deleteBlock?: (id: number) => void
  sendNoticeResponse?: (item: Notification, action: RequestAction) => void
  readNotification?: (id: number) => void
}
