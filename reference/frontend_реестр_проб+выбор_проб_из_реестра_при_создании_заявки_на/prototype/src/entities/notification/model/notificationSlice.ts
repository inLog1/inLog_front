import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from '../../../shared/api/clientApi'
import type {
  InvitationResponseRequest,
  NotificationUpdateRequest,
} from '../../../shared/types/dto/notification'
import type { Notification } from './types'
import { errorsHandler } from '../../../shared/lib/errors-handler'

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery,
  tagTypes: ['Notifications'],
  endpoints: (builder) => ({
    getNotifications: builder.query<Notification[], void>({
      query: () => '/notifications/notification/',
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (error: unknown) {
          errorsHandler((error as { error?: unknown })?.error)
        }
      },
      providesTags: ['Notifications'],
    }),

    updateNotification: builder.mutation<
      Notification,
      { id: number; data: NotificationUpdateRequest }
    >({
      query: ({ id, data }) => ({
        url: `/notifications/notification/${id}/`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Notifications'],
    }),

    deleteNotification: builder.mutation<void, number>({
      query: (id) => ({
        url: `/notifications/notification/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications'],
    }),

    invitationResponse: builder.mutation<
      void,
      { projectId: number; data: InvitationResponseRequest }
    >({
      query: ({ projectId, data }) => ({
        url: `projects/${projectId}/user-invitation/response/`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Notifications'],
    }),
  }),
})

export const {
  useGetNotificationsQuery,
  useUpdateNotificationMutation,
  useDeleteNotificationMutation,
  useInvitationResponseMutation,
} = notificationApi
