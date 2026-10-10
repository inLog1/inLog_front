import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "../../../shared/api/clientApi";
import type { TagsResponse, TaskCreate, TaskUpdate } from "../../../shared/types/dto/task";
import type { Status, Task, TasksFilterParams } from "./types";
import { errorsHandler } from "../../../shared/lib/errors-handler";

export const taskApi = createApi({
    reducerPath: 'taskApi',
    baseQuery,
    tagTypes: ['Tasks', 'Task'],
    endpoints: (builder) => ({
        getTasks: builder.query<{
            count: number
            next: string | null
            previous: string | null
            results: Task[]
        }, { projectId: number; params: Partial<TasksFilterParams> }>({
            query: ({ projectId, params }) => ({
                url: `projects/${projectId}/tasks/task/`,
                params: { ...params },
            }),
            providesTags: ['Tasks'],
            transformResponse: (response: {
                count: number
                next: string | null
                previous: string | null
                results: Task[]
            }, _, arg) => {
                const taskType = arg.params.taskType;

                if (!taskType) {
                    return response;
                }

                const filteredResults = response.results.filter(task => {
                    if (taskType === 'parent') {
                        return task.parent === null;
                    } else if (taskType === 'child') {
                        return task.parent !== null;
                    } else if (taskType === 'completed') {
                        return task.status.name_en === 'Closed';
                    } else if (taskType === 'incomplete') {
                        return task.status.name_en === 'No status';
                    }
                });

                return {
                    ...response,
                    count: filteredResults.length,
                    results: filteredResults,
                };
            },
        }),

        getTask: builder.query<Task, { projectId: number; taskSlug: string; archived?: boolean }>({
            query: ({ projectId, taskSlug, archived }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/`,
                ...(archived ? { params: { archived: true } } : {}),
            }),
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
            providesTags: ['Task'],
        }),

        getTaskByParams: builder.mutation<{
            count: number
            next: string | null
            previous: string | null
            results: Task[]
        }, { projectId: number; params: Partial<TasksFilterParams> }>({
            query: ({ projectId, params }) => ({
                url: `projects/${projectId}/tasks/task/`,
                params: { ...params },
            }),
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
        }),

        updateTask: builder.mutation<Task, { projectId: number; taskSlug: string; archived?: boolean; data: { id?: number, parent?: number } & Partial<TaskUpdate> }>({
            query: ({ projectId, taskSlug, archived, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/`,
                method: 'PATCH',
                ...(archived ? { params: { archived: true } } : {}),
                body: data,
            }),
            async onQueryStarted({ taskSlug }, { dispatch, queryFulfilled, getState }) {
                try {
                    const { data: updatedTask } = await queryFulfilled;

                    const state = getState();
                    const allQueries = Object.values(state.taskApi.queries);

                    const getTasksQueries = allQueries.filter(
                        (query: any) => query?.endpointName === 'getTasks'
                    );

                    getTasksQueries.forEach((query: any) => {
                        dispatch(
                            taskApi.util.updateQueryData('getTasks', query.originalArgs, (draft) => {
                                const index = draft.results.findIndex(task => task.slug === taskSlug);
                                if (index !== -1) {
                                    draft.results[index] = updatedTask;
                                }
                            })
                        );
                    });
                } catch (error) {
                    console.error('Error:', error);
                }
            },
            invalidatesTags: ['Task'],
        }),

        AddTaskDoer: builder.mutation<Task, { projectId: number; taskSlug: string; data: { user: number } }>({
            query: ({ projectId, taskSlug, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/doer/`,
                method: 'POST',
                body: {
                    user: data.user,
                    project: projectId,
                },
            }),
            // invalidatesTags: (_, __, { taskSlug }) => [{ type: 'Task', id: taskSlug }],
        }),
        deleteTaskDoer: builder.mutation<Task, { projectId: number; taskSlug: string, doerId: number }>({
            query: ({ projectId, taskSlug, doerId }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/doer/${doerId}/`,
                method: 'DELETE',
            }),
        }),
        AddTaskSupervisor: builder.mutation<Task, { projectId: number; taskSlug: string; data: { user: number } }>({
            query: ({ projectId, taskSlug, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/supervisor/`,
                method: 'POST',
                body: {
                    user: data.user,
                    project: projectId,
                },
            }),
        }),
        deleteTaskSupervisor: builder.mutation<Task, { projectId: number; taskSlug: string, supervisorId: number }>({
            query: ({ projectId, taskSlug, supervisorId }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/supervisor/${supervisorId}/`,
                method: 'DELETE',
            }),
        }),

        createTask: builder.mutation<Task, { projectId: number; data: Pick<TaskCreate, 'name'> & Partial<Omit<TaskCreate, 'name'>> }>({
            query: ({ projectId, data }) => ({
                url: `projects/${projectId}/tasks/task/`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Tasks', 'Task'],
        }),

        deleteTask: builder.mutation<void, { projectId: number; taskSlug: string }>({
            query: ({ projectId, taskSlug }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Tasks'],
        }),

        getStatuses: builder.query<Status[], { projectId: number }>({
            query: ({ projectId }) => `projects/${projectId}/tasks/status/`,
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
        }),
        getTaskTags: builder.query<TagsResponse, { projectId: number, limit?: number, is_orphan?: boolean }>({
            query: ({ projectId, limit, is_orphan }) => `projects/${projectId}/tasks/tag/?limit=${limit}&is_orphan=${is_orphan}`,
            async onQueryStarted(_, { queryFulfilled }) {
                try {
                    await queryFulfilled
                } catch (error: any) {
                    errorsHandler(error?.error)
                }
            },
        }),
        addTaskTag: builder.mutation<Task, { projectId: number, data: { name: string } }>({
            query: ({ projectId, data }) => ({
                url: `projects/${projectId}/tasks/tag/`,
                method: 'POST',
                body: data,
            }),
            // invalidatesTags: ['Task'],
        }),
        addTaskComment: builder.mutation<Comment, { projectId: number, taskSlug: string, data: { text: string } }>({
            query: ({ projectId, taskSlug, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/comment/`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Task'],
        }),
        editTaskComment: builder.mutation<Comment, { projectId: number, taskSlug: string, commentId: number, data: { text: string } }>({
            query: ({ projectId, taskSlug, commentId, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/comment/${commentId}/`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Task'],
        }),
        deleteTaskComment: builder.mutation<void, { projectId: number, taskSlug: string, commentId: number }>({
            query: ({ projectId, taskSlug, commentId }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/comment/${commentId}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Task'],
        }),
        createTaskFile: builder.mutation<Task['files'][number], { projectId: number, taskSlug: string, file: File }>({
            query: ({ projectId, taskSlug, file }) => {
                const formData = new FormData()
                formData.append('file', file)
                return {
                    url: `projects/${projectId}/tasks/task/${taskSlug}/file/`,
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            },

            // invalidatesTags: ['Task'],
        }),
        deleteTaskFile: builder.mutation<void, { projectId: number, taskSlug: string, fileId: number }>({
            query: ({ projectId, taskSlug, fileId }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/file/${fileId}/`,
                method: 'DELETE',
            }),
            // invalidatesTags: ['Task'],
        }),
    }),
});

export const {
    useGetTasksQuery,
    useGetTaskQuery,
    useUpdateTaskMutation,
    useCreateTaskMutation,
    useDeleteTaskMutation,
    useGetStatusesQuery,
    useAddTaskDoerMutation,
    useDeleteTaskDoerMutation,
    useAddTaskSupervisorMutation,
    useDeleteTaskSupervisorMutation,
    useAddTaskTagMutation,
    useGetTaskTagsQuery,
    useAddTaskCommentMutation,
    useEditTaskCommentMutation,
    useDeleteTaskCommentMutation,
    useCreateTaskFileMutation,
    useDeleteTaskFileMutation,
    useGetTaskByParamsMutation,
} = taskApi;


