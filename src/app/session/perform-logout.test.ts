import { afterEach, describe, expect, it } from 'vitest'
import { invalidateAuthAttempts } from '../../entities/session'
import { beginAuthAttempt, commitAccessSession } from '../../entities/session/model/auth-attempt'
import {
  readAccessToken,
  setSessionStorageBackend,
  writeSession,
  type KeyValueStorage,
} from '../../shared/api/session-storage'
import { store } from '../store/store'
import { performLogout } from './perform-logout'

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

describe('local logout', () => {
  const storage = new MemoryStorage()

  afterEach(() => {
    setSessionStorageBackend(null)
  })

  it('closes the session before the remote logout resolves and ignores that late response', async () => {
    setSessionStorageBackend(storage)
    writeSession({ accessToken: 'old-access', refreshToken: 'old-refresh', subjectId: 2 }, 'live')
    writeSession({ accessToken: 'mock-access', refreshToken: 'mock-refresh', subjectId: 3 }, 'mock')
    storage.setItem('theme', 'dark')
    storage.setItem('inlog-whiteboard:task-1:u2', '{"elements":[1]}')
    const ticket = beginAuthAttempt()
    let release: (value: Response) => void = () => undefined
    const gate = new Promise<Response>((resolve) => {
      release = resolve
    })
    let authorization: string | null = null
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('Authorization')
      return gate
    }) as typeof fetch

    const pending = performLogout({ reason: 'user', callApi: true })
    await Promise.resolve()
    expect(readAccessToken('live')).toBeNull()
    expect(readAccessToken('mock')).toBe('mock-access')
    expect(store.getState().session.phase).toBe('anonymous')
    expect(store.getState().session.subjectId).toBeNull()
    expect(storage.getItem('theme')).toBe('dark')
    expect(storage.getItem('inlog-whiteboard:task-1:u2')).toContain('elements')

    writeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', subjectId: 4 }, 'live')
    expect(commitAccessSession(ticket, {
      access_token: 'resurrected-access',
      refresh_token: 'resurrected-refresh',
      user: { id: 2 },
    })).toBe(false)
    release(new Response(null, { status: 204 }))
    await pending
    expect(authorization).toBe('Bearer old-access')
    expect(readAccessToken('live')).toBe('new-access')
    expect(readAccessToken('mock')).toBe('mock-access')
    invalidateAuthAttempts()
    globalThis.fetch = originalFetch
  })
})
