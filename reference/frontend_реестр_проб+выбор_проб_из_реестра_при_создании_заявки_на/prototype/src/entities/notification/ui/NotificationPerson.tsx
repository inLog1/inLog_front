import { getUserFullName } from '../../../shared/lib/get-valid-text'
import type { NotificationUser } from '../model/types'

interface NotificationPersonProps {
  sender?: NotificationUser
}

const getInitials = (sender?: NotificationUser) => {
  const fullName = getUserFullName(sender)
  if (!fullName) return '?'

  const parts = fullName.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts[1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase() || '?'
}

const NotificationPerson = ({ sender }: NotificationPersonProps) => {
  if (!sender) return null

  const fullName = getUserFullName(sender)
  if (!fullName) return null

  return (
    <>
      {sender.avatar ? (
        <img
          src={sender.avatar}
          alt={fullName}
          className="notification-sender__img"
        />
      ) : (
        <div className="notification-sender-name-phone">
          {getInitials(sender)}
        </div>
      )}
      <span className="font-15-normal">{fullName}</span>
    </>
  )
}

export default NotificationPerson
