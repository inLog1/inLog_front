import { http, HttpResponse, passthrough, type HttpHandler } from 'msw'
import {
  cancelMockSso,
  capabilitiesOf,
  completeMockSso,
  currentUser,
  describeAccounts,
  listOrganizations,
  listProjects,
  listProviderIdentities,
  loginWithPassword,
  logoutToken,
  mutateAssignment,
  readTestResource,
  sessionAccess,
  switchUser,
  verifyToken,
  type FlowResult,
} from './auth/flow'
import {
  ensureMockState,
  isMockWriteLocked,
  MockWriterHeldError,
  resetMockNamespace,
  SchemaMismatchError,
  StaleMockWriteError,
  updateMockState,
} from './db/repository'
import { guardOutboundRequest } from './outbound-guard'
import type { MockFault, MockState } from './db/types'
import type { AuthMode } from '../../shared/config/runtime'
import type { InstallationPhase } from '../../entities/access/model/accessApi'

const PREFIX = '/mock-api'

function json(body: object, status = 200) {
  return HttpResponse.json(body, { status })
}

function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

function mismatch(foundVersion: number) {
  return json({ code: 'schema_mismatch', foundVersion }, 409)
}

function persistenceFailure(error: unknown): Response | null {
  if (error instanceof SchemaMismatchError) return mismatch(error.foundVersion)
  if (error instanceof MockWriterHeldError) {
    return json({
      code: 'mock_writer_held',
      detail: 'Another tab is the writer for this mock namespace. This tab did not change it.',
    }, 409)
  }
  if (error instanceof StaleMockWriteError) {
    return json({
      code: 'stale_write',
      detail: 'The write used an older snapshot. The stored mock data was left unchanged.',
    }, 409)
  }
  return null
}

function faultResponse(fault: Exclude<MockFault, null>) {
  if (fault.kind === 'network') return HttpResponse.error()
  const status = fault.kind === 'unauthorized'
    ? 401
    : fault.kind === 'forbidden'
      ? 403
      : fault.kind === 'cancel'
        ? 400
        : 500
  return json({ code: fault.kind }, status)
}

async function load(path?: string): Promise<MockState | Response> {
  const read = await ensureMockState()
  if (!read.ok) return mismatch(read.foundVersion)
  if (!path || read.state.fault?.path !== path) return read.state
  const fault = read.state.fault
  try {
    await updateMockState((state) => ({ ...state, fault: null }))
  } catch (error) {
    const failure = persistenceFailure(error)
    if (failure) return failure
    throw error
  }
  return faultResponse(fault)
}

function reply(result: FlowResult) {
  if (result.status === 204) return new HttpResponse(null, { status: 204 })
  const body = result.body && typeof result.body === 'object' ? result.body : { code: 'empty' }
  return json(body, result.status)
}

