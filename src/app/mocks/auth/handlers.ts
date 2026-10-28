import { http, type HttpHandler } from 'msw'
import type { InstallationPhase } from '../../../entities/access/model/accessApi'
import type { AuthMode } from '../../../shared/config/runtime'
import { documentMockNamespace, PERSONAL_MOCK_NAMESPACE } from '../../../shared/config/mock-scenario'
import { saveDirectoryEmployee, syncDirectory } from '../directory/service'
import { releaseMockWriter, resetMockNamespace, updateMockState } from '../db/repository'
import type { MockFault } from '../db/types'
import { configureInstallation, createOrganization, createProject, InstallationSetupError, installationNeedsOwner } from '../installation/service'
import { readDirectory, updateOrganizationRecord, updateProjectRecord } from '../organizations/service'
import { bearer, commit, json, load, MOCK_PREFIX, persistenceFailure, positiveId, readJson, reply, writeSupport } from '../http'
import { createSalt, digestPassword } from './password'
import {
  cancelMockSso,
  capabilitiesOf,
  completeMockSso,
  currentUser,
  describeAccounts,
  listOrganizations,
  listProjects,
  listProviderIdentities,
  projectDto,
  loginWithLocalDigest,
  loginWithPassword,
  logoutToken,
  mutateAssignment,
  principal,
  readOrganization,
  readProject,
  readTestResource,
  sessionAccess,
  ensureFormsSwitchAuthor,
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
    const normalized = email.trim().toLowerCase()
    const user = ready.users.find((item) => item.email.toLowerCase() === normalized)
    const credential = user
      ? (ready.localCredentials ?? []).find((item) => item.userId === user.id)
      : undefined
    if (credential) {
      const digest = await digestPassword(password, credential.salt)
      const salt = credential.salt
      return commit((state) => loginWithLocalDigest(state, email, digest, salt))
    }
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
    const writing = await writeSupport()
    return json({
      phase: ready.installationPhase,
      schemaVersion: ready.schemaVersion,
      writeLocked: writing.writeLocked,
      writesUnavailable: writing.writesUnavailable,
      needsOwner: installationNeedsOwner(ready),
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

  http.patch(`${MOCK_PREFIX}/projects/project/:id/`, async ({ request, params }) => {
    const ready = await load('projects/project/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    const token = bearer(request)
    return commit((state) => updateProjectRecord(state, token, id, {
      name: optionalText(body, 'name'),
      reservoir: optionalText(body, 'reservoir'),
      expectedRevision: optionalRevision(body.expectedRevision),
      id: optionalField(body, 'id'),
      corporationId: optionalField(body, 'corporation_id') ?? optionalField(body, 'corporationId'),
      organizationId: optionalField(body, 'organization') ?? optionalField(body, 'organization_id') ?? optionalField(body, 'organizationId'),
    }))
  }),

  http.post(`${MOCK_PREFIX}/projects/project/`, async ({ request }) => {
    const ready = await load('projects/project/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const token = bearer(request)
    const organizationId = typeof body.organization === 'number' ? body.organization : Number(body.organization)
    return commit((state) => {
      const who = principal(state, token)
      if (!who.ok) return who.result
      const created = createProject(state, who.user.id, {
        organizationId,
        name: text(body.name),
        reservoir: text(body.reservoir),
      })
      if ('error' in created) {
        return { state, status: created.error === 'forbidden' ? 403 : 400, body: { code: created.error } }
      }
      return { state: created.state, status: 201, body: projectDto(created.project) }
    })
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
    const namespace = documentMockNamespace()
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
        const withAuthor = body.ensureFormsSwitchAuthor === true ? ensureFormsSwitchAuthor(state) : state
        return {
          ...withAuthor,
          authMode: authMode === 'local' || authMode === 'sso' || authMode === 'mixed' ? authMode as AuthMode : state.authMode,
          installationPhase: installationPhase === 'uninitialized' || installationPhase === 'ready'
            ? installationPhase as InstallationPhase
            : state.installationPhase,
          fault: fault === null
            ? null
            : fault && typeof fault === 'object'
              ? fault as MockFault
              : state.fault,
          users: withAuthor.users.map((user) => {
            if (typeof blockedUserId === 'number' && user.id === blockedUserId) return { ...user, status: 'blocked' }
            if (typeof clearBlockedUserId === 'number' && user.id === clearBlockedUserId) return { ...user, status: 'active' }
            return user
          }),
        }
      }, namespace)
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
    const namespace = documentMockNamespace()
    try {
      const next = await resetMockNamespace(namespace)
      return json({ namespace: next.namespace, schemaVersion: next.schemaVersion })
    } catch (error) {
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/personal/reset/`, async () => {
    try {
      const next = await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
      return json({ namespace: next.namespace, schemaVersion: next.schemaVersion })
    } catch (error) {
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/release-writer/`, async () => {
    const namespace = documentMockNamespace()
    releaseMockWriter(namespace)
    return json({ released: true, namespace })
  }),

  http.post(`${MOCK_PREFIX}/installation/setup/`, async ({ request }) => {
    const namespace = documentMockNamespace()
    const ready = await load('installation/setup/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmation = typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : ''
    if (password.length < 8 || password !== confirmation) return json({ code: 'invalid_setup' }, 400)
    const salt = createSalt()
    const hash = await digestPassword(password, salt)
    const draft = {
      corporationName: text(body.corporationName),
      givenName: text(body.givenName),
      surname: text(body.surname),
      email: text(body.email),
      salt,
      hash,
    }
    try {
      await updateMockState((state) => configureInstallation(state, draft), namespace)
    } catch (error) {
      if (error instanceof InstallationSetupError) {
        return json({ code: error.code }, error.code === 'already_configured' ? 409 : 400)
      }
      const failure = persistenceFailure(error)
      if (failure) return failure
      throw error
    }
    try {
      return await commit((state) => {
        const login = loginWithLocalDigest(state, draft.email, hash, salt)
        if (login.status !== 200 || !login.body || typeof login.body !== 'object') {
          return { state, status: 200, body: { configured: true, signedIn: false } }
        }
        return {
          state: login.state,
          status: 200,
          body: { configured: true, signedIn: true, ...login.body },
        }
      })
    } catch {
      return json({ configured: true, signedIn: false })
    }
  }),

  http.get(`${MOCK_PREFIX}/organizations/directory/`, async ({ request }) => {
    const ready = await load('organizations/directory/')
    if (ready instanceof Response) return ready
    return reply(readDirectory(ready, bearer(request)))
  }),

  http.patch(`${MOCK_PREFIX}/organizations/organization/:id/`, async ({ request, params }) => {
    const ready = await load('organizations/organization/:id/')
    if (ready instanceof Response) return ready
    const id = positiveId(params.id)
    if (id == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    const token = bearer(request)
    return commit((state) => updateOrganizationRecord(state, token, id, {
      fullName: optionalText(body, 'full_name'),
      shortName: optionalText(body, 'short_name'),
      address: optionalText(body, 'address'),
      kind: optionalText(body, 'kind'),
      expectedRevision: optionalRevision(body.expectedRevision),
      id: optionalField(body, 'id'),
      corporationId: optionalField(body, 'corporation_id') ?? optionalField(body, 'corporationId'),
      organizationId: optionalField(body, 'organization_id') ?? optionalField(body, 'organizationId'),
    }))
  }),

  http.post(`${MOCK_PREFIX}/organizations/organization/`, async ({ request }) => {
    const ready = await load('organizations/organization/')
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    const token = bearer(request)
    return commit((state) => {
      const who = principal(state, token)
      if (!who.ok) return who.result
      const created = createOrganization(state, who.user.id, {
        fullName: text(body.full_name),
        shortName: text(body.short_name),
        address: text(body.address),
        kind: text(body.kind),
      })
      if ('error' in created) {
        return { state, status: created.error === 'forbidden' ? 403 : 400, body: { code: created.error } }
      }
      return {
        state: created.state,
        status: 201,
        body: {
          id: created.organization.id,
          full_name: created.organization.fullName,
          short_name: created.organization.shortName,
          address: created.organization.address,
          created_at: null,
          inn: null,
          kpp: null,
        },
      }
    })
  }),

  http.get(`${MOCK_PREFIX}/auth/dev/directory/`, async () => {
    const ready = await load()
    if (ready instanceof Response) return ready
    return json({
      providerId: 'mock-corporate',
      employees: (ready.directoryEmployees ?? []).map((item) => ({
        id: item.id,
        givenName: item.givenName,
        surname: item.surname,
        email: item.email,
        organizationId: item.organizationId,
        providerId: item.providerId,
        externalSubject: item.externalSubject,
        linkedUserId: item.linkedUserId,
      })),
      organizations: ready.organizations
        .filter((item) => item.corporationId === ready.installationCorporationId)
        .map((item) => ({ id: item.id, shortName: item.shortName, kind: item.kind })),
    })
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/directory/employees/`, async ({ request }) => {
    const ready = await load()
    if (ready instanceof Response) return ready
    const body = await readJson(request)
    return commit((state) => {
      const saved = saveDirectoryEmployee(state, {
        id: text(body.id),
        givenName: text(body.givenName),
        surname: text(body.surname),
        patronymic: text(body.patronymic),
        email: text(body.email),
        organizationId: typeof body.organizationId === 'number' ? body.organizationId : Number(body.organizationId),
        providerId: text(body.providerId),
        externalSubject: text(body.externalSubject),
      })
      if (!saved.ok) return { state, status: 400, body: { code: saved.code } }
      return { state: saved.state, status: 200, body: { id: text(body.id) } }
    })
  }),

  http.post(`${MOCK_PREFIX}/auth/dev/directory/sync/`, async () => {
    const ready = await load()
    if (ready instanceof Response) return ready
    return commit((state) => {
      const synced = syncDirectory(state)
      return { state: synced.state, status: 200, body: synced.report }
    })
  }),
]

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalField(body: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : undefined
}

function optionalText(body: Record<string, unknown>, key: string): string | undefined {
  const value = optionalField(body, key)
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : ''
}

function optionalRevision(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}
