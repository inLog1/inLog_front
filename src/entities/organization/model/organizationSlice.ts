import { createApi } from "@reduxjs/toolkit/query/react"
import { baseQuery } from "../../../shared/api/clientApi"
import type { OrganizationRequest, OrganizationResponse } from "../../../shared/types/dto/organization"
import type { Organization } from "./types"
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
          addOrganization: builder.mutation<OrganizationResponse, Partial<OrganizationRequest>>({
            query: (data) => ({
              url: 'organizations/organization/',
              method: 'POST',
              body: data,
            }),
            invalidatesTags: ['Organization'],
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

export const { useGetOrganizationsQuery, useAddOrganizationMutation, useDeleteOrganizationMutation } = organizationApi