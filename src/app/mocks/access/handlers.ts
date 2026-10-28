import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, readJson, reply } from '../http'
import {
  createAssignment,
  createRole,
  deleteRole,
  readAssignmentWrite,
  readDirectory,
  readRole,
  readRoleWrite,
  revokeAssignment,
  updateRole,
} from './service'
import { readUser, readUsers } from './users'

/**
 * Proposed access API. Registered only with the mock worker.
 * These paths are not a production backend.
 */
export const accessHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/access/users/`, async ({ request }) => {
    const ready = await load('access/users/')
    if (ready instanceof Response) return ready
    const url = new URL(request.url)
    return reply(readUsers(ready, bearer(request), {
      organization: url.searchParams.get('organization'),
      q: url.searchParams.get('q'),
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
    }))
  }),

  http.get(`${MOCK_PREFIX}/access/users/:userId/`, async ({ request, params }) => {
    const ready = await load('access/users/:userId/')
    if (ready instanceof Response) return ready
    const userId = typeof params.userId === 'string' && /^[1-9]\d*$/.test(params.userId) ? Number(params.userId) : null
    if (userId == null) return json({ code: 'not_found' }, 404)
    return reply(readUser(ready, bearer(request), userId))
  }),

  http.get(`${MOCK_PREFIX}/access/directory/`, async ({ request }) => {
    const ready = await load('access/directory/')
    if (ready instanceof Response) return ready
    const url = new URL(request.url)
    return reply(readDirectory(ready, bearer(request), {
      scope: url.searchParams.get('scope'),
      organization: url.searchParams.get('organization'),
    }))
  }),

  http.post(`${MOCK_PREFIX}/access/roles/`, async ({ request }) => {
    const ready = await load('access/roles/')
    if (ready instanceof Response) return ready
    const parsed = readRoleWrite(await readJson(request), true)
    if (!parsed.ok) return json({ code: parsed.code }, 400)
    return commit((state) => createRole(state, bearer(request), parsed.value))
  }),

  http.get(`${MOCK_PREFIX}/access/roles/:roleId/`, async ({ request, params }) => {
    const ready = await load('access/roles/:roleId/')
    if (ready instanceof Response) return ready
    const roleId = typeof params.roleId === 'string' ? params.roleId : ''
    if (!roleId) return json({ code: 'not_found' }, 404)
    return reply(readRole(ready, bearer(request), roleId))
  }),

  http.patch(`${MOCK_PREFIX}/access/roles/:roleId/`, async ({ request, params }) => {
    const ready = await load('access/roles/:roleId/')
    if (ready instanceof Response) return ready
    const roleId = typeof params.roleId === 'string' ? params.roleId : ''
    if (!roleId) return json({ code: 'not_found' }, 404)
    const parsed = readRoleWrite(await readJson(request), false)
    if (!parsed.ok) return json({ code: parsed.code }, 400)
    return commit((state) => updateRole(state, bearer(request), roleId, parsed.value))
  }),

  http.delete(`${MOCK_PREFIX}/access/roles/:roleId/`, async ({ request, params }) => {
    const ready = await load('access/roles/:roleId/')
    if (ready instanceof Response) return ready
    const roleId = typeof params.roleId === 'string' ? params.roleId : ''
    if (!roleId) return json({ code: 'not_found' }, 404)
    const version = new URL(request.url).searchParams.get('expectedAccessVersion')
    const expected = version == null || version === '' ? undefined : Number(version)
    if (expected != null && !Number.isInteger(expected)) return json({ code: 'invalid_version' }, 400)
    return commit((state) => deleteRole(state, bearer(request), roleId, expected))
  }),

  http.post(`${MOCK_PREFIX}/access/assignments/`, async ({ request }) => {
    const ready = await load('access/assignments/')
    if (ready instanceof Response) return ready
    const parsed = readAssignmentWrite(await readJson(request))
    if (!parsed.ok) return json({ code: parsed.code }, 400)
    return commit((state) => createAssignment(state, bearer(request), parsed.value))
  }),

  http.delete(`${MOCK_PREFIX}/access/assignments/:assignmentId/`, async ({ request, params }) => {
    const ready = await load('access/assignments/:assignmentId/')
    if (ready instanceof Response) return ready
    const assignmentId = typeof params.assignmentId === 'string' ? params.assignmentId : ''
    if (!assignmentId) return json({ code: 'not_found' }, 404)
    const version = new URL(request.url).searchParams.get('expectedAccessVersion')
    const expected = version == null || version === '' ? undefined : Number(version)
    if (expected != null && !Number.isInteger(expected)) return json({ code: 'invalid_version' }, 400)
    return commit((state) => revokeAssignment(state, bearer(request), assignmentId, expected))
  }),
]
