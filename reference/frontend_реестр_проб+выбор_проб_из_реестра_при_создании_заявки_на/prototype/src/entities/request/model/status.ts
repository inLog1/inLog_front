import {
  REQUEST_STATUSES,
  REQUEST_STATUS_GROUPS,
  type RequestStatus,
  type RequestStatusGroup,
} from './types'

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value)
}

export function requestStatusGroup(status: RequestStatus): RequestStatusGroup {
  if ((REQUEST_STATUS_GROUPS.closed as readonly string[]).includes(status)) return 'closed'
  if (status === 'draft') return 'draft'
  return 'inProgress'
}

/** i18n key. The status code stays stable when the label changes. */
export function requestStatusLabelKey(status: RequestStatus): string {
  return `requests.status.${status}`
}

export function requestStatusGroupLabelKey(group: RequestStatusGroup): string {
  return `requests.group.${group}`
}
