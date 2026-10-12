import { ArrowLeft, Loader2, Plus, Search, SortAsc, SortDesc, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../shared/ui/dialog'
import { ResponsiveSplit } from '../../../shared/ui/responsive-split'

import { useCreateTaskMutation, useDeleteTaskMutation, useGetStatusesQuery, useGetTaskQuery, useGetTasksQuery, useGetTaskTagsQuery, useUpdateTaskMutation } from '../../../entities/task/model/taskSlice'

import { useGetProjectMembersQuery } from '../../../entities/project/model/projectSlice'
import type { Task, TasksFilterParams } from '../../../entities/task/model/types'
import { TaskDetails } from '../../../features/task-details'
import { DEBOUNCE_DELAY } from '../../../shared/config/constants'
import useDebounce from '../../../shared/lib/hooks/use-deboucne'
import { Input } from '../../../shared/ui/input'
import type { TasksFilterValues } from '../model/types'
import CreateTaskForm from './CreateTaskForm'
import { TasksFilter } from './TasksFilter'
import TasksList from './TasksList'

export default function Tasks({ type = 'tasks-page' }: { type?: 'tasks-page' | 'templates-page' }) {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()

    const isTemplates = type === 'templates-page'

    const projectId = searchParams.get('project')
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

    const { data: statuses } = useGetStatusesQuery({ projectId: Number(projectId) }, { skip: !projectId })
    const { data: members } = useGetProjectMembersQuery(Number(projectId), { skip: !projectId })
    const { data: tagsResponse } = useGetTaskTagsQuery({ projectId: Number(projectId), limit: 9999, is_orphan: false }, { skip: !projectId })

    const { data: tasksData, isLoading: tasksLoading, isFetching: tasksFetching } = useGetTasksQuery({
        projectId: Number(projectId),
        params: { ...(filterParams ?? {}), ...{ is_template: isTemplates ? true : false } },

    }, { skip: !projectId })

    const { data: taskData, isFetching: taskFetching, isLoading: taskLoading } = useGetTaskQuery({
        projectId: Number(projectId),
        taskSlug: selectedTaskSlug || '',
    }, { skip: !projectId || !selectedTaskSlug })

    const [deleteTask] = useDeleteTaskMutation()
    const [createTask] = useCreateTaskMutation()
    const [updateTask] = useUpdateTaskMutation()

    const handleAddTask = async (name: string, priority: Task['priority']) => {
        if (!Number(projectId)) {
            toast.error(t('errors.select-project-first'))
            return
        }

        try {
            const newTask = await createTask({
                projectId: Number(projectId),
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
        const targetStatus = statuses?.find((st) => status === 'completed' ? st.name_en === 'Closed' : st.name_en === 'No status')
        let toastId: string | number | undefined
        try {
            if (!targetStatus) {
                toast.error(t('errors.status-not-found'))
                return
            }
            toastId = toast.loading(t('notice-list.changing-task-status'))
            await updateTask({
                projectId: Number(projectId),
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
        try {
            await deleteTask({
                projectId: Number(projectId),
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
        setFilterParams({
            ...(filterParams ?? {}),
            ...filters
        } as TasksFilterParams)
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
        />
    }

    const taskListPane = (
                <div className="flex h-full min-h-0 flex-col">
                    <div className="p-3 sm:p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                                {t(`${type}.title`)}
                            </h1>
                            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="w-full sm:w-auto" disabled={tasksLoading || taskFetching || !projectId}>
                                        <Plus className="mr-2 h-4 w-4" />
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

                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
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
                    <TasksList
                        tasks={tasksData?.results || []}
                        filterParams={filterParams}
                        isTemplates={isTemplates}
                        selectedTaskSlug={selectedTaskSlug || undefined}
                        selectTask={handleSelectTask}
                        deleteTask={handleDeleteTask}
                        createTemplate={createTemplate}  
                        changeTaskStatus={handleChangeTaskStatus}
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
                </div>
    )

    return (
        <ResponsiveSplit
            className="h-full min-h-0 rounded-lg border border-border"
            mobile={selectedTaskSlug ? 'main' : 'aside'}
            asideDefaultSize={40}
            mainDefaultSize={60}
            aside={taskListPane}
            main={
                <div className="flex h-full min-h-0 flex-col">
                    {selectedTaskSlug && (
                        <div className="border-b border-border p-2 lg:hidden">
                            <Button variant="ghost" size="sm" onClick={handleCloseTaskDetails}>
                                <ArrowLeft className="h-4 w-4" />
                                {t('buttons.back')}
                            </Button>
                        </div>
                    )}
                    <div className="min-h-0 flex-1">
                        {renderTaskDetails()}
                    </div>
                </div>
            }
        />
    )
}