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
import { beginAuthAttempt, commitAccessSession } from '../../../entities/session'
import { baseQuery } from '../../../shared/api/clientApi'

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
        const ticket = beginAuthAttempt()
        try {
          const { data } = await queryFulfilled
          commitAccessSession(ticket, data)
        } catch {
          // The form renders the credential error. Storage stays unchanged.
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: 'auth/logout/',
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      }),
      async onQueryStarted() {
        // Session cleanup is owned by the shared logout lifecycle, including API failure.
      },
    }),

    verifyToken: builder.mutation<{ token: string }, { token: string }>({
      query: (data) => ({
        url: 'auth/token/verify/',
        method: 'POST',
        body: data,
      }),
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
  useVerifyTokenMutation,
  usePasswordResetMutation,
  usePasswordResetConfirmMutation,
  useVerifyEmailMutation,
  useResendEmailMutation,
  useConfirmEmailChangeMutation,
} = authApi