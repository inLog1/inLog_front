import { platformApi } from '../../../shared/api/platformApi'
import type { RequestDraftDetails } from './draft'
import type { OrganizationKind, RequestRecord } from './types'

/** List and detail projection. Names are labels; they are not stored on the record. */
export type RequestListItem = RequestRecord & {
  customerShortName: string
  executorShortName: string
  authorName: string
}

export type RequestListResponse = {
  requests: RequestListItem[]
  organizationKind: OrganizationKind
}
export type RequestResponse = { request: RequestListItem }
export type ExecutorLaboratory = { id: number; shortName: string }
export type ExecutorListResponse = { laboratories: ExecutorLaboratory[] }

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
  details?: RequestDraftDetails
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
  }),
})

export const {
  useGetRequestsQuery,
  useGetRequestQuery,
  useGetExecutorLaboratoriesQuery,
  useGetRequestCatalogQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
} = requestApi
