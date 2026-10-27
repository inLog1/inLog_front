import { http, type HttpHandler } from 'msw'
import type { InstallationPhase } from '../../../entities/access/model/accessApi'
import type { AuthMode } from '../../../shared/config/runtime'
import { resetMockNamespace, updateMockState } from '../db/repository'
import type { MockFault } from '../db/types'
import { bearer, commit, json, load, MOCK_PREFIX, persistenceFailure, positiveId, readJson, reply, writeLockedFlag } from '../http'
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
  readOrganization,
  readProject,
  readTestResource,
  sessionAccess,
  switchUser,
  verifyToken,
} from './flow'

export const authHandlers: HttpHandler[] = [
  http.post(`${MOCK_PREFIX}/auth/login/`, async ({ request }) => {
    const ready = await load('auth/login/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    return commit((state) => loginWithPassword(state, email, password))
  }),

  http.post(`${MOCK_PREFIX}/auth/token/verify/`, async ({ request }) => {
    const ready = await load('auth/token/verify/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const token = typeof body.token === 'string' ? body.token : ''
    return reply(verifyToken(ready, token))
  }),

  http.post(`${MOCK_PREFIX}/auth/logout/`, async ({ request }) => {
    const ready = await load('auth/logout/')
    if (ready instanceof Response) return ready
    return commit((state) => logoutToken(state, bearer(request)))
  }),

  http.get(`${MOCK_PREFIX}/users/me/`, async ({ request }) => {
    const ready = await load('users/me/')
    if (ready instanceof Response) return ready
    return reply(currentUser(ready, bearer(request)))
  }),

  http.get(`${MOCK_PREFIX}/authentication/capabilities/`, async () => {
    const ready = await load('authentication/capabilities/')
    if (ready instanceof Response) return ready
    return json(capabilitiesOf(ready))
  }),

  http.get(`${MOCK_PREFIX}/installation/status/`, async () => {
    const ready = await load('installation/status/')
    if (ready instanceof Response) return ready
    return json({
      phase: ready.installationPhase,
      schemaVersion: ready.schemaVersion,
      writeLocked: await writeLockedFlag(),
    })
  }),

  http.get(`${MOCK_PREFIX}/session/access/`, async ({ request }) => {
    const ready = await load('session/access/')
    if (ready instanceof Response) return ready
    return reply(sessionAccess(ready, bearer(request)))
  }),

  http.get(`${MOCK_PREFIX}/organizations/organization/`, async ({ request }) => {
    const ready = await load('organizations/organization/')
    if (ready instanceof Response) return ready
    return reply(listOrganizations(ready, bearer(request)))
  }),

  http.get(`${MOCK_PREFIX}/organizations/organization/:id/`, async ({ request, params }) => {
    const ready = await load('organizations/organization/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    return reply(readOrganization(ready, bearer(request), id))
  }),

  http.get(`${MOCK_PREFIX}/projects/project/`, async ({ request }) => {
    const ready = await load('projects/project/')
    if (ready instanceof Response) return ready
    const organization = new URL(request.url).searchParams.get('organization')
    if (organization == null || organization === '') return reply(listProjects(ready, bearer(request), null))
    if (!/^[1-9]\d*$/.test(organization)) return json({ code: 'invalid_organization' }, 400)
    return reply(listProjects(ready, bearer(request), Number(organization)))
  }),

  http.get(`${MOCK_PREFIX}/projects/project/:id/`, async ({ request, params }) => {
    const ready = await load('projects/project/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    return reply(readProject(ready, bearer(request), id))
  }),

  http.get(`${MOCK_PREFIX}/auth/mock-sso/identities/`, async () => {
    const ready = await load('auth/mock-sso/identities/')
    if (ready instanceof Response) return ready
    return json(listProviderIdentities(ready))
  }),

  http.post(`${MOCK_PREFIX}/auth/mock-sso/complete/`, async ({ request }) => {
    const ready = await load('auth/mock-sso/complete/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const providerId = typeof body.providerId === 'string' ? body.providerId : ''
    const externalSubject = typeof body.externalSubject === 'string' ? body.externalSubject : ''
    return commit((state) => completeMockSso(state, providerId, externalSubject))
  }),

  http.post(`${MOCK_PREFIX}/auth/mock-sso/cancel/`, async () => {
    const ready = await load('auth/mock-sso/cancel/')
    if (ready instanceof Response) return ready
    return reply(cancelMockSso(ready))
  }),

  http.get(`${MOCK_PREFIX}/mock/test-resource/`, async ({ request }) => {
    const ready = await load('mock/test-resource/')
    if (ready instanceof Response) return ready
    const organization = Number(new URL(request.url).searchParams.get('organization'))
    if (!Number.isFinite(organization)) return json({ code: 'invalid_organization' }, 400)
    return reply(readTestResource(ready, bearer(request), organization))
  }),

  http.post(`${MOCK_PREFIX}/mock/test-assignments/`, async ({ request }) => {
    const ready = await load('mock/test-assignments/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : ''
    const roleId = typeof body.roleId === 'string' ? body.roleId : ''
    return commit((state) => mutateAssignment(state, bearer(request), assignmentId, roleId))
  }),

  http.get(`${MOCK_PREFIX}/auth/dev/accounts/`, async () => {
    const ready = await load()
    if (ready instanceof Response) return ready
    return json(describeAccounts(ready))
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/switch/`, async ({ request }) => {
    const ready = await load()
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const userId = typeof body.userId === 'number' ? body.userId : Number(body.userId)
    return commit((state) => switchUser(state, userId))
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/settings/`, async ({ request }) => {
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

  http.post(`${MOCK_PREFIX}/auth/dev/reset/`, async () => {
    try {
      const next = await resetMockNamespace()
      return json({ namespace: next.namespace, schemaVersion: next.schemaVersion })
    } catch (error) {
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
  }),
]
