import { beforeEach, describe, expect, it } from 'vitest'
import { readAccessToken, setSessionStorageBackend, type KeyValueStorage } from '../../../shared/api/session-storage'
import { beginAuthAttempt, commitAccessSession, invalidateAuthAttempts } from './auth-attempt'

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

describe('auth attempt tickets', () => {
  beforeEach(() => {
    setSessionStorageBackend(new MemoryStorage())
  })

  it('does not commit a late login after the attempt was invalidated', async () => {
    const ticket = beginAuthAttempt()
    let resolveLogin: (value: { access_token: string; refresh_token: string; user: { id: number } }) => void = () => undefined
    const pending = new Promise<{ access_token: string; refresh_token: string; user: { id: number } }>((resolve) => {
      resolveLogin = resolve
    })
    invalidateAuthAttempts()
    resolveLogin({ access_token: 'late-access', refresh_token: 'late-refresh', user: { id: 1 } })
    const data = await pending
    expect(commitAccessSession(ticket, data)).toBe(false)
    expect(readAccessToken()).toBeNull()
  })

  it('keeps the session written by the latest attempt', () => {
    const first = beginAuthAttempt()
    const second = beginAuthAttempt()
    expect(commitAccessSession(second, {
      access_token: 'second-access',
      refresh_token: 'second-refresh',
      user: { id: 4 },
    })).toBe(true)
    expect(commitAccessSession(first, {
      access_token: 'first-access',
      refresh_token: 'first-refresh',
      user: { id: 1 },
    })).toBe(false)
    expect(readAccessToken()).toBe('second-access')
  })
})
