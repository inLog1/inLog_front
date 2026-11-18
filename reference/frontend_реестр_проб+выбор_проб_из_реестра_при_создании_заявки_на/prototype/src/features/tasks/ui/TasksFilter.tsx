'use client'

import { format } from 'date-fns'
import { Filter } from 'lucide-react'
import * as React from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { DATE_REQUEST_FORMAT } from '../../../shared/config/constants'
import { cn } from '../../../shared/lib/utils'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../../shared/ui/dialog'
import { RangePicker } from '../../../shared/ui/range-picker'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../shared/ui/select'
import type { TaskTypeFilter } from '../../../entities/task/model/types'
import { useEffect, useImperativeHandle } from 'react'

export interface TasksFilterValues {
    dateRange?: DateRange
    taskType?: TaskTypeFilter
}

interface TasksFilterProps {
    onFilterChange: (filters: TasksFilterValues) => void
    onReset: () => void
    initialValues?: Partial<TasksFilterValues>
    disabled?: boolean
    className?: string
}

const taskTypeOptions: { value: TaskTypeFilter; label: string }[] = [
    { value: 'parent', label: 'tasks-page.parent-tasks' },
    { value: 'child', label: 'tasks-page.child-tasks' },
    { value: 'completed', label: 'tasks-page.completed-tasks' },
    { value: 'incomplete', label: 'tasks-page.incomplete-tasks' },
    { value: 'all', label: 'tasks-page.all-tasks' },
]

export const TasksFilter = React.forwardRef<{
    handleReset: () => void
}, TasksFilterProps>(({
    onFilterChange,
    onReset,
    initialValues = {},
    disabled = false,
    className,
}, ref) => {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const [localFilters, setLocalFilters] = React.useState<TasksFilterValues>({
        dateRange: initialValues.dateRange,
        taskType: initialValues.taskType || 'all',
    })

    const [isFilterActive, setIsFilterActive] = React.useState(false)

    useEffect(() => {
        const hasActiveFilters = !!(
            localFilters.dateRange ||
            (localFilters.taskType && localFilters.taskType !== 'all')
        )
        setIsFilterActive(hasActiveFilters)
    }, [localFilters])

    const handleApply = () => {
        onFilterChange(localFilters)
        setOpen(false)
    }

    const handleReset = () => {
        const resetFilters: TasksFilterValues = {
            dateRange: undefined,
            taskType: 'all',
        }
        setLocalFilters(resetFilters)
        onReset()
        setOpen(false)
    }

    const handleCancel = () => {
        setLocalFilters({
            dateRange: initialValues.dateRange,
            taskType: initialValues.taskType || 'all',
        })
        setOpen(false)
    }

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setLocalFilters((prev) => ({
            ...prev,
            dateRange: range,
        }))
    }

    const handleTaskTypeChange = (value: string) => {
        setLocalFilters((prev) => ({
            ...prev,
            taskType: value as TaskTypeFilter,
        }))
    }

    useImperativeHandle(ref, () => ({
        handleReset: handleReset,
    }), [])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    disabled={disabled}
                    className={cn(className, "relative")}
                >
                    <Filter className="h-4 w-4" />
                    {isFilterActive && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-2 w-2 p-0 rounded-full"
                        />
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('tasks-page.filter-tasks')}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('fields.date-range')}
                        </label>
                        <RangePicker
                            value={localFilters.dateRange}
                            onChange={handleDateRangeChange}
                            placeholder={t('fields.date-range')}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('tasks-page.task-type')}
                        </label>
                        <Select
                            value={localFilters.taskType}
                            onValueChange={handleTaskTypeChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('tasks-page.select-task-type')} />
                            </SelectTrigger>
                            <SelectContent>
                                {taskTypeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {t(option.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                    >
                        {t('buttons.cancel')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleReset}
                    >
                        {t('buttons.reset')}
                    </Button>
                    <Button
                        onClick={handleApply}
                    >
                        {t('buttons.apply')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
})

TasksFilter.displayName = 'TasksFilter'

export function useTasksFilter(initialValues?: Partial<TasksFilterValues>) {
    const [filters, setFilters] = React.useState<TasksFilterValues>({
        dateRange: initialValues?.dateRange,
        taskType: initialValues?.taskType || 'all',
    })

    const handleFilterChange = (newFilters: TasksFilterValues) => {
        setFilters(newFilters)
    }

    const handleReset = () => {
        setFilters({
            dateRange: undefined,
            taskType: 'all',
        })
    }

    const getApiParams = () => {
        const params: Record<string, string | undefined> = {}

        if (filters.dateRange?.from) {
            const from = format(filters.dateRange.from, DATE_REQUEST_FORMAT)
            const to = filters.dateRange.to
                ? format(filters.dateRange.to, DATE_REQUEST_FORMAT)
                : from
            params.created_at__range = `${from},${to}`
        }

        switch (filters.taskType) {
            case 'parent':
                params.parent__isnull = 'true'
                break
            case 'child':
                params.parent__isnull = 'false'
                break
            case 'completed':
                params.is_completed = 'true'
                break
            case 'incomplete':
                params.is_completed = 'false'
                break
            case 'all':
            default:
                break
        }

        return params
    }

    return {
        filters,
        handleFilterChange,
        handleReset,
        getApiParams,
        isActive: !!(filters.dateRange || filters.taskType !== 'all'),
    }
}