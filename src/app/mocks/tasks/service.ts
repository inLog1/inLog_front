import { can } from '../../../entities/access/model/grants'
import { principal, projectRecord, toLegacyUser, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockState, MockTask, MockTaskFile, MockUser } from '../db/types'

/** Test attachment limit. A larger file is refused before the document is written. */
export const MAX_TASK_FILE_BYTES = 2 * 1024 * 1024

export type TaskListQuery = {
  limit: number
  offset: number
  ordering?: string
  nameContains?: string
  slugContains?: string
  statusId?: number
  priority?: string
  template?: boolean | null
  parentIsNull?: boolean | null
  completed?: boolean | null
  taskType?: string
  tagId?: number
  doerUserId?: number
  supervisorUserId?: number
  createdFrom?: string
  createdTo?: string
  requestUrl?: string
}

type TaskAction = 'read' | 'create' | 'update' | 'delete' | 'assign'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function gate(state: MockState, token: string | null, projectId: number, action: TaskAction) {
  const who = principal(state, token)
  if (!who.ok) return who
  const project = projectRecord(state, projectId)
  if (!project) return { ok: false as const, result: done(state, 404, { code: 'not_found' }) }
  const allowed = can(toSnapshot(state), who.user.id, 'tasks', action, {
    type: 'project',
    projectId: project.id,
    organizationId: project.organizationId,
    corporationId: project.corporationId,
  })
  if (!allowed) return { ok: false as const, result: done(state, 403, { code: 'forbidden' }) }
  return { ok: true as const, user: who.user, project }
}

function taskBySlug(state: MockState, projectId: number, slug: string): MockTask | null {
  return state.tasks.find((task) => task.projectId === projectId && task.slug === slug) ?? null
}

function nextId(ids: number[]): number {
  return ids.reduce((max, id) => Math.max(max, id), 0) + 1
}

function statusOf(state: MockState, projectId: number, statusId: number) {
  return state.taskStatuses.find((status) => status.id === statusId && status.projectId === projectId) ?? null
}

function defaultStatus(state: MockState, projectId: number) {
  return state.taskStatuses
    .filter((status) => status.projectId === projectId)
    .sort((a, b) => a.position - b.position)[0] ?? null
}

function userOf(state: MockState, userId: number): MockUser | undefined {
  return state.users.find((user) => user.id === userId)
}

function contentPath(projectId: number, slug: string, fileId: number): string {
  return `/mock-api/projects/${projectId}/tasks/task/${encodeURIComponent(slug)}/file/${fileId}/content/`
}

function fileDto(file: MockTaskFile, slug: string) {
  return {
    id: file.id,
    name: file.filename,
    filename: file.filename,
    url: contentPath(file.projectId, slug, file.id),
    file: contentPath(file.projectId, slug, file.id),
    size: file.size,
    mime_type: file.mimeType,
    created_at: file.createdAt,
    task: file.taskId,
  }
}

function commentDto(state: MockState, comment: MockState['taskComments'][number]) {
  const user = userOf(state, comment.userId)
  return {
    id: comment.id,
    text: comment.text,
    project: comment.projectId,
    user: user ? toLegacyUser(user) : { id: comment.userId, email: '' },
    files: [],
    created_at: comment.createdAt,
  }
}

function participantDto(state: MockState, participant: { id: number; userId: number }) {
  const user = userOf(state, participant.userId)
  return { id: participant.id, user: user ? toLegacyUser(user) : undefined }
}

type TaskBody = {
  id: number
  name: string
  description: string
  slug: string
  project: number
  subtasks: TaskBody[]
  parent: number | null
  is_template: boolean
}

