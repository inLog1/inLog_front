import { createApi } from '@reduxjs/toolkit/query/react'
import type { User, UserFile, UserSettings } from './types'
import type {
  ChangeRoleAdminResponseRequest,
  ChangeRoleByUserRequest,
  ChangeRoleRequest,
  ChangeRoleResponse,
  RoleRequestResponse,
  SocialLoginResponse,
  UserSettingsUpdateRequest,
  UserUpdateRequest,
} from '../../../shared/types/dto/user'
import type { SocialName } from '../../../shared/types/enums'
import { baseQuery } from '../../../shared/api/clientApi'
import i18next from 'i18next'

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery,
  tagTypes: ['User', 'UserSettings', 'UserDocuments'],
  endpoints: (builder) => ({
    getMe: builder.query<User, void>({
      query: () => 'users/me/',
      providesTags: ['User'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled

          if (data?.settings?.language) {
            await i18next.changeLanguage(data.settings.language)
          }
        } catch {
          // ignore language sync errors on failed query
        }
      },
    }),

    updateMe: builder.mutation<User, FormData | UserUpdateRequest>({
      query: (data) => ({
        url: 'users/me/',
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),

    getUserSettings: builder.query<UserSettings, void>({
      query: () => 'users/me/settings/',
      providesTags: ['UserSettings'],
    }),

    updateUserSettings: builder.mutation<UserSettings, UserSettingsUpdateRequest>({
      query: (data) => ({
        url: 'users/me/settings/',
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['UserSettings', 'User'],
    }),

    socialLogin: builder.mutation<
      SocialLoginResponse,
      { code: string; socialName: SocialName }
    >({
      query: ({ code, socialName }) => ({
        url: `users/social-auth/${socialName}/login/`,
        method: 'PATCH',
        body: { code },
      }),
      invalidatesTags: ['User'],
    }),

    getRecentParticipants: builder.query<User[], void>({
      query: () => 'users/recent-participants/',
      providesTags: ['User'],
    }),

    getInvitationList: builder.query<User[], number>({
      query: (projectId) => `projects/${projectId}/user-invitation/`,
    }),

    changeRole: builder.mutation<
      ChangeRoleResponse,
      { projectId: number; memberId: number; data: ChangeRoleRequest }
    >({
      query: ({ projectId, memberId, data }) => ({
        url: `projects/${projectId}/members/${memberId}/`,
        method: 'PATCH',
        body: data,
      }),
    }),

    closeRoleAccess: builder.mutation<void, { projectId: number; memberId: number }>({
      query: ({ projectId, memberId }) => ({
        url: `projects/${projectId}/members/${memberId}/`,
        method: 'DELETE',
      }),
    }),

    changeRoleByUser: builder.mutation<
      RoleRequestResponse,
      { projectId: number; data: ChangeRoleByUserRequest }
    >({
      query: ({ projectId, data }) => ({
        url: `projects/${projectId}/role-request/`,
        method: 'POST',
        body: data,
      }),
    }),

    changeRoleAdminResponse: builder.mutation<
      RoleRequestResponse,
      { projectId: number; data: ChangeRoleAdminResponseRequest }
    >({
      query: ({ projectId, data }) => ({
        url: `projects/${projectId}/role-request/response/`,
        method: 'POST',
        body: data,
      }),
    }),

    getUserDocuments: builder.query<UserFile[], void>({
      query: () => 'users/me/documents/',
      providesTags: ['UserDocuments'],
    }),

    addUserDocument: builder.mutation<UserFile, FormData>({
      query: (data) => ({
        url: 'users/me/documents/',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['UserDocuments'],
    }),

    deleteUserDocument: builder.mutation<void, number>({
      query: (id) => ({
        url: `users/me/documents/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['UserDocuments'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useUpdateMeMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useSocialLoginMutation,
  useGetRecentParticipantsQuery,
  useGetInvitationListQuery,
  useChangeRoleMutation,
  useCloseRoleAccessMutation,
  useChangeRoleByUserMutation,
  useChangeRoleAdminResponseMutation,
  useGetUserDocumentsQuery,
  useAddUserDocumentMutation,
  useDeleteUserDocumentMutation,
} = userApi
