import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from '../../../shared/api/clientApi'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import type {
  AdminAccess,
  FeatureProfile,
  FeatureProfileWriteBody,
  AdminResource,
  AdminMember,
  AdminOrganization,
  AdminOrganizationMember,
  AdminProject,
  AdminTask,
  AdminTaskDoer,
  AdminTaskStatus,
  AdminTaskTag,
  UpdateAdminTaskBody,
  AdminUser,
  AdminUserBrief,
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
    'AdminFeatures',
    'AdminFeatureProfiles',
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
    getAdminFeatures: builder.query<string[], void>({
      query: () => 'admin/features/',
      transformResponse: normalizeAdminFeatures,
      providesTags: ['AdminFeatures'],
    }),
    getAdminFeatureProfiles: builder.query<FeatureProfile[], void>({
      query: () => 'admin/feature-profile/',
      transformResponse: normalizeFeatureProfiles,
      providesTags: ['AdminFeatureProfiles'],
    }),
    createAdminFeatureProfile: builder.mutation<FeatureProfile, FeatureProfileWriteBody>({
      query: (body) => ({
        url: 'admin/feature-profile/',
        method: 'POST',
        body,
      }),
      transformResponse: normalizeFeatureProfile,
      invalidatesTags: ['AdminFeatureProfiles'],
    }),
    updateAdminFeatureProfile: builder.mutation<
      FeatureProfile,
      { id: number; body: Partial<FeatureProfileWriteBody> }
    >({
      query: ({ id, body }) => ({
        url: `admin/feature-profile/${id}/`,
        method: 'PATCH',
        body,
      }),
      transformResponse: normalizeFeatureProfile,
      invalidatesTags: ['AdminFeatureProfiles'],
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
      transformResponse: (response: PaginatedResponse<AdminTaskResponse>) => ({
        ...response,
        results: (response.results ?? []).map(toAdminTask),
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
    updateAdminTask: builder.mutation<
      AdminTask,
      { projectId: number; slug: string; body: UpdateAdminTaskBody }
    >({
      query: ({ projectId, slug, body }) => ({
        url: `projects/${projectId}/tasks/task/${encodeURIComponent(slug)}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'AdminTasks', id: 'LIST' }],
    }),
    getAdminTaskDoers: builder.query<AdminTaskDoer[], number>({
      query: (taskId) => ({
        url: 'admin/tables/tasks/taskdoer/',
        params: { task: taskId, limit: 100, offset: 0 },
      }),
      transformResponse: (response: PaginatedResponse<AdminTableTaskLink> | AdminTableTaskLink[]) =>
        toAdminTaskLinks(response),
      providesTags: (_result, _error, taskId) => [{ type: 'AdminTasks', id: `doers-${taskId}` }],
    }),
    addAdminTaskMember: builder.mutation<
      { id: number },
      { taskId: number; userId: number; projectId: number }
    >({
      query: ({ taskId, userId, projectId }) => ({
        url: 'admin/tables/tasks/taskdoer/',
        method: 'POST',
        body: { task: taskId, user: userId, project: projectId },
      }),
      invalidatesTags: (_result, _error, { taskId }) => [
        { type: 'AdminTasks', id: 'LIST' },
        { type: 'AdminTasks', id: `doers-${taskId}` },
      ],
    }),
    removeAdminTaskMember: builder.mutation<void, { taskId: number; doerId: number }>({
      query: ({ doerId }) => ({
        url: `admin/tables/tasks/taskdoer/${doerId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { taskId }) => [
        { type: 'AdminTasks', id: 'LIST' },
        { type: 'AdminTasks', id: `doers-${taskId}` },
      ],
    }),
    getAdminTaskSupervisors: builder.query<AdminTaskDoer[], number>({
      query: (taskId) => ({
        url: 'admin/tables/tasks/tasksupervisor/',
        params: { task: taskId, limit: 20, offset: 0 },
      }),
      transformResponse: (response: PaginatedResponse<AdminTableTaskLink> | AdminTableTaskLink[]) =>
        toAdminTaskLinks(response),
      providesTags: (_result, _error, taskId) => [{ type: 'AdminTasks', id: `supervisors-${taskId}` }],
    }),
    addAdminTaskSupervisor: builder.mutation<
      { id: number },
      { taskId: number; userId: number; projectId: number }
    >({
      query: ({ taskId, userId, projectId }) => ({
        url: 'admin/tables/tasks/tasksupervisor/',
        method: 'POST',
        body: { task: taskId, user: userId, project: projectId },
      }),
      invalidatesTags: (_result, _error, { taskId }) => [
        { type: 'AdminTasks', id: 'LIST' },
        { type: 'AdminTasks', id: `supervisors-${taskId}` },
      ],
    }),
    removeAdminTaskSupervisor: builder.mutation<void, { taskId: number; supervisorId: number }>({
      query: ({ supervisorId }) => ({
        url: `admin/tables/tasks/tasksupervisor/${supervisorId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { taskId }) => [
        { type: 'AdminTasks', id: 'LIST' },
        { type: 'AdminTasks', id: `supervisors-${taskId}` },
      ],
    }),
    getAdminTaskStatuses: builder.query<
      PaginatedResponse<AdminTaskStatus>,
      { limit?: number; offset?: number; project?: number }
    >({
      query: ({ limit = 50, offset = 0, project }) => ({
        url: 'admin/task-status/',
        params: { limit, offset, ...(project ? { project } : {}) },
      }),
      transformResponse: (response: PaginatedResponse<AdminTaskStatusResponse>) => ({
        ...response,
        results: (response.results ?? []).map(toAdminTaskStatus),
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
    createAdminTaskStatus: builder.mutation<
      { id: number },
      { name_ru: string; name_en: string; project: number }
    >({
      query: (body) => ({
        url: 'admin/tables/tasks/taskstatus/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AdminTaskStatuses', id: 'LIST' }],
    }),
    updateAdminTaskStatus: builder.mutation<
      { id: number },
      { id: number; name_ru: string; name_en: string; project: number }
    >({
      query: ({ id, ...body }) => ({
        url: `admin/tables/tasks/taskstatus/${id}/`,
        method: 'PATCH',
        body,
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
      transformResponse: (response: PaginatedResponse<AdminTaskTagResponse>) => ({
        ...response,
        results: (response.results ?? []).map(toAdminTaskTag),
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
    createAdminTaskTag: builder.mutation<{ id: number }, { name: string; project: number }>({
      query: (body) => ({
        url: 'admin/tables/tasks/tasktag/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'AdminTaskTags', id: 'LIST' }],
    }),
    updateAdminTaskTag: builder.mutation<
      { id: number },
      { id: number; name: string; project: number }
    >({
      query: ({ id, ...body }) => ({
        url: `admin/tables/tasks/tasktag/${id}/`,
        method: 'PATCH',
        body,
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

type AdminTaskStatusResponse = {
  id: number
  name_en?: string
  name_ru?: string
  position?: number
  project?: number
  project_id?: number
  project_name?: string
  created_at?: string
}

type AdminTaskTagResponse = {
  id: number
  name?: string
  project?: number
  project_id?: number
  project_name?: string
  is_systemic?: boolean
  is_orphan?: boolean
  created_at?: string
}

function toAdminTaskTag(raw: AdminTaskTagResponse): AdminTaskTag {
  return {
    id: raw.id,
    project_id: raw.project_id ?? raw.project ?? 0,
    project_name: raw.project_name || '',
    name: raw.name || '',
    is_systemic: Boolean(raw.is_systemic),
    is_orphan: Boolean(raw.is_orphan),
    created_at: raw.created_at || '',
  }
}

function toAdminTaskStatus(raw: AdminTaskStatusResponse): AdminTaskStatus {
  return {
    id: raw.id,
    project_id: raw.project_id ?? raw.project ?? 0,
    project_name: raw.project_name || '',
    name_en: raw.name_en || '',
    name_ru: raw.name_ru || '',
    position: raw.position ?? 0,
    created_at: raw.created_at || '',
  }
}

type AdminTaskStatusRef = {
  id: number
  name_en?: string
  name_ru?: string
}

type AdminTaskProjectRef = {
  id: number
  name?: string
  organization?: number | { id?: number; name?: string; short_name?: string; full_name?: string } | null
  organization_id?: number
  organization_name?: string
}

type AdminTaskResponse = {
  id: number
  name?: string
  slug?: string
  project?: number | AdminTaskProjectRef | null
  project_id?: number
  project_name?: string
  organization?: number | { id?: number; name?: string; short_name?: string; full_name?: string } | null
  organization_id?: number
  organization_name?: string
  creator?: AdminUserBrief | null
  creator_id?: number
  creator_email?: string
  creator_name?: string
  doers?: AdminTaskDoer[]
  members?: { id?: number; type?: string; user?: AdminUserBrief | number }[]
  tags?: { id?: number; name?: string }[]
  status?: number | AdminTaskStatusRef | null
  status_id?: number
  status_name_en?: string
  status_name_ru?: string
  priority?: string | null
  archived?: boolean
  is_template?: boolean
  parent_id?: number | null
  parent?: number | null
  created_at?: string
}

function namedOrganization(
  value?: number | { id?: number; name?: string; short_name?: string; full_name?: string } | null,
) {
  if (!value || typeof value === 'number') return { id: typeof value === 'number' ? value : undefined, name: '' }
  return {
    id: value.id,
    name: value.short_name || value.full_name || value.name || '',
  }
}

type AdminTableTaskLink = {
  id: number
  user?: number | AdminUserBrief
  task?: number
  project?: number
}

function toAdminTaskLinks(
  response: PaginatedResponse<AdminTableTaskLink> | AdminTableTaskLink[],
): AdminTaskDoer[] {
  const rows = Array.isArray(response) ? response : response.results ?? []
  return rows.flatMap((row) => {
    if (!row.id) return []
    const user = typeof row.user === 'number'
      ? { id: row.user, email: '', full_name: '' }
      : row.user
    return [{ id: row.id, user }]
  })
}

function toAdminTask(raw: AdminTaskResponse): AdminTask {
  const project = raw.project && typeof raw.project === 'object' ? raw.project : null
  const projectId = project?.id ?? (typeof raw.project === 'number' ? raw.project : raw.project_id) ?? 0
  const status = raw.status && typeof raw.status === 'object' ? raw.status : null
  const statusId = status?.id ?? (typeof raw.status === 'number' ? raw.status : raw.status_id) ?? 0
  const projectOrganization = namedOrganization(project?.organization)
  const taskOrganization = namedOrganization(raw.organization)

  return {
    id: raw.id,
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    project_id: projectId,
    project_name: project?.name || raw.project_name || '',
    organization_id:
      taskOrganization.id ??
      raw.organization_id ??
      projectOrganization.id ??
      project?.organization_id,
    organization_name:
      taskOrganization.name ||
      raw.organization_name ||
      projectOrganization.name ||
      project?.organization_name ||
      '',
    creator_id: raw.creator?.id ?? raw.creator_id ?? 0,
    creator_email: raw.creator?.email ?? raw.creator_email ?? '',
    creator_name: raw.creator?.full_name || raw.creator_name,
    creator: raw.creator ?? undefined,
    doers: (raw.members ?? []).flatMap((member) => {
      const user = member.user && typeof member.user === 'object' ? member.user : undefined
      if (!user?.id || !member.id || member.type === 'supervisor') return []
      return [{ id: member.id, user }]
    }),
    members: (raw.members ?? []).flatMap((member) => {
      const user = member.user && typeof member.user === 'object' ? member.user : undefined
      if (!user?.id || member.type === 'supervisor') return []
      return [user]
    }),
    tags: (raw.tags ?? []).flatMap((tag) => (tag.name ? [tag.name] : [])),
    status_id: statusId,
    status_name_en: status?.name_en || raw.status_name_en || '',
    status_name_ru: status?.name_ru || raw.status_name_ru || '',
    priority: raw.priority || '',
    archived: Boolean(raw.archived),
    is_template: Boolean(raw.is_template),
    parent_id: raw.parent_id ?? (typeof raw.parent === 'number' ? raw.parent : null),
    created_at: raw.created_at ?? '',
  }
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

function normalizeAdminFeatures(response: unknown): string[] {
  const list = unwrapFeatureList(response)
  const keys: string[] = []
  const seen = new Set<string>()

  for (const item of list) {
    const key = featureKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }

  return keys
}

function unwrapFeatureList(response: unknown): unknown[] {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []

  const record = response as Record<string, unknown>
  if (Array.isArray(record.features)) return record.features
  if (Array.isArray(record.results)) return record.results
  return []
}

function featureKey(item: unknown): string | null {
  if (typeof item === 'string') {
    const key = item.trim()
    return key || null
  }

  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  for (const field of ['key', 'code', 'slug', 'name']) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function normalizeFeatureProfiles(response: unknown): FeatureProfile[] {
  const list = Array.isArray(response)
    ? response
    : response && typeof response === 'object' && Array.isArray((response as { results?: unknown }).results)
      ? (response as { results: unknown[] }).results
      : []

  return list.map((item) => normalizeFeatureProfile(item)).filter((item): item is FeatureProfile => item != null)
}

function normalizeFeatureProfile(response: unknown): FeatureProfile {
  if (!response || typeof response !== 'object') {
    throw new Error('Feature profile response is empty')
  }

  const record = response as Record<string, unknown>
  const id = typeof record.id === 'number' ? record.id : Number(record.id)
  if (!Number.isFinite(id)) throw new Error('Feature profile has no id')

  const features = Array.isArray(record.features)
    ? record.features.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const members = Array.isArray(record.members)
    ? record.members.flatMap((item) => {
        if (typeof item === 'number' && Number.isFinite(item)) return [item]
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'number') {
          return [(item as { id: number }).id]
        }
        return []
      })
    : []

  return {
    id,
    name: typeof record.name === 'string' ? record.name : '',
    features,
    members,
  }
}

function adminTablePath(url: string) {
  return url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\//, '').replace(/^\//, '')
}

export const {
  useGetAdminAccessQuery,
  useGetAdminFeaturesQuery,
  useGetAdminFeatureProfilesQuery,
  useCreateAdminFeatureProfileMutation,
  useUpdateAdminFeatureProfileMutation,
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
  useUpdateAdminTaskMutation,
  useGetAdminTaskDoersQuery,
  useAddAdminTaskMemberMutation,
  useRemoveAdminTaskMemberMutation,
  useGetAdminTaskSupervisorsQuery,
  useAddAdminTaskSupervisorMutation,
  useRemoveAdminTaskSupervisorMutation,
  useGetAdminTaskStatusesQuery,
  useDeleteAdminTaskStatusMutation,
  useCreateAdminTaskStatusMutation,
  useUpdateAdminTaskStatusMutation,
  useGetAdminTaskTagsQuery,
  useDeleteAdminTaskTagMutation,
  useCreateAdminTaskTagMutation,
  useUpdateAdminTaskTagMutation,
} = platformAdminApi
