'use client'

import { Locale } from '@svar-ui/react-core'
import type { IApi } from '@svar-ui/react-gantt'
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt'
import "@svar-ui/react-gantt/all.css"
import { formatDate } from 'date-fns'
import { AlertCircle, Clock } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { taskApi, useGetTasksQuery, useUpdateTaskMutation } from '../../../../entities/task/model/taskSlice'
import type { TasksFilterParams } from '../../../../entities/task/model/types'
import { DATE_REQUEST_FORMAT } from '../../../../shared/config/constants'
import '../../../../shared/styles/index.css'
import { scalePresets, taskTypes } from '../lib/data'
import { convertToGanttTasks, getDefaultRoadmapColumns } from '../lib/roadmapHelpers'
import type { RoadmapColumnOption, RoadmapDetalizationMode } from '../model/types'
import RoadmapControls from './RoadmapControls'
import './TaskRoadmap.css'

function TasksRoadmap() {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const [searchParams] = useSearchParams()
    const projectId = searchParams.get('project')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const [updateTask] = useUpdateTaskMutation()
    const dispatch = useDispatch()

    const [viewMode, setViewMode] = useState<RoadmapDetalizationMode>('week')
    const [filterParams, setFilterParams] = useState<Partial<TasksFilterParams>>({
        limit: 100,
        offset: 0
    })

    const columns = useMemo(() => getDefaultRoadmapColumns(t), [t])

    const [columnSettings, setColumnSettings] = useState<{ showTable: boolean; visibleColumns: RoadmapColumnOption[] }>({
        showTable: true,
        visibleColumns: columns.map(col => ({ id: col.id, label: col.header })),
    })

    const refApi = useRef<IApi | null>(null);

    const { data: tasksData, isLoading } = useGetTasksQuery({
        projectId: Number(projectId),
        params: { is_template: false, ...filterParams },
    }, { skip: !projectId })

    const ganttTasks = useMemo(() => {
        try {
            const tasks = convertToGanttTasks(tasksData?.results || [], i18n.language)
            return Array.isArray(tasks) ? tasks : []
        } catch (error) {
            console.error('Error converting tasks:', error)
            return []
        }
    }, [tasksData?.results, i18n.language])


    // const ganttRange = useMemo(() => {
    //     if (!ganttTasks.length) return {}

    //     const dates = ganttTasks.flatMap(t => [t.start, t.end])
    //     return {
    //         start: dateFrom ? new Date(dateFrom) : new Date(Math.min(...dates.map(d => d.getTime()))),
    //         end: dateTo ? new Date(dateTo) : new Date(Math.max(...dates.map(d => d.getTime()))),
    //     }
    // }, [ganttTasks, dateFrom, dateTo])

    const ganttRange = useMemo(() => {
        // Всегда возвращаем объект с датами
        if (!ganttTasks.length) {
            const now = new Date()
            return {
                start: now,
                end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 дней
            }
        }

        try {
            const dates = ganttTasks.flatMap(t => {
                // Убеждаемся, что это Date объекты
                const start = t.start instanceof Date ? t.start : new Date(t.start)
                const end = t.end instanceof Date ? t.end : new Date(t.end)

                // Проверяем валидность
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    console.warn('Invalid date for task:', t.id, t.start, t.end)
                    return []
                }

                return [start, end]
            })

            if (!dates.length) {
                const now = new Date()
                return { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
            }

            const timestamps = dates.map(d => d.getTime())

            return {
                start: dateFrom ? new Date(dateFrom) : new Date(Math.min(...timestamps)),
                end: dateTo ? new Date(dateTo) : new Date(Math.max(...timestamps)),
            }
        } catch (error) {
            console.error('Error calculating ganttRange:', error)
            const now = new Date()
            return {
                start: now,
                end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            }
        }
    }, [ganttTasks, dateFrom, dateTo])

    const filteredColumns = useMemo(() => {
        if (!columnSettings.showTable) return []

        return columns.filter(col =>
            columnSettings.visibleColumns.some(c => c.id === col.id)
        )
    }, [columnSettings, columns])

    const GanttWrapper = theme === 'dark' ? WillowDark : Willow

    const handleUpdateTask = async (event: any) => {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading(t('notice-list.saving-task-data'))
            await updateTask({
                projectId: Number(projectId),
                taskSlug: event.task.slug,
                data: {
                    due_date_start: formatDate(event.task.start, DATE_REQUEST_FORMAT),
                    due_date_end: formatDate(event.task.end, DATE_REQUEST_FORMAT),
                }
            }).unwrap()

            dispatch(taskApi.util.invalidateTags(['Tasks']))
        } catch (error) {
            console.error('Failed to update task:', error)
        } finally {
            toast.dismiss(toastId)
        }
    }


    const safeTaskTypes = useMemo(() => {
        return Array.isArray(taskTypes) ? taskTypes : []
    }, [taskTypes])

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 pt-1">
            <RoadmapControls
                disabled={isLoading}
                initialValues={{
                    limit: 100,
                    offset: 0
                }}
                viewMode={viewMode}
                columnSettings={columnSettings}
                onChangeColumnSettings={setColumnSettings}
                setViewMode={setViewMode}
                onFilterChange={setFilterParams}
            />

            <div className="min-h-0 flex-1 overflow-hidden overflow-y-auto rounded-lg">

                {
                    (ganttTasks.length > 0 && !isLoading) ? (
                        <Locale words={'ru'}>
                            <GanttWrapper>
                                <Gantt
                                    ref={refApi}
                                    tasks={ganttTasks}
                                    scales={scalePresets[viewMode as keyof typeof scalePresets]}
                                    columns={filteredColumns}
                                    start={ganttRange.start}
                                    end={ganttRange.end}
                                    taskTypes={safeTaskTypes}
                                    onUpdateTask={handleUpdateTask}
                                />
                            </GanttWrapper>
                        </Locale>
                    ) : (isLoading) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <AlertCircle className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{t('tasks-page.roadmap.no-tasks-with-filters')}</p>
                        </div>
                    )
                }

            </div>
        </div>
    )
}

export default TasksRoadmap