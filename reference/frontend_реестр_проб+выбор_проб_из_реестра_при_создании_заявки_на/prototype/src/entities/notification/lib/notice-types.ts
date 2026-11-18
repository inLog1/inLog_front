export const NoticeTypes = {
  ProjectUserInvitation: 'project_user_invitation',
  RoleRequest: 'role_request',
  ProjectUserInvitationResponse: 'project_user_invitation_response',
  RoleRequestResponse: 'role_request_response',
  ProjectLeaving: 'project_leaving',
  AdminRightsTransfer: 'admin_rights_transfer',
  ProjectUserRemoval: 'project_user_removal',
  RoleChangeByAdmin: 'role_change',
  GeneralTaskUpdate: 'general_task_update',
} as const

export type NoticeType = (typeof NoticeTypes)[keyof typeof NoticeTypes]

export const noticeTypesForButtons: NoticeType[] = [
  NoticeTypes.ProjectUserInvitation,
  NoticeTypes.RoleRequest,
]

export const noticeTypesToShowBlocks: NoticeType[] = [
  ...noticeTypesForButtons,
  NoticeTypes.ProjectUserInvitationResponse,
  NoticeTypes.RoleRequestResponse,
  NoticeTypes.ProjectLeaving,
  NoticeTypes.AdminRightsTransfer,
  NoticeTypes.ProjectUserRemoval,
  NoticeTypes.RoleChangeByAdmin,
]

const titleKeyByType: Partial<Record<NoticeType, string>> = {
  [NoticeTypes.ProjectUserInvitation]: 'invitation-to-project',
  [NoticeTypes.ProjectUserInvitationResponse]: 'response-on-invitation-to-project',
  [NoticeTypes.RoleRequest]: 'role-request',
  [NoticeTypes.RoleRequestResponse]: 'request-to-change-role',
  [NoticeTypes.ProjectLeaving]: 'existing-the-project',
  [NoticeTypes.RoleChangeByAdmin]: 'role-changing-by-admin',
  [NoticeTypes.ProjectUserRemoval]: 'project-user-removal',
  [NoticeTypes.AdminRightsTransfer]: 'admin-rights-transfer',
  [NoticeTypes.GeneralTaskUpdate]: 'general-task-update',
}

export const getNotificationTitleKey = (type: string) => titleKeyByType[type as NoticeType]
