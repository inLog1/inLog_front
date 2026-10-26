import { platformApi } from '../../../shared/api/platformApi'
import type { SessionAccess } from './types'

export type InstallationPhase = 'uninitialized' | 'owner-assigned' | 'configuring' | 'ready'

export type InstallationStatus = {
  phase: InstallationPhase
  schemaVersion: number
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
  }),
})

export const {
  useGetSessionAccessQuery,
  useGetInstallationStatusQuery,
  useGetAuthCapabilitiesQuery,
} = accessApi
