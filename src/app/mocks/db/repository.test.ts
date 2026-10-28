import { beforeEach, describe, expect, it, vi } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { can, canDelegate } from '../../../entities/access'
import { LIVE_ACCESS_KEY, MOCK_ACCESS_KEY, clearSession, readAccessToken, setSessionStorageBackend, writeSession, type KeyValueStorage } from '../../../shared/api/session-storage'
import { toSnapshot } from '../auth/flow'
import { createSeed } from './seed'
import type { MockState } from './types'
import { MOCK_DB_VERSION, MOCK_SCHEMA_VERSION, PUBLIC_FIXTURE_PASSWORD } from './constants'
import {
  currentMockWriterId,
  duplicateMockWriterDocument,
  ensureMockState,
  MockWriterHeldError,
  MockWriterUnavailableError,
  readMockState,
  reloadMockWriterIdentity,
  rememberMockWriterSession,
  replaceMockRecord,
  resetMockNamespace,
  setMockLockSource,
  setMockWriterId,
  StaleMockWriteError,
  updateMockState,
} from './repository'

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

const corporation = { type: 'corporation' as const, corporationId: 1 }
const laboratoryA = { type: 'organization' as const, organizationId: 101, corporationId: 1 }
const laboratoryB = { type: 'organization' as const, organizationId: 102, corporationId: 1 }

function legacySnapshot(namespace: string): MockState {
  const seed = createSeed()
  const snapshot: MockState = {
    ...seed,
    schemaVersion: 1,
    namespace,
    accessVersion: 7,
    authMode: 'local',
    users: [
      ...seed.users,
      {
        id: 9,
        email: 'kept@example.test',
        name: 'Кедр',
        patronymic: 'Тестович',
        surname: 'Сохранённый',
        position: 'Архив',
        legacyRole: 'member',
        status: 'active',
      },
    ],
    grants: seed.grants.filter((grant) => grant.id !== 'g-delegate' && !grant.id.startsWith('g-tasks-')),
    roles: seed.roles.map((role) => {
      if (role.id === 'role-owner') {
        const next = { ...role, grantIds: ['g-projects'] }
        delete next.delegationGrantIds
        return next
      }
      if (role.id === 'role-employee') {
        const next = { ...role, grantIds: ['g-tasks', 'g-projects'] }
        delete next.delegationGrantIds
        return next
      }
      if (role.id === 'role-lab-admin') return { ...role, delegationGrantIds: ['g-members-read'] }
      const next = { ...role }
      delete next.delegationGrantIds
      return next
    }),
    assignments: seed.assignments.map((item) => item.id === 'asg-employee-a' ? { ...item, roleId: 'role-lab-admin' } : item),
    delegations: [{
      id: 'dlg-kept',
      fromUserId: 2,
      toUserId: 3,
      grant: {
        id: 'g-members-read-delegated',
        resource: 'members',
        action: 'read',
        scope: laboratoryA,
      },
    }],
  }
  delete snapshot.recordRevision
  const stored = snapshot as Partial<MockState>
  delete stored.tasks
  delete stored.taskStatuses
  delete stored.taskTags
  delete stored.taskComments
  delete stored.taskFiles
  return snapshot
}

function openDb(namespace: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(namespace)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('open failed'))
  })
}

function readRoot(db: IDBDatabase): Promise<MockState> {
  return new Promise((resolve, reject) => {
    const request = db.transaction('state', 'readonly').objectStore('state').get('root')
    request.onsuccess = () => resolve(request.result as MockState)
    request.onerror = () => reject(request.error ?? new Error('read failed'))
  })
}

async function rawRoot(namespace: string): Promise<MockState> {
  const db = await openDb(namespace)
  try {
    return await readRoot(db)
  } finally {
    db.close()
  }
}

async function readWriter(namespace: string): Promise<{ ownerId?: string; until?: number } | undefined> {
  const db = await openDb(namespace)
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get('writer')
      request.onsuccess = () => resolve(request.result as { ownerId?: string; until?: number } | undefined)
      request.onerror = () => reject(request.error ?? new Error('writer read failed'))
    })
  } finally {
    db.close()
  }
}

async function plantWriter(namespace: string, lease: { ownerId: string; until: number }) {
  const db = await openDb(namespace)
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite')
      tx.objectStore('state').put(lease, 'writer')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('plant aborted'))
      tx.onerror = () => reject(tx.error ?? new Error('plant failed'))
    })
  } finally {
    db.close()
  }
}

