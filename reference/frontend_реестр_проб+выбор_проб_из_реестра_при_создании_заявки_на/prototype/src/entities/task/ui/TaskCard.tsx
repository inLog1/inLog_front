import { CheckCircle2, Circle, MoreHorizontal, Trash2 } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn, getPriorityColorStyle } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../shared/ui/dropdown-menu'
import type { Task } from '../model/types'

interface TaskCardProps {
    task: Task
    className?: string
    isDragging?: boolean
    isActive?: boolean
    selectTask?: (task: Task) => void
    deleteTask?: (task: Task) => void
    createTemplate?: (task: Task) => void
    changeStatus?: (slug: string, status: 'completed' | 'incomplete') => void
    updateDeniedReason?: string
}

const TaskCard = ({
    task,
    className = '',
    isDragging = false,
    selectTask = () => { },
    deleteTask,
    changeStatus,
    updateDeniedReason,
    isActive = false,
}: TaskCardProps) => {
    const { t } = useTranslation()
    const isTemplate = task.is_template
    const isCompleted = task.status.name_en === 'Closed'

    const formattedDate = useMemo(() => {
        if (!task.due_date_end) return null;
        return new Date(task.due_date_end).toLocaleDateString();
    }, [task.due_date_end]);

    const handleChangeStatus = () => {
        if (!changeStatus) return
        changeStatus(task.slug, isCompleted ? 'incomplete' : 'completed')
    }

    return (
        <div
            onClick={() => selectTask(task)}
            className={cn(
                "group relative flex items-center justify-between p-2 rounded-lg border transition-all duration-200 cursor-pointer bg-card",
                getPriorityColorStyle(task.priority, 'border'),
                className,
                isActive
                    ? "border-primary shadow-sm ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50",
                isCompleted && "bg-muted/30 hover:bg-muted/40"
            )}
        >
            <div
                className='absolute left-0 top-0 bottom-0 w-2 rounded-l-lg'
                style={getPriorityColorStyle(task.priority, 'background')}
            />

            <div className="flex items-center gap-3 flex-1 pl-3">
                {/* Статус иконка */}
                <button
                    type="button"
                    disabled={!changeStatus}
                    title={updateDeniedReason}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleChangeStatus()
                    }}
                    className={cn(
                        'flex-shrink-0 transition-transform',
                        changeStatus ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-70',
                    )}
                >
                    {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-blue-500" />
                    )}
                </button>

                <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn(
                        "font-medium group-hover:text-primary transition-colors",
                        isCompleted && "line-through text-muted-foreground"
                    )}>
                        {task.name}
                    </span>

                    {formattedDate && (
                        <span className={cn(
                            "text-xs text-muted-foreground",
                            isCompleted && "line-through"
                        )}>
                            {formattedDate}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {!isDragging && deleteTask && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteTask(task)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isTemplate ? t('templates-page.delete-template') : t('tasks-page.delete-task')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    )
}

export default memo(TaskCard)