export function taskDto(state: MockState, task: MockTask, withChildren = true): TaskBody & Record<string, unknown> {
  const status = state.taskStatuses.find((item) => item.id === task.statusId)
  const creator = userOf(state, task.creatorId)
  const children = withChildren
    ? state.tasks.filter((item) => item.projectId === task.projectId && item.parentId === task.id)
    : []
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    slug: task.slug,
    project: task.projectId,
    creator: creator ? toLegacyUser(creator) : { id: task.creatorId, email: '' },
    priority: task.priority,
    status: {
      id: task.statusId,
      name_en: status?.nameEn ?? '',
      name_ru: status?.nameRu ?? '',
      name: status?.nameRu ?? '',
      position: status?.position ?? 0,
      project: task.projectId,
    },
    status_position: task.statusPosition,
    due_date_start: task.dueDateStart,
    due_date_end: task.dueDateEnd,
    tags: task.tagIds
      .map((id) => state.taskTags.find((tag) => tag.id === id && tag.projectId === task.projectId))
      .filter((tag) => tag != null)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        project: tag.projectId,
        is_systemic: tag.isSystemic,
        is_orphan: false,
      })),
    equipment: { name: '' },
    parent: task.parentId,
    archived: task.archived,
    subtasks: children.map((child) => taskDto(state, child, false)),
    doers: task.doers.map((doer) => participantDto(state, doer)),
    supervisor: task.supervisor ? participantDto(state, task.supervisor) : null,
    files: state.taskFiles
      .filter((file) => file.taskId === task.id && file.projectId === task.projectId)
      .map((file) => fileDto(file, task.slug)),
    created_at: task.createdAt,
    comments: state.taskComments
      .filter((comment) => comment.taskId === task.id && comment.projectId === task.projectId)
      .map((comment) => commentDto(state, comment)),
    is_template: task.isTemplate,
  }
}

function matches(state: MockState, task: MockTask, query: TaskListQuery): boolean {
  if (query.template != null && task.isTemplate !== query.template) return false
  if (query.statusId != null && task.statusId !== query.statusId) return false
  if (query.priority && task.priority !== query.priority) return false
  if (query.nameContains && !task.name.toLowerCase().includes(query.nameContains.toLowerCase())) return false
  if (query.slugContains && !task.slug.toLowerCase().includes(query.slugContains.toLowerCase())) return false
  if (query.parentIsNull != null && (task.parentId == null) !== query.parentIsNull) return false
  if (query.tagId != null && !task.tagIds.includes(query.tagId)) return false
  if (query.doerUserId != null && !task.doers.some((doer) => doer.userId === query.doerUserId)) return false
  if (query.supervisorUserId != null && task.supervisor?.userId !== query.supervisorUserId) return false
  const status = state.taskStatuses.find((item) => item.id === task.statusId)
  if (query.completed != null && ((status?.nameEn === 'Closed') !== query.completed)) return false
  if (query.createdFrom && task.createdAt.slice(0, 10) < query.createdFrom) return false
  if (query.createdTo && task.createdAt.slice(0, 10) > query.createdTo) return false
  if (query.taskType === 'parent' && task.parentId != null) return false
  if (query.taskType === 'child' && task.parentId == null) return false
  if (query.taskType === 'completed' && status?.nameEn !== 'Closed') return false
  if (query.taskType === 'incomplete' && status?.nameEn !== 'No status') return false
  return true
}

function ordered(tasks: MockTask[], ordering: string | undefined): MockTask[] {
  const key = ordering && ordering.length > 0 ? ordering : 'id'
  const desc = key.startsWith('-')
  const field = desc ? key.slice(1) : key
  return [...tasks].sort((a, b) => {
    const av = field === 'status_position' ? a.statusPosition
      : field === 'name' ? a.name
        : field === 'created_at' ? a.createdAt
          : field === 'priority' ? a.priority
            : a.id
    const bv = field === 'status_position' ? b.statusPosition
      : field === 'name' ? b.name
        : field === 'created_at' ? b.createdAt
          : field === 'priority' ? b.priority
            : b.id
    if (av < bv) return desc ? 1 : -1
    if (av > bv) return desc ? -1 : 1
    return a.id - b.id
  })
}

function pageBody(rows: MockTask[], state: MockState, query: TaskListQuery) {
  const count = rows.length
  const offset = query.offset
  const limit = query.limit
  const slice = rows.slice(offset, offset + limit)
  const url = query.requestUrl
  const withOffset = (nextOffset: number) => {
    if (!url) return null
    const parsed = new URL(url, 'http://mock.local')
    parsed.searchParams.set('offset', String(nextOffset))
    parsed.searchParams.set('limit', String(limit))
    return `${parsed.pathname}${parsed.search}`
  }
  return {
    count,
    next: offset + limit < count ? withOffset(offset + limit) : null,
    previous: offset > 0 ? withOffset(Math.max(0, offset - limit)) : null,
    results: slice.map((task) => taskDto(state, task)),
  }
}

