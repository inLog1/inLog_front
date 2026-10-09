import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from '../../../shared/api/clientApi'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import type {
  AdminAccess,
  AdminResource,
  AdminMember,
  AdminOrganization,
  AdminOrganizationMember,
  AdminProject,
  AdminTask,
  AdminTaskStatus,
  AdminTaskTag,
  AdminUser,
  PaginatedResponse,
  CreateAdminOrganizationBody,
  CreateAdminOrganizationMemberBody,
  CreateAdminProjectBody,
  CreateAdminProjectMemberBody,
  CreateProjectEmailInvitationBody,
  CreateProjectUserInvitationBody,
  CreateOrganizationEmailInvitationBody,
  CreateOrganizationUserInvitationBody,
  OrganizationEmailInvitation,
  UpdateAdminOrganizationBody,
  UpdateAdminProjectBody,
} from './types'
import type { PlatformRole } from '../../../shared/types/platform-role'

export const platformAdminApi = createApi({
  reducerPath: 'platformAdminApi',
  baseQuery,
  tagTypes: [
    'AdminUsers',
    'AdminAccess',
    'AdminResources',
    'AdminTasks',
    'AdminTaskStatuses',
    'AdminTaskTags',
    'AdminMembers',
    'AdminOrganizations',
    'AdminOrganizationInvitations',
    'AdminProjects',
    'AdminProjectMembers',
    'AdminProjectInvitations',
  ],
  endpoints: (builder) => ({
    getAdminAccess: builder.query<AdminAccess, void>({
      query: () => 'admin/access/',
      providesTags: ['AdminAccess'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (error: unknown) {
          errorsHandler((error as { error?: unknown })?.error)
        }
      },
    }),
    getAdminResources: builder.query<AdminResource[], void>({
      query: () => 'admin/resources/',
      providesTags: ['AdminResources'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (error: unknown) {
          errorsHandler((error as { error?: unknown })?.error)
        }
      },
    }),
    getAdminTableRows: builder.query<
      PaginatedResponse<Record<string, unknown>>,
      { url: string; limit?: number; offset?: number; search?: string }
    >({
      query: ({ url, limit = 25, offset = 0, search }) => ({
        url: adminTablePath(url),
        params: { limit, offset, ...(search ? { search } : {}) },
      }),
    }),
    getAdminUsers: builder.query<
      PaginatedResponse<AdminUser>,
      { limit?: number; offset?: number; search?: string }
    >({
      query: ({ limit = 50, offset = 0, search }) => ({
        url: 'admin/user/',
        params: { limit, offset, ...(search ? { search } : {}) },
      }),
      providesTags: ['AdminUsers'],
    }),
    deleteAdminUser: builder.mutation<void, number>({
      query: (userId) => ({
        url: `admin/user/${userId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminUsers'],
    }),
    updateAdminUserRole: builder.mutation<AdminUser, { userId: number; role: PlatformRole }>({
      query: ({ userId, role }) => ({
        url: `admin/user/${userId}/role/`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: ['AdminUsers'],
    }),
    getAdminMembers: builder.query<
      PaginatedResponse<AdminMember>,
      {
        limit?: number
        offset?: number
        search?: string
        type?: 'project' | 'organization'
        organization?: number
        project?: number
      }
    >({
      query: ({ limit = 50, offset = 0, search, type = 'project', organization, project }) => ({
        url: 'admin/member/',
        params: {
          limit,
          offset,
          type,
          ...(search ? { search } : {}),
          ...(organization ? { organization } : {}),
          ...(project ? { project } : {}),
        },
      }),
      providesTags: ['AdminMembers'],
    }),
    getAdminOrganizations: builder.query<
      PaginatedResponse<AdminOrganization>,
      { limit?: number; offset?: number; search?: string }
    >({
      query: ({ limit = 50, offset = 0, search }) => ({
        url: 'admin/organization/',
        params: { limit, offset, ...(search ? { search } : {}) },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AdminOrganizations' as const, id })),
              { type: 'AdminOrganizations', id: 'LIST' },
            ]
          : [{ type: 'AdminOrganizations', id: 'LIST' }],
    }),
    updateAdminOrganization: builder.mutation<
      AdminOrganization,
      { id: number; body: UpdateAdminOrganizationBody }
    >({
      query: ({ id, body }) => ({
        url: `admin/organization/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'AdminOrganizations', id: 'LIST' }],
    }),
    createAdminOrganization: builder.mutation<AdminOrganization, CreateAdminOrganizationBody>({
      query: (body) => ({
        url: 'admin/tables/organizations/organization/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AdminOrganizations', id: 'LIST' }],
    }),
    deleteAdminOrganization: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/organization/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminOrganizations', id: 'LIST' }],
    }),
    createAdminOrganizationMember: builder.mutation<
      { id: number; user: number; organization: number; role: string },
      CreateAdminOrganizationMemberBody
    >({
      query: (body) => ({
        url: 'admin/tables/organizations/organizationmember/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AdminOrganizations', id: 'LIST' }, 'AdminMembers'],
    }),
    deleteAdminOrganizationMember: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/tables/organizations/organizationmember/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminOrganizations', id: 'LIST' }, 'AdminMembers'],
    }),
    getAdminOrganizationEmailInvitations: builder.query<
      PaginatedResponse<OrganizationEmailInvitation>,
      { organization: number }
    >({
      query: ({ organization }) => ({
        url: 'admin/tables/organizations/organizationunregisteredemailinvitation/',
        params: { organization, limit: 100, offset: 0 },
      }),
      providesTags: ['AdminOrganizationInvitations'],
    }),
    createAdminOrganizationEmailInvitation: builder.mutation<
      OrganizationEmailInvitation,
      CreateOrganizationEmailInvitationBody
    >({
      query: (body) => ({
        url: 'admin/tables/organizations/organizationunregisteredemailinvitation/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminOrganizationInvitations'],
    }),
    deleteAdminOrganizationEmailInvitation: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/tables/organizations/organizationunregisteredemailinvitation/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminOrganizationInvitations'],
    }),
    createAdminOrganizationUserInvitation: builder.mutation<
      { id: number },
      CreateOrganizationUserInvitationBody
    >({
      query: (body) => ({
        url: 'admin/tables/organizations/organizationuserinvitation/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminOrganizationInvitations'],
    }),
    deleteAdminOrganizationUserInvitation: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/tables/organizations/organizationuserinvitation/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminOrganizationInvitations'],
    }),
    getAdminProjectMembers: builder.query<AdminOrganizationMember[], number>({
      query: (project) => ({
        url: 'admin/tables/projects/projectmember/',
        params: { project, limit: 200, offset: 0 },
      }),
      transformResponse: (response: PaginatedResponse<ProjectMemberResponse> | ProjectMemberResponse[]) => {
        const rows = Array.isArray(response) ? response : response.results ?? []
        return rows.map(toProjectMember)
      },
      providesTags: (_result, _error, project) => [{ type: 'AdminProjectMembers', id: project }],
    }),
    createAdminProjectMember: builder.mutation<
      { id: number; user: number; project: number; role: string },
      CreateAdminProjectMemberBody
    >({
      query: (body) => ({
        url: 'admin/tables/projects/projectmember/',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, body) => [
        { type: 'AdminProjectMembers', id: body.project },
        { type: 'AdminProjects', id: 'LIST' },
      ],
    }),
    deleteAdminProjectMember: builder.mutation<void, { id: number; project: number }>({
      query: ({ id }) => ({
        url: `admin/tables/projects/projectmember/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { project }) => [
        { type: 'AdminProjectMembers', id: project },
        { type: 'AdminProjects', id: 'LIST' },
      ],
    }),
    getAdminProjectEmailInvitations: builder.query<
      PaginatedResponse<OrganizationEmailInvitation>,
      { project: number }
    >({
      query: ({ project }) => ({
        url: 'admin/tables/projects/projectunregisteredemailinvitation/',
        params: { project, limit: 100, offset: 0 },
      }),
      providesTags: ['AdminProjectInvitations'],
    }),
    createAdminProjectEmailInvitation: builder.mutation<
      OrganizationEmailInvitation,
      CreateProjectEmailInvitationBody
    >({
      query: (body) => ({
        url: 'admin/tables/projects/projectunregisteredemailinvitation/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminProjectInvitations'],
    }),
    deleteAdminProjectEmailInvitation: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/tables/projects/projectunregisteredemailinvitation/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminProjectInvitations'],
    }),
    createAdminProjectUserInvitation: builder.mutation<
      { id: number },
      CreateProjectUserInvitationBody
    >({
      query: (body) => ({
        url: 'admin/tables/projects/projectuserinvitation/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminProjectInvitations'],
    }),
    deleteAdminProjectUserInvitation: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/tables/projects/projectuserinvitation/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminProjectInvitations'],
    }),
    getAdminProjects: builder.query<
      PaginatedResponse<AdminProject>,
      { limit?: number; offset?: number; search?: string; organization?: number }
    >({
      query: ({ limit = 50, offset = 0, search, organization }) => ({
        url: 'admin/project/',
        params: {
          limit,
          offset,
          ...(search ? { search } : {}),
          ...(organization ? { organization } : {}),
        },
      }),
      transformResponse: (response: PaginatedResponse<AdminProjectResponse>) => ({
        ...response,
        results: (response.results ?? []).map(toAdminProject),
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AdminProjects' as const, id })),
              { type: 'AdminProjects', id: 'LIST' },
            ]
          : [{ type: 'AdminProjects', id: 'LIST' }],
    }),
    createAdminProject: builder.mutation<AdminProject, CreateAdminProjectBody>({
      query: (body) => ({
        url: 'admin/tables/projects/project/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AdminProjects', id: 'LIST' }],
    }),
    updateAdminProject: builder.mutation<
      AdminProject,
      { id: number; body: UpdateAdminProjectBody }
    >({
      query: ({ id, body }) => ({
        url: `admin/project/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'AdminProjects', id: 'LIST' }],
    }),
    deleteAdminProject: builder.mutation<void, number>({
      query: (id) => ({
        url: `admin/project/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminProjects', id: 'LIST' }],
    }),
    getAdminTasks: builder.query<
      PaginatedResponse<AdminTask>,
      { limit?: number; offset?: number; search?: string; project?: number }
    >({
      query: ({ limit = 50, offset = 0, search, project }) => ({
        url: 'admin/task/',
        params: {
          limit,
          offset,
          ...(search ? { search } : {}),
          ...(project ? { project } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AdminTasks' as const, id })),
              { type: 'AdminTasks', id: 'LIST' },
            ]
          : [{ type: 'AdminTasks', id: 'LIST' }],
    }),
    deleteAdminTask: builder.mutation<void, number>({
      query: (taskId) => ({
        url: `admin/task/${taskId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminTasks', id: 'LIST' }],
    }),
    getAdminTaskStatuses: builder.query<
      PaginatedResponse<AdminTaskStatus>,
      { limit?: number; offset?: number; project?: number }
    >({
      query: ({ limit = 50, offset = 0, project }) => ({
        url: 'admin/task-status/',
        params: { limit, offset, ...(project ? { project } : {}) },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AdminTaskStatuses' as const, id })),
              { type: 'AdminTaskStatuses', id: 'LIST' },
            ]
          : [{ type: 'AdminTaskStatuses', id: 'LIST' }],
    }),
    deleteAdminTaskStatus: builder.mutation<void, number>({
      query: (statusId) => ({
        url: `admin/task-status/${statusId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminTaskStatuses', id: 'LIST' }],
    }),
    getAdminTaskTags: builder.query<
      PaginatedResponse<AdminTaskTag>,
      { limit?: number; offset?: number; search?: string; project?: number }
    >({
      query: ({ limit = 50, offset = 0, search, project }) => ({
        url: 'admin/task-tag/',
        params: {
          limit,
          offset,
          ...(search ? { search } : {}),
          ...(project ? { project } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AdminTaskTags' as const, id })),
              { type: 'AdminTaskTags', id: 'LIST' },
            ]
          : [{ type: 'AdminTaskTags', id: 'LIST' }],
    }),
    deleteAdminTaskTag: builder.mutation<void, number>({
      query: (tagId) => ({
        url: `admin/task-tag/${tagId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AdminTaskTags', id: 'LIST' }],
    }),
  }),
})

type ProjectMemberResponse = {
  id: number
  role: string
  user: number | { id: number; full_name?: string; email?: string }
}

function toProjectMember(raw: ProjectMemberResponse): AdminOrganizationMember {
  const user = typeof raw.user === 'number'
    ? { id: raw.user, full_name: '', email: '' }
    : {
        id: raw.user.id,
        full_name: raw.user.full_name || raw.user.email || '',
        email: raw.user.email || '',
      }

  return {
    id: raw.id,
    role: raw.role,
    user,
  }
}

type AdminProjectResponse = {
  id: number
  name: string
  organization?: number | { id?: number; name?: string; short_name?: string; full_name?: string } | null
  organization_id?: number | null
  organization_name?: string | null
  reservoir?: string | null
  company_customer?: string | null
  contractor?: string | null
  country?: string | null
  created_at?: string | null
  members_count?: number | null
}

function toAdminProject(raw: AdminProjectResponse): AdminProject {
  const nested = raw.organization && typeof raw.organization === 'object' ? raw.organization : null
  const organizationId = nested?.id
    ?? (typeof raw.organization === 'number' ? raw.organization : raw.organization_id)
    ?? 0
  const organizationName = nested
    ? nested.short_name || nested.full_name || nested.name || raw.organization_name || ''
    : raw.organization_name || ''

  return {
    id: raw.id,
    name: raw.name,
    organization_id: organizationId,
    organization_name: organizationName,
    reservoir: raw.reservoir ?? '',
    company_customer: raw.company_customer ?? '',
    contractor: raw.contractor ?? '',
    country: raw.country ?? '',
    created_at: raw.created_at ?? '',
    members_count: raw.members_count ?? 0,
  }
}

function adminTablePath(url: string) {
  return url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\//, '').replace(/^\//, '')
}

export const {
  useGetAdminAccessQuery,
  useGetAdminResourcesQuery,
  useGetAdminTableRowsQuery,
  useGetAdminUsersQuery,
  useLazyGetAdminUsersQuery,
  useDeleteAdminUserMutation,
  useUpdateAdminUserRoleMutation,
  useGetAdminMembersQuery,
  useGetAdminOrganizationsQuery,
  useUpdateAdminOrganizationMutation,
  useDeleteAdminOrganizationMutation,
  useCreateAdminOrganizationMutation,
  useCreateAdminOrganizationMemberMutation,
  useDeleteAdminOrganizationMemberMutation,
  useGetAdminOrganizationEmailInvitationsQuery,
  useCreateAdminOrganizationEmailInvitationMutation,
  useDeleteAdminOrganizationEmailInvitationMutation,
  useCreateAdminOrganizationUserInvitationMutation,
  useDeleteAdminOrganizationUserInvitationMutation,
  useGetAdminProjectMembersQuery,
  useCreateAdminProjectMemberMutation,
  useDeleteAdminProjectMemberMutation,
  useGetAdminProjectEmailInvitationsQuery,
  useCreateAdminProjectEmailInvitationMutation,
  useDeleteAdminProjectEmailInvitationMutation,
  useCreateAdminProjectUserInvitationMutation,
  useDeleteAdminProjectUserInvitationMutation,
  useGetAdminProjectsQuery,
  useUpdateAdminProjectMutation,
  useCreateAdminProjectMutation,
  useDeleteAdminProjectMutation,
  useGetAdminTasksQuery,
  useDeleteAdminTaskMutation,
  useGetAdminTaskStatusesQuery,
  useDeleteAdminTaskStatusMutation,
  useGetAdminTaskTagsQuery,
  useDeleteAdminTaskTagMutation,
} = platformAdminApi
