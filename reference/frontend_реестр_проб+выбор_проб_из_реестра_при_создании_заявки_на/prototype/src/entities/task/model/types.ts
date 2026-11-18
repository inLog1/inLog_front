import type { ProjectMember, Supervisor, TaskDoer, User, UserFile } from "../../user/model/types"

export interface Task {
    id: number
    name: string
    description: string
    slug: string
    project: number
    creator: User
    priority: TaskPriority
    status: Status
    status_position: number | string
    due_date_start: string
    due_date_end: string
    tags: Tag[]
    equipment: ResearchEntity
    parent: number
    archived: boolean
    subtasks: Task[]
    doers: TaskDoer[]
    supervisor: Supervisor | ProjectMember
    files: UserFile[]
    created_at: string
    height?:number
    comments?:Comment[]
    is_template?:boolean
    days_to_complete?:number
}

export type TaskPriority = 'low' | 'medium' | 'critical' | 'important'

export type TaskTypeFilter = 'all' | 'parent' | 'child' | 'completed' | 'incomplete'

export interface TasksFilterParams {
    slug: string
    status: string
    doers__user: TaskDoer['user']
    slug__icontains: string
    name__icontains: string
    tags: Tag[]
    priority: Task['priority']
    created_at__range: any
    parent__isnull?: boolean | string
    is_completed?: boolean | string
    supervisor__user: Supervisor['user']
    ordering: string
    limit: string | number
    is_template: boolean
    offset: string | number

    taskType?: TaskTypeFilter
}

export interface Status {
    id: number
    name?: string
    name_en?: string
    name_ru?: string
    position: number | string
    project?: number
    tasksOrder?: string[]
    tasks?: any[]
}

export interface SubTask {
    id: number
    name: string
    slug: string
    created_at: string
}

export interface Tag {
    id?: number
    name?: string
    project?: number
    is_systemic?:boolean
    is_orphan?:boolean
    linked_object_content_type?:string | null
}


export interface ResearchEntity {
    id?: number
    name: string
    project?: number
    created_at?: string
}

interface CommentFile {
    id: number
    url: string
    name: string
    size?: number
    mime_type?: string
  }

export interface Comment {
    id: number
    text: string
    project: number
    user: User
    files: CommentFile[]
    created_at: string // ISO date string
  }