export function listTasks(state: MockState, token: string | null, projectId: number, query: TaskListQuery): FlowResult {
  const access = gate(state, token, projectId, 'read')
  if (!access.ok) return access.result
  const rows = ordered(
    state.tasks.filter((task) => task.projectId === projectId && matches(state, task, query)),
    query.ordering,
  )
  return done(state, 200, pageBody(rows, state, query))
}

export function readTask(state: MockState, token: string | null, projectId: number, slug: string): FlowResult {
  const access = gate(state, token, projectId, 'read')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  return done(state, 200, taskDto(state, task))
}

function slugFor(name: string, id: number, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task'
  let slug = `${base}-${id}`
  let suffix = 2
  while (taken.has(slug)) {
    slug = `${base}-${id}-${suffix}`
    suffix += 1
  }
  return slug
}

function parentError(state: MockState, projectId: number, taskId: number | null, parentId: number | null): string | null {
  if (parentId == null) return null
  const parent = state.tasks.find((task) => task.id === parentId)
  if (!parent || parent.projectId !== projectId) return 'invalid_parent'
  if (taskId != null && parent.id === taskId) return 'invalid_parent'
  let cursor: MockTask | undefined = parent
  const seen = new Set<number>()
  while (cursor) {
    if (taskId != null && cursor.id === taskId) return 'invalid_parent'
    if (seen.has(cursor.id)) return 'invalid_parent'
    seen.add(cursor.id)
    cursor = cursor.parentId == null ? undefined : state.tasks.find((task) => task.id === cursor?.parentId)
  }
  return null
}

export function createTask(
  state: MockState,
  token: string | null,
  projectId: number,
  input: { name?: unknown; priority?: unknown; parent?: unknown; is_template?: unknown; description?: unknown; status?: unknown; due_date_start?: unknown; due_date_end?: unknown },
): FlowResult {
  const access = gate(state, token, projectId, 'create')
  if (!access.ok) return access.result
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) return done(state, 400, { code: 'invalid_name' })
  const status = typeof input.status === 'number'
    ? statusOf(state, projectId, input.status)
    : defaultStatus(state, projectId)
  if (!status) return done(state, 400, { code: 'invalid_status' })
  const id = nextId(state.tasks.map((task) => task.id))
  const parentId = typeof input.parent === 'number' ? input.parent : null
  const parentProblem = parentError(state, projectId, null, parentId)
  if (parentProblem) return done(state, 400, { code: parentProblem })
  const priorities = ['low', 'medium', 'critical', 'important']
  const priority = typeof input.priority === 'string' && priorities.includes(input.priority)
    ? input.priority as MockTask['priority']
    : 'medium'
  const task: MockTask = {
    id,
    projectId,
    slug: slugFor(name, id, new Set(state.tasks.filter((item) => item.projectId === projectId).map((item) => item.slug))),
    name,
    description: typeof input.description === 'string' ? input.description : '',
    creatorId: access.user.id,
    priority,
    statusId: status.id,
    statusPosition: 1,
    dueDateStart: typeof input.due_date_start === 'string' ? input.due_date_start : '',
    dueDateEnd: typeof input.due_date_end === 'string' ? input.due_date_end : '',
    parentId,
    archived: false,
    isTemplate: input.is_template === true,
    tagIds: [],
    doers: [],
    supervisor: null,
    createdAt: new Date().toISOString(),
  }
  const next = { ...state, tasks: [...state.tasks, task] }
  return done(next, 201, taskDto(next, task))
}

function replaceTask(state: MockState, task: MockTask): MockState {
  return { ...state, tasks: state.tasks.map((item) => item.id === task.id ? task : item) }
}

