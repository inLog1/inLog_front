import { MOCK_DB_VERSION, MOCK_NAMESPACE, MOCK_WRITER_LEASE_MS } from './constants'
import { migrateMockDocument } from './migrate'
import { createSeed } from './seed'
import type { MockState } from './types'

const STORE = 'state'
const RECORD_KEY = 'root'
const WRITER_KEY = 'writer'

export class SchemaMismatchError extends Error {
  foundVersion: number

  constructor(foundVersion: number) {
    super('Mock schema version does not match')
    this.name = 'SchemaMismatchError'
    this.foundVersion = foundVersion
  }
}

export class MockWriterHeldError extends Error {
  constructor() {
    super('Another tab holds the mock writer lease')
    this.name = 'MockWriterHeldError'
  }
}

/**
 * The page has no cross-tab lock API. The in-memory lock only exists inside
 * this JavaScript realm, so it is not used as a substitute and writes are refused.
 */
export class MockWriterUnavailableError extends Error {
  constructor() {
    super('This environment has no cross-tab lock API. A lock kept inside one page does not exclude other tabs, so mock writes are refused.')
    this.name = 'MockWriterUnavailableError'
  }
}

export class StaleMockWriteError extends Error {
  constructor() {
    super('Mock write was based on an older snapshot')
    this.name = 'StaleMockWriteError'
  }
}

export type MockRead =
  | { ok: true; state: MockState; writeLocked?: boolean; writesUnavailable?: boolean }
  | { ok: false; reason: 'schema-mismatch'; foundVersion: number }

type LockLookup = () => { request?: LockManager['request'] } | null | undefined

let lockLookup: LockLookup = () => (typeof navigator === 'undefined' ? undefined : navigator.locks)

/** Test seam. Null restores navigator.locks. An empty lookup is the browser without the API. */
export function setMockLockSource(source: LockLookup | null): void {
  lockLookup = source ?? (() => (typeof navigator === 'undefined' ? undefined : navigator.locks))
}

type WriterLease = { ownerId: string; until: number }

type StoredView =
  | { ok: true; state: MockState; changed: boolean }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'schema-mismatch'; foundVersion: number }

type Controls<T> = {
  succeed(value: T): void
  fail(error: unknown): void
}

// Serializes mock operations in this JavaScript realm only.
// Other tabs are refused with the writer lease below; this queue is not their lock.
let queue: Promise<unknown> = Promise.resolve()

/**
 * sessionStorage keeps the tab lineage across reload. A duplicated tab copies
 * that value, so the lineage alone cannot name the single live document.
 * Each document also has a memory-only epoch. The exclusive lock is what
 * proves this document is the live holder; the lease still blocks a different lineage.
 */
const WRITER_SESSION_KEY = 'inlog:mock:writer-tab'
let writerSession: string | null = null

function readWriterSession(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(WRITER_SESSION_KEY)
      if (stored) return stored
    }
  } catch {
    // Private mode still keeps the lineage for this document.
  }
  return writerSession
}

function writeWriterSession(id: string): void {
  writerSession = id
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(WRITER_SESSION_KEY, id)
  } catch {
    // The in-memory copy remains for this document.
  }
}

function acceptableLineage(id: string | null): id is string {
  return id != null && id.startsWith('tab-') && !id.includes('#') && id.length > 4 && id.length < 80
}

function loadOrCreateLineage(): string {
  const existing = readWriterSession()
  if (acceptableLineage(existing)) return existing
  const created = `tab-${crypto.randomUUID()}`
  writeWriterSession(created)
  return created
}

function createEpoch(): string {
  return `epoch-${crypto.randomUUID()}`
}

function lineageOf(ownerId: string): string {
  const split = ownerId.indexOf('#')
  return split === -1 ? ownerId : ownerId.slice(0, split)
}

let lineageId = loadOrCreateLineage()
let epochId = createEpoch()
let writerId = `${lineageId}#${epochId}`

type HeldWriterLock = { ownerId: string; release: (() => void) | null }
const heldWriterLocks = new Map<string, HeldWriterLock>()

function writerLockName(namespace: string): string {
  return `inlog-mock-writer:${namespace}`
}

function releaseWriterLock(namespace: string, ownerId = writerId): void {
  const held = heldWriterLocks.get(namespace)
  if (!held || held.ownerId !== ownerId) return
  heldWriterLocks.delete(namespace)
  held.release?.()
}

function releaseEveryWriterLock(): void {
  for (const namespace of [...heldWriterLocks.keys()]) {
    const held = heldWriterLocks.get(namespace)
    heldWriterLocks.delete(namespace)
    held?.release?.()
  }
}

