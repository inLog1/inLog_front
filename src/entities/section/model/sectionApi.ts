import { platformApi } from '../../../shared/api/platformApi'
import type {
  PublishedSection,
  SectionDraftResponse,
  SectionListItem,
  SectionNavItem,
  SectionOptionForm,
  SectionOptionView,
  SectionPreview,
} from './types'

export type SectionListResponse = { sections: SectionListItem[] }
export type SectionNavResponse = { sections: SectionNavItem[] }
export type SectionOptionsResponse = { forms: SectionOptionForm[]; views: SectionOptionView[] }

export type SaveSectionBody = {
  organizationId: number
  sectionId?: string
  expectedRevision?: number
  expectedDraftRevision?: number
  schemaVersion: number
  title: string
  description: string
  iconKey: string
  formId: string
  tableViewId: string
  showCreate: boolean
  createLabel: string
  order: number
}

/**
 * Proposed mock contract. Pages call these hooks only when sectionsMode is mock.
 * The published query is not the draft query.
 */
export const sectionApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getSections: build.query<SectionListResponse, { organizationId: number }>({
      query: ({ organizationId }) => `sections/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: `list-${arg.organizationId}` }],
    }),
    getSectionOptions: build.query<SectionOptionsResponse, { organizationId: number }>({
      query: ({ organizationId }) => `sections/options/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: `options-${arg.organizationId}` }],
    }),
    createSection: build.mutation<{ id: string; revision: number; draftRevision: number }, { organizationId: number; title: string; description: string }>({
      query: (body) => ({ url: 'sections/', method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Sections', id: `list-${arg.organizationId}` }],
    }),
    getSectionDraft: build.query<SectionDraftResponse, { organizationId: number; sectionId: string }>({
      query: ({ organizationId, sectionId }) => `sections/${sectionId}/draft/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: arg.sectionId }],
    }),
    saveSectionDraft: build.mutation<SectionDraftResponse, SaveSectionBody & { sectionId: string; expectedRevision: number; expectedDraftRevision: number }>({
      query: ({ sectionId, ...body }) => ({ url: `sections/${sectionId}/draft/`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Sections', id: arg.sectionId },
        { type: 'Sections', id: `list-${arg.organizationId}` },
      ],
    }),
    publishSection: build.mutation<{ versionId: string; versionNumber: number; revision: number; publishedAt: string }, { organizationId: number; sectionId: string; expectedRevision: number; expectedDraftRevision: number }>({
      query: ({ sectionId, ...body }) => ({ url: `sections/${sectionId}/publish/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Sections', id: arg.sectionId },
        { type: 'Sections', id: `list-${arg.organizationId}` },
        { type: 'Sections', id: `published-${arg.sectionId}` },
        { type: 'Sections', id: `nav-${arg.organizationId}` },
      ],
    }),
    unpublishSection: build.mutation<{ id: string; active: boolean; revision: number }, { organizationId: number; sectionId: string; expectedRevision: number }>({
      query: ({ sectionId, ...body }) => ({ url: `sections/${sectionId}/unpublish/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Sections', id: arg.sectionId },
        { type: 'Sections', id: `list-${arg.organizationId}` },
        { type: 'Sections', id: `published-${arg.sectionId}` },
        { type: 'Sections', id: `nav-${arg.organizationId}` },
      ],
    }),
    getSectionNavigation: build.query<SectionNavResponse, { organizationId: number }>({
      query: ({ organizationId }) => `sections/navigation/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: `nav-${arg.organizationId}` }],
    }),
    getPublishedSection: build.query<PublishedSection, { organizationId: number; sectionId: string }>({
      query: ({ organizationId, sectionId }) => `sections/${sectionId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: `published-${arg.sectionId}` }],
    }),
    getSectionPreview: build.query<SectionPreview, { organizationId: number; sectionId: string }>({
      query: ({ organizationId, sectionId }) => `sections/${sectionId}/preview/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Sections', id: `preview-${arg.sectionId}` }],
    }),
  }),
})

export const {
  useGetSectionsQuery,
  useGetSectionOptionsQuery,
  useCreateSectionMutation,
  useGetSectionDraftQuery,
  useSaveSectionDraftMutation,
  usePublishSectionMutation,
  useUnpublishSectionMutation,
  useGetSectionNavigationQuery,
  useGetPublishedSectionQuery,
  useGetSectionPreviewQuery,
} = sectionApi

export function readSectionError(error: unknown): { status: number | null; code: string | null } {
  if (!error || typeof error !== 'object') return { status: null, code: null }
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null
  const data = 'data' in error ? error.data : null
  if (!data || typeof data !== 'object' || !('code' in data) || typeof data.code !== 'string') return { status, code: null }
  return { status, code: data.code }
}
