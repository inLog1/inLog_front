import { MOCK_NAMESPACE, MOCK_SCHEMA_VERSION } from './constants'
import { createSeed } from './seed'
import type { MockState } from './types'

const STORE = 'state'
const RECORD_KEY = 'root'

export class SchemaMismatchError extends Error {
  foundVersion: number

  constructor(foundVersion: number) {
    super('Mock schema version does not match')
    this.name = 'SchemaMismatchError'
    this.foundVersion = foundVersion
  }
}

export type MockRead =
  | { ok: true; state: MockState }
  | { ok: false; reason: 'schema-mismatch'; foundVersion: number }

let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(() => undefined, () => undefined)
  return run
}

function factory(): IDBFactory {
  const value = globalThis.indexedDB
  if (!value) throw new Error('IndexedDB is not available')
  return value
}

function deleteDatabase(namespace: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory().deleteDatabase(namespace)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'))
    request.onblocked = () => resolve()
  })
}

function openDatabase(namespace: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory().open(namespace, MOCK_SCHEMA_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function withStore<T>(
  namespace: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase(namespace)
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  } finally {
    db.close()
  }
}

function isMockState(value: unknown): value is MockState {
  if (!value || typeof value !== 'object') return false
  return typeof (value as MockState).schemaVersion === 'number' && Array.isArray((value as MockState).users)
}

async function readUnlocked(namespace: string): Promise<MockRead | { ok: false; reason: 'empty' }> {
  const record = await withStore(namespace, 'readonly', (store) => store.get(RECORD_KEY))
  if (!record) return { ok: false, reason: 'empty' }
  if (!isMockState(record) || record.schemaVersion !== MOCK_SCHEMA_VERSION) {
    return { ok: false, reason: 'schema-mismatch', foundVersion: isMockState(record) ? record.schemaVersion : -1 }
  }
  return { ok: true, state: record }
}

async function ensureUnlocked(namespace: string): Promise<MockRead> {
  const current = await readUnlocked(namespace)
  if (current.ok || current.reason === 'schema-mismatch') return current
  const seeded = createSeed()
  seeded.namespace = namespace
  await withStore(namespace, 'readwrite', (store) => store.put(seeded, RECORD_KEY))
  return { ok: true, state: seeded }
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
  return enqueue(async () => {
    const current = await ensureUnlocked(namespace)
    if (!current.ok) throw new SchemaMismatchError(current.foundVersion)
    const next = mutator(current.state)
    await withStore(namespace, 'readwrite', (store) => store.put(next, RECORD_KEY))
    return next
  })
}

export async function resetMockNamespace(namespace = MOCK_NAMESPACE): Promise<MockState> {
  return enqueue(async () => {
    await deleteDatabase(namespace)
    const seeded = createSeed()
    seeded.namespace = namespace
    await withStore(namespace, 'readwrite', (store) => store.put(seeded, RECORD_KEY))
    return seeded
  })
}

export async function replaceMockRecord(namespace: string, value: unknown): Promise<void> {
  return enqueue(async () => {
    await withStore(namespace, 'readwrite', (store) => store.put(value, RECORD_KEY))
  })
}
