import { cn } from '../../../shared/lib/utils'

interface TaskCardSkeletonProps {
    className?: string
}

const TaskCardSkeleton = ({ className = '' }: TaskCardSkeletonProps) => {
    return (
        <div
            className={cn(
                "w-full group relative flex items-center justify-between p-2 rounded-lg border border-border bg-card animate-pulse",
                className
            )}
        >
            <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg bg-muted" />

            <div className="flex items-center gap-4 flex-1 pl-3">
                <div className="flex flex-col w-full">
                    <div className="h-5 w-3/4 bg-muted rounded mb-2" />

                    <div className="flex items-center gap-3 mt-1">
                        <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <div className="h-5 w-20 bg-muted rounded mb-2" />

                <div className="h-8 w-8 bg-muted rounded" />
            </div>
        </div>
    )
}

export default TaskCardSkeleton