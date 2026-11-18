import { useTranslation } from 'react-i18next'
import { getUserFullName, getValidText } from '../../../shared/lib/get-valid-text'
import { NoticeTypes } from '../lib/notice-types'
import type { NotificationDescriptionProps } from '../model/types'

const NotificationDescription = ({ item }: NotificationDescriptionProps) => {
  const { t } = useTranslation()

  const senderName = getUserFullName(item.sender)
  const senderEmail = getValidText(item.sender?.email)

  const translateRole = (role?: string) => {
    if (!role) return ''
    const key = `notifications-list.roles.${role}`
    const translated = t(key)
    return translated === key ? role : translated
  }

  const acceptedLabel = t('notifications-list.descriptions.accepted')
  const rejectedLabel = t('notifications-list.descriptions.rejected')

  if (item.type === NoticeTypes.RoleRequest) {
    return (
      <div>
        {t('notifications-list.descriptions.sender-requests-role-in-project', {
          sender: senderName,
          senderEmail,
          role: translateRole(item.data?.role_request?.role),
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.ProjectUserInvitationResponse) {
    return (
      <div>
        {t('notifications-list.descriptions.user-do-action-with-invitation-to-project', {
          user: senderName,
          senderEmail,
          action: item.data?.accepted ? acceptedLabel : rejectedLabel,
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.RoleRequestResponse) {
    return (
      <div>
        {t('notifications-list.descriptions.user-do-action-with-role-in-project', {
          user: senderName,
          senderEmail,
          action: item.data?.accepted ? acceptedLabel : rejectedLabel,
          role: translateRole(item.data?.role_request?.role),
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.ProjectUserInvitation) {
    return (
      <div>
        {t('notifications-list.descriptions.user-invite-you-to-project-with-certain', {
          user: senderName,
          senderEmail,
          action: item.data?.accepted ? acceptedLabel : rejectedLabel,
          role: translateRole(item.data?.project_user_invitation?.role),
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.ProjectLeaving) {
    const leavingData = item.data[item.type] as { role?: string } | undefined

    return (
      <div>
        {t('notifications-list.descriptions.user-left-project', {
          user: senderName,
          senderEmail,
          role: translateRole(leavingData?.role),
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.AdminRightsTransfer) {
    return (
      <div>
        {t('notifications-list.descriptions.admin-transfered-rights-to-you', {
          user: senderName,
          senderEmail,
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.ProjectUserRemoval) {
    return (
      <div>
        {t('notifications-list.descriptions.user-removed-you-from-project', {
          user: senderName,
          senderEmail,
        })}
      </div>
    )
  }

  if (item.type === NoticeTypes.RoleChangeByAdmin) {
    return (
      <div>
        {t('notifications-list.descriptions.admin-changed-your-role-to-certain', {
          user: senderName,
          senderEmail,
          role: getValidText(item.data?.role).toLowerCase(),
        })}
      </div>
    )
  }

  return null
}

export default NotificationDescription
