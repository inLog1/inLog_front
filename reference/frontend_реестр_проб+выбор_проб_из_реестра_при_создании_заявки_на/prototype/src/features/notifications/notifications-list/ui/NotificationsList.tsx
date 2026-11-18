import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useInvitationResponseMutation,
  useUpdateNotificationMutation,
} from '../../../../entities/notification'
import { useChangeRoleAdminResponseMutation } from '../../../../entities/user/model/userSlice'
import { errorsHandler } from '../../../../shared/lib/errors-handler'
import { cn } from '../../../../shared/lib/utils'
import type { RequestAction } from '../../../../shared/types/enums'
import NotificationSkeleton from './NotificationSkeleton'
import type { NotificationsListProps } from './types'
import Notification from '../../../../entities/notification/ui/Notification'
import type { Notification as NotificationItem } from '../../../../entities/notification/model/types'

const SKELETON_COUNT = 5

const NotificationsList = ({ isLoading: isLoadingProp }: NotificationsListProps) => {
  const { t } = useTranslation()
  const {
    data: notifications = [],
    isLoading: isNotificationsLoading,
    isFetching: isNotificationsFetching,
  } = useGetNotificationsQuery()
  const [deleteNotification] = useDeleteNotificationMutation()
  const [updateNotification] = useUpdateNotificationMutation()
  const [changeRoleAdminResponse] = useChangeRoleAdminResponseMutation()
  const [invitationResponse] = useInvitationResponseMutation()

  const isInitialLoading = isLoadingProp ?? isNotificationsLoading
  const isRefetching = isNotificationsFetching && !isInitialLoading

  const deleteNotificationHandler = async (id: number) => {
    try {
      await deleteNotification(id).unwrap()
      toast.success(t('notice-list.notification-deleted'))
    } catch (e) {
      errorsHandler(e, t)
    }
  }

  const sendNoticeResponse = async (item: NotificationItem, action: RequestAction) => {
    try {
      const getPreparedData = (field: string) =>
        ({
          [field]: (item.data[field] as { id: number } | undefined)?.id,
          action,
        }) as Record<string, unknown>

      if (item.type === 'role_request') {
        await changeRoleAdminResponse({
          projectId: item.data.project!.id,
          data: getPreparedData(item.type) as { action: RequestAction; role_request: number },
        }).unwrap()
      }

      if (item.type === 'project_user_invitation') {
        await invitationResponse({
          projectId: item.data.project!.id,
          data: getPreparedData(item.type) as {
            action: RequestAction
            project_user_invitation: number
          },
        }).unwrap()
      }
    } catch (e) {
      errorsHandler(e, t)
    }
  }

  const readNotification = async (id: number) => {
    try {
      await updateNotification({ id, data: { is_read: true } }).unwrap()
    } catch (e) {
      errorsHandler(e, t)
    }
  }

  const visibleNotifications = notifications.filter(
    (item) => !item.is_deleted && !item.deleted
  )

  if (isInitialLoading) {
    return (
      <div className="mt-5 space-y-3" aria-busy="true" aria-label={t('notifications-list.loading')}>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <NotificationSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (visibleNotifications.length === 0) {
    return (
      <div className="mt-5 flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('notifications-list.empty')}</p>
      </div>
    )
  }

  return (
    <div className="relative mt-5 space-y-3">
      {isRefetching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{t('notifications-list.updating')}</span>
        </div>
      )}

      <div className={cn('space-y-3', isRefetching && 'pointer-events-none opacity-60')}>
        {visibleNotifications.map((item) => (
          <Notification
            key={item.id}
            item={item}
            deleteBlock={deleteNotificationHandler}
            sendNoticeResponse={sendNoticeResponse}
            readNotification={readNotification}
          />
        ))}
      </div>
    </div>
  )
}

export default NotificationsList
