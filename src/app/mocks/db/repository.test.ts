import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { LIVE_ACCESS_KEY, MOCK_ACCESS_KEY, clearSession, readAccessToken, setSessionStorageBackend, writeSession, type KeyValueStorage } from '../../../shared/api/session-storage'
import { createSeed } from './seed'
import { ensureMockState, readMockState, replaceMockRecord, resetMockNamespace, updateMockState } from './repository'
import { PUBLIC_FIXTURE_PASSWORD } from './constants'

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

describe('mock repository', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
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
    await resetMockNamespace(target)
    const reset = await readMockState(target)
    const untouched = await readMockState(kept)
    expect(reset.ok && reset.state.schemaVersion).toBe(1)
    expect(untouched.ok && untouched.state.accessVersion).toBe(7)
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
