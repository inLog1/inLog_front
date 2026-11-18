interface NotificationTaskChangesProps {
  html: string
}

const NotificationTaskChanges = ({ html }: NotificationTaskChangesProps) => (
  <div
    className="notification-task-changes-block"
    dangerouslySetInnerHTML={{ __html: html }}
  />
)

export default NotificationTaskChanges
