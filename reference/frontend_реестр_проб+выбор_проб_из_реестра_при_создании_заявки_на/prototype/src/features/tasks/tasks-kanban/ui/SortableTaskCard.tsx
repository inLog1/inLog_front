'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../../../../entities/task/model/types'
import { TaskCard } from '../../../../entities/task'
import { cn } from '../../../../shared/lib/utils'
import { memo } from 'react'

interface Props {
    task: Task
    onClick?: (task: Task | undefined) => void
    onDelete?: (task: Task | undefined) => void
    canDrag?: boolean
    updateDeniedReason?: string
    isActive?: boolean
    className?: string
}

const SortableTaskCard = ({ task, onClick, onDelete, canDrag = true, updateDeniedReason, isActive, className }: Props) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: task.id,
        data: {
            type: 'task',
            task: task,
        },
        disabled: !canDrag, 
        animateLayoutChanges: () => true,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.3 : 1,
    }

    const handleClick = () => {
        if (!isDragging) {
            onClick?.(task)
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(canDrag ? attributes : {})}
            {...(canDrag ? listeners : {})}
            className={cn(
                canDrag && "cursor-grab active:cursor-grabbing",
                isDragging && "pointer-events-none",
                className
            )}
            onClick={handleClick}
        >
            <TaskCard
                task={task}
                isDragging={isDragging}
                deleteTask={onDelete}
                updateDeniedReason={updateDeniedReason}
                isActive={isActive}
            />
        </div>
    )
}

export default memo(SortableTaskCard);