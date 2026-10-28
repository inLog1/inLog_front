import { platformApi } from '../../../shared/api/platformApi'
import type { AccessDirectory, AccessRoleDetail, AccessRoleView, AccessUserDetail, AccessUsersPage, AssignmentWrite, RoleWrite } from './directory'
import type { SessionAccess } from './types'

export type InstallationPhase = 'uninitialized' | 'owner-assigned' | 'configuring' | 'ready'

export type InstallationStatus = {
  phase: InstallationPhase
  schemaVersion: number
  /** Mock-only. True when another tab holds the writer lease. */
  writeLocked?: boolean
  /**
   * Mock-only. True when this environment has no cross-tab lock, so writes are refused.
   * It is not the same as another tab holding the lease.
   */
  writesUnavailable?: boolean
  /** Mock only. True when the installation has no corporation and no owner yet. */
  needsOwner?: boolean
}

export type AuthCapabilities = {
  authMode: 'local' | 'sso' | 'mixed'
  methods: Array<'local' | 'sso'>
  providerLabel: string | null
  startPath: string | null
  ssoConfigured: boolean
}

export const accessApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getSessionAccess: build.query<SessionAccess, void>({
      query: () => 'session/access/',
      providesTags: ['SessionAccess'],
    }),
    getInstallationStatus: build.query<InstallationStatus, void>({
      query: () => 'installation/status/',
      providesTags: ['Installation'],
    }),
    getAuthCapabilities: build.query<AuthCapabilities, void>({
      query: () => 'authentication/capabilities/',
      providesTags: ['Capabilities'],
    }),
    /**
     * Proposed mock contract. The page calls these hooks only when apiMode is mock.
     */
    getAccessUsers: build.query<AccessUsersPage, { organization: number | 'all'; q: string; page: number; pageSize: number }>({
      query: (arg) => {
        const params = new URLSearchParams({
          organization: String(arg.organization),
          q: arg.q,
          page: String(arg.page),
          pageSize: String(arg.pageSize),
        })
        return `access/users/?${params.toString()}`
      },
      providesTags: ['AccessControl'],
    }),
    getAccessUser: build.query<AccessUserDetail, number>({
      query: (userId) => `access/users/${userId}/`,
      providesTags: ['AccessControl'],
    }),
    getAccessDirectory: build.query<AccessDirectory, { scope: 'organization'; organizationId: number } | { scope: 'corporation' }>({
      query: (arg) => arg.scope === 'corporation'
        ? 'access/directory/?scope=corporation'
        : `access/directory/?organization=${arg.organizationId}`,
      providesTags: ['AccessControl'],
    }),
    getAccessRole: build.query<AccessRoleDetail, string>({
      query: (roleId) => `access/roles/${roleId}/`,
      providesTags: ['AccessControl'],
    }),
    createAccessRole: build.mutation<{ role: AccessRoleView }, RoleWrite>({
      query: (body) => ({ url: 'access/roles/', method: 'POST', body }),
      invalidatesTags: ['AccessControl', 'SessionAccess'],
    }),
    updateAccessRole: build.mutation<{ role: AccessRoleView }, { roleId: string; body: RoleWrite }>({
      query: ({ roleId, body }) => ({ url: `access/roles/${roleId}/`, method: 'PATCH', body }),
      invalidatesTags: ['AccessControl', 'SessionAccess'],
    }),
    deleteAccessRole: build.mutation<{ deleted: string }, { roleId: string; expectedAccessVersion?: number }>({
      query: ({ roleId, expectedAccessVersion }) => ({
        url: expectedAccessVersion == null
          ? `access/roles/${roleId}/`
          : `access/roles/${roleId}/?expectedAccessVersion=${expectedAccessVersion}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccessControl', 'SessionAccess'],
    }),
    createAccessAssignment: build.mutation<{ assignment: AccessDirectory['assignments'][number]; idempotent: boolean }, AssignmentWrite>({
      query: (body) => ({ url: 'access/assignments/', method: 'POST', body }),
      invalidatesTags: ['AccessControl', 'SessionAccess'],
    }),
    revokeAccessAssignment: build.mutation<{ revoked: string }, { assignmentId: string; expectedAccessVersion?: number }>({
      query: ({ assignmentId, expectedAccessVersion }) => ({
        url: expectedAccessVersion == null
          ? `access/assignments/${assignmentId}/`
          : `access/assignments/${assignmentId}/?expectedAccessVersion=${expectedAccessVersion}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccessControl', 'SessionAccess'],
    }),
  }),
})

export const {
  useGetSessionAccessQuery,
  useGetInstallationStatusQuery,
  useGetAuthCapabilitiesQuery,
  useGetAccessDirectoryQuery,
  useGetAccessUserQuery,
  useGetAccessUsersQuery,
  useGetAccessRoleQuery,
  useCreateAccessRoleMutation,
  useUpdateAccessRoleMutation,
  useDeleteAccessRoleMutation,
  useCreateAccessAssignmentMutation,
  useRevokeAccessAssignmentMutation,
} = accessApi
