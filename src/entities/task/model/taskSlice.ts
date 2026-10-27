import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "../../../shared/api/clientApi";
import type { TagsResponse, TaskCreate, TaskUpdate } from "../../../shared/types/dto/task";
import type { Status, Tag, Task, TasksFilterParams } from "./types";
import { errorsHandler } from "../../../shared/lib/errors-handler";
import { applyClientTaskTypeFilter, applyOptimisticTaskPatch, projectTaskIdentity, reconcileTaskInList, taskListQueryMatchesProject } from "./task-cache";

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
            }, _, arg) => applyClientTaskTypeFilter(response, arg.params.taskType),
        }),

        getTask: builder.query<Task, { projectId: number; taskSlug: string }>({
            query: ({ projectId, taskSlug }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/`,
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

        updateTask: builder.mutation<Task, { projectId: number; taskSlug: string; data: { id?: number, parent?: number } & Partial<TaskUpdate> }>({
            query: ({ projectId, taskSlug, data }) => ({
                url: `projects/${projectId}/tasks/task/${taskSlug}/`,
                method: 'PATCH',
                body: data,
            }),
            async onQueryStarted({ projectId, taskSlug, data }, { dispatch, queryFulfilled, getState }) {
                const patches: { undo: () => void }[] = []
                const queries = Object.values(getState().taskApi.queries)
                for (const query of queries) {
                    if (!query || query.endpointName !== 'getTasks') continue
                    if (!taskListQueryMatchesProject(query.originalArgs, projectId)) continue
                    const args = query.originalArgs as { projectId: number; params: Partial<TasksFilterParams> }
                    const cached = query.data as { results?: Task[] } | undefined
                    if (!cached?.results?.some((task) => projectTaskIdentity(task, projectId, taskSlug))) continue
                    patches.push(dispatch(
                        taskApi.util.updateQueryData('getTasks', args, (draft) => {
                            applyOptimisticTaskPatch(draft, args.params, projectId, taskSlug, data, args.params?.ordering)
                        }),
                    ))
                }
                const detail = queries.find((query) => query?.endpointName === 'getTask'
                    && taskListQueryMatchesProject(query.originalArgs, projectId)
                    && (query.originalArgs as { taskSlug?: string }).taskSlug === taskSlug)
                if (detail?.data) {
                    const detailArgs = detail.originalArgs as { projectId: number; taskSlug: string }
                    patches.push(dispatch(
                        taskApi.util.updateQueryData('getTask', detailArgs, (draft) => {
                            if (!projectTaskIdentity(draft, projectId, taskSlug)) return
                            if (typeof data.name === 'string') draft.name = data.name
                            if (typeof data.description === 'string') draft.description = data.description
                            if (typeof data.priority === 'string') draft.priority = data.priority
                            if (typeof data.due_date_start === 'string') draft.due_date_start = data.due_date_start
                            if (typeof data.due_date_end === 'string') draft.due_date_end = data.due_date_end
                            if (typeof data.status === 'number') draft.status = { ...draft.status, id: data.status }
                            if (typeof data.status_position === 'number') draft.status_position = data.status_position
                        }),
                    ))
                }
                try {
                    const { data: updatedTask } = await queryFulfilled
                    if (updatedTask.project !== projectId || updatedTask.slug !== taskSlug) return
                    for (const query of queries) {
                        if (!query || query.endpointName !== 'getTasks') continue
                        if (!taskListQueryMatchesProject(query.originalArgs, projectId)) continue
                        const args = query.originalArgs as { projectId: number; params: Partial<TasksFilterParams> }
                        dispatch(taskApi.util.updateQueryData('getTasks', args, (draft) => {
                            reconcileTaskInList(draft, args.params, projectId, updatedTask, args.params?.ordering)
                        }))
                    }
                } catch {
                    patches.forEach((patch) => patch.undo())
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
        addTaskTag: builder.mutation<Tag, { projectId: number, data: { name: string } }>({
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
            query: ({ projectId, taskSlug, file }) => taskFileUploadRequest(projectId, taskSlug, file),

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

/** The browser sets the multipart boundary. A manual Content-Type would drop it. */
export function taskFileUploadRequest(projectId: number, taskSlug: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return {
        url: `projects/${projectId}/tasks/task/${taskSlug}/file/`,
        method: 'POST' as const,
        body: formData,
    }
}

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


