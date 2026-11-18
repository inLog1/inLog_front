import type { RequestAction } from '../enums'

export interface InvitationResponseRequest {
  action: RequestAction
  project_user_invitation: number
}

export interface NotificationUpdateRequest {
  is_read?: boolean
}
