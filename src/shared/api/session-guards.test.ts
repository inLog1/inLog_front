import { describe, expect, it } from 'vitest'
import { classifyHttpFailure, isCredentialEndpoint, sameSessionView, shouldLogoutOnStatus } from './endpoint-policy'
import { sanitizeReturnTo } from './return-to'
import { readJsonString } from './session-storage'

describe('session guards', () => {
  it('treats login 401 as a credential error and private 401 as logout', () => {
    expect(isCredentialEndpoint('auth/login/')).toBe(true)
    expect(isCredentialEndpoint('/mock-api/auth/login/')).toBe(true)
    expect(shouldLogoutOnStatus('auth/login/', 401)).toBe(false)
    expect(shouldLogoutOnStatus('users/me/', 401)).toBe(true)
    expect(shouldLogoutOnStatus('users/social-auth/google/login/', 401)).toBe(true)
    expect(classifyHttpFailure('session/access/', 403)).toBe('forbidden')
    expect(shouldLogoutOnStatus('mock/test-resource/', 403)).toBe(false)
    expect(classifyHttpFailure('users/me/', 'FETCH_ERROR')).toBe('network')
    expect(classifyHttpFailure('users/me/', 500)).toBe('server')
  })

  it('accepts only a local return path', () => {
    expect(sanitizeReturnTo('/scheduler/tasks?project=1001')).toBe('/scheduler/tasks?project=1001')
    expect(sanitizeReturnTo('https://evil.example/steal')).toBeNull()
    expect(sanitizeReturnTo('//evil.example')).toBeNull()
    expect(sanitizeReturnTo('/login?next=/')).toBeNull()
  })

  it('treats a repeated null token as a new session when the generation changes', () => {
    expect(sameSessionView({ token: null, generation: 1 }, { token: null, generation: 1 })).toBe(true)
    expect(sameSessionView({ token: null, generation: 1 }, { token: null, generation: 2 })).toBe(false)
    expect(sameSessionView({ token: 'previous', generation: 4 }, { token: 'next', generation: 4 })).toBe(false)
    expect(sameSessionView({ token: 'same', generation: 4 }, { token: 'same', generation: 5 })).toBe(false)
  })

  it('does not throw on a corrupt token payload', () => {
    expect(readJsonString('{')).toBeNull()
    expect(readJsonString('"token"')).toBe('token')
    expect(readJsonString('42')).toBeNull()
  })
})
