import { platformApi } from '../../../shared/api/platformApi'
import type {
  AddSampleDocumentsInput,
  ChangeSampleInspectionInput,
  ChangeSamplePlaceInput,
  ChangeSampleStatusInput,
  RegisterSampleBatchInput,
  RegisterSampleInput,
  RegisterSubsampleInput,
  SampleBatchResponse,
  SampleDocumentsResponse,
  SampleHistoryResponse,
  SampleListResponse,
  SampleResponse,
} from './contracts'

/**
 * Proposed mock contract. The worker serves these paths only while apiMode is mock.
 * Live mode has no sample backend. Use samplesMode() and do not call these hooks there:
 * a live request is a real miss, not an empty registry.
 */

type SampleTag = { type: 'Samples'; id: string }

function organizationTag(organizationId: number): SampleTag {
  return { type: 'Samples', id: `org-${organizationId}` }
}

function sampleTag(sampleId: string): SampleTag {
  return { type: 'Samples', id: sampleId }
}

function changedTags(
  _result: unknown,
  error: unknown,
  arg: { organizationId: number; sampleId?: string; sampleIds?: string[] },
): SampleTag[] {
  if (error) return []
  const ids = arg.sampleIds ?? (arg.sampleId ? [arg.sampleId] : [])
  return [organizationTag(arg.organizationId), ...ids.map(sampleTag)]
}

export function sampleDocumentUploadRequest(input: Omit<AddSampleDocumentsInput, 'files'> & { files: File[] }) {
  const body = new FormData()
  body.append('organizationId', String(input.organizationId))
  body.append('type', input.type)
  body.append('documentNumber', input.documentNumber ?? '')
  body.append('documentDate', input.documentDate ?? '')
  for (const sampleId of input.sampleIds) body.append('sampleIds', sampleId)
  for (const file of input.files) body.append('files', file)
  return { url: 'samples/documents/', method: 'POST' as const, body }
}

export const sampleApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getSamples: build.query<SampleListResponse, { organizationId: number; includeDeleted?: boolean }>({
      query: ({ organizationId, includeDeleted }) => {
        const deleted = includeDeleted ? '&includeDeleted=1' : ''
        return `samples/?organization=${organizationId}${deleted}`
      },
      providesTags: (_result, _error, arg) => [organizationTag(arg.organizationId)],
    }),
    getSample: build.query<SampleResponse, { organizationId: number; sampleId: string }>({
      query: ({ organizationId, sampleId }) => `samples/${sampleId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [sampleTag(arg.sampleId)],
    }),
    getSampleHistory: build.query<SampleHistoryResponse, { organizationId: number; sampleId: string }>({
      query: ({ organizationId, sampleId }) => `samples/${sampleId}/history/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [sampleTag(arg.sampleId)],
    }),
    getSampleDocuments: build.query<SampleDocumentsResponse, { organizationId: number; sampleId: string }>({
      query: ({ organizationId, sampleId }) => `samples/${sampleId}/documents/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [sampleTag(arg.sampleId)],
    }),
    getSampleDocumentContent: build.query<Blob, { organizationId: number; sampleId: string; fileId: string }>({
      query: ({ organizationId, sampleId, fileId }) => ({
        url: `samples/${sampleId}/documents/${fileId}/content/?organization=${organizationId}`,
        responseHandler: (response) => response.blob(),
      }),
      keepUnusedDataFor: 0,
    }),
    createSample: build.mutation<SampleResponse, RegisterSampleInput>({
      query: (body) => ({ url: 'samples/', method: 'POST', body }),
      invalidatesTags: changedTags,
    }),
    createSubsample: build.mutation<SampleResponse, RegisterSubsampleInput>({
      query: (body) => ({ url: 'samples/subsamples/', method: 'POST', body }),
      invalidatesTags: changedTags,
    }),
    createSampleBatch: build.mutation<SampleBatchResponse, RegisterSampleBatchInput>({
      query: (body) => ({ url: 'samples/batch/', method: 'POST', body }),
      invalidatesTags: changedTags,
    }),
    updateSampleStatus: build.mutation<SampleResponse, ChangeSampleStatusInput>({
      query: ({ sampleId, ...body }) => ({ url: `samples/${sampleId}/status/`, method: 'PATCH', body: { ...body, sampleId } }),
      invalidatesTags: changedTags,
    }),
    updateSampleInspection: build.mutation<SampleResponse, ChangeSampleInspectionInput>({
      query: ({ sampleId, ...body }) => ({ url: `samples/${sampleId}/inspection/`, method: 'PATCH', body: { ...body, sampleId } }),
      invalidatesTags: changedTags,
    }),
    updateSamplePlace: build.mutation<SampleResponse, ChangeSamplePlaceInput>({
      query: ({ sampleId, ...body }) => ({ url: `samples/${sampleId}/place/`, method: 'PATCH', body: { ...body, sampleId } }),
      invalidatesTags: changedTags,
    }),
    addSampleDocuments: build.mutation<SampleDocumentsResponse, Omit<AddSampleDocumentsInput, 'files'> & { files: File[] }>({
      query: (input) => sampleDocumentUploadRequest(input),
      invalidatesTags: changedTags,
    }),
    linkSampleDocument: build.mutation<SampleDocumentsResponse, { organizationId: number; sampleId: string; fileId: string }>({
      query: ({ sampleId, ...body }) => ({ url: `samples/${sampleId}/documents/link/`, method: 'POST', body }),
      invalidatesTags: changedTags,
    }),
    unlinkSampleDocument: build.mutation<SampleDocumentsResponse, { organizationId: number; sampleId: string; fileId: string }>({
      query: ({ organizationId, sampleId, fileId }) => ({
        url: `samples/${sampleId}/documents/${fileId}/?organization=${organizationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: changedTags,
    }),
    deleteSample: build.mutation<SampleResponse, { organizationId: number; sampleId: string }>({
      query: ({ organizationId, sampleId }) => ({
        url: `samples/${sampleId}/?organization=${organizationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: changedTags,
    }),
  }),
})

export const {
  useGetSamplesQuery,
  useGetSampleQuery,
  useGetSampleHistoryQuery,
  useGetSampleDocumentsQuery,
  useLazyGetSampleDocumentContentQuery,
  useCreateSampleMutation,
  useCreateSubsampleMutation,
  useCreateSampleBatchMutation,
  useUpdateSampleStatusMutation,
  useUpdateSampleInspectionMutation,
  useUpdateSamplePlaceMutation,
  useAddSampleDocumentsMutation,
  useLinkSampleDocumentMutation,
  useUnlinkSampleDocumentMutation,
  useDeleteSampleMutation,
} = sampleApi
