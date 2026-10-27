import type { Task, TasksFilterParams, TaskTypeFilter } from './types'

type TaskPage = {
  count: number
  next: string | null
  previous: string | null
  results: Task[]
}

export function taskListQueryMatchesProject(originalArgs: unknown, projectId: number): boolean {
  if (!originalArgs || typeof originalArgs !== 'object') return false
  return (originalArgs as { projectId?: unknown }).projectId === projectId
}

export function projectTaskIdentity(task: { slug?: string; project?: number }, projectId: number, taskSlug: string): boolean {
  return task.slug === taskSlug && (task.project == null || task.project === projectId)
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function taskMatchesListParams(task: Task, params: Partial<TasksFilterParams> | undefined): boolean {
  if (!params) return true
  if (params.is_template != null && Boolean(task.is_template) !== Boolean(params.is_template)) return false
  if (params.status != null && params.status !== '' && String(task.status?.id) !== String(params.status)) return false
  if (params.name__icontains && !task.name.toLowerCase().includes(String(params.name__icontains).toLowerCase())) return false
  if (params.slug__icontains && !task.slug.toLowerCase().includes(String(params.slug__icontains).toLowerCase())) return false
  const parentIsNull = asBoolean(params.parent__isnull)
  if (parentIsNull != null && (task.parent == null) !== parentIsNull) return false
  const completed = asBoolean(params.is_completed)
  if (completed != null && ((task.status?.name_en === 'Closed') !== completed)) return false
  return taskTypeMatches(task, params.taskType)
}

function taskTypeMatches(task: Task, taskType: TaskTypeFilter | undefined): boolean {
  if (!taskType || taskType === 'all') return true
  if (taskType === 'parent') return task.parent == null
  if (taskType === 'child') return task.parent != null
  if (taskType === 'completed') return task.status?.name_en === 'Closed'
  if (taskType === 'incomplete') return task.status?.name_en === 'No status'
  return true
}

function sortValue(task: Task, field: string): string | number {
  if (field === 'status_position') return Number(task.status_position)
  if (field === 'name') return task.name
  if (field === 'created_at') return task.created_at
  if (field === 'priority') return task.priority
  return task.id
}

function sortResults(results: Task[], ordering: string | undefined): Task[] {
  if (!ordering) return results
  const desc = ordering.startsWith('-')
  const field = desc ? ordering.slice(1) : ordering
  return [...results].sort((a, b) => {
    const av = sortValue(a, field)
    const bv = sortValue(b, field)
    if (av < bv) return desc ? 1 : -1
    if (av > bv) return desc ? -1 : 1
    return a.id - b.id
  })
}

function mergePatch(task: Task, patch: { parent?: number } & Record<string, unknown>): Task {
  const next: Task = { ...task, status: { ...task.status } }
  if (typeof patch.name === 'string') next.name = patch.name
  if (typeof patch.description === 'string') next.description = patch.description
  if (typeof patch.priority === 'string') next.priority = patch.priority as Task['priority']
  if (typeof patch.due_date_start === 'string') next.due_date_start = patch.due_date_start
  if (typeof patch.due_date_end === 'string') next.due_date_end = patch.due_date_end
  if (typeof patch.status === 'number') next.status = { ...task.status, id: patch.status }
  if (typeof patch.status_position === 'number') next.status_position = patch.status_position
  if ('parent' in patch) next.parent = typeof patch.parent === 'number' ? patch.parent : null as unknown as number
  if (typeof patch.archived === 'boolean') next.archived = patch.archived
  if (typeof patch.is_template === 'boolean') next.is_template = patch.is_template
  return next
}

/**
 * Optimistic list update for one project and one task slug.
 * A task that no longer matches the query leaves that page and the count drops.
 * Another project's row is left alone even when the slug is the same.
 */
export function applyOptimisticTaskPatch(
  draft: TaskPage,
  params: Partial<TasksFilterParams> | undefined,
  projectId: number,
  taskSlug: string,
  patch: { parent?: number } & Record<string, unknown>,
  ordering?: string,
): void {
  const index = draft.results.findIndex((task) => projectTaskIdentity(task, projectId, taskSlug))
  if (index === -1) return
  const next = mergePatch(draft.results[index], patch)
  if (!taskMatchesListParams(next, params)) {
    draft.results.splice(index, 1)
    draft.count = Math.max(0, draft.count - 1)
    return
  }
  draft.results[index] = next
  draft.results = sortResults(draft.results, ordering)
}

export function reconcileTaskInList(
  draft: TaskPage,
  params: Partial<TasksFilterParams> | undefined,
  projectId: number,
  task: Task,
  ordering?: string,
): void {
  const index = draft.results.findIndex((item) => projectTaskIdentity(item, projectId, task.slug))
  if (index === -1) return
  if (task.project !== projectId || !taskMatchesListParams(task, params)) {
    draft.results.splice(index, 1)
    draft.count = Math.max(0, draft.count - 1)
    return
  }
  draft.results[index] = task
  draft.results = sortResults(draft.results, ordering)
}

/**
 * taskType is a client filter. It may rewrite a response only when that response
 * is the whole selection. A partial page keeps the server count.
 */
export function applyClientTaskTypeFilter<T extends TaskPage>(response: T, taskType: TaskTypeFilter | undefined): T {
  if (!taskType || taskType === 'all') return response
  if (response.next != null || response.previous != null) return response
  const results = response.results.filter((task) => taskTypeMatches(task, taskType))
  return { ...response, results, count: results.length }
}
