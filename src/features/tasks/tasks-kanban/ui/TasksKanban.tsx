'use client'

import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
    pointerWithin,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useGetStatusesQuery, useGetTaskByParamsMutation, useUpdateTaskMutation } from '../../../../entities/task/model/taskSlice'
import type { Task } from '../../../../entities/task/model/types'
import { errorsHandler } from '../../../../shared/lib/errors-handler'
import { cn } from '../../../../shared/lib/utils'
import type { LanguageType } from '../../../../shared/types/enums'
import KanbanColumn from './KanbanColumn'
import SortableTaskCard from './SortableTaskCard'
import { ScrollArea } from '../../../../shared/ui/scroll-area'

interface Props {
    isLoading?: boolean
    onTaskClick?: (task: Task | undefined) => void
    onTaskDelete?: (task: Task | undefined) => void
    onCreateTask?: (statusId: number) => void
    selectedTaskSlug?: string
}

const TasksKanban = (props: Props) => {
    const { isLoading, onTaskClick, onTaskDelete, selectedTaskSlug } = props

    const { t, i18n } = useTranslation()
    const [columns, setColumns] = useState<Record<number, Task[]>>({})
    const [activeTask, setActiveTask] = useState<Task | null>(null)

    const [searchParams] = useSearchParams()
    const projectId = searchParams.get('project')

    const [isTasksLoading, setIsTasksLoading] = useState(false)

    const [getTaskByParams] = useGetTaskByParamsMutation()
    const [updateTask] = useUpdateTaskMutation()

    const { data: statuses, isLoading: statusesLoading } = useGetStatusesQuery(
        { projectId: Number(projectId) },
        { skip: !projectId }
    )

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const fetchTasksByStatuses = useCallback(async () => {
        if (!statuses || !projectId) return

        setIsTasksLoading(true)
        try {
            const results = await Promise.all(
                statuses.map(status =>
                    getTaskByParams({
                        projectId: Number(projectId),
                        params: {
                            status: status.id.toString(),
                            limit: 1000,
                            ordering: 'status_position',
                            is_template: false
                        }
                    }).unwrap()
                )
            )

            const newColumns: Record<number, Task[]> = {}
            statuses.forEach((status, i) => {
                newColumns[status.id] = results[i]?.results || []
            })

            setColumns(newColumns)
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            setIsTasksLoading(false)
        }
    }, [statuses, projectId, getTaskByParams, t])

    useEffect(() => {
        fetchTasksByStatuses()
    }, [fetchTasksByStatuses])

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event

        for (const [_, tasks] of Object.entries(columns)) {
            const task = tasks.find(t => t.id === active.id)
            if (task) {
                setActiveTask(task)
                break
            }
        }
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
    
        const activeId = active.id;
        const overId = over.id;
    
        const activeContId = active.data.current?.sortable?.containerId;
        const overContId = over.data.current?.type === 'column' 
            ? over.id 
            : over.data.current?.sortable?.containerId;
    
        if (!activeContId || !overContId) return;
    
        const activeContainer = Number(activeContId);
        const overContainer = Number(overContId);
    
        if (activeContainer === overContainer) {
            const items = columns[activeContainer];
            const oldIndex = items.findIndex(t => t.id === activeId);
            const newIndex = items.findIndex(t => t.id === overId);
            
            if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
                setColumns(prev => ({
                    ...prev,
                    [activeContainer]: arrayMove(items, oldIndex, newIndex)
                }));
            }
            return;
        }
    
        setColumns((prev) => {
            const sourceItems = prev[activeContainer] || [];
            const targetItems = prev[overContainer] || [];
    
            const activeIndex = sourceItems.findIndex((i) => i.id === activeId);
            if (activeIndex === -1) return prev;
    
            let newIndex: number;
            if (over.data.current?.type === 'column') {
                newIndex = targetItems.length;
            } else {
                newIndex = targetItems.findIndex((i) => i.id === overId);
                newIndex = newIndex === -1 ? targetItems.length : newIndex;
            }
    
            const movedTask = {
                ...sourceItems[activeIndex],
                status: { ...sourceItems[activeIndex].status, id: overContainer }
            };
    
            return {
                ...prev,
                [activeContainer]: sourceItems.filter((i) => i.id !== activeId),
                [overContainer]: [
                    ...targetItems.slice(0, newIndex),
                    movedTask,
                    ...targetItems.slice(newIndex),
                ],
            };
        });
    };
    
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
    
        setActiveTask(null);
    
        if (!over) return;
    
        let finalStatusId: number | null = null;
        let finalIndex = -1;
    
        for (const [statusId, tasks] of Object.entries(columns)) {
            const index = tasks.findIndex(t => t.id === active.id);
            if (index !== -1) {
                finalStatusId = Number(statusId);
                finalIndex = index;
                break;
            }
        }
    
        if (finalStatusId === null || finalIndex === -1) return;
    
        const taskToUpdate = columns[finalStatusId][finalIndex];
        
        const newPosition = finalIndex + 1;
    
        try {
            await updateTask({
                projectId: Number(projectId),
                taskSlug: taskToUpdate.slug,
                data: {
                    status: finalStatusId,
                    status_position: newPosition
                },
            }).unwrap();
        } catch (error) {
            errorsHandler(error, t);
            fetchTasksByStatuses();
        }
    };
    
    if (isLoading || statusesLoading || isTasksLoading) {
        return (
            <div className="flex h-full min-h-0 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            measuring={{
                droppable: {
                    strategy: MeasuringStrategy.Always,
                },
            }}
        >
            <div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-2">
                {statuses?.map(status => (
                    <KanbanColumn
                        key={status.id}
                        id={status.id}
                        title={status[`name_${i18n.language as LanguageType}`] || ''}
                        count={columns[status.id]?.length || 0}
                    >
                        <SortableContext
                            items={columns[status.id]?.map(t => t.id) || []}
                            id={status.id.toString()}
                            strategy={verticalListSortingStrategy}
                        >
                            <ScrollArea className="flex h-full min-h-0 flex-col gap-2">
                                {columns[status.id]?.map((task, taskIndex) => (
                                    <SortableTaskCard
                                        key={task.id}
                                        task={task}
                                        onClick={onTaskClick}
                                        onDelete={onTaskDelete}
                                        isActive={selectedTaskSlug === task.slug}
                                        className={cn(taskIndex !== 0 && 'mt-2')}
                                    />
                                ))}
                            </ScrollArea>
                        </SortableContext>
                    </KanbanColumn>
                ))}
            </div>

            <DragOverlay>
                {activeTask && (
                    <div className="opacity-80 rotate-2 scale-105">
                        <SortableTaskCard task={activeTask} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    )
}

export default TasksKanban;