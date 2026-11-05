import type { RequestDraftDetails } from './draft'

/** One request record. A laboratory filing for itself uses the same id on both sides. */
export type RequestRecord = {
  id: string
  number: string
  customerOrganizationId: number
  executorOrganizationId: number
  authorId: number
  status: RequestStatus
  title: string
  createdAt: string
  updatedAt: string
  revision: number
  /** Absent on drafts saved before the wizard. Parties stay in the ids above. */
  details?: RequestDraftDetails
}

export const REQUEST_TITLE_MAX = 200

export const REQUEST_STATUSES = [
  'draft',
  'sent',
  'clarification',
  'accepted',
  'approved',
  'distributed',
  'in_progress',
  'results_published',
  'completed',
  'rejected',
  'cancelled',
] as const

export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Buckets for later list filters. Incoming and "mine" are not statuses. */
export const REQUEST_STATUS_GROUPS = {
  draft: ['draft'],
  inProgress: ['sent', 'clarification', 'accepted', 'approved', 'distributed', 'in_progress', 'results_published'],
  closed: ['completed', 'rejected', 'cancelled'],
} as const satisfies Record<string, readonly RequestStatus[]>

export type RequestStatusGroup = keyof typeof REQUEST_STATUS_GROUPS

export type OrganizationKind = 'laboratory' | 'customer'

export type RequestParty = {
  id: number
  kind: OrganizationKind
}
