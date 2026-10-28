import type { LoginResponse } from '../../../shared/types/dto/auth'
import { platformApi } from '../../../shared/api/platformApi'
import { invalidateAuthAttempts } from '../../../entities/session'
import { writeSession } from '../../../shared/api/session-storage'
import type { AuthMode } from '../../../shared/config/runtime'
import { devSwitchTicket, isCurrentDevSwitch } from './dev-switch'

export type DevAccount = {
  id: number
  email: string
  fullName?: string
  status: 'active' | 'blocked'
  legacyRole: string
  accessState: 'ready' | 'pending' | 'blocked'
  memberships: Array<{ organizationId: number }>
  grants: Array<{ resource: string; action: string }>
  systemCapabilities: string[]
  password: string
}

export type DevSettingsBody = {
  authMode?: AuthMode
  installationPhase?: 'ready' | 'uninitialized'
  fault?: { path: string; kind: 'unauthorized' | 'forbidden' | 'network' | 'server' | 'cancel' } | null
  blockedUserId?: number
  clearBlockedUserId?: number
  ensureFormsSwitchAuthor?: boolean
}

const devApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getDevAccounts: build.query<DevAccount[], void>({
      query: () => 'auth/dev/accounts/',
      providesTags: ['DevAccounts'],
    }),
    switchDevUser: build.mutation<LoginResponse, { userId: number }>({
      query: (body) => ({ url: 'auth/dev/switch/', method: 'POST', body }),
      async onQueryStarted(_, { queryFulfilled }) {
        const ticket = devSwitchTicket()
        invalidateAuthAttempts()
        try {
          const { data } = await queryFulfilled
          if (!isCurrentDevSwitch(ticket) || !data.access_token) return
          writeSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            subjectId: typeof data.user?.id === 'number' ? data.user.id : null,
          })
        } catch {
          // A newer switch or a reset owns the session.
        }
      },
    }),
    updateDevSettings: build.mutation<{ authMode: AuthMode }, DevSettingsBody>({
      query: (body) => ({ url: 'auth/dev/settings/', method: 'POST', body }),
      invalidatesTags: ['DevAccounts', 'Capabilities', 'Installation', 'SessionAccess'],
    }),
    resetDevFixtures: build.mutation<{ namespace: string; schemaVersion: number }, void>({
      query: () => ({ url: 'auth/dev/reset/', method: 'POST' }),
      invalidatesTags: ['DevAccounts', 'Capabilities', 'Installation', 'SessionAccess'],
    }),
  }),
})

export const {
  useGetDevAccountsQuery,
  useResetDevFixturesMutation,
  useSwitchDevUserMutation,
  useUpdateDevSettingsMutation,
} = devApi
