import { createApi } from "@reduxjs/toolkit/query/react"
import { accessApi } from "../../access/model/accessApi"
import { baseQuery } from "../../../shared/api/clientApi"
import type { OrganizationRequest, OrganizationResponse } from "../../../shared/types/dto/organization"
import type { Organization } from "./types"
import { directoryFromWire, type OrganizationDirectory } from "./directory"
import { errorsHandler } from "../../../shared/lib/errors-handler"

export const organizationApi = createApi({
    reducerPath: 'organizationApi',
    baseQuery,
    tagTypes: ['Organization'],
    endpoints: (builder) => ({
        getOrganizations: builder.query<Organization[], void>({
            query: () => 'organizations/organization/',
            transformResponse: (response: any) => {
              if (!response || !Array.isArray(response)) return []
      
              return response.map((el: any) => ({
                fullName: el?.full_name,
                shortName: el?.short_name,
                address: el?.address,
                id: el?.id,
                role: el?.role ?? null,
              })) as Organization[]
            },
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['Organization'],
          }),
          getOrganizationById: builder.query<Organization, number>({
            query: (id) => `organizations/organization/${id}/`,
            transformResponse: (response: { id?: number; full_name?: string; short_name?: string; address?: string; role?: string | null }) => ({
              id: Number(response?.id),
              fullName: response?.full_name,
              shortName: response?.short_name,
              address: response?.address,
              role: response?.role ?? null,
            }),
          }),
          addOrganization: builder.mutation<OrganizationResponse, Partial<OrganizationRequest> & { kind?: 'laboratory' | 'customer' }>({
            query: (data) => ({
              url: 'organizations/organization/',
              method: 'POST',
              body: data,
            }),
            invalidatesTags: ['Organization'],
            async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
              try {
                await queryFulfilled
                dispatch(accessApi.util.invalidateTags(['SessionAccess']))
              } catch {
                // A rejected create stays rejected and is not sent again.
              }
            },
          }),
          getOrganizationDirectory: builder.query<OrganizationDirectory, void>({
            query: () => 'organizations/directory/',
            transformResponse: (response: Parameters<typeof directoryFromWire>[0]) => directoryFromWire(response),
            providesTags: ['Organization'],
          }),
          updateOrganization: builder.mutation<OrganizationResponse & { revision?: number }, {
            id: number
            full_name: string
            short_name: string
            address: string
            kind: 'laboratory' | 'customer'
            expectedRevision: number
          }>({
            query: ({ id, ...body }) => ({
              url: `organizations/organization/${id}/`,
              method: 'PATCH',
              body,
            }),
            invalidatesTags: ['Organization'],
            async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
              try {
                await queryFulfilled
                dispatch(accessApi.util.invalidateTags(['SessionAccess']))
              } catch {
                // A conflict or refusal is not retried and is not treated as a saved change.
              }
            },
          }),
          deleteOrganization: builder.mutation<void, number>({
            query: (id) => ({
              url: `organizations/organization/${id}/`,
              method: 'DELETE',
            }),
            invalidatesTags: ['Organization'],
          }),
    }),
})

export const {
  useGetOrganizationsQuery,
  useGetOrganizationByIdQuery,
  useGetOrganizationDirectoryQuery,
  useAddOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} = organizationApi