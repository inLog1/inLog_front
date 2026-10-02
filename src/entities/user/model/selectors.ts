import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../../../app/store/store'
import { isPlatformAdmin, isSuperAdmin } from '../../../shared/types/platform-role'
import type { User } from './types'
import { userApi } from './userSlice'
import { getAccessToken } from '../../../shared/api/auth-session'

const selectUserApiSlice = (state: RootState) => state[userApi.reducerPath]

export const selectUser = createSelector(
  selectUserApiSlice,
  (slice) => slice.queries?.['getMe(undefined)']?.data as User | undefined
)

export const selectUserIsLoading = createSelector(
  selectUserApiSlice,
  (slice) => slice.queries?.['getMe(undefined)']?.status === 'pending'
)

export const selectUserError = createSelector(
  selectUserApiSlice,
  (slice) => slice.queries?.['getMe(undefined)']?.error
)

export const selectUserSettings = createSelector(
  selectUser,
  (user) => user?.settings
)

export const selectUserLanguage = createSelector(
  selectUserSettings,
  (settings) => settings?.language || 'ru'
)

export const selectUserFullName = createSelector(
  selectUser,
  (user) =>
    user?.full_name ||
    [user?.name, user?.patronymic, user?.surname].filter(Boolean).join(' ') ||
    ''
)

export const selectUserAvatar = createSelector(selectUser, (user) => user?.avatar)

export const selectUserRole = createSelector(selectUser, (user) => user?.role)

export const selectIsPlatformAdmin = createSelector(selectUserRole, (role) =>
  isPlatformAdmin(role)
)

export const selectIsSuperAdmin = createSelector(selectUserRole, (role) => isSuperAdmin(role))

export const selectIsAuthenticatedAlternative = createSelector(
  selectUser,
  () => !!getAccessToken(),
  (user, hasToken) => !!user && hasToken
)
