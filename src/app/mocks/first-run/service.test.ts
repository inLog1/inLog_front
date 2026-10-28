import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { can } from '../../../entities/access/model/grants'
import {
  MOCK_ACCESS_KEY,
  sessionDraftPrefix,
  setSessionStorageBackend,
  writeSession,
  type KeyValueStorage,
} from '../../../shared/api/session-storage'
import {
  MOCK_SCENARIO_STORAGE_KEY,
  PERSONAL_MOCK_NAMESPACE,
  documentMockNamespace,
  persistScenarioChoice,
  resetDocumentScenarioForTests,
} from '../../../shared/config/mock-scenario'
import { MOCK_DATA_NAMESPACE } from '../../../shared/config/runtime'
import { whiteboardRecordKey } from '../../../features/whiteboard/model/whiteboard-key'
import { canReadOrganization, completeMockSso, describeAccounts, listProjects, loginWithLocalDigest, loginWithPassword, toSnapshot } from '../auth/flow'
import { createSalt, digestPassword } from '../auth/password'
import { MOCK_PROVIDER_ID, MOCK_SCHEMA_VERSION, PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { createEmptyInstallation } from '../db/empty-installation'
import {
  MockWriterHeldError,
  ensureMockState,
  readMockState,
  releaseMockWriter,
  replaceMockRecord,
  resetMockNamespace,
  setMockLockSource,
  setMockWriterId,
  updateMockState,
} from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { saveDirectoryEmployee, syncDirectory } from '../directory/service'
import { InstallationSetupError, configureInstallation, createOrganization, createProject, installationNeedsOwner } from '../installation/service'

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

const opened: string[] = []
const secret = 'OwnerPass1'
const corporationScope = { type: 'corporation' as const, corporationId: 1 }

function denyLocks() {
  setMockLockSource(() => ({
    request: ((_name, _options, callback: (lock: null) => void) => {
      callback(null)
    }) as LockManager['request'],
  }))
}

async function draft() {
  const salt = createSalt()
  const hash = await digestPassword(secret, salt)
  return {
    corporationName: 'Своя корпорация',
    givenName: 'Анна',
    surname: 'Владелец',
    email: 'owner@personal.test',
    salt,
    hash,
  }
}

describe('mock first-run scenarios', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
    setMockWriterId(`tab-${crypto.randomUUID()}`)
    setMockLockSource(null)
    resetDocumentScenarioForTests()
    setSessionStorageBackend(null)
  })

  afterEach(() => {
    setMockLockSource(null)
    for (const namespace of opened) releaseMockWriter(namespace)
    opened.length = 0
    releaseMockWriter(PERSONAL_MOCK_NAMESPACE)
    resetDocumentScenarioForTests()
    setSessionStorageBackend(null)
  })

  it('keeps the demonstration and the personal installation in separate databases', async () => {
    const demo = `inlog:mock:scenario-demo-${crypto.randomUUID()}`
    opened.push(demo)
    await ensureMockState(demo)
    await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
    const personal = await readMockState(PERSONAL_MOCK_NAMESPACE)
    const demonstration = await readMockState(demo)
    expect(personal.ok && personal.state.users).toEqual([])
    expect(personal.ok && personal.state.organizations).toEqual([])
    expect(personal.ok && personal.state.roles).toEqual([])
    expect(personal.ok && personal.state.assignments).toEqual([])
    expect(personal.ok && personal.state.installationPhase).toBe('uninitialized')
    expect(personal.ok && personal.state.installationCorporationId).toBeNull()
    expect(personal.ok && installationNeedsOwner(personal.state)).toBe(true)
    expect(demonstration.ok && demonstration.state.users.length).toBeGreaterThan(0)
    await updateMockState((state) => ({
      ...state,
      corporation: { ...state.corporation, name: 'Только личная' },
    }), PERSONAL_MOCK_NAMESPACE)
    const demonstrationAfter = await readMockState(demo)
    expect(demonstrationAfter.ok && demonstrationAfter.state.corporation.name).not.toBe('Только личная')
    await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
    const cleared = await readMockState(PERSONAL_MOCK_NAMESPACE)
    const demonstrationKept = await readMockState(demo)
    expect(cleared.ok && cleared.state.users).toEqual([])
    expect(cleared.ok && installationNeedsOwner(cleared.state)).toBe(true)
    expect(demonstrationKept.ok && demonstrationKept.state.users.length).toBeGreaterThan(0)
  })

  it('does not reseed a personal installation that is already configured', async () => {
    await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
    const setup = await draft()
    await updateMockState((state) => configureInstallation(state, setup), PERSONAL_MOCK_NAMESPACE)
    const again = await ensureMockState(PERSONAL_MOCK_NAMESPACE)
    expect(again.ok && again.state.users).toHaveLength(1)
    expect(again.ok && again.state.corporation.name).toBe('Своя корпорация')
  })

  it('does not let a stored scenario choice retarget the open document', async () => {
    const memory = new MemoryStorage()
    resetDocumentScenarioForTests('demo')
    const openedNamespace = documentMockNamespace()
    expect(openedNamespace).toBe(MOCK_DATA_NAMESPACE)
    const captured = documentMockNamespace()
    persistScenarioChoice('personal', memory)
    await Promise.resolve()
    expect(documentMockNamespace()).toBe(openedNamespace)
    expect(captured).toBe(MOCK_DATA_NAMESPACE)
    expect(memory.getItem(MOCK_SCENARIO_STORAGE_KEY)).toBe('personal')
    const target = `inlog:mock:captured-${crypto.randomUUID()}`
    opened.push(target)
    await ensureMockState(target)
    await updateMockState((state) => ({
      ...state,
      corporation: { ...state.corporation, name: 'Поздняя запись' },
    }), captured === MOCK_DATA_NAMESPACE ? target : captured)
    const personal = await readMockState(PERSONAL_MOCK_NAMESPACE)
    const written = await readMockState(target)
    expect(personal.ok && personal.state.corporation.name).not.toBe('Поздняя запись')
    expect(written.ok && written.state.corporation.name).toBe('Поздняя запись')
  })

  it('stores session, drafts and whiteboard under the scenario that is already open', () => {
    const memory = new MemoryStorage()
    setSessionStorageBackend(memory)
    resetDocumentScenarioForTests('demo')
    writeSession({ accessToken: 'demo-token', refreshToken: 'demo-refresh', subjectId: 1 }, 'mock')
    memory.setItem(`${sessionDraftPrefix('mock')}note`, 'demo-draft')
    const demoBoard = whiteboardRecordKey('board', 'mock', 1)
    resetDocumentScenarioForTests('personal')
    writeSession({ accessToken: 'personal-token', refreshToken: 'personal-refresh', subjectId: 1 }, 'mock')
    memory.setItem(`${sessionDraftPrefix('mock')}note`, 'personal-draft')
    const personalBoard = whiteboardRecordKey('board', 'mock', 1)
    expect(memory.getItem(MOCK_ACCESS_KEY)).toContain('demo-token')
    expect(memory.getItem('inlog:mock:personal:session:access')).toContain('personal-token')
    expect(memory.getItem('inlog:session-draft:note')).toBe('demo-draft')
    expect(memory.getItem('inlog:mock:personal:draft:note')).toBe('personal-draft')
    expect(demoBoard).not.toBe(personalBoard)
    expect(demoBoard).toContain(encodeURIComponent(MOCK_DATA_NAMESPACE))
    expect(personalBoard).toContain(encodeURIComponent(PERSONAL_MOCK_NAMESPACE))
  })

  it('creates one owner atomically and rejects a second setup without another write', async () => {
    await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
    const setup = await draft()
    await expect(updateMockState((state) => configureInstallation(state, {
      ...setup,
      email: 'not-an-email',
    }), PERSONAL_MOCK_NAMESPACE)).rejects.toBeInstanceOf(InstallationSetupError)
    const untouched = await readMockState(PERSONAL_MOCK_NAMESPACE)
    expect(untouched.ok && untouched.state.users).toEqual([])
    expect(untouched.ok && untouched.state.installationPhase).toBe('uninitialized')
    await updateMockState((state) => configureInstallation(state, setup), PERSONAL_MOCK_NAMESPACE)
    await expect(updateMockState((state) => configureInstallation(state, {
      ...setup,
      email: 'second@personal.test',
    }), PERSONAL_MOCK_NAMESPACE)).rejects.toBeInstanceOf(InstallationSetupError)
    const stored = await readMockState(PERSONAL_MOCK_NAMESPACE)
    expect(stored.ok && stored.state.users.map((user) => user.email)).toEqual(['owner@personal.test'])
    expect(stored.ok && stored.state.systemCapabilities).toEqual([{ userId: 1, code: 'corporate_superadmin' }])
    expect(stored.ok && stored.state.localCredentials).toHaveLength(1)
    expect(stored.ok && stored.state.organizations).toEqual([])
  })

  it('lets the owner create the first organization when none exist', async () => {
    const setup = await draft()
    const ready = configureInstallation(createEmptyInstallation(PERSONAL_MOCK_NAMESPACE), setup)
    const snapshot = toSnapshot(ready)
    expect(ready.organizations).toEqual([])
    expect(ready.projects).toEqual([])
    expect(can(snapshot, 1, 'organizations', 'create', corporationScope)).toBe(true)
    expect(can(snapshot, 1, 'organizations', 'create', { type: 'corporation', corporationId: 99 })).toBe(false)
    const created = createOrganization(ready, 1, {
      fullName: 'Лаборатория Север',
      shortName: 'Север',
      address: 'Полевая, 1',
      kind: 'laboratory',
    })
    expect('organization' in created && created.organization.corporationId).toBe(1)
    expect('organization' in created && canReadOrganization(created.state, 1, created.organization.id)).toBe(true)
    expect('organization' in created && created.organization.kind).toBe('laboratory')
    const spoofed: MockState = {
      ...ready,
      installationCorporationId: 2,
      corporation: { id: 1, name: ready.corporation.name },
    }
    expect(createOrganization(spoofed, 1, {
      fullName: 'Чужая',
      shortName: 'Чужая',
      address: 'Нет',
      kind: 'laboratory',
    })).toEqual({ error: 'forbidden' })
    const described = describeAccounts(ready)
    expect(described[0]?.password).toBeNull()
    expect(described[0]?.grants.some((grant) => grant.resource === 'organizations' && grant.action === 'create')).toBe(true)
    const serialized = JSON.stringify(described)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain(ready.localCredentials?.[0]?.hash ?? 'missing-hash')
    expect(serialized).not.toContain(ready.localCredentials?.[0]?.salt ?? 'missing-salt')
    expect(JSON.stringify(ready)).not.toContain(secret)
  })

  it('lets the owner create a project and keeps read from granting create', async () => {
    const setup = await draft()
    const ready = configureInstallation(createEmptyInstallation('personal-memory'), setup)
    const login = loginWithLocalDigest(ready, setup.email, setup.hash, setup.salt)
    expect(login.status).toBe(200)
    const token = login.body && typeof login.body === 'object' && 'access_token' in login.body
      ? String(login.body.access_token)
      : ''
    const laboratory = createOrganization(login.state, 1, {
      fullName: 'Лаборатория Север',
      shortName: 'Север',
      address: 'Полевая, 1',
      kind: 'laboratory',
    })
    if (!('organization' in laboratory)) throw new Error('laboratory')
    const created = createProject(laboratory.state, 1, {
      organizationId: laboratory.organization.id,
      name: 'TestPr',
      reservoir: 'test pr',
    })
    if (!('project' in created)) throw new Error('project')
    expect(created.project.corporationId).toBe(1)
    expect(created.project.organizationId).toBe(laboratory.organization.id)
    expect(created.project.reservoir).toBe('test pr')
    const listed = listProjects(created.state, token, laboratory.organization.id)
    expect(listed.status).toBe(200)
    expect(listed.body).toEqual([expect.objectContaining({ name: 'TestPr', reservoir: 'test pr' })])
    expect(createProject(created.state, 1, {
      organizationId: 999,
      name: 'Нет',
      reservoir: 'Нет',
    })).toEqual({ error: 'invalid_project' })
    expect(can(toSnapshot(created.state), 1, 'projects', 'read', {
      type: 'project',
      projectId: created.project.id,
      organizationId: laboratory.organization.id,
      corporationId: 1,
    })).toBe(true)
  })

  it('checks the owner password and keeps the fixture password on demonstration accounts', async () => {
    const setup = await draft()
    const ready = configureInstallation(createEmptyInstallation('personal-memory'), setup)
    const accepted = loginWithLocalDigest(ready, setup.email, setup.hash, setup.salt)
    const wrong = await digestPassword('OtherPass1', setup.salt)
    expect(accepted.status).toBe(200)
    expect(loginWithLocalDigest(ready, setup.email, wrong, setup.salt).status).toBe(401)
    expect(loginWithPassword(ready, setup.email, PUBLIC_FIXTURE_PASSWORD).status).toBe(401)
    expect(JSON.stringify(accepted.body)).not.toContain(secret)
    const seed = createSeed()
    expect(JSON.stringify(seed)).not.toContain(PUBLIC_FIXTURE_PASSWORD)
    expect(loginWithPassword(seed, 'admin.a@example.test', PUBLIC_FIXTURE_PASSWORD).status).toBe(200)
    expect(describeAccounts(seed).find((account) => account.email === 'admin.a@example.test')?.password).toBe(PUBLIC_FIXTURE_PASSWORD)
    expect(describeAccounts(ready)[0]?.password).toBeNull()
  })

  it('synchronizes a directory row without roles, email matching, or a second user', async () => {
    const setup = await draft()
    let state = configureInstallation(createEmptyInstallation('personal-memory'), setup)
    const laboratory = createOrganization(state, 1, {
      fullName: 'Лаборатория Север',
      shortName: 'Север',
      address: 'Полевая, 1',
      kind: 'laboratory',
    })
    if (!('organization' in laboratory)) throw new Error('laboratory')
    state = laboratory.state
    const customer = createOrganization(state, 1, {
      fullName: 'Заказчик Юг',
      shortName: 'Юг',
      address: 'Офис, 2',
      kind: 'customer',
    })
    if (!('organization' in customer)) throw new Error('customer')
    state = customer.state
    const ownerHash = state.localCredentials?.[0]?.hash
    const saved = saveDirectoryEmployee(state, {
      id: 'hr-1',
      givenName: 'Илья',
      surname: 'Сотрудник',
      email: 'ilya@personal.test',
      organizationId: laboratory.organization.id,
      externalSubject: 'subject-ilya',
    })
    if (!saved.ok) throw new Error(saved.code)
    const first = syncDirectory(saved.state)
    expect(first.report.created).toEqual(['hr-1'])
    expect(first.state.users).toHaveLength(2)
    expect(first.state.assignments).toEqual([])
    expect(first.state.roles).toEqual([])
    expect(first.state.systemCapabilities).toEqual(state.systemCapabilities)
    expect(first.state.localCredentials?.[0]?.hash).toBe(ownerHash)
    const employee = first.state.users.find((user) => user.email === 'ilya@personal.test')
    expect(employee?.fixturePassword).toBe(false)
    expect(describeAccounts(first.state).find((account) => account.id === employee?.id)?.accessState).toBe('pending')
    expect(describeAccounts(first.state).find((account) => account.id === employee?.id)?.password).toBeNull()
    const again = syncDirectory(first.state)
    expect(again.report.updated).toEqual(['hr-1'])
    expect(again.report.created).toEqual([])
    expect(again.state.users).toHaveLength(2)
    const renamed = saveDirectoryEmployee(again.state, {
      id: 'hr-1',
      givenName: 'Илья',
      surname: 'Сотрудник',
      email: 'ilya.moved@personal.test',
      organizationId: laboratory.organization.id,
      externalSubject: 'subject-ilya',
    })
    if (!renamed.ok) throw new Error(renamed.code)
    const moved = syncDirectory(renamed.state)
    expect(moved.state.users.filter((user) => user.surname === 'Сотрудник')).toHaveLength(1)
    expect(moved.state.users.find((user) => user.surname === 'Сотрудник')?.email).toBe('ilya.moved@personal.test')
    const sameMail = saveDirectoryEmployee(moved.state, {
      id: 'hr-2',
      givenName: 'Другой',
      surname: 'Человек',
      email: 'ilya.moved@personal.test',
      organizationId: laboratory.organization.id,
      externalSubject: 'subject-other',
    })
    if (!sameMail.ok) throw new Error(sameMail.code)
    const separated = syncDirectory(sameMail.state)
    expect(separated.state.users).toHaveLength(3)
    const other = separated.state.users.find((user) => user.surname === 'Человек')
    const original = separated.state.users.find((user) => user.surname === 'Сотрудник')
    expect(completeMockSso(separated.state, MOCK_PROVIDER_ID, 'subject-other').status).toBe(200)
    expect(userId(completeMockSso(separated.state, MOCK_PROVIDER_ID, 'subject-other'))).toBe(other?.id)
    expect(userId(completeMockSso(separated.state, MOCK_PROVIDER_ID, 'subject-ilya'))).toBe(original?.id)
    expect(completeMockSso(separated.state, MOCK_PROVIDER_ID, 'subject-unknown').status).not.toBe(200)
    const customerRow = saveDirectoryEmployee(separated.state, {
      id: 'hr-3',
      givenName: 'Ольга',
      surname: 'Заказчик',
      email: 'olga@personal.test',
      organizationId: customer.organization.id,
      externalSubject: 'subject-olga',
    })
    if (!customerRow.ok) throw new Error(customerRow.code)
    const withCustomer = syncDirectory(customerRow.state)
    expect(withCustomer.state.memberships.find((item) => item.organizationId === customer.organization.id)?.kind).toBe('customer')
    const taken = saveDirectoryEmployee({
      ...withCustomer.state,
      identities: withCustomer.state.identities.map((item) => item.externalSubject === 'subject-ilya'
        ? item
        : item),
    }, {
      id: 'hr-4',
      givenName: 'Чужая',
      surname: 'Связь',
      email: 'taken@personal.test',
      organizationId: laboratory.organization.id,
      externalSubject: 'subject-ilya',
    })
    if (!taken.ok) throw new Error(taken.code)
    const skipped = syncDirectory(taken.state)
    expect(skipped.report.skipped).toContainEqual({ id: 'hr-4', reason: 'identity_taken' })
    expect(skipped.state.users.some((user) => user.email === 'taken@personal.test')).toBe(false)
    const shadow: MockState = {
      ...withCustomer.state,
      identities: [...withCustomer.state.identities, {
        id: 'idn-shadow',
        providerId: MOCK_PROVIDER_ID,
        externalSubject: 'subject-shadow',
        email: 'shadow@personal.test',
        userId: null,
      }],
    }
    const shadowRow = saveDirectoryEmployee(shadow, {
      id: 'hr-5',
      givenName: 'Тень',
      surname: 'Связь',
      email: 'shadow@personal.test',
      organizationId: laboratory.organization.id,
      externalSubject: 'subject-shadow',
    })
    if (!shadowRow.ok) throw new Error(shadowRow.code)
    const linked = syncDirectory(shadowRow.state)
    expect(linked.state.identities.filter((item) => item.externalSubject === 'subject-shadow')).toHaveLength(1)
    expect(linked.state.identities.find((item) => item.externalSubject === 'subject-shadow')?.userId).toBeTypeOf('number')
    const absent = syncDirectory({
      ...linked.state,
      directoryEmployees: linked.state.directoryEmployees?.filter((item) => item.id !== 'hr-1'),
    })
    expect(absent.state.users.some((user) => user.surname === 'Сотрудник')).toBe(true)
    expect(absent.state.localCredentials?.[0]?.hash).toBe(ownerHash)
  })

  it('does not give an ordinary administrator organization creation', () => {
    const seed = createSeed()
    const snapshot = toSnapshot(seed)
    expect(seed.roles.every((role) => !role.grantIds.includes('g-organizations-create'))).toBe(true)
    expect(seed.grants.some((grant) => grant.id === 'g-organizations-create')).toBe(true)
    expect(can(snapshot, 2, 'organizations', 'create', corporationScope)).toBe(false)
    expect(can(snapshot, 2, 'organizations', 'create', {
      type: 'organization',
      organizationId: 101,
      corporationId: 1,
    })).toBe(false)
    expect(seed.roles.every((role) => !role.grantIds.includes('g-projects-create'))).toBe(true)
    expect(createProject(seed, 2, { organizationId: 101, name: 'Чужой', reservoir: 'Нет' })).toEqual({ error: 'forbidden' })
    const created = createOrganization(seed, 2, {
      fullName: 'Новая',
      shortName: 'Новая',
      address: 'Адрес',
      kind: 'laboratory',
    })
    expect(created).toEqual({ error: 'forbidden' })
  })

  it('adds the organization permission to the catalog without granting stored roles', () => {
    const seed = createSeed()
    const legacy = {
      ...seed,
      schemaVersion: 8,
      users: seed.users.map((user) => ({ ...user, fixturePassword: undefined })),
    } as MockState
    delete (legacy as { installationCorporationId?: number }).installationCorporationId
    delete (legacy as { localCredentials?: unknown }).localCredentials
    delete (legacy as { directoryEmployees?: unknown }).directoryEmployees
    legacy.grants = legacy.grants.filter((grant) => grant.id !== 'g-organizations-create' && grant.id !== 'g-projects-create')
    const migrated = migrateMockDocument(legacy)
    expect(migrated?.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-organizations-create')).toBe(true)
    expect(migrated?.state.grants.some((grant) => grant.id === 'g-projects-create')).toBe(true)
    expect(migrated?.state.roles.every((role) => !role.grantIds.includes('g-organizations-create'))).toBe(true)
    expect(migrated?.state.roles.every((role) => !role.grantIds.includes('g-projects-create'))).toBe(true)
    expect(migrated?.state.users.every((user) => user.fixturePassword === true)).toBe(true)
    expect(migrated?.state.users).toHaveLength(seed.users.length)
  })

  it('leaves the personal installation unchanged when the writer lock is refused', async () => {
    await resetMockNamespace(PERSONAL_MOCK_NAMESPACE)
    releaseMockWriter(PERSONAL_MOCK_NAMESPACE)
    const planted = createEmptyInstallation(PERSONAL_MOCK_NAMESPACE)
    await replaceMockRecord(PERSONAL_MOCK_NAMESPACE, planted)
    denyLocks()
    const setup = await draft()
    await expect(updateMockState((state) => configureInstallation(state, setup), PERSONAL_MOCK_NAMESPACE)).rejects.toBeInstanceOf(MockWriterHeldError)
    await expect(resetMockNamespace(PERSONAL_MOCK_NAMESPACE)).rejects.toBeInstanceOf(MockWriterHeldError)
    setMockLockSource(null)
    const stored = await readMockState(PERSONAL_MOCK_NAMESPACE)
    expect(stored.ok && stored.state.users).toEqual([])
    expect(stored.ok && stored.state.installationPhase).toBe('uninitialized')
    expect(stored.ok && stored.state.recordRevision).toBe(planted.recordRevision)
  })
})

function userId(result: { body: unknown }): number | null {
  if (!result.body || typeof result.body !== 'object' || !('user' in result.body)) return null
  const user = (result.body as { user?: { id?: unknown } }).user
  return user && typeof user.id === 'number' ? user.id : null
}
