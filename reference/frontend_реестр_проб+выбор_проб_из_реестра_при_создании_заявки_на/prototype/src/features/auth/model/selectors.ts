import { createSelector } from "@reduxjs/toolkit"
import type { RootState } from "../../../app/store/store"
import { authApi } from "./authSlice"
import type { User } from "../../../entities/user/model/types"

const selectAuthApiSlice = (state: RootState) => state[authApi.reducerPath]

export const selectAuth = createSelector(
    selectAuthApiSlice,
    (slice) => slice.queries?.['getMe(undefined)']?.data as User | undefined
)

export const selectAuthIsLoading = createSelector(
    selectAuthApiSlice,
    (slice) => slice.queries?.['getMe(undefined)']?.status === 'pending'
)

export const selectAuthError = createSelector(
    selectAuthApiSlice,
    (slice) => slice.queries?.['getMe(undefined)']?.error as Error | undefined
)

export const isAuthenticated = createSelector(
    selectAuth,
    (user) => !!user
)