export function updateTask(
  state: MockState,
  token: string | null,
  projectId: number,
  slug: string,
  input: Record<string, unknown>,
): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const current = taskBySlug(state, projectId, slug)
  if (!current) return done(state, 404, { code: 'not_found' })
  if (typeof input.id === 'number' && input.id !== current.id) return done(state, 400, { code: 'invalid_task' })
  const nextTask: MockTask = { ...current, doers: current.doers.map((doer) => ({ ...doer })), tagIds: [...current.tagIds] }
  if (typeof input.name === 'string') {
    const name = input.name.trim()
    if (!name) return done(state, 400, { code: 'invalid_name' })
    nextTask.name = name
  }
  if (typeof input.description === 'string') nextTask.description = input.description
  if (typeof input.priority === 'string') {
    const priorities = ['low', 'medium', 'critical', 'important']
    if (!priorities.includes(input.priority)) return done(state, 400, { code: 'invalid_priority' })
    nextTask.priority = input.priority as MockTask['priority']
  }
  if (typeof input.status === 'number') {
    if (!statusOf(state, projectId, input.status)) return done(state, 400, { code: 'invalid_status' })
    nextTask.statusId = input.status
  }
  if (typeof input.status_position === 'number' && Number.isFinite(input.status_position)) {
    nextTask.statusPosition = input.status_position
  }
  if (typeof input.due_date_start === 'string') nextTask.dueDateStart = input.due_date_start.slice(0, 10)
  if (typeof input.due_date_end === 'string') nextTask.dueDateEnd = input.due_date_end.slice(0, 10)
  if ('parent' in input) {
    const parentId = typeof input.parent === 'number' ? input.parent : null
    const problem = parentError(state, projectId, current.id, parentId)
    if (problem) return done(state, 400, { code: problem })
    nextTask.parentId = parentId
  }
  if (typeof input.archived === 'boolean') nextTask.archived = input.archived
  if (typeof input.is_template === 'boolean') nextTask.isTemplate = input.is_template
  if (Array.isArray(input.tags)) {
    const tagIds: number[] = []
    for (const value of input.tags) {
      const id = typeof value === 'number' ? value : null
      const tag = id == null ? null : state.taskTags.find((item) => item.id === id && item.projectId === projectId)
      if (!tag) return done(state, 400, { code: 'invalid_tag' })
      tagIds.push(tag.id)
    }
    nextTask.tagIds = tagIds
  }
  if (Array.isArray(input.files)) {
    const ids: number[] = []
    for (const value of input.files) {
      const id = value && typeof value === 'object' && 'id' in value && typeof value.id === 'number'
        ? value.id
        : typeof value === 'number' ? value : null
      const file = id == null ? null : state.taskFiles.find((item) => item.id === id && item.taskId === current.id && item.projectId === projectId)
      if (!file) return done(state, 400, { code: 'invalid_file' })
      ids.push(file.id)
    }
    const nextFiles = state.taskFiles.filter((file) => file.taskId !== current.id || ids.includes(file.id))
    const replaced = replaceTask({ ...state, taskFiles: nextFiles }, nextTask)
    return done(replaced, 200, taskDto(replaced, nextTask))
  }
  const replaced = replaceTask(state, nextTask)
  return done(replaced, 200, taskDto(replaced, nextTask))
}

export function deleteTask(state: MockState, token: string | null, projectId: number, slug: string): FlowResult {
  const access = gate(state, token, projectId, 'delete')
  if (!access.ok) return access.result
  const current = taskBySlug(state, projectId, slug)
  if (!current) return done(state, 404, { code: 'not_found' })
  const remove = new Set<number>([current.id])
  let grew = true
  while (grew) {
    grew = false
    for (const task of state.tasks) {
      if (task.projectId === projectId && task.parentId != null && remove.has(task.parentId) && !remove.has(task.id)) {
        remove.add(task.id)
        grew = true
      }
    }
  }
  const next: MockState = {
    ...state,
    tasks: state.tasks.filter((task) => !remove.has(task.id)),
    taskComments: state.taskComments.filter((comment) => !remove.has(comment.taskId)),
    taskFiles: state.taskFiles.filter((file) => !remove.has(file.taskId)),
  }
  return done(next, 204, null)
}

function projectMember(state: MockState, userId: number, project: { id: number; organizationId: number; corporationId: number }): boolean {
  const user = userOf(state, userId)
  if (!user || user.status !== 'active') return false
  const snapshot = toSnapshot(state)
  const target = {
    type: 'project' as const,
    projectId: project.id,
    organizationId: project.organizationId,
    corporationId: project.corporationId,
  }
  return can(snapshot, userId, 'tasks', 'read', target) || can(snapshot, userId, 'projects', 'read', target)
}

