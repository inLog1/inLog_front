import type { LoginResponse } from '../../../shared/types/dto/auth'
import { platformApi } from '../../../shared/api/platformApi'
import { beginAuthAttempt, commitAccessSession } from '../../../entities/session'

export type MockIdentityOption = {
  providerId: string
  externalSubject: string
  email: string
  linked: boolean
  label: string
}

const ssoApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getMockIdentities: build.query<MockIdentityOption[], void>({
      query: () => 'auth/mock-sso/identities/',
    }),
    completeMockSso: build.mutation<LoginResponse, { providerId: string; externalSubject: string }>({
      query: (body) => ({
        url: 'auth/mock-sso/complete/',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        const ticket = beginAuthAttempt()
        try {
          const { data } = await queryFulfilled
          commitAccessSession(ticket, data)
        } catch {
          // Cancelled or rejected SSO must not create a session.
        }
      },
    }),
  }),
})

export const { useGetMockIdentitiesQuery, useCompleteMockSsoMutation } = ssoApi
