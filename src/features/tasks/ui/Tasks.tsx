import { format } from 'date-fns'
import { Loader2, Plus, Search, SortAsc, SortDesc, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../shared/ui/dialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../shared/ui/resizable'

import { useCreateTaskMutation, useDeleteTaskMutation, useGetStatusesQuery, useGetTaskQuery, useGetTasksQuery, useGetTaskTagsQuery, useUpdateTaskMutation } from '../../../entities/task/model/taskSlice'

import { useGetProjectMembersQuery } from '../../../entities/project/model/projectSlice'
import type { Task, TasksFilterParams } from '../../../entities/task/model/types'
import { TaskDetails } from '../../../features/task-details'
import { useTaskOperations } from '../../../features/org-project-selector/model/useWorkspaceSection'
import { DATE_REQUEST_FORMAT, DEBOUNCE_DELAY } from '../../../shared/config/constants'
import useDebounce from '../../../shared/lib/hooks/use-deboucne'
import { Input } from '../../../shared/ui/input'
import type { TasksFilterValues } from '../model/types'
import CreateTaskForm from './CreateTaskForm'
import { TasksFilter } from './TasksFilter'
import TasksList from './TasksList'

export default function Tasks({ type = 'tasks-page', projectId, organizationId }: { type?: 'tasks-page' | 'templates-page'; projectId: number; organizationId: number }) {
    const { t } = useTranslation()
    const operations = useTaskOperations(organizationId, projectId)
    const [searchParams, setSearchParams] = useSearchParams()

    const isTemplates = type === 'templates-page'

    const selectedTaskSlug = searchParams.get('task')

    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [filterParams, setFilterParams] = useState<Partial<TasksFilterParams>>({
        limit: 100,
        offset: 0
    })
    const [searchValue, setSearchValue] = useState('')
    const debouncedSearchValue = useDebounce<string>(searchValue, DEBOUNCE_DELAY)

    const filterRef = useRef<{
        handleReset: () => void
    }>(null)

    const { data: statuses } = useGetStatusesQuery({ projectId }, { skip: !projectId })
    const { data: members } = useGetProjectMembersQuery(projectId, { skip: !projectId })
    const { data: tagsResponse } = useGetTaskTagsQuery({ projectId, limit: 9999, is_orphan: false }, { skip: !projectId })

    const { data: tasksData, isLoading: tasksLoading, isFetching: tasksFetching, isError: tasksError, refetch: refetchTasks } = useGetTasksQuery({
        projectId,
        params: { ...(filterParams ?? {}), ...{ is_template: isTemplates ? true : false } },

    }, { skip: !projectId })

    const { data: taskData, isFetching: taskFetching, isLoading: taskLoading } = useGetTaskQuery({
        projectId,
        taskSlug: selectedTaskSlug || '',
    }, { skip: !projectId || !selectedTaskSlug })

    const [deleteTask] = useDeleteTaskMutation()
    const [createTask] = useCreateTaskMutation()
    const [updateTask] = useUpdateTaskMutation()

    if (!operations.create && createModalOpen) setCreateModalOpen(false)

    const handleAddTask = async (name: string, priority: Task['priority']) => {
        if (!operations.create) {
            toast.error(t('tasks-page.no-create'))
            setCreateModalOpen(false)
            return
        }
        if (!projectId) {
            toast.error(t('errors.select-project-first'))
            return
        }

        try {
            const newTask = await createTask({
                projectId,
                data: {
                    name: name.trim(),
                    priority,
                    is_template: isTemplates,
                },
            }).unwrap()

            toast.success(isTemplates ? t('notice-list.template-created') : t('notice-list.task-created'))
            setCreateModalOpen(false)

            handleSelectTask(newTask)
        } catch {
            toast.error(isTemplates ? t('errors.error-creating-template') : t('errors.error-creating-task'))
        }
    }

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value)
    }

    const handleSelectTask = (task: Task) => {
        searchParams.set('task', task.slug)
        setSearchParams(searchParams)
    }

    const handleCloseTaskDetails = () => {
        searchParams.delete('task')
        setSearchParams(searchParams)
    }

    const handleChangeTaskStatus = async (slug: string, status: 'completed' | 'incomplete') => {
        if (!operations.update) {
            toast.error(t('tasks-page.no-update'))
            return
        }
        const targetStatus = statuses?.find((st) => status === 'completed' ? st.name_en === 'Closed' : st.name_en === 'No status')
        let toastId: string | number | undefined
        try {
            if (!targetStatus) {
                toast.error(t('errors.status-not-found'))
                return
            }
            toastId = toast.loading(t('notice-list.changing-task-status'))
            await updateTask({
                projectId,
                taskSlug: slug,
                data: {
                    status: targetStatus?.id
                }
            }).unwrap()
            toast.success(t('notice-list.task-status-changed'))
        } catch {
            toast.error(t('errors.error-changing-task-status'))
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleDeleteTask = async (task: Task) => {
        if (!operations.delete) {
            toast.error(t('tasks-page.no-delete'))
            return
        }
        try {
            await deleteTask({
                projectId,
                taskSlug: task.slug
            }).unwrap()

            toast.success(isTemplates ? t('notice-list.template-deleted') : t('notice-list.task-deleted'))

            if (selectedTaskSlug === task.slug) {
                handleCloseTaskDetails()
            }
        } catch {
            toast.error(isTemplates ? t('errors.error-deleting-template') : t('errors.error-deleting-task'))
        }
    }

    const createTemplate = (_task: Task) => {
        toast.info(t('notice-list.template-created-from-task'))
    }

    const handleFilterChange = (filters: TasksFilterValues) => {
        const next: Partial<TasksFilterParams> = {
            limit: filterParams.limit,
            offset: 0,
            ordering: filterParams.ordering,
            name__icontains: filterParams.name__icontains,
            taskType: filters.taskType,
        }
        if (filters.dateRange?.from) {
            const from = format(filters.dateRange.from, DATE_REQUEST_FORMAT)
            const to = filters.dateRange.to ? format(filters.dateRange.to, DATE_REQUEST_FORMAT) : from
            next.created_at__range = `${from},${to}`
        }
        setFilterParams(next)
        searchParams.delete('task')
    }

    const handleResetFilters = () => {
        setFilterParams({ limit: 10000, offset: 0 })
        filterRef.current?.handleReset()
        searchParams.delete('task')
    }

    const handlePaginationChange = (value: { limit: number; offset: number }) => {
        setFilterParams({ ...(filterParams ?? {}), ...value } as TasksFilterParams)
    }

    useEffect(() => {
        setFilterParams({
            ...(filterParams ?? {}),
            name__icontains: debouncedSearchValue || undefined
        } as TasksFilterParams)
    }, [debouncedSearchValue])

    useEffect(() => {
        let toastId: string | number | undefined
        if (taskFetching) {
            toastId = toast.loading(t('notice-list.loading-task'))
        } else {
            toast.dismiss(toastId)
        }

        return () => {
            toast.dismiss(toastId)
        }
    }, [taskFetching])

    const renderTaskDetails = () => {
        if (!selectedTaskSlug || !taskData) {
            return <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                    <p className="text-lg mb-2">{isTemplates ? t(`templates-page.no-templates-selected`) : t(`tasks-page.no-task-selected`)}</p>
                    <p className="text-sm">{isTemplates ? t(`templates-page.select-template-to-view`) : t(`tasks-page.select-task-to-view`)}</p>
                </div>
            </div>
        }
        if (taskLoading) {
            return <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }
        return <TaskDetails
            task={taskData}
            tasks={tasksData?.results ?? []}
            tags={tagsResponse?.results ?? []}
            statuses={statuses ?? []}
            members={members ?? []}
            taskSlug={selectedTaskSlug || ''}
            projectId={projectId}
            organizationId={organizationId}
        />
    }

    return (
        <ResizablePanelGroup
            className="h-fit rounded-lg border border-border "
            orientation="horizontal"
        >
            <ResizablePanel
                defaultSize={40}
            >
                <div className="flex flex-col h-full ">
                    <div className="p-4 ">
                        <div className="flex items-center justify-between mb-4">
                            <h1 className="text-2xl font-bold tracking-tight">
                                {t(`${type}.title`)}
                            </h1>
                            <Dialog open={createModalOpen && operations.create} onOpenChange={(open) => {
                                if (!operations.create) {
                                    setCreateModalOpen(false)
                                    return
                                }
                                setCreateModalOpen(open)
                            }}>
                                <DialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        disabled={tasksLoading || taskFetching || !projectId || !operations.create}
                                        title={operations.create ? undefined : t('tasks-page.no-create')}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {isTemplates ? t(`templates-page.create-template`) : t(`tasks-page.create-task`)}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{isTemplates ? t(`templates-page.create-template`) : t(`tasks-page.create-task`)}</DialogTitle>
                                    </DialogHeader>
                                    <CreateTaskForm onCreate={handleAddTask} isTemplates={isTemplates} />
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="space-y-2 grid grid-cols-[1fr_auto] gap-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    value={searchValue}
                                    onChange={handleSearch}
                                    className="w-full pl-9 pr-8"
                                    placeholder={t('fields.search')}
                                    disabled={tasksLoading || taskFetching || tasksData?.results?.length === 0 || !projectId}
                                />

                                {searchValue && (
                                    <X
                                        className="absolute cursor-pointer right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                                        onClick={() => setSearchValue('')}
                                    />
                                )}
                            </div>

                            <div className="flex gap-2">
                                <TasksFilter
                                    ref={filterRef}
                                    onFilterChange={handleFilterChange}
                                    disabled={tasksLoading || taskFetching || (tasksData?.results?.length === 0 && Object.keys(filterParams).length === 2) || !projectId}
                                    onReset={() => setFilterParams({ limit: 10000, offset: 0 })}
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={tasksLoading || taskFetching || tasksData?.results?.length === 0 || !projectId}
                                    onClick={() => setFilterParams({
                                        ...(filterParams ?? {}),
                                        ordering: filterParams.ordering === '-created_at' ? 'created_at' : '-created_at'
                                    } as TasksFilterParams)}
                                >
                                    {filterParams.ordering === '-created_at' ? (
                                        <SortDesc className="h-4 w-4" />
                                    ) : (
                                        <SortAsc className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                    {tasksError ? (
                        <div className="m-4 rounded-lg border border-border p-6 text-center" role="alert">
                            <p className="mb-4 text-sm text-muted-foreground">{t('workspace.section-error')}</p>
                            <Button type="button" variant="outline" size="sm" onClick={() => void refetchTasks()}>
                                {t('workspace.retry')}
                            </Button>
                        </div>
                    ) : (
                    <TasksList
                        tasks={tasksData?.results || []}
                        filterParams={filterParams}
                        isTemplates={isTemplates}
                        selectedTaskSlug={selectedTaskSlug || undefined}
                        selectTask={handleSelectTask}
                        deleteTask={operations.delete ? handleDeleteTask : undefined}
                        createTemplate={createTemplate}  
                        changeTaskStatus={operations.update ? handleChangeTaskStatus : undefined}
                        updateDeniedReason={operations.update ? undefined : t('tasks-page.no-update')}
                        changePagination={handlePaginationChange}
                        resetFilters={handleResetFilters}
                        isFetching={tasksFetching}
                        isLoading={tasksLoading}
                        pagination={{
                            limit: Number(filterParams.limit) || 10,
                            offset: Number(filterParams.offset) || 0,
                            total: tasksData?.count || 0
                        }}
                    />
                    )}
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} className="border-none rounded-none">
                <div className={isTemplates ? "h-[calc(100vh-64px-28px)]" : "h-[calc(100vh-64px-32px-32px-16px)]"}>
                    {renderTaskDetails()}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}