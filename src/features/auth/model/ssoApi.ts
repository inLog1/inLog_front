import type { LoginResponse } from '../../../shared/types/dto/auth'
import { platformApi } from '../../../shared/api/platformApi'
import { writeSession } from '../../../shared/api/session-storage'

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
        try {
          const { data } = await queryFulfilled
          if (data.access_token) {
            writeSession({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              subjectId: typeof data.user?.id === 'number' ? data.user.id : null,
            })
          }
        } catch {
          // Cancelled or rejected SSO must not create a session.
        }
      },
    }),
  }),
})

export const { useGetMockIdentitiesQuery, useCompleteMockSsoMutation } = ssoApi
