import { createApi } from "@reduxjs/toolkit/query/react"
import { baseQuery } from '../../../shared/api/clientApi'
import type { AdminPanelGroup, AdminPanelGroupRequest, AdminPanelNode, AdminPanelNodeRequest, AdminPanelNodeTab, AdminPanelReport, AdminPanelReportRequest, AdminPanelReportTable, AdminPanelRowRequest } from "./types"
import { errorsHandler } from "../../../shared/lib/errors-handler"

export const adminApi = createApi({
    reducerPath: 'adminApi',
    baseQuery,
    tagTypes: ['Nodes','Node','NodeTabs','NodeGroups'],
    endpoints: (builder) => ({
        getAdminPanelNodes: builder.query<AdminPanelNode[], { organizationId: number }>({
            query: ({ organizationId }) => `organizations/${organizationId}/structure-element-group/`,
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['Nodes']
        }),
        getAdminPanelNodeById: builder.query<AdminPanelNode, { organizationId: number, nodeId: number }>({
            query: ({ organizationId, nodeId }) => `organizations/${organizationId}/structure-element-group/${nodeId}/`,
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['Node']
        }),
        addAdminPanelNode: builder.mutation<AdminPanelNode, { organizationId: number, body: AdminPanelNodeRequest }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/structure-element-group/`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Nodes','Node']
        }),
        updateAdminPanelNode: builder.mutation<AdminPanelNode, { organizationId: number, nodeId: number, body: AdminPanelNodeRequest }>({
            query: ({ organizationId, nodeId, body }) => ({
                url: `organizations/${organizationId}/structure-element-group/${nodeId}/`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: ['Node']
        }),
        deleteAdminPanelNode: builder.mutation<void, { organizationId: number, nodeId: number }>({
            query: ({ organizationId, nodeId }) => ({
                url: `organizations/${organizationId}/structure-element-group/${nodeId}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Nodes']
        }),

        getAdminPanelNodeTabs: builder.query<AdminPanelNodeTab[], { organizationId: number }>({
            query: ({ organizationId }) => `organizations/${organizationId}/structure-element/`,
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['NodeTabs','Node']
        }),
        addAdminPanelNodeTab: builder.mutation<AdminPanelNodeTab, { organizationId: number, body: AdminPanelNodeTab  }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/structure-element/`,
                method: 'POST',
                body: { ...body, organizationId },
            }),
            invalidatesTags: ['NodeTabs','Node']
        }),
        updateAdminPanelNodeTab: builder.mutation<AdminPanelNodeTab, { organizationId: number, body: {
            id: number
            name_en: string
            name_ru: string
            group: number
            related_structure_elements?: number[]
            structure_elements: { id: number, name_en: string, name_ru: string }[]
        } }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/structure-element/multiple-update/`,
                method: 'PATCH',
                body: { ...body, organizationId, related_structure_elements: body.related_structure_elements || [] },
            }),
            invalidatesTags: ['NodeTabs','Node']
        }),
        deleteAdminPanelNodeTab: builder.mutation<void, { organizationId: number, tabId: number }>({
            query: ({ organizationId, tabId }) => ({
                url: `organizations/${organizationId}/structure-element/${tabId}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['NodeTabs','Node']
        }),
        getAdminPanelGroups: builder.query<AdminPanelGroup[], { group?: number, structure_element?: number, organizationId?: number }>({
            query: ({ group, structure_element, organizationId }) => ({
                url: `organizations/${organizationId}/structure-element-field/`,
                params: { group, structure_element },
            }),
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['NodeGroups']
        }),
        addAdminPanelGroup: builder.mutation<AdminPanelGroup, { organizationId: number, body: AdminPanelGroupRequest }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/structure-element-field/`,
                method: 'POST',
                body: { ...body, organizationId },
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
        updateAdminPanelGroup: builder.mutation<AdminPanelGroup, { organizationId: number, groupId: number, body: AdminPanelGroupRequest }>({
            query: ({ organizationId, groupId, body }) => ({
                url: `organizations/${organizationId}/structure-element-field/${groupId}/`,
                method: 'PATCH',
                body: { ...body, organizationId },
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
        deleteAdminPanelGroup: builder.mutation<void, { organizationId: number, groupId: number }>({
            query: ({ organizationId, groupId }) => ({
                url: `organizations/${organizationId}/structure-element-field/${groupId}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
        generateReport: builder.mutation<AdminPanelReportTable, { organizationId: number, body: AdminPanelReportRequest[] }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/get-combined-constructor-data/`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: AdminPanelReport[]) => {
                const dataForTable: AdminPanelReportTable = {}
                response.forEach((item: AdminPanelReport) => {
                    item.data.objects.forEach((obj: any) => {
                        const fieldNames = obj.data ? Object.keys(obj.data) : []
                        if (fieldNames.length > 0) {
                            fieldNames.forEach((fieldName: string) => {
                                const fieldValue = obj.data[fieldName]
                                
                                if (!dataForTable[fieldName]) {
                                    dataForTable[fieldName] = []
                                }
                                
                                dataForTable[fieldName].push({
                                    value: fieldValue?.value ?? '',
                                    type: fieldValue?.type ?? '',
                                    id: obj.id,
                                })
                            })
                        }
                    })
                })
                return dataForTable
            }
        }),
        addAdminPanelRow:builder.mutation<AdminPanelReport, { organizationId: number, body: AdminPanelRowRequest }>({
            query: ({ organizationId, body }) => ({
                url: `organizations/${organizationId}/structure-element-object/`,
                method: 'POST',
                body
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
        updateAdminPanelRow: builder.mutation<AdminPanelReport, { organizationId: number, rowId: number, body: AdminPanelRowRequest }>({
            query: ({ organizationId, rowId, body }) => ({
                url: `organizations/${organizationId}/structure-element-object/${rowId}/`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
        deleteAdminPanelRow: builder.mutation<void, { organizationId: number, rowId: number }>({
            query: ({ organizationId, rowId }) => ({
                url: `organizations/${organizationId}/structure-element-object/${rowId}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['NodeGroups','Node']
        }),
    })
})

export const {
    useGetAdminPanelNodesQuery,
    useGetAdminPanelNodeByIdQuery,
    useAddAdminPanelNodeMutation,
    useUpdateAdminPanelNodeMutation,
    useDeleteAdminPanelNodeMutation,
    useGetAdminPanelNodeTabsQuery,
    useAddAdminPanelNodeTabMutation,
    useUpdateAdminPanelNodeTabMutation,
    useDeleteAdminPanelNodeTabMutation,
    useGetAdminPanelGroupsQuery,
    useAddAdminPanelGroupMutation,
    useDeleteAdminPanelGroupMutation,
    useUpdateAdminPanelGroupMutation,
    useGenerateReportMutation,
    useAddAdminPanelRowMutation,
    useDeleteAdminPanelRowMutation,
    useUpdateAdminPanelRowMutation
} = adminApi;