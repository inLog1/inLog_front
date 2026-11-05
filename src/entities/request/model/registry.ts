import { requestStatusGroup } from './status'
import type { OrganizationKind, RequestStatus } from './types'
import { isAuthoredBy, isFiledByOrganization, isIncomingSent, type VisibleRequest } from './visibility'

/** One list, filtered in the page. These buckets do not grant access. */
export type RequestTab = 'all' | 'mine' | 'drafts' | 'incoming' | 'filed' | 'inProgress' | 'closed'

export type RequestTabScope = {
  organizationId: number
  userId: number
}

export function requestTabs(kind: OrganizationKind): readonly RequestTab[] {
  if (kind === 'laboratory') return ['all', 'incoming', 'filed', 'inProgress', 'closed']
  return ['all', 'mine', 'drafts', 'inProgress', 'closed']
}

export function requestMatchesTab(request: VisibleRequest, tab: RequestTab, scope: RequestTabScope): boolean {
  if (tab === 'all') return true
  if (tab === 'mine') return isAuthoredBy(request, scope.userId)
  if (tab === 'drafts') return request.status === 'draft'
  if (tab === 'incoming') return isIncomingSent(request, scope.organizationId)
  if (tab === 'filed') return isFiledByOrganization(request, scope.organizationId)
  if (tab === 'inProgress') return requestStatusGroup(request.status) === 'inProgress'
  return requestStatusGroup(request.status) === 'closed'
}

export type RequestRegistryStats = {
  total: number
  fresh: number
  inProgress: number
  closed: number
  /** No planned date is stored yet, so this stays zero. */
  overdue: number
}

/**
 * Counts the rows the caller is already allowed to read.
 * The same record is counted once even when a laboratory is both customer and executor.
 */
export function requestRegistryStats(
  requests: readonly { id: string; status: RequestStatus }[],
): RequestRegistryStats {
  const unique = new Map<string, RequestStatus>()
  for (const item of requests) unique.set(item.id, item.status)
  const statuses = [...unique.values()]
  return {
    total: statuses.length,
    fresh: statuses.filter((status) => status === 'sent').length,
    inProgress: statuses.filter((status) => requestStatusGroup(status) === 'inProgress').length,
    closed: statuses.filter((status) => requestStatusGroup(status) === 'closed').length,
    overdue: 0,
  }
}
