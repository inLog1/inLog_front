import { http, HttpResponse, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import type { TaskListQuery } from './service'
import {
  addComment,
  addDoer,
  addFile,
  addSupervisor,
  createTag,
  createTask,
  deleteComment,
  deleteFile,
  deleteTask,
  editComment,
  listMembers,
  listStatuses,
  listTags,
  listTasks,
  readFile,
  readTask,
  removeDoer,
  removeSupervisor,
  updateTask,
} from './service'

function flag(value: string | null): boolean | null {
  if (value == null || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function bounded(raw: string | null, fallback: number, max: number): number {
  if (raw == null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return fallback
  return Math.min(value, max)
}

function listQuery(url: URL): TaskListQuery {
  const params = url.searchParams
  const status = params.get('status')
  const tag = params.get('tags')
  const doer = params.get('doers__user')
  const supervisor = params.get('supervisor__user')
  const range = params.get('created_at__range')
  const [createdFrom, createdTo] = range ? range.split(',') : []
  const taskType = params.get('taskType')
  return {
    limit: bounded(params.get('limit'), 100, 10000),
    offset: bounded(params.get('offset'), 0, 100000),
    ordering: params.get('ordering') ?? undefined,
    nameContains: params.get('name__icontains') ?? undefined,
    slugContains: params.get('slug__icontains') ?? undefined,
    statusId: status && /^[1-9]\d*$/.test(status) ? Number(status) : undefined,
    priority: params.get('priority') ?? undefined,
    template: flag(params.get('is_template')),
    parentIsNull: flag(params.get('parent__isnull')),
    completed: flag(params.get('is_completed')),
    taskType: taskType && taskType !== 'all' ? taskType : undefined,
    tagId: tag && /^[1-9]\d*$/.test(tag) ? Number(tag) : undefined,
    doerUserId: doer && /^[1-9]\d*$/.test(doer) ? Number(doer) : undefined,
    supervisorUserId: supervisor && /^[1-9]\d*$/.test(supervisor) ? Number(supervisor) : undefined,
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || createdFrom || undefined,
    requestUrl: `${url.pathname}${url.search}`,
  }
}

function projectIdOf(raw: string | readonly string[] | undefined): number | null {
  return positiveId(raw)
}

function slugOf(raw: string | readonly string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || value.includes('/') || value.includes('..')) return null
  return decodeURIComponent(value)
}

export const taskHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/projects/:projectId/members/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/members/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    return reply(listMembers(ready, bearer(request), projectId))
  }),

  http.get(`${MOCK_PREFIX}/projects/:projectId/tasks/status/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/status/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    return reply(listStatuses(ready, bearer(request), projectId))
  }),

  http.get(`${MOCK_PREFIX}/projects/:projectId/tasks/tag/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/tag/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    const url = new URL(request.url)
    return reply(listTags(ready, bearer(request), projectId, {
      limit: bounded(url.searchParams.get('limit'), 100, 10000),
      orphan: flag(url.searchParams.get('is_orphan')),
    }))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/tag/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/tag/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createTag(state, bearer(request), projectId, body.name))
  }),

  http.get(`${MOCK_PREFIX}/projects/:projectId/tasks/task/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    return reply(listTasks(ready, bearer(request), projectId, listQuery(new URL(request.url))))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/task/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    if (projectId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createTask(state, bearer(request), projectId, body))
  }),

  http.get(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    return reply(readTask(ready, bearer(request), projectId, slug))
  }),

  http.patch(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateTask(state, bearer(request), projectId, slug, body))
  }),

  http.delete(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteTask(state, bearer(request), projectId, slug))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/doer/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/doer/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => addDoer(state, bearer(request), projectId, slug, body.user))
  }),

  http.delete(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/doer/:doerId/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/doer/:doerId/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const doerId = positiveId(params.doerId)
    if (projectId == null || slug == null || doerId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => removeDoer(state, bearer(request), projectId, slug, doerId))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/supervisor/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/supervisor/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => addSupervisor(state, bearer(request), projectId, slug, body.user))
  }),

  http.delete(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/supervisor/:supervisorId/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/supervisor/:supervisorId/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const supervisorId = positiveId(params.supervisorId)
    if (projectId == null || slug == null || supervisorId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => removeSupervisor(state, bearer(request), projectId, slug, supervisorId))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/comment/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/comment/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => addComment(state, bearer(request), projectId, slug, body.text))
  }),

  http.patch(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/comment/:commentId/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/comment/:commentId/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const commentId = positiveId(params.commentId)
    if (projectId == null || slug == null || commentId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => editComment(state, bearer(request), projectId, slug, commentId, body.text))
  }),

  http.delete(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/comment/:commentId/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/comment/:commentId/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const commentId = positiveId(params.commentId)
    if (projectId == null || slug == null || commentId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteComment(state, bearer(request), projectId, slug, commentId))
  }),

  http.post(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/file/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/file/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    if (projectId == null || slug == null) return json({ code: 'not_found' }, 404)
    const form = await request.formData()
    const entry = form.get('file')
    if (!(entry instanceof File)) return json({ code: 'invalid_file' }, 400)
    const bytes = new Uint8Array(await entry.arrayBuffer())
    return commit((state) => addFile(state, bearer(request), projectId, slug, {
      filename: entry.name,
      mimeType: entry.type,
      bytes,
    }))
  }),

  http.delete(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/file/:fileId/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/file/:fileId/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const fileId = positiveId(params.fileId)
    if (projectId == null || slug == null || fileId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteFile(state, bearer(request), projectId, slug, fileId))
  }),

  http.get(`${MOCK_PREFIX}/projects/:projectId/tasks/task/:slug/file/:fileId/content/`, async ({ request, params }) => {
    const ready = await load('projects/:projectId/tasks/task/:slug/file/:fileId/content/')
    if (ready instanceof Response) return ready
    const projectId = projectIdOf(params.projectId)
    const slug = slugOf(params.slug)
    const fileId = positiveId(params.fileId)
    if (projectId == null || slug == null || fileId == null) return json({ code: 'not_found' }, 404)
    const result = readFile(ready, bearer(request), projectId, slug, fileId)
    if (result.status !== 200 || !result.bytes) return reply(result)
    return new HttpResponse(result.bytes, {
      status: 200,
      headers: { 'Content-Type': result.mimeType || 'application/octet-stream' },
    })
  }),
]
