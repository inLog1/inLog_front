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

export class StaleMockWriteError extends Error {
  constructor() {
    super('Mock write was based on an older snapshot')
    this.name = 'StaleMockWriteError'
  }
}

export type MockRead =
  | { ok: true; state: MockState; writeLocked?: boolean }
  | { ok: false; reason: 'schema-mismatch'; foundVersion: number }

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
let writerId = `tab-${crypto.randomUUID()}`

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(() => undefined, () => undefined)
  return run
}

export function currentMockWriterId(): string {
  return writerId
}

/** Test seam: this realm pretends to be another tab. */
export function setMockWriterId(id: string): void {
  writerId = id
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

function foreignLease(value: unknown, now: number): boolean {
  return isWriterLease(value) && value.ownerId !== writerId && value.until > now
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

async function ensureUnlocked(namespace: string): Promise<MockRead> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    readBoth(store, (root, writer) => {
      const now = Date.now()
      const locked = foreignLease(writer, now)
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
): Promise<MockState> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    readBoth(store, (root, writer) => {
      const now = Date.now()
      if (foreignLease(writer, now)) {
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

async function resetUnlocked(namespace: string): Promise<MockState> {
  return openAndRun(namespace, 'readwrite', (store, controls) => {
    const writerRequest = store.get(WRITER_KEY)
    writerRequest.onsuccess = () => {
      const now = Date.now()
      if (foreignLease(writerRequest.result, now)) {
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

export async function ensureMockState(namespace = MOCK_NAMESPACE): Promise<MockRead> {
  return enqueue(() => ensureUnlocked(namespace))
}

export async function updateMockState(
  mutator: (state: MockState) => MockState,
  namespace = MOCK_NAMESPACE,
): Promise<MockState> {
  return enqueue(() => updateUnlocked(mutator, namespace))
}

export async function resetMockNamespace(namespace = MOCK_NAMESPACE): Promise<MockState> {
  return enqueue(() => resetUnlocked(namespace))
}

/** Plants a raw record for tests. It does not migrate and does not take the writer lease. */
export async function replaceMockRecord(namespace: string, value: unknown): Promise<void> {
  return enqueue(() => openAndRun(namespace, 'readwrite', (store, controls) => {
    const request = store.put(value, RECORD_KEY)
    request.onsuccess = () => controls.succeed(undefined)
    request.onerror = () => controls.fail(request.error ?? new Error('IndexedDB put failed'))
  }))
}

export async function isMockWriteLocked(namespace = MOCK_NAMESPACE): Promise<boolean> {
  return enqueue(() => openAndRun(namespace, 'readonly', (store, controls) => {
    const request = store.get(WRITER_KEY)
    request.onsuccess = () => controls.succeed(foreignLease(request.result, Date.now()))
    request.onerror = () => controls.fail(request.error ?? new Error('IndexedDB read failed'))
  }))
}
