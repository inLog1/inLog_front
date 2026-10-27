import { Card } from '../../../shared/ui/card'

import { memo, useCallback, useEffect, useRef } from 'react'
import { TaskCard, TaskCardSkeleton } from '../../../entities/task'
import type { Task, TasksFilterParams } from '../../../entities/task/model/types'
import { cn } from '../../../shared/lib/utils'
import { ScrollArea } from '../../../shared/ui/scroll-area'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/button'

interface Props {
  tasks: Task[]
  isFetching: boolean
  isLoading: boolean
  selectedTaskSlug?: string
  isTemplates: boolean
  filterParams: Partial<TasksFilterParams>
  selectTask: (task: Task) => void
  deleteTask?: (task: Task) => void
  createTemplate: (task: Task) => void
  changeTaskStatus?: (slug: string, status: 'completed' | 'incomplete') => void
  updateDeniedReason?: string
  changePagination: (params: { limit: number; offset: number }) => void
  resetFilters: () => void
  pagination: {
    limit: number
    offset: number
    total: number
  }
  hasMore?: boolean
}

const TASKS_LIST_HEIGHT = 'h-[calc(100vh-280px)]'

const TasksList = ({
  tasks,
  isFetching,
  isLoading,
  isTemplates,
  selectedTaskSlug,
  filterParams,
  selectTask,
  deleteTask,
  createTemplate,
  changeTaskStatus,
  updateDeniedReason,
  changePagination,
  resetFilters,
  pagination,
  hasMore = true
}: Props) => {
  const { t } = useTranslation()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastTaskRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(() => {
    if (hasMore && tasks.length < pagination.total) {
      console.log('loadMore')
      // changePagination({ 
      //   limit: pagination.limit, 
      //   offset: tasks.length 
      // })
    }
  }, [hasMore, tasks.length, pagination.total, pagination.limit, changePagination])

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (firstEntry.isIntersecting && hasMore && tasks.length < pagination.total) {
          loadMore()
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    if (lastTaskRef.current) {
      observerRef.current.observe(lastTaskRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, tasks.length, pagination.total, loadMore])

  if (tasks.length === 0 && !isLoading && !isFetching) {
    return (
      <div className="pt-[50%] h-full">
        <div className="text-center text-muted-foreground">
          {isTemplates ? t(`templates-page.templates-absent-message`) : t(`tasks-page.tasks-absent-message`)}
          {Object.values(filterParams).filter(Boolean).length > 2 && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
              >
                {t('fields.clear-filters')}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className="px-4 border-none bg-transparent">

      <ScrollArea className={cn("flex flex-col gap-2 pr-3 -mr-3", TASKS_LIST_HEIGHT)}>
        {(isFetching || isLoading) && (
          <div className="w-full h-full flex items-center flex-col gap-2  text-muted-foreground">
            {Array.from({ length: 10 }).map((_, index) => (
              <TaskCardSkeleton key={index} />
            ))}
          </div>
        )}
        {(!isLoading && !isFetching) && tasks.map((task, index) => {
          const isLastElement = index === tasks.length - 1

          return (
            <div
              key={`${task.is_template ? 'template' : 'task'}-${task.id}`}
              ref={isLastElement ? lastTaskRef : null}
            >
              <TaskCard
                task={task}
                className={!isLastElement ? 'mb-2' : ''}
                isActive={selectedTaskSlug === task.slug}
                selectTask={selectTask}
                deleteTask={deleteTask}
                createTemplate={createTemplate}
                changeStatus={changeTaskStatus}
                updateDeniedReason={updateDeniedReason}
              />
            </div>
          )
        })}

        {(!isLoading && !isFetching) && hasMore && tasks.length < pagination.total && (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
          </div>
        )}
      </ScrollArea>
    </Card>
  )
}

export default memo(TasksList)