function rememberHeldLock(namespace: string, release: (() => void) | null): void {
  heldWriterLocks.set(namespace, { ownerId: writerId, release })
}

async function acquireWriterLock(namespace: string): Promise<'held' | 'blocked' | 'unavailable'> {
  const locks = lockLookup()
  if (!locks?.request) return 'unavailable'
  const held = heldWriterLocks.get(namespace)
  if (held?.ownerId === writerId) return 'held'
  if (held) return 'blocked'
  return new Promise((resolve) => {
    void locks.request!(writerLockName(namespace), { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve('blocked')
        return
      }
      rememberHeldLock(namespace, null)
      resolve('held')
      return new Promise<void>((release) => {
        const current = heldWriterLocks.get(namespace)
        if (current?.ownerId === writerId) current.release = release
        else release()
      })
    })
  })
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(() => undefined, () => undefined)
  return run
}

export function currentMockWriterId(): string {
  return writerId
}

/** Test seam: this realm pretends to be another tab. It does not rewrite the session lineage. */
export function setMockWriterId(id: string): void {
  writerId = id
  const split = id.indexOf('#')
  if (split === -1) {
    lineageId = id
    epochId = ''
    return
  }
  lineageId = id.slice(0, split)
  epochId = id.slice(split + 1)
}

/** Remembers the lineage that a reload of this tab will inherit. The epoch stays in memory. */
export function rememberMockWriterSession(): void {
  writeWriterSession(lineageId)
}

/**
 * Simulates a new document in the same tab.
 * The old document's lock is gone. The lineage comes back from the session slot
 * with a new epoch, so its own unexpired lease can be reclaimed. A foreign lease cannot.
 */
export function reloadMockWriterIdentity(): string {
  releaseEveryWriterLock()
  lineageId = loadOrCreateLineage()
  epochId = createEpoch()
  writerId = `${lineageId}#${epochId}`
  return writerId
}

/**
 * Simulates a second live document that inherited this tab's sessionStorage.
 * The first document keeps its lock, so the copy must not become a writer.
 */
export function duplicateMockWriterDocument(): string {
  epochId = createEpoch()
  writerId = `${lineageId}#${epochId}`
  return writerId
}

function factory(): IDBFactory {
  const value = globalThis.indexedDB
  if (!value) throw new Error('IndexedDB is not available')
  return value
}

function openDatabase(namespace: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory().open(namespace, MOCK_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function openAndRun<T>(
  namespace: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, controls: Controls<T>) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    openDatabase(namespace).then((db) => {
      let settled = false
      const finish = (outcome: () => void) => {
        if (settled) return
        settled = true
        db.close()
        outcome()
      }
      let failure: unknown = null
      let succeeded = false
      let result!: T
      const tx = db.transaction(STORE, mode)
      tx.oncomplete = () => {
        if (failure || !succeeded) finish(() => reject(failure ?? new Error('IndexedDB transaction completed without a result')))
        else finish(() => resolve(result))
      }
      tx.onabort = () => finish(() => reject(failure ?? tx.error ?? new Error('IndexedDB transaction aborted')))
      tx.onerror = () => {
        failure = failure ?? tx.error ?? new Error('IndexedDB transaction failed')
      }
      const controls: Controls<T> = {
        succeed(value) {
          result = value
          succeeded = true
        },
        fail(error) {
          failure = error
          succeeded = false
          try { tx.abort() } catch { /* already finishing */ }
        },
      }
      try {
        run(tx.objectStore(STORE), controls)
      } catch (error) {
        controls.fail(error)
      }
    }, reject)
  })
}

function isMockState(value: unknown): value is MockState {
  if (!value || typeof value !== 'object') return false
  return typeof (value as MockState).schemaVersion === 'number' && Array.isArray((value as MockState).users)
}

function viewRecord(record: unknown): StoredView {
  if (record == null) return { ok: false, reason: 'empty' }
  if (!isMockState(record)) return { ok: false, reason: 'schema-mismatch', foundVersion: -1 }
  const migrated = migrateMockDocument(record)
  if (!migrated) return { ok: false, reason: 'schema-mismatch', foundVersion: record.schemaVersion }
  return { ok: true, state: migrated.state, changed: migrated.changed }
}

function isWriterLease(value: unknown): value is WriterLease {
  if (!value || typeof value !== 'object') return false
  const lease = value as WriterLease
  return typeof lease.ownerId === 'string' && typeof lease.until === 'number'
}