export function listMembers(state: MockState, token: string | null, projectId: number): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const project = projectRecord(state, projectId)
  if (!project) return done(state, 404, { code: 'not_found' })
  if (!projectMember(state, who.user.id, project)) return done(state, 403, { code: 'forbidden' })
  const rows = state.users
    .filter((user) => projectMember(state, user.id, project))
    .map((user) => ({
      id: user.id,
      belonging: '',
      created_at: '2026-01-01T00:00:00.000Z',
      project: project.id,
      role: '',
      user: {
        id: user.id,
        email: user.email,
        full_name: toLegacyUser(user).full_name,
        name: user.name,
        mobile_phone: '',
        organization: '',
        position: user.position,
        work_phone: '',
        avatar: { large: '', medium: '', small: '', original: '' },
      },
    }))
  return done(state, 200, rows)
}

export function listStatuses(state: MockState, token: string | null, projectId: number): FlowResult {
  const access = gate(state, token, projectId, 'read')
  if (!access.ok) return access.result
  const rows = state.taskStatuses
    .filter((status) => status.projectId === projectId)
    .sort((a, b) => a.position - b.position)
    .map((status) => ({
      id: status.id,
      name: status.nameRu,
      name_en: status.nameEn,
      name_ru: status.nameRu,
      position: status.position,
      project: projectId,
    }))
  return done(state, 200, rows)
}

export function listTags(
  state: MockState,
  token: string | null,
  projectId: number,
  query: { limit: number; orphan: boolean | null },
): FlowResult {
  const access = gate(state, token, projectId, 'read')
  if (!access.ok) return access.result
  const used = new Set(state.tasks.filter((task) => task.projectId === projectId).flatMap((task) => task.tagIds))
  const filtered = state.taskTags
    .filter((tag) => tag.projectId === projectId)
    .filter((tag) => query.orphan == null || query.orphan === !used.has(tag.id))
  const rows = filtered.slice(0, query.limit)
  return done(state, 200, {
    count: filtered.length,
    next: null,
    previous: null,
    results: rows.map((tag) => ({
      id: tag.id,
      name: tag.name,
      project: tag.projectId,
      is_systemic: tag.isSystemic,
      is_orphan: !used.has(tag.id),
    })),
  })
}

export function createTag(state: MockState, token: string | null, projectId: number, name: unknown): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const label = typeof name === 'string' ? name.trim() : ''
  if (!label) return done(state, 400, { code: 'invalid_tag' })
  const existing = state.taskTags.find((tag) => tag.projectId === projectId && tag.name.toLowerCase() === label.toLowerCase())
  if (existing) {
    return done(state, 200, { id: existing.id, name: existing.name, project: projectId, is_orphan: false })
  }
  const tag = { id: nextId(state.taskTags.map((item) => item.id)), projectId, name: label, isSystemic: false }
  const next = { ...state, taskTags: [...state.taskTags, tag] }
  return done(next, 201, { id: tag.id, name: tag.name, project: projectId, is_orphan: true })
}

export function addDoer(state: MockState, token: string | null, projectId: number, slug: string, userId: unknown): FlowResult {
  const access = gate(state, token, projectId, 'assign')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  if (typeof userId !== 'number') return done(state, 400, { code: 'invalid_participant' })
  if (!projectMember(state, userId, access.project)) return done(state, 400, { code: 'invalid_participant' })
  if (task.doers.some((doer) => doer.userId === userId)) return done(state, 409, { code: 'already_assigned' })
  const nextTask: MockTask = {
    ...task,
    doers: [...task.doers, { id: nextId(state.tasks.flatMap((item) => item.doers.map((doer) => doer.id))), userId }],
  }
  const next = replaceTask(state, nextTask)
  return done(next, 200, taskDto(next, nextTask))
}

export function removeDoer(state: MockState, token: string | null, projectId: number, slug: string, doerId: number): FlowResult {
  const access = gate(state, token, projectId, 'assign')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  if (!task.doers.some((doer) => doer.id === doerId)) return done(state, 404, { code: 'not_found' })
  const nextTask: MockTask = { ...task, doers: task.doers.filter((doer) => doer.id !== doerId) }
  const next = replaceTask(state, nextTask)
  return done(next, 200, taskDto(next, nextTask))
}

export function addSupervisor(state: MockState, token: string | null, projectId: number, slug: string, userId: unknown): FlowResult {
  const access = gate(state, token, projectId, 'assign')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  if (task.supervisor) return done(state, 409, { code: 'supervisor_exists' })
  if (typeof userId !== 'number' || !projectMember(state, userId, access.project)) {
    return done(state, 400, { code: 'invalid_participant' })
  }
  const rowId = nextId(state.tasks.flatMap((item) => item.supervisor ? [item.supervisor.id] : []))
  const nextTask: MockTask = { ...task, supervisor: { id: rowId, userId } }
  const next = replaceTask(state, nextTask)
  return done(next, 200, taskDto(next, nextTask))
}