async function commit(produce: (state: MockState) => FlowResult) {
  const box: { result?: FlowResult } = {}
  try {
    await updateMockState((state) => {
      const result = produce(state)
      box.result = result
      return result.state
    })
  } catch (error) {
    const failure = persistenceFailure(error)
    if (failure) return failure
    throw error
  }
  if (!box.result) return json({ code: 'empty' }, 500)
  return reply(box.result)
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? body as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export const handlers: HttpHandler[] = [
  http.post(`${PREFIX}/auth/login/`, async ({ request }) => {
    const ready = await load('auth/login/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    return commit((state) => loginWithPassword(state, email, password))
  }),

  http.post(`${PREFIX}/auth/token/verify/`, async ({ request }) => {
    const ready = await load('auth/token/verify/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const token = typeof body.token === 'string' ? body.token : ''
    return reply(verifyToken(ready, token))
  }),

  http.post(`${PREFIX}/auth/logout/`, async ({ request }) => {
    const ready = await load('auth/logout/')
    if (ready instanceof Response) return ready
    const token = bearer(request)
    return commit((state) => logoutToken(state, token))
  }),

  http.get(`${PREFIX}/users/me/`, async ({ request }) => {
    const ready = await load('users/me/')
    if (ready instanceof Response) return ready
    return reply(currentUser(ready, bearer(request)))
  }),

  http.get(`${PREFIX}/authentication/capabilities/`, async () => {
    const ready = await load('authentication/capabilities/')
    if (ready instanceof Response) return ready
    return json(capabilitiesOf(ready))
  }),

  http.get(`${PREFIX}/installation/status/`, async () => {
    const ready = await load('installation/status/')
    if (ready instanceof Response) return ready
    return json({
      phase: ready.installationPhase,
      schemaVersion: ready.schemaVersion,
      writeLocked: await isMockWriteLocked(),
    })
  }),

  http.get(`${PREFIX}/session/access/`, async ({ request }) => {
    const ready = await load('session/access/')
    if (ready instanceof Response) return ready
    return reply(sessionAccess(ready, bearer(request)))
  }),

  http.get(`${PREFIX}/organizations/organization/`, async ({ request }) => {
    const ready = await load('organizations/organization/')
    if (ready instanceof Response) return ready
    return reply(listOrganizations(ready, bearer(request)))
  }),

  http.get(`${PREFIX}/projects/project/`, async ({ request }) => {
    const ready = await load('projects/project/')
    if (ready instanceof Response) return ready
    const organization = new URL(request.url).searchParams.get('organization')
    const organizationId = organization && Number.isFinite(Number(organization)) ? Number(organization) : null
    return reply(listProjects(ready, bearer(request), organizationId))
  }),

  http.get(`${PREFIX}/auth/mock-sso/identities/`, async () => {
    const ready = await load('auth/mock-sso/identities/')
    if (ready instanceof Response) return ready
    return json(listProviderIdentities(ready))
  }),

  http.post(`${PREFIX}/auth/mock-sso/complete/`, async ({ request }) => {
    const ready = await load('auth/mock-sso/complete/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const providerId = typeof body.providerId === 'string' ? body.providerId : ''
    const externalSubject = typeof body.externalSubject === 'string' ? body.externalSubject : ''
    return commit((state) => completeMockSso(state, providerId, externalSubject))
  }),

  http.post(`${PREFIX}/auth/mock-sso/cancel/`, async () => {
    const ready = await load('auth/mock-sso/cancel/')
    if (ready instanceof Response) return ready
    return reply(cancelMockSso(ready))
  }),

  http.get(`${PREFIX}/mock/test-resource/`, async ({ request }) => {
    const ready = await load('mock/test-resource/')
    if (ready instanceof Response) return ready
    const organization = Number(new URL(request.url).searchParams.get('organization'))
    if (!Number.isFinite(organization)) return json({ code: 'invalid_organization' }, 400)
    return reply(readTestResource(ready, bearer(request), organization))
  }),

  http.post(`${PREFIX}/mock/test-assignments/`, async ({ request }) => {
    const ready = await load('mock/test-assignments/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : ''
    const roleId = typeof body.roleId === 'string' ? body.roleId : ''
    const token = bearer(request)
    return commit((state) => mutateAssignment(state, token, assignmentId, roleId))
  }),

  http.get(`${PREFIX}/auth/dev/accounts/`, async () => {
    const ready = await load()
    if (ready instanceof Response) return ready
    return json(describeAccounts(ready))
  }),

  http.post(`${PREFIX}/auth/dev/switch/`, async ({ request }) => {
    const ready = await load()
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const userId = typeof body.userId === 'number' ? body.userId : Number(body.userId)
    return commit((state) => switchUser(state, userId))
  }),

  http.post(`${PREFIX}/auth/dev/settings/`, async ({ request }) => {
    const ready = await load()
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    try {
      const next = await updateMockState((state) => {
        const authMode = body.authMode
        const installationPhase = body.installationPhase
        const fault = body.fault
        const blockedUserId = body.blockedUserId
        const clearBlockedUserId = body.clearBlockedUserId
        return {
          ...state,
          authMode: authMode === 'local' || authMode === 'sso' || authMode === 'mixed' ? authMode as AuthMode : state.authMode,
          installationPhase: installationPhase === 'uninitialized' || installationPhase === 'ready'
            ? installationPhase as InstallationPhase
            : state.installationPhase,
          fault: fault === null
            ? null
            : fault && typeof fault === 'object'
              ? fault as MockFault
              : state.fault,
          users: state.users.map((user) => {
            if (typeof blockedUserId === 'number' && user.id === blockedUserId) return { ...user, status: 'blocked' }
            if (typeof clearBlockedUserId === 'number' && user.id === clearBlockedUserId) return { ...user, status: 'active' }
            return user
          }),
        }
      })
      return json({
        authMode: next.authMode,
        installationPhase: next.installationPhase,
        fault: next.fault,
      })
    } catch (error) {
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
  }),

  http.post(`${PREFIX}/auth/dev/reset/`, async () => {
    try {
      const next = await resetMockNamespace()
      return json({ namespace: next.namespace, schemaVersion: next.schemaVersion })
    } catch (error) {
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
  }),

  http.all(`${PREFIX}/*`, () => json({
    code: 'mock_coverage_gap',
    detail: 'This legacy endpoint has no mock handler yet.',
  }, 501)),

  http.all('*', ({ request }) => {
    const blocked = guardOutboundRequest(request)
    if (blocked) return blocked
    return passthrough()
  }),
]
