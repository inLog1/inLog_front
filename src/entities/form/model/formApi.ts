import { platformApi } from '../../../shared/api/platformApi'
import type {
  FormAnswers,
  FormDraftResponse,
  FormListItem,
  FormRecordListItem,
  FormRecordResponse,
  FormSchema,
  PublishedFormResponse,
} from './types'

export type FormListResponse = { forms: FormListItem[] }
export type FormRecordListResponse = { records: FormRecordListItem[] }

export type SaveDraftBody = {
  organizationId: number
  formId: string
  title: string
  description: string
  schema: FormSchema
  expectedFormRevision: number
  expectedDraftRevision: number
}

export type PublishBody = {
  organizationId: number
  formId: string
  expectedFormRevision: number
  expectedDraftRevision: number
}

export type CreateRecordBody = {
  organizationId: number
  formId: string
  formVersionId: string
  values: FormAnswers
}

/**
 * Proposed mock contract. Pages call these hooks only when formsMode is mock.
 * The fill query is not the draft query: a published DTO has no draft schema.
 */
export const formApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getForms: build.query<FormListResponse, { organizationId: number }>({
      query: ({ organizationId }) => `forms/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Forms', id: `org-${arg.organizationId}` }],
    }),
    createForm: build.mutation<{ id: string; revision: number; draftRevision: number }, { organizationId: number; title: string; description: string }>({
      query: (body) => ({ url: 'forms/', method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Forms', id: `org-${arg.organizationId}` }],
    }),
    getFormDraft: build.query<FormDraftResponse, { organizationId: number; formId: string }>({
      query: ({ organizationId, formId }) => `forms/${formId}/draft/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Forms', id: arg.formId }],
    }),
    saveFormDraft: build.mutation<FormDraftResponse, SaveDraftBody>({
      query: ({ formId, ...body }) => ({ url: `forms/${formId}/draft/`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Forms', id: arg.formId }, { type: 'Forms', id: `org-${arg.organizationId}` }],
    }),
    publishForm: build.mutation<{ versionId: string; versionNumber: number; formRevision: number; publishedAt: string }, PublishBody>({
      query: ({ formId, ...body }) => ({ url: `forms/${formId}/publish/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Forms', id: arg.formId },
        { type: 'Forms', id: `org-${arg.organizationId}` },
        { type: 'Forms', id: `pub-${arg.formId}` },
      ],
    }),
    getPublishedForm: build.query<PublishedFormResponse, { organizationId: number; formId: string }>({
      query: ({ organizationId, formId }) => `forms/${formId}/published/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Forms', id: `pub-${arg.formId}` }],
    }),
    getFormRecords: build.query<FormRecordListResponse, { organizationId: number; formId: string }>({
      query: ({ organizationId, formId }) => `forms/${formId}/records/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Forms', id: `records-${arg.formId}` }],
    }),
    createFormRecord: build.mutation<{ id: string; formVersionId: string; createdAt: string }, CreateRecordBody>({
      query: ({ formId, ...body }) => ({ url: `forms/${formId}/records/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Forms', id: `records-${arg.formId}` }],
    }),
    getFormRecord: build.query<FormRecordResponse, { organizationId: number; formId: string; recordId: string }>({
      query: ({ organizationId, formId, recordId }) => `forms/${formId}/records/${recordId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Forms', id: `record-${arg.recordId}` }],
    }),
  }),
})

export const {
  useGetFormsQuery,
  useCreateFormMutation,
  useGetFormDraftQuery,
  useSaveFormDraftMutation,
  usePublishFormMutation,
  useGetPublishedFormQuery,
  useGetFormRecordsQuery,
  useCreateFormRecordMutation,
  useGetFormRecordQuery,
} = formApi

export function readFormError(error: unknown): { status: number | null; code: string | null; fields: Record<string, string> } {
  if (!error || typeof error !== 'object') return { status: null, code: null, fields: {} }
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null
  const data = 'data' in error ? error.data : null
  if (!data || typeof data !== 'object') return { status, code: null, fields: {} }
  const code = 'code' in data && typeof data.code === 'string' ? data.code : null
  const rawFields = 'fields' in data && data.fields && typeof data.fields === 'object' ? data.fields as Record<string, unknown> : {}
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawFields)) {
    if (typeof value === 'string') fields[key] = value
  }
  return { status, code, fields }
}
