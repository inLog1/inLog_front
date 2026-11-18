import type { MouseEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RequestAction } from '../../../shared/types/enums'
import { cn } from '../../../shared/lib/utils'
import { formatNotificationDate } from '../lib/format-notification-date'
import {
  getNotificationTitleKey,
  noticeTypesForButtons,
  noticeTypesToShowBlocks,
} from '../lib/notice-types'
import type { NotificationProps } from '../model/types'
import NotificationDescription from './NotificationDescription'
import NotificationPerson from './NotificationPerson'
import NotificationTaskChanges from './NotificationTaskChanges'
import './Notification.css'

const Notification = ({
  item,
  isModalItem,
  deleteBlock,
  sendNoticeResponse,
  readNotification,
}: NotificationProps) => {
  const { t } = useTranslation()

  const sendResponse = (action: RequestAction) => {
    sendNoticeResponse?.(item, action)
  }

  const deleteNotice = (event: MouseEvent) => {
    event.stopPropagation()
    deleteBlock?.(item.id)
  }

  const readNotificationHandler = () => {
    if (!item.is_read) {
      readNotification?.(item.id)
    }
  }

  const titleKey = getNotificationTitleKey(item.type)
  const title = titleKey
    ? t(`notifications-settings.rows.${titleKey}`)
    : ''
  const showInfoBlock = noticeTypesToShowBlocks.includes(item.type as typeof noticeTypesToShowBlocks[number])
  const showActionButtons = noticeTypesForButtons.includes(item.type as typeof noticeTypesForButtons[number])
  const projectName = item.data?.project?.name

  const noticeInfoBlock = (
    <div className="notification-top row-flex-sb">
      <div className="notification-top-project-name font-15-normal">
        <span className="dotted-text-250">{title}</span>
        {projectName && (
          <span className="dotted-text-150">[{projectName}]</span>
        )}
      </div>
    </div>
  )

  const taskChangesBlock = (
    <>
      {noticeInfoBlock}
      {item.data?.html && <NotificationTaskChanges html={item.data.html} />}
    </>
  )

  return (
    <div
      className={cn(
        'notification',
        item.is_read ? 'notification-read' : 'notification-unread'
      )}
      onMouseEnter={readNotificationHandler}
    >
      <time
        dateTime={item.created_at}
        className="font-15-normal notification-date"
      >
        {formatNotificationDate(item.created_at, !isModalItem)}
      </time>

      <button
        type="button"
        className="notification-top-cancel-icon"
        onClick={deleteNotice}
        aria-label={t('notifications-list.delete')}
      >
        <X width={13} height={13} />
      </button>

      {showInfoBlock ? noticeInfoBlock : taskChangesBlock}

      {showInfoBlock && (
        <div className="mt-10 row-flex-10">
          <NotificationPerson sender={item.sender} />
        </div>
      )}

      {showInfoBlock && (
        <div className="font-15-normal mt-10">
          <NotificationDescription item={item} />
        </div>
      )}

      {showActionButtons && (
        <div className="mt-10 row-flex-10 notification-buttons">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              sendResponse('accept')
            }}
          >
            {t('notifications-list.accept')}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              sendResponse('reject')
            }}
          >
            {t('notifications-list.reject')}
          </button>
        </div>
      )}
    </div>
  )
}

export default Notification