export function removeSupervisor(state: MockState, token: string | null, projectId: number, slug: string, supervisorId: number): FlowResult {
  const access = gate(state, token, projectId, 'assign')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  if (!task.supervisor || task.supervisor.id !== supervisorId) return done(state, 404, { code: 'not_found' })
  const nextTask: MockTask = { ...task, supervisor: null }
  const next = replaceTask(state, nextTask)
  return done(next, 200, taskDto(next, nextTask))
}

export function addComment(state: MockState, token: string | null, projectId: number, slug: string, text: unknown): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  const body = typeof text === 'string' ? text.trim() : ''
  if (!body) return done(state, 400, { code: 'invalid_comment' })
  const comment = {
    id: nextId(state.taskComments.map((item) => item.id)),
    taskId: task.id,
    projectId,
    userId: access.user.id,
    text: body,
    createdAt: new Date().toISOString(),
  }
  const next = { ...state, taskComments: [...state.taskComments, comment] }
  return done(next, 201, commentDto(next, comment))
}

export function editComment(
  state: MockState,
  token: string | null,
  projectId: number,
  slug: string,
  commentId: number,
  text: unknown,
): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  const comment = state.taskComments.find((item) => item.id === commentId && item.taskId === task.id)
  if (!comment) return done(state, 404, { code: 'not_found' })
  if (comment.userId !== access.user.id) return done(state, 403, { code: 'forbidden' })
  const body = typeof text === 'string' ? text.trim() : ''
  if (!body) return done(state, 400, { code: 'invalid_comment' })
  const updated = { ...comment, text: body }
  const next = { ...state, taskComments: state.taskComments.map((item) => item.id === comment.id ? updated : item) }
  return done(next, 200, commentDto(next, updated))
}

export function deleteComment(state: MockState, token: string | null, projectId: number, slug: string, commentId: number): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  const comment = state.taskComments.find((item) => item.id === commentId && item.taskId === task.id)
  if (!comment) return done(state, 404, { code: 'not_found' })
  if (comment.userId !== access.user.id) return done(state, 403, { code: 'forbidden' })
  const next = { ...state, taskComments: state.taskComments.filter((item) => item.id !== comment.id) }
  return done(next, 204, null)
}

export function addFile(
  state: MockState,
  token: string | null,
  projectId: number,
  slug: string,
  file: { filename: string; mimeType: string; bytes: Uint8Array },
): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  if (file.bytes.byteLength > MAX_TASK_FILE_BYTES) return done(state, 413, { code: 'payload_too_large' })
  const stored: MockTaskFile = {
    id: nextId(state.taskFiles.map((item) => item.id)),
    taskId: task.id,
    projectId,
    filename: file.filename || 'file',
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.bytes.byteLength,
    createdAt: new Date().toISOString(),
    bytes: file.bytes,
  }
  const next = { ...state, taskFiles: [...state.taskFiles, stored] }
  return done(next, 201, fileDto(stored, task.slug))
}

export function deleteFile(state: MockState, token: string | null, projectId: number, slug: string, fileId: number): FlowResult {
  const access = gate(state, token, projectId, 'update')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  const file = state.taskFiles.find((item) => item.id === fileId && item.taskId === task.id && item.projectId === projectId)
  if (!file) return done(state, 404, { code: 'not_found' })
  const next = { ...state, taskFiles: state.taskFiles.filter((item) => item.id !== file.id) }
  return done(next, 204, null)
}

export function readFile(state: MockState, token: string | null, projectId: number, slug: string, fileId: number): FlowResult & { bytes?: Uint8Array; mimeType?: string } {
  const access = gate(state, token, projectId, 'read')
  if (!access.ok) return access.result
  const task = taskBySlug(state, projectId, slug)
  if (!task) return done(state, 404, { code: 'not_found' })
  const file = state.taskFiles.find((item) => item.id === fileId && item.taskId === task.id && item.projectId === projectId)
  if (!file) return done(state, 404, { code: 'not_found' })
  return { state, status: 200, body: null, bytes: file.bytes, mimeType: file.mimeType }
}
