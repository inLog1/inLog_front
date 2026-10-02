import { createApi } from '@reduxjs/toolkit/query/react'
import type {
  LoginRequest,
  LoginResponse,
  RegistrationRequest,
  RegistrationResponse,
  PasswordResetConfirmRequest,
  PasswordResetConfirmResponse,
  ConfirmEmailChangeRequest,
} from '../../../shared/types/dto/auth'
import { baseQuery } from '../../../shared/api/clientApi'
import { clearAuthSession, setAuthSession } from '../../../shared/api/auth-session'

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  endpoints: (builder) => ({
    register: builder.mutation<RegistrationResponse, RegistrationRequest>({
      query: (data) => ({
        url: 'auth/registration/',
        method: 'POST',
        body: data,
      }),
    }),

    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (data) => ({
        url: 'auth/login/',
        method: 'POST',
        body: data,
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data?.access_token) {
            setAuthSession({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              accessTokenExpiration: data.access_token_expiration,
            })
          }
        } catch {}
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: 'auth/logout/',
        method: 'POST',
        body: {},
        signal: AbortSignal.timeout(10000),
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
          clearAuthSession()
        } catch {}
      },
    }),

    passwordReset: builder.mutation<{ email: string; detail?: string }, { email: string }>({
      query: (data) => ({
        url: 'auth/password/reset/',
        method: 'POST',
        body: data,
      }),
    }),

    passwordResetConfirm: builder.mutation<
      PasswordResetConfirmResponse,
      PasswordResetConfirmRequest
    >({
      query: (data) => ({
        url: 'auth/password/reset/confirm/',
        method: 'POST',
        body: data,
      }),
    }),

    verifyEmail: builder.mutation<
      { key: string; uid?: string; detail?: any },
      { key: string; uid?: string }
    >({
      query: (data) => ({
        url: 'auth/registration/verify-email/',
        method: 'POST',
        body: data,
      }),
    }),

    resendEmail: builder.mutation<
      { email: string; detail?: string },
      { email: string }
    >({
      query: (data) => ({
        url: 'auth/registration/resend-email/',
        method: 'POST',
        body: data,
      }),
    }),

    confirmEmailChange: builder.mutation<
      { detail: any },
      ConfirmEmailChangeRequest
    >({
      query: (data) => ({
        url: 'users/me/confirm-email-change/',
        method: 'POST',
        body: data,
      }),
    }),
  }),
  
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  usePasswordResetMutation,
  usePasswordResetConfirmMutation,
  useVerifyEmailMutation,
  useResendEmailMutation,
  useConfirmEmailChangeMutation,
} = authApi