import { useState } from 'react'
import { Bell, BellOff, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useInvitationResponseMutation,
  useNotificationsWebSocket,
  useUpdateNotificationMutation,
  Notification,
} from '../../../entities/notification'
import { useChangeRoleAdminResponseMutation } from '../../../entities/user/model/userSlice'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { routes } from '../../../shared/lib/routes'
import { cn } from '../../../shared/lib/utils'
import type { RequestAction } from '../../../shared/types/enums'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { ScrollArea } from '../../../shared/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip'
import NotificationSkeleton from '../../../features/notifications/notifications-list/ui/NotificationSkeleton'
import type { Notification as NotificationItem } from '../../../entities/notification/model/types'

const PREVIEW_SKELETON_COUNT = 3
const PREVIEW_LIMIT = 8

interface NotificationsMenuProps {
  triggerClassName?: string
}

export function NotificationsMenu({ triggerClassName }: NotificationsMenuProps = {}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useNotificationsWebSocket()

  const {
    data: notifications = [],
    isLoading,
    isFetching,
  } = useGetNotificationsQuery()
  const [deleteNotification] = useDeleteNotificationMutation()
  const [updateNotification] = useUpdateNotificationMutation()
  const [changeRoleAdminResponse] = useChangeRoleAdminResponseMutation()
  const [invitationResponse] = useInvitationResponseMutation()

  const visibleNotifications = notifications.filter(
    (item) => !item.is_deleted && !item.deleted
  )
  const unreadCount = visibleNotifications.filter((item) => !item.is_read).length
  const previewNotifications = visibleNotifications.slice(0, PREVIEW_LIMIT)
  const hasMoreNotifications = visibleNotifications.length > PREVIEW_LIMIT
  const isRefetching = isFetching && !isLoading

  const deleteNotificationHandler = async (id: number) => {
    try {
      await deleteNotification(id).unwrap()
      toast.success(t('notice-list.notification-deleted'))
    } catch (error) {
      errorsHandler(error, t)
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
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const readNotification = async (id: number) => {
    try {
      await updateNotification({ id, data: { is_read: true } }).unwrap()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('relative', triggerClassName)}
              aria-label={t('header.notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('header.notifications')}</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),420px)] overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{t('header.notifications')}</h2>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? t('header.unread-notifications', { count: unreadCount })
                : t('header.all-caught-up')}
            </p>
          </div>

          <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2" asChild>
            <Link
              to={routes.settings.notifications()}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5"
            >
              {t('header.view-all')}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div
            className="space-y-2 bg-background p-3"
            aria-busy="true"
            aria-label={t('notifications-list.loading')}
          >
            {Array.from({ length: PREVIEW_SKELETON_COUNT }).map((_, index) => (
              <NotificationSkeleton key={index} />
            ))}
          </div>
        ) : previewNotifications.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 bg-background px-6 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('header.no-notifications')}</p>
            <p className="text-xs text-muted-foreground">{t('header.no-notifications-description')}</p>
          </div>
        ) : (
          <>
            {isRefetching && (
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>{t('notifications-list.updating')}</span>
              </div>
            )}

            <ScrollArea className="h-[min(60vh,420px)] bg-background">
              <div
                className={cn(
                  'space-y-2 p-3',
                  isRefetching && 'pointer-events-none opacity-70'
                )}
              >
                {previewNotifications.map((item) => (
                  <Notification
                    key={item.id}
                    item={item}
                    isModalItem
                    deleteBlock={deleteNotificationHandler}
                    sendNoticeResponse={sendNoticeResponse}
                    readNotification={readNotification}
                  />
                ))}
              </div>
            </ScrollArea>

            {hasMoreNotifications && (
              <div className="border-t border-border bg-muted/30 px-4 py-2.5">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={routes.settings.notifications()} onClick={() => setOpen(false)}>
                    {t('header.show-more-notifications', {
                      count: visibleNotifications.length - PREVIEW_LIMIT,
                    })}
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
