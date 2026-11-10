import type { RequestDraftDetails } from './draft'

/** One request record. A laboratory filing for itself uses the same id on both sides. */
export type RequestRecord = {
  id: string
  number: string
  customerOrganizationId: number
  executorOrganizationId: number
  /** Organization that saved the draft. Absent rows were filed by the customer. */
  filedByOrganizationId?: number
  authorId: number
  status: RequestStatus
  title: string
  createdAt: string
  updatedAt: string
  revision: number
  /** Points at mock requestBasisFiles. Absent until a document is attached. */
  basisFileId?: string
  sentAt?: string
  sentByUserId?: number
  /** Draft opened from a rejected or withdrawn request. History is not copied. */
  sourceRequestId?: string
  reviewStartedAt?: string
  reviewStartedByUserId?: number
  returnReason?: string
  returnedAt?: string
  returnedByUserId?: number
  rejectionReason?: string
  rejectedAt?: string
  rejectedByUserId?: number
  withdrawnAt?: string
  withdrawnByUserId?: number
  /** Absent on drafts saved before the wizard. Parties stay in the ids above. */
  details?: RequestDraftDetails
}

export const REQUEST_TITLE_MAX = 200

export const REQUEST_STATUSES = [
  'draft',
  'sent',
  'in_review',
  'rework',
  'clarification',
  'accepted',
  'approved',
  'distributed',
  'in_progress',
  'results_published',
  'completed',
  'rejected',
  'withdrawn',
  'cancelled',
] as const

export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Buckets for later list filters. Incoming and "mine" are not statuses. */
export const REQUEST_STATUS_GROUPS = {
  draft: ['draft'],
  inProgress: ['sent', 'in_review', 'rework', 'clarification', 'accepted', 'approved', 'distributed', 'in_progress', 'results_published'],
  closed: ['completed', 'rejected', 'withdrawn', 'cancelled'],
} as const satisfies Record<string, readonly RequestStatus[]>

export type RequestStatusGroup = keyof typeof REQUEST_STATUS_GROUPS

export type OrganizationKind = 'laboratory' | 'customer'

export type RequestParty = {
  id: number
  kind: OrganizationKind
}