function writerLineage(ownerId: string): string {
  const split = ownerId.indexOf('#')
  return split === -1 ? ownerId : ownerId.slice(0, split)
}

function flushTasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function storePrototype(db: IDBDatabase): IDBObjectStore {
  const store = db.transaction('state', 'readonly').objectStore('state')
  return Object.getPrototypeOf(store) as IDBObjectStore
}

describe('mock repository', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
    setMockWriterId(`tab-${crypto.randomUUID()}`)
  })

  it('keeps an assignment after the database is reopened and does not reseed it', async () => {
    const namespace = `inlog:mock:test-assignment-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    await updateMockState((state) => ({
      ...state,
      assignments: state.assignments.map((item) => item.id === 'asg-employee-a' ? { ...item, roleId: 'role-lab-admin' } : item),
    }), namespace)
    const reopened = await readMockState(namespace)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-lab-admin')
    }
    const again = await ensureMockState(namespace)
    expect(again.ok).toBe(true)
    if (again.ok) {
      expect(again.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-lab-admin')
    }
  })

  it('resets only the requested namespace and keeps a schema mismatch until an explicit reset', async () => {
    const kept = `inlog:mock:test-kept-${crypto.randomUUID()}`
    const target = `inlog:mock:test-reset-${crypto.randomUUID()}`
    await ensureMockState(kept)
    await updateMockState((state) => ({ ...state, accessVersion: 7 }), kept)
    await replaceMockRecord(target, { schemaVersion: 99, users: [] })
    const mismatch = await readMockState(target)
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok && mismatch.reason === 'schema-mismatch') {
      expect(mismatch.foundVersion).toBe(99)
    }
    const stillMismatch = await ensureMockState(target)
    expect(stillMismatch.ok).toBe(false)
    await resetMockNamespace(target)
    const reset = await readMockState(target)
    const untouched = await readMockState(kept)
    expect(reset.ok && reset.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(untouched.ok && untouched.state.accessVersion).toBe(7)
  })

  it('migrates a changed version-1 snapshot without granting delegation or dropping data', async () => {
    const namespace = `inlog:mock:test-migrate-${crypto.randomUUID()}`
    await replaceMockRecord(namespace, legacySnapshot(namespace))
    const migrated = await ensureMockState(namespace)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(migrated.state.recordRevision).toBe(0)
    expect(migrated.state.accessVersion).toBe(7)
    expect(migrated.state.authMode).toBe('local')
    expect(migrated.state.namespace).toBe(namespace)
    expect(migrated.state.users.map((user) => user.id)).toContain(9)
    expect(migrated.state.assignments.find((item) => item.id === 'asg-employee-a')?.roleId).toBe('role-lab-admin')
    expect(migrated.state.delegations.map((item) => item.id)).toEqual(['dlg-kept'])
    expect(migrated.state.grants.map((grant) => grant.id)).not.toContain('g-delegate')
    const owner = migrated.state.roles.find((role) => role.id === 'role-owner')
    const admin = migrated.state.roles.find((role) => role.id === 'role-lab-admin')
    const employee = migrated.state.roles.find((role) => role.id === 'role-employee')
    expect(owner?.grantIds).toEqual(['g-projects'])
    expect(owner?.delegationGrantIds).toEqual([])
    expect(admin?.delegationGrantIds).toEqual(['g-members-read'])
    expect(employee?.grantIds).toEqual(['g-tasks', 'g-projects'])
    expect(migrated.state.grants.map((grant) => grant.id)).not.toContain('g-tasks-create')
    expect(migrated.state.tasks.filter((task) => task.slug === 'shared-sample').map((task) => task.projectId).sort()).toEqual([1001, 1002])
    expect(migrated.state.tasks.find((task) => task.projectId === 1001 && task.slug === 'shared-sample')?.name).toBe('Образец А-1')
    expect(migrated.state.tasks.find((task) => task.projectId === 1002 && task.slug === 'shared-sample')?.name).toBe('Образец Б-1')
    const snapshot = toSnapshot(migrated.state)
    expect(can(snapshot, 1, 'projects', 'read', corporation)).toBe(true)
    expect(can(snapshot, 1, 'assignments', 'update', corporation)).toBe(true)
    expect(can(snapshot, 1, 'forms', 'read', laboratoryA)).toBe(true)
    expect(can(snapshot, 1, 'tasks', 'create', laboratoryA)).toBe(true)
    expect(can(snapshot, 1, 'requests', 'create', corporation)).toBe(false)
    expect(can(snapshot, 2, 'forms', 'read', laboratoryA)).toBe(false)
    expect(canDelegate(snapshot, 1, 'delegations', 'delegate', corporation)).toBe(true)
    expect(canDelegate(snapshot, 2, 'members', 'read', laboratoryA)).toBe(true)
    expect(canDelegate(snapshot, 2, 'delegations', 'delegate', laboratoryA)).toBe(false)
    expect(can(snapshot, 4, 'tasks', 'read', laboratoryB)).toBe(true)
    const database = await openDb(namespace)
    expect(database.version).toBe(MOCK_DB_VERSION)
    const prototype = storePrototype(database)
    database.close()

    const rootPuts: unknown[] = []
    const original = prototype.put
    prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (key === 'root') rootPuts.push(value)
      return original.call(this, value, key)
    }
    try {
      const again = await ensureMockState(namespace)
      expect(again.ok && again.state).toEqual(migrated.state)
      expect(rootPuts).toEqual([])
    } finally {
      prototype.put = original
    }
  })

  it('does not persist a migration while another tab holds the writer lock', async () => {
    const namespace = `inlog:mock:test-lease-${crypto.randomUUID()}`
    await replaceMockRecord(namespace, legacySnapshot(namespace))
    await plantWriter(namespace, { ownerId: 'other-tab', until: Date.now() + 60_000 })
    setMockLockSource(() => ({
      request: ((_name, _options, callback: (lock: null) => void) => {
        callback(null)
      }) as LockManager['request'],
    }))
    try {
      const opened = await ensureMockState(namespace)
      expect(opened.ok && opened.writeLocked).toBe(true)
      if (!opened.ok) return
      expect(opened.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
      expect(opened.state.users.map((user) => user.id)).toContain(9)
      expect(opened.state.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).toEqual([])
      const disk = await rawRoot(namespace)
      expect(disk.schemaVersion).toBe(1)
      expect(disk.accessVersion).toBe(7)
      expect(disk.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).toBeUndefined()
      await expect(updateMockState((state) => ({ ...state, accessVersion: 1 }), namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
      await expect(resetMockNamespace(namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
      expect((await rawRoot(namespace)).accessVersion).toBe(7)
      expect((await readWriter(namespace))?.ownerId).toBe('other-tab')
    } finally {
      setMockLockSource(null)
    }
    const persisted = await ensureMockState(namespace)
    expect(persisted.ok && persisted.writeLocked).toBe(false)
    const stored = await rawRoot(namespace)
    expect(stored.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(stored.accessVersion).toBe(7)
    expect(stored.users.map((user) => user.id)).toContain(9)
    expect(stored.roles.find((role) => role.id === 'role-owner')?.delegationGrantIds).toEqual([])
    expect((await readWriter(namespace))?.ownerId).toBe(currentMockWriterId())
  })

  it('keeps the previous record when reset aborts and does not delete the database later', async () => {
    const namespace = `inlog:mock:test-reset-abort-${crypto.randomUUID()}`
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase')
    await ensureMockState(namespace)
    await updateMockState((state) => ({ ...state, accessVersion: 7 }), namespace)
    const probe = await openDb(namespace)
    const prototype = storePrototype(probe)
    probe.close()
    const original = prototype.put
    let armed = true
    prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = original.call(this, value, key)
      if (armed && key === 'root' && value && typeof value === 'object' && (value as MockState).namespace === namespace && (value as MockState).accessVersion === 1) {
        armed = false
        this.transaction.abort()
      }
      return request
    }
    try {
      await expect(resetMockNamespace(namespace)).rejects.toThrow()
    } finally {
      prototype.put = original
    }
    expect((await rawRoot(namespace)).accessVersion).toBe(7)
    await flushTasks()
    expect((await rawRoot(namespace)).accessVersion).toBe(7)
    expect(deleteDatabase).not.toHaveBeenCalled()
    deleteDatabase.mockRestore()
  })

  it('replaces namespace contents without deleteDatabase while another connection stays open', async () => {
    const namespace = `inlog:mock:test-open-connection-${crypto.randomUUID()}`
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase')
    await ensureMockState(namespace)
    await updateMockState((state) => ({ ...state, accessVersion: 7 }), namespace)
    const db = await openDb(namespace)
    db.onversionchange = () => undefined
    try {
      const reset = await resetMockNamespace(namespace)
      expect(reset.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
      expect(reset.accessVersion).toBe(1)
      expect((await readRoot(db)).accessVersion).toBe(1)
    } finally {
      db.close()
    }
    await flushTasks()
    const after = await readMockState(namespace)
    expect(after.ok && after.state.accessVersion).toBe(1)
    expect(after.ok && after.state.users).toHaveLength(9)
    expect(after.ok && after.state.users.some((user) => user.email === 'project.only@example.test')).toBe(true)
    expect(deleteDatabase).not.toHaveBeenCalled()
    deleteDatabase.mockRestore()
  })

  it('refuses a stale snapshot after a newer write from this tab', async () => {
    const namespace = `inlog:mock:test-stale-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    await updateMockState((state) => ({ ...state, accessVersion: 4, authMode: 'local' }), namespace)
    const snap = await readMockState(namespace)
    if (!snap.ok) throw new Error('missing snapshot')
    const newer = updateMockState((state) => ({ ...state, accessVersion: state.accessVersion + 1 }), namespace)
    const stale = updateMockState(() => snap.state, namespace)
    await expect(stale).rejects.toBeInstanceOf(StaleMockWriteError)
    await newer
    const after = await readMockState(namespace)
    expect(after.ok && after.state.accessVersion).toBe(5)
    expect(after.ok && after.state.authMode).toBe('local')
    expect(currentMockWriterId()).toContain('tab-')
  })

  it('reclaims the same tab after reload and takes over a lease from a closed tab', async () => {
    const namespace = `inlog:mock:test-reload-${crypto.randomUUID()}`
    const owner = currentMockWriterId()
    rememberMockWriterSession()
    await ensureMockState(namespace)
    await plantWriter(namespace, { ownerId: owner, until: Date.now() + 60_000 })
    setMockWriterId('tab-fresh-document')
    expect(currentMockWriterId()).not.toBe(owner)
    const restored = reloadMockWriterIdentity()
    expect(writerLineage(restored)).toBe(writerLineage(owner))
    expect(restored).not.toBe(owner)
    expect(restored).not.toBe('tab-fresh-document')
    const reopened = await ensureMockState(namespace)
    expect(reopened.ok && reopened.writeLocked).toBe(false)
    const written = await updateMockState((state) => ({ ...state, accessVersion: 4 }), namespace)
    expect(written.accessVersion).toBe(4)
    expect((await readWriter(namespace))?.ownerId).toBe(restored)

    const rival = `inlog:mock:test-rival-${crypto.randomUUID()}`
    await ensureMockState(rival)
    await plantWriter(rival, { ownerId: 'tab-other-live', until: Date.now() + 60_000 })
    const again = reloadMockWriterIdentity()
    expect(writerLineage(again)).toBe(writerLineage(owner))
    expect(again).not.toBe('tab-other-live')
    const taken = await ensureMockState(rival)
    expect(taken.ok && taken.writeLocked).toBe(false)
    const takenWrite = await updateMockState((state) => ({ ...state, accessVersion: 9 }), rival)
    expect(takenWrite.accessVersion).toBe(9)
    expect((await readWriter(rival))?.ownerId).toBe(again)
  })

  it('does not let a duplicated tab write with the copied session lineage', async () => {
    const namespace = `inlog:mock:test-duplicate-${crypto.randomUUID()}`
    rememberMockWriterSession()
    const first = currentMockWriterId()
    await ensureMockState(namespace)
    await updateMockState((state) => ({ ...state, accessVersion: 3 }), namespace)
    const duplicate = duplicateMockWriterDocument()
    expect(duplicate).not.toBe(first)
    expect(writerLineage(duplicate)).toBe(writerLineage(first))
    const view = await ensureMockState(namespace)
    expect(view.ok && view.writeLocked).toBe(true)
    await expect(updateMockState((state) => ({ ...state, accessVersion: 9 }), namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
    await expect(resetMockNamespace(namespace)).rejects.toBeInstanceOf(MockWriterHeldError)
    expect((await readWriter(namespace))?.ownerId).toBe(first)
    const after = await readMockState(namespace)
    expect(after.ok && after.state.accessVersion).toBe(3)
    expect(after.ok && after.state.recordRevision).toBe(2)
  })

  it('does not add the constructor reader to a snapshot that was saved without that user', async () => {
    const namespace = `inlog:mock:test-reader-migration-${crypto.randomUUID()}`
    const seed = createSeed()
    const saved: MockState = {
      ...seed,
      namespace,
      users: seed.users.filter((user) => user.id !== 8),
      identities: seed.identities.filter((item) => item.userId !== 8),
      roles: seed.roles.filter((role) => role.id !== 'role-constructor-reader'),
      assignments: seed.assignments.filter((item) => item.userId !== 8),
    }
    await replaceMockRecord(namespace, saved)
    const opened = await ensureMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.users.some((user) => user.email === 'constructor.reader@example.test')).toBe(false)
    expect(opened.state.roles.some((role) => role.id === 'role-constructor-reader')).toBe(false)
    expect(opened.state.assignments.some((item) => item.userId === 8)).toBe(false)
  })

  it('refuses writes when the cross-tab lock API is missing and still reads the saved record', async () => {
    const namespace = `inlog:mock:test-no-locks-${crypto.randomUUID()}`
    await ensureMockState(namespace)
    await updateMockState((state) => ({ ...state, accessVersion: 4 }), namespace)
    setMockLockSource(() => undefined)
    try {
      const read = await readMockState(namespace)
      expect(read.ok && read.state.accessVersion).toBe(4)
      const opened = await ensureMockState(namespace)
      expect(opened.ok && opened.writesUnavailable).toBe(true)
      expect(opened.ok && opened.writeLocked).toBe(false)
      await expect(updateMockState((state) => ({ ...state, accessVersion: 9 }), namespace)).rejects.toBeInstanceOf(MockWriterUnavailableError)
      await expect(resetMockNamespace(namespace)).rejects.toBeInstanceOf(MockWriterUnavailableError)
      expect((await rawRoot(namespace)).accessVersion).toBe(4)
    } finally {
      setMockLockSource(null)
    }
  })

  it('adds an empty access audit without granting new permissions or users', async () => {
    const namespace = `inlog:mock:test-audit-${crypto.randomUUID()}`
    const seed = createSeed()
    const saved: MockState = {
      ...seed,
      namespace,
      schemaVersion: 4,
      accessVersion: 7,
      accessAudit: undefined,
      users: seed.users.filter((user) => user.id !== 8),
      roles: seed.roles.map((role) => role.id === 'role-owner' ? { ...role, grantIds: ['g-projects'] } : role),
      systemCapabilities: [{ userId: 1, code: 'corporate_superadmin' }],
    }
    await replaceMockRecord(namespace, saved)
    const opened = await ensureMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(opened.state.accessAudit).toEqual([])
    expect(opened.state.accessVersion).toBe(7)
    expect(opened.state.users.some((user) => user.id === 8)).toBe(false)
    expect(opened.state.roles.find((role) => role.id === 'role-owner')?.grantIds).toEqual(['g-projects'])
    expect(opened.state.roles.find((role) => role.id === 'role-owner')?.ownerScope).toBeUndefined()
    expect(opened.state.systemCapabilities).toEqual([{ userId: 1, code: 'corporate_superadmin' }])
    const disk = await rawRoot(namespace)
    expect(disk.accessAudit).toEqual([])
    expect(disk.users.some((user) => user.email === 'constructor.reader@example.test')).toBe(false)
  })

  it('does not store the fixture password and logout does not reset the database', async () => {
    const namespace = `inlog:mock:test-logout-${crypto.randomUUID()}`
    const seeded = await ensureMockState(namespace)
    expect(seeded.ok).toBe(true)
    expect(JSON.stringify(createSeed())).not.toContain(PUBLIC_FIXTURE_PASSWORD)
    const storage = new MemoryStorage()
    setSessionStorageBackend(storage)
    writeSession({ accessToken: 'live-token', refreshToken: 'live-refresh', subjectId: 1 }, 'live')
    writeSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh', subjectId: 2 }, 'mock')
    storage.setItem('theme', 'dark')
    storage.setItem('inlog-whiteboard:task-1', '{"elements":[]}')
    clearSession('mock')
    expect(readAccessToken('live')).toBe('live-token')
    expect(storage.getItem(LIVE_ACCESS_KEY)).toBe(JSON.stringify('live-token'))
    expect(storage.getItem(MOCK_ACCESS_KEY)).toBeNull()
    expect(storage.getItem('theme')).toBe('dark')
    expect(storage.getItem('inlog-whiteboard:task-1')).toContain('elements')
    const afterLogout = await readMockState(namespace)
    expect(afterLogout.ok).toBe(true)
    setSessionStorageBackend(null)
  })
})
