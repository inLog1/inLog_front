'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'
import { cn } from '../../../../shared/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../shared/ui/card'

interface Props {
    id: number
    title: string
    count: number
    children: React.ReactNode
    className?: string
}

const KanbanColumn = ({ 
    id, 
    title, 
    count, 
    children,
    className,
}: Props) => {
    const { setNodeRef, isOver: isOverInternal } = useDroppable({
        id: id,
        data: {
            type: 'column',
            statusId: id,
        },
    })

    // Используем внешний isOver если передан, иначе внутренний
    // const isOver = externalIsOver !== undefined ? externalIsOver : isOverInternal
    const isOver = isOverInternal
    return (
        <Card
            ref={setNodeRef}
            className={cn(
                "flex flex-col w-[320px] border-border flex-shrink-0 h-full transition-all duration-200",
                isOver && "ring-2 ring-primary ring-opacity-50 bg-accent/50",
                className
            )}
        >
            <CardHeader className="p-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* {color && (
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                            />
                        )} */}
                        <CardTitle className="text-sm font-medium truncate">
                            {title}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {count}
                        </span>
                    </div>
                    {/* {onAddClick && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => {
                                e.stopPropagation()
                                onAddClick()
                            }}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    )} */}
                </div>
            </CardHeader>
            <CardContent className="h-full p-2 pt-0 flex-1 overflow-hidden">
                {children}
            </CardContent>
        </Card>
    )
}

export default memo(KanbanColumn)