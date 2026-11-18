'use client'

import { format } from 'date-fns'
import { Filter } from 'lucide-react'
import * as React from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import type { Status, TasksFilterParams } from '../../../../entities/task/model/types'
import { DATE_REQUEST_FORMAT, priorityColors, priorityTypes } from '../../../../shared/config/constants'
import { cn } from '../../../../shared/lib/utils'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../../../../shared/ui/dialog'
import { RangePicker } from '../../../../shared/ui/range-picker'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../../shared/ui/select'

export interface RoadmapFilterParams extends Omit<TasksFilterParams, 'priority'> {
    priority?: TasksFilterParams['priority'] | 'all'
}

interface RoadmapFilterProps {
    statuses: Status[]
    onFilterChange: (filters: Partial<TasksFilterParams>) => void
    initialValues?: Partial<TasksFilterParams>
    resetFilter: () => void
    disabled?: boolean
    className?: string
}

export function RoadmapFilter({
    statuses,
    onFilterChange,
    initialValues = {},
    resetFilter,
    disabled = false,
    className,
}: RoadmapFilterProps) {
    const { t, i18n } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const [localFilters, setLocalFilters] = React.useState<Partial<RoadmapFilterParams>>(initialValues)

    const [isFilterActive, setIsFilterActive] = React.useState(false)

    React.useEffect(() => {
        const hasActiveFilters = !!(
            (localFilters.priority && localFilters.priority !== 'all') ||
            (localFilters.status && localFilters.status !== 'all') ||
            (localFilters.created_at__range && localFilters.created_at__range.from && localFilters.created_at__range.to)
        )
        setIsFilterActive(hasActiveFilters)
    }, [localFilters])

    const handleApply = () => {
            onFilterChange(
                {
                    ...localFilters,
                    status: localFilters.status === 'all' ? undefined : localFilters.status,
                    priority: localFilters.priority === 'all' ? undefined : localFilters.priority,
                    created_at__range: localFilters.created_at__range ? [
                        localFilters.created_at__range.from ? format(localFilters.created_at__range.from, DATE_REQUEST_FORMAT) : undefined,
                        localFilters.created_at__range.to ? format(localFilters.created_at__range.to, DATE_REQUEST_FORMAT) : undefined,
                    ] : undefined,
                } as Partial<TasksFilterParams>)
            setOpen(false)
        }

    const handleReset = () => {
        resetFilter()
        setLocalFilters(initialValues)
        setOpen(false)
    }

    const handlePriorityChange = (value: string) => {
        setLocalFilters((prev) => ({
            ...prev,
            priority: value as TasksFilterParams['priority'] | 'all',
        }))
    }

    const handleStatusChange = (value: string) => {
        setLocalFilters((prev) => ({
            ...prev,
            status: value,
        }))
    }

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setLocalFilters((prev) => ({
            ...prev,
            created_at__range: range ? {
                from: range.from ? format(range.from, DATE_REQUEST_FORMAT) : undefined,
                to: range.to ? format(range.to, DATE_REQUEST_FORMAT) : undefined,
            } : undefined,
        }))
    }

    const renderStatusValue = (value: number | string) => {
        const targetStatus = statuses && statuses.find((status) => status.id?.toString() === value?.toString())
        if (!targetStatus) {
            return <span>{t('fields.not-specified')}</span>
        }
        return targetStatus[`name${i18n.language === 'ru' ? '_ru' : '_en'}`]
    }

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
                            value={localFilters.created_at__range}
                            onChange={handleDateRangeChange}
                            placeholder={t('fields.date-range')}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('fields.priority')}
                        </label>
                        <Select
                            value={localFilters.priority}
                            onValueChange={handlePriorityChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('fields.select-priority')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('fields.all-priorities')}</SelectItem>
                                {Object.values(priorityTypes).map((priority) => (
                                    <SelectItem key={priority} value={priority}>
                                        <span className={cn("flex items-center gap-2", priorityColors[priority])}>
                                            {t(`fields.priority-types.${priority}`)}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('fields.status')}
                        </label>
                        <Select
                            value={localFilters.status}
                            onValueChange={handleStatusChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('fields.select-status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('fields.all-statuses')}</SelectItem>
                                {statuses.map((option) => (
                                    <SelectItem key={option.id} value={option.id.toString()}>
                                        {renderStatusValue(option.id)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
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
}

