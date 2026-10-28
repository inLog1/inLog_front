import { createApi } from "@reduxjs/toolkit/query/react";
import { accessApi } from "../../access/model/accessApi";
import { organizationApi } from "../../organization/model/organizationSlice";
import { baseQuery } from "../../../shared/api/clientApi";
import type { Project } from "./types";
import type { MemberResponse, ProjectRequest } from "../../../shared/types/dto/project";
import { errorsHandler } from "../../../shared/lib/errors-handler";

export const projectApi = createApi({
    reducerPath: 'projectApi',
    baseQuery,
    tagTypes: ['Project'],
    endpoints: (builder) => ({
        getProjects: builder.query<Project[], { organization?: number | string }>({
            query: (params) => ({
              url: 'projects/project/',
              params: params?.organization ? { organization: params.organization } : undefined,
            }),
            async onQueryStarted(_, { queryFulfilled }) {
              try {
                  await queryFulfilled
              } catch (error: any) {
                  errorsHandler(error?.error)
              }
          },
            providesTags: ['Project'],
          }),

          addProject: builder.mutation<Project, Partial<ProjectRequest>>({
            query: (data) => ({
              url: 'projects/project/',
              method: 'POST',
              body: data,
            }),
            invalidatesTags: ['Project'],
            async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
              try {
                await queryFulfilled
                dispatch(accessApi.util.invalidateTags(['SessionAccess']))
                dispatch(organizationApi.util.invalidateTags(['Organization']))
              } catch {
                // A rejected create stays rejected and is not sent again.
              }
            },
          }),
          reviseProject: builder.mutation<{ id: number; name: string; revision: number }, {
            id: number
            name: string
            reservoir: string
            expectedRevision: number
          }>({
            query: ({ id, name, reservoir, expectedRevision }) => ({
              url: `projects/project/${id}/`,
              method: 'PATCH',
              body: { name, reservoir, expectedRevision },
            }),
            invalidatesTags: ['Project'],
            async onQueryStarted(_argument, { dispatch, queryFulfilled }) {
              try {
                await queryFulfilled
                dispatch(accessApi.util.invalidateTags(['SessionAccess']))
                dispatch(organizationApi.util.invalidateTags(['Organization']))
              } catch {
                // A conflict or refusal is not retried and is not treated as a saved change.
              }
            },
          }),

          getProjectById: builder.query<Project, number>({
            query: (id) => `projects/project/${id}/`,
            providesTags: (_result, _error, id) => [{ type: 'Project', id }],
          }),

          updateProject: builder.mutation<Project, { id: number; data: Partial<Project> }>({
            query: ({ id, data }) => ({
              url: `projects/project/${id}/`,
              method: 'PATCH',
              body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
              { type: 'Project', id },
              'Project',
            ],
          }),

          deleteProject: builder.mutation<void, number>({
            query: (id) => ({
              url: `projects/project/${id}/`,
              method: 'DELETE',
            }),
            invalidatesTags: ['Project'],
          }),
          getProjectMembers: builder.query<MemberResponse[], number>({
            query: (id) => `projects/${id}/members/`,
            async onQueryStarted(_, { queryFulfilled }) {
              try {
                  await queryFulfilled
              } catch (error: any) {
                  errorsHandler(error?.error)
              }
          },
          }),
    }),
})

export const { useGetProjectsQuery, useAddProjectMutation, useReviseProjectMutation, useGetProjectByIdQuery, useUpdateProjectMutation, useDeleteProjectMutation, useGetProjectMembersQuery } = projectApi