function claimAllowed(lease: unknown, now: number, lockHeld: boolean): boolean {
  if (!lockHeld) return false
  if (!isWriterLease(lease) || lease.until <= now) return true
  if (lease.ownerId === writerId) return true
  return lineageOf(lease.ownerId) === lineageId
}

function ourLease(now: number): WriterLease {
  return { ownerId: writerId, until: now + MOCK_WRITER_LEASE_MS }
}

function readBoth(
  store: IDBObjectStore,
  onBoth: (root: unknown, writer: unknown) => void,
  onError: (error: unknown) => void,
) {
  const rootRequest = store.get(RECORD_KEY)
  const writerRequest = store.get(WRITER_KEY)
  let root: unknown
  let writer: unknown
  let pending = 2
  let stopped = false
  const finish = () => {
    if (stopped || --pending !== 0) return
    onBoth(root, writer)
  }
  rootRequest.onsuccess = () => {
    root = rootRequest.result
    finish()
  }
  writerRequest.onsuccess = () => {
    writer = writerRequest.result
    finish()
  }
  rootRequest.onerror = () => {
    stopped = true
    onError(rootRequest.error ?? new Error('IndexedDB read failed'))
  }
  writerRequest.onerror = () => {
    stopped = true
    onError(writerRequest.error ?? new Error('IndexedDB read failed'))
  }
}

function seedFor(namespace: string): MockState {
  const seeded = createSeed()
  seeded.namespace = namespace
  return seeded
}

async function readUnlocked(namespace: string): Promise<MockRead | { ok: false; reason: 'empty' }> {
  return openAndRun(namespace, 'readonly', (store, controls) => {
    const request = store.get(RECORD_KEY)
    request.onsuccess = () => {
      const viewed = viewRecord(request.result)
      if (!viewed.ok && viewed.reason === 'empty') controls.succeed({ ok: false, reason: 'empty' })
      else if (!viewed.ok) controls.succeed({ ok: false, reason: 'schema-mismatch', foundVersion: viewed.foundVersion })
      else controls.succeed({ ok: true, state: viewed.state })
    }
    request.onerror = () => controls.fail(request.error ?? new Error('IndexedDB read failed'))
  })
}

async function ensureUnlocked(namespace: string, lockHeld: boolean): Promise<MockRead> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    readBoth(store, (root, writer) => {
      const now = Date.now()
      const locked = !claimAllowed(writer, now, lockHeld)
      const viewed = viewRecord(root)
      if (!viewed.ok && viewed.reason === 'empty') {
        if (locked) {
          controls.fail(new MockWriterHeldError())
          return
        }
        const seeded = seedFor(namespace)
        store.put(ourLease(now), WRITER_KEY)
        store.put(seeded, RECORD_KEY)
        controls.succeed({ ok: true, state: seeded, writeLocked: false })
        return
      }
      if (!viewed.ok) {
        controls.succeed({ ok: false, reason: 'schema-mismatch', foundVersion: viewed.foundVersion })
        return
      }
      if (locked) {
        controls.succeed({ ok: true, state: viewed.state, writeLocked: true })
        return
      }
      store.put(ourLease(now), WRITER_KEY)
      if (viewed.changed) store.put(viewed.state, RECORD_KEY)
      controls.succeed({ ok: true, state: viewed.state, writeLocked: false })
    }, (error) => controls.fail(error))
  })
}

async function updateUnlocked(
  mutator: (state: MockState) => MockState,
  namespace: string,
  lockHeld: boolean,
): Promise<MockState> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    readBoth(store, (root, writer) => {
      const now = Date.now()
      if (!claimAllowed(writer, now, lockHeld)) {
        controls.fail(new MockWriterHeldError())
        return
      }
      const viewed = viewRecord(root)
      if (!viewed.ok && viewed.reason === 'empty') {
        const seeded = seedFor(namespace)
        let next: MockState
        try {
          next = mutator(structuredClone(seeded))
        } catch (error) {
          controls.fail(error)
          return
        }
        if (next.recordRevision !== seeded.recordRevision) {
          controls.fail(new StaleMockWriteError())
          return
        }
        const stored: MockState = { ...next, recordRevision: (seeded.recordRevision ?? 0) + 1 }
        store.put(ourLease(now), WRITER_KEY)
        store.put(stored, RECORD_KEY)
        controls.succeed(stored)
        return
      }
      if (!viewed.ok) {
        controls.fail(new SchemaMismatchError(viewed.foundVersion))
        return
      }
      let next: MockState
      try {
        next = mutator(structuredClone(viewed.state))
      } catch (error) {
        controls.fail(error)
        return
      }
      if (next.recordRevision !== viewed.state.recordRevision) {
        controls.fail(new StaleMockWriteError())
        return
      }
      const stored: MockState = { ...next, recordRevision: (viewed.state.recordRevision ?? 0) + 1 }
      store.put(ourLease(now), WRITER_KEY)
      store.put(stored, RECORD_KEY)
      controls.succeed(stored)
    }, (error) => controls.fail(error))
  })
}

