import { format } from 'date-fns'
import { DATE_VIEW_FORMAT } from '../../../shared/config/constants'

export const formatNotificationDate = (
  date: string | undefined,
  showTime: boolean
) => {
  if (!date) return ''

  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return ''

  return format(
    parsedDate,
    showTime ? `${DATE_VIEW_FORMAT} HH:mm` : DATE_VIEW_FORMAT
  )
}
