import { platformApi } from '../../../shared/api/platformApi'
import type { RequestBasisDocument } from './basis'
import type { RequestDraftDetails } from './draft'
import type { OrganizationKind, RequestRecord } from './types'

export type RequestEventType =
  | 'sent'
  | 'review_started'
  | 'returned'
  | 'resent'
  | 'rejected'
  | 'withdrawn'
  | 'derived'
  | 'program_started'
  | 'program_changed'
  | 'program_submitted'
  | 'program_returned'
  | 'program_approved'
  | 'request_approved'

export type RequestEventView = {
  id: string
  requestId: string
  type: RequestEventType
  userId: number
  authorName: string
  at: string
  previousStatus: string
  newStatus: string
  comment?: string
  previousApproval?: string
  nextApproval?: string
}

export type RequestProgramBody = RequestRevisionBody & {
  lines: unknown
  note?: string
}

/** List and detail projection. Names are labels; they are not stored on the record. */
export type RequestListItem = RequestRecord & {
  customerShortName: string
  executorShortName: string
  authorName: string
  basisDocument?: RequestBasisDocument | null
  events: RequestEventView[]
  sourceRequestNumber?: string
}

export type RequestRevisionBody = {
  organizationId: number
  expectedRevision: number
}

export type RequestReasonBody = RequestRevisionBody & {
  reason: string
}

export type RequestListResponse = {
  requests: RequestListItem[]
  organizationKind: OrganizationKind
}
export type RequestResponse = { request: RequestListItem }
export type ExecutorLaboratory = { id: number; shortName: string }
export type ExecutorListResponse = {
  laboratories: ExecutorLaboratory[]
  customers: ExecutorLaboratory[]
}

export type RequestCatalogOption = { id: string; label: string }

export type RequestCatalogSample = {
  id: string
  number: string
  geologicalNumber: string
  sampleKind: 'core' | 'fluid'
  interval: string
  geometry: 'cylinder' | 'bottle'
  remainder: string
  availability: 'available' | 'in_use' | 'archived'
}

/** Demonstration options for the draft wizard. Labels are a fallback for i18n. */
export type RequestCatalog = {
  organizationKind: OrganizationKind
  fields: RequestCatalogOption[]
  wells: RequestCatalogOption[]
  pads: RequestCatalogOption[]
  formations: RequestCatalogOption[]
  materials: RequestCatalogOption[]
  fluidKinds: RequestCatalogOption[]
  wellTypes: RequestCatalogOption[]
  sampleKinds: RequestCatalogOption[]
  workKinds: RequestCatalogOption[]
  units: RequestCatalogOption[]
  curators: RequestCatalogOption[]
  samples: RequestCatalogSample[]
}

export type CreateRequestBody = {
  organizationId: number
  executorOrganizationId: number
  title?: string
  customerOrganizationId?: number
  details?: RequestDraftDetails
}

export type UpdateRequestBody = {
  organizationId: number
  expectedRevision: number
  title?: string
  executorOrganizationId?: number
  customerOrganizationId?: number
  details?: RequestDraftDetails
}

export type SendRequestBody = UpdateRequestBody

export function requestBasisUploadRequest(organizationId: number, requestId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return {
    url: `requests/${requestId}/basis/?organization=${organizationId}`,
    method: 'POST' as const,
    body: formData,
  }
}

const overviewTag = { type: 'Personnel' as const, id: 'overview' }

/**
 * Proposed mock contract. Live mode has no request endpoints yet.
 * Creating or editing a draft also refreshes the corporate card counter.
 */
export const requestApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getRequests: build.query<RequestListResponse, { organizationId: number }>({
      query: ({ organizationId }) => `requests/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Requests', id: `org-${arg.organizationId}` }],
    }),
    getRequest: build.query<RequestResponse, { organizationId: number; requestId: string }>({
      query: ({ organizationId, requestId }) => `requests/${requestId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Requests', id: arg.requestId }],
    }),
    getExecutorLaboratories: build.query<ExecutorListResponse, { organizationId: number }>({
      query: ({ organizationId }) => `requests/laboratories/?organization=${organizationId}`,
    }),
    getRequestCatalog: build.query<RequestCatalog, { organizationId: number }>({
      query: ({ organizationId }) => `requests/catalog/?organization=${organizationId}`,
    }),
    createRequest: build.mutation<RequestResponse, CreateRequestBody>({
      query: (body) => ({ url: 'requests/', method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: `org-${arg.organizationId}` },
        overviewTag,
      ],
    }),
    updateRequest: build.mutation<RequestResponse, UpdateRequestBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: arg.requestId },
        { type: 'Requests', id: `org-${arg.organizationId}` },
        overviewTag,
      ],
    }),
    uploadRequestBasis: build.mutation<RequestResponse, { organizationId: number; requestId: string; file: File }>({
      query: ({ organizationId, requestId, file }) => requestBasisUploadRequest(organizationId, requestId, file),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: arg.requestId },
        { type: 'Requests', id: `org-${arg.organizationId}` },
      ],
    }),
    deleteRequestBasis: build.mutation<RequestResponse, { organizationId: number; requestId: string }>({
      query: ({ organizationId, requestId }) => ({
        url: `requests/${requestId}/basis/?organization=${organizationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: arg.requestId },
        { type: 'Requests', id: `org-${arg.organizationId}` },
      ],
    }),
    sendRequest: build.mutation<RequestResponse, SendRequestBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/send/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: arg.requestId },
        { type: 'Requests', id: `org-${arg.organizationId}` },
        overviewTag,
      ],
    }),
    startRequestReview: build.mutation<RequestResponse, RequestRevisionBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/review/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    returnRequest: build.mutation<RequestResponse, RequestReasonBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/return/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    rejectRequest: build.mutation<RequestResponse, RequestReasonBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/reject/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    withdrawRequest: build.mutation<RequestResponse, RequestRevisionBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/withdraw/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    deriveRequest: build.mutation<RequestResponse, RequestRevisionBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/derive/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Requests', id: arg.requestId },
        { type: 'Requests', id: `org-${arg.organizationId}` },
        overviewTag,
      ],
    }),
    saveRequestProgram: build.mutation<RequestResponse, RequestProgramBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/program/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    submitRequestProgram: build.mutation<RequestResponse, RequestRevisionBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/program/submit/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    approveRequestProgram: build.mutation<RequestResponse, RequestRevisionBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/program/approve/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
    returnRequestProgram: build.mutation<RequestResponse, RequestReasonBody & { requestId: string }>({
      query: ({ requestId, ...body }) => ({ url: `requests/${requestId}/program/return/`, method: 'POST', body }),
      invalidatesTags: reviewTags,
    }),
  }),
})

function reviewTags(
  _result: RequestResponse | undefined,
  _error: unknown,
  arg: { requestId: string; organizationId: number },
) {
  return [
    { type: 'Requests' as const, id: arg.requestId },
    { type: 'Requests' as const, id: `org-${arg.organizationId}` },
    overviewTag,
  ]
}

export const {
  useGetRequestsQuery,
  useGetRequestQuery,
  useGetExecutorLaboratoriesQuery,
  useGetRequestCatalogQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useUploadRequestBasisMutation,
  useDeleteRequestBasisMutation,
  useDeriveRequestMutation,
  useRejectRequestMutation,
  useReturnRequestMutation,
  useSendRequestMutation,
  useStartRequestReviewMutation,
  useWithdrawRequestMutation,
  useSaveRequestProgramMutation,
  useSubmitRequestProgramMutation,
  useApproveRequestProgramMutation,
  useReturnRequestProgramMutation,
} = requestApi
