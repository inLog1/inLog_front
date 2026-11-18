import type { TaskPriority } from "../../../../entities/task/model/types"

export type RoadmapDetalizationMode = 'day' | 'week' | 'month' | 'year'

export interface RoadmapColumnOption {
    id: string
    label: string
}

export interface GanttTask {
    id: number
    slug: string
    text: string
    start: Date
    end: Date
    parent?: number
    type: string
    open?: boolean
    status: string
    priority: TaskPriority
}