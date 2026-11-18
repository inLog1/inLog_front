import type { Tag, TaskPriority } from "../../../entities/task/model/types"
import type { UserFile } from "../../../entities/user/model/types"

    export interface TaskCreate {
    name: string
    title: string
    description: string
    priority: TaskPriority
    project: number
    parent: number
    status: number
    due_date_start: string
    due_date_end: string
    is_template: boolean
}

export interface TaskUpdate {
    id: number
    name: string
    description: string
    priority: TaskPriority
    status: number
    status_position: number
    due_date_start: string
    due_date_end: string
    tags: number[]
    supervisor: {
        email: string
        name: string
        organization: string
        position: string
        work_phone: string
        mobile_phone: string
    }
    equipment: number
    archived: boolean
    is_template: boolean
    files:UserFile[]
}

export interface TagsResponse {
    count: number
    next: string | null
    previous: string | null
    results: Tag[]
}