async function resetUnlocked(namespace: string, lockHeld: boolean): Promise<MockState> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    const writerRequest = store.get(WRITER_KEY)
    writerRequest.onsuccess = () => {
      const now = Date.now()
      if (!claimAllowed(writerRequest.result, now, lockHeld)) {
        controls.fail(new MockWriterHeldError())
        return
      }
      const seeded = seedFor(namespace)
      store.put(ourLease(now), WRITER_KEY)
      store.put(seeded, RECORD_KEY)
      controls.succeed(seeded)
    }
    writerRequest.onerror = () => controls.fail(writerRequest.error ?? new Error('IndexedDB read failed'))
  })
}

export async function readMockState(namespace = MOCK_NAMESPACE): Promise<MockRead | { ok: false; reason: 'empty' }> {
  return enqueue(() => readUnlocked(namespace))
}

async function releasingRefusal<T>(lockHeld: boolean, namespace: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (lockHeld && error instanceof MockWriterHeldError) releaseWriterLock(namespace)
    throw error
  }
}

export async function ensureMockState(namespace = MOCK_NAMESPACE): Promise<MockRead> {
  return enqueue(async () => {
    const lock = await acquireWriterLock(namespace)
    if (lock === 'unavailable') {
      const read = await readUnlocked(namespace)
      if (!read.ok && read.reason === 'empty') throw new MockWriterUnavailableError()
      if (!read.ok) return read
      return { ok: true, state: read.state, writeLocked: false, writesUnavailable: true }
    }
    const lockHeld = lock === 'held'
    const result = await releasingRefusal(lockHeld, namespace, () => ensureUnlocked(namespace, lockHeld))
    if (result.ok && result.writeLocked && lockHeld) releaseWriterLock(namespace)
    return result
  })
}

export async function updateMockState(
  mutator: (state: MockState) => MockState,
  namespace = MOCK_NAMESPACE,
): Promise<MockState> {
  return enqueue(async () => {
    const lock = await acquireWriterLock(namespace)
    if (lock === 'unavailable') throw new MockWriterUnavailableError()
    return releasingRefusal(lock === 'held', namespace, () => updateUnlocked(mutator, namespace, lock === 'held'))
  })
}

export async function resetMockNamespace(namespace = MOCK_NAMESPACE): Promise<MockState> {
  return enqueue(async () => {
    const lock = await acquireWriterLock(namespace)
    if (lock === 'unavailable') throw new MockWriterUnavailableError()
    return releasingRefusal(lock === 'held', namespace, () => resetUnlocked(namespace, lock === 'held'))
  })
}

/** Plants a raw record for tests. It does not migrate and does not take the writer lease. */
export async function replaceMockRecord(namespace: string, value: unknown): Promise<void> {
  return enqueue(() => openAndRun(namespace, 'readwrite', (store, controls) => {
    const request = store.put(value, RECORD_KEY)
    request.onsuccess = () => controls.succeed(undefined)
    request.onerror = () => controls.fail(request.error ?? new Error('IndexedDB put failed'))
  }))
}

async function readWriterLease(namespace: string): Promise<unknown> {
  return openAndRun(namespace, 'readonly', (store, controls) => {
    const request = store.get(WRITER_KEY)
    request.onsuccess = () => controls.succeed(request.result)
    request.onerror = () => controls.fail(request.error ?? new Error('IndexedDB read failed'))
  })
}

export async function mockWriteStatus(namespace = MOCK_NAMESPACE): Promise<{ writeLocked: boolean; writesUnavailable: boolean }> {
  return enqueue(async () => {
    const lock = await acquireWriterLock(namespace)
    if (lock === 'unavailable') return { writeLocked: false, writesUnavailable: true }
    const lease = await readWriterLease(namespace)
    const allowed = claimAllowed(lease, Date.now(), lock === 'held')
    if (!allowed && lock === 'held') releaseWriterLock(namespace)
    return { writeLocked: !allowed, writesUnavailable: false }
  })
}

export async function isMockWriteLocked(namespace = MOCK_NAMESPACE): Promise<boolean> {
  const status = await mockWriteStatus(namespace)
  return status.writeLocked
}
