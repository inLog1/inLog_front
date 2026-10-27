import { describe, expect, it } from 'vitest'
import { resolveSsoStart } from './sso'
import { resetAllApiCaches, registeredApis } from '../../../app/store/api-registry'

describe('sso and cache isolation', () => {
  it('never falls back to the mock provider in live mode', () => {
    expect(resolveSsoStart('live', null)).toEqual({ kind: 'unconfigured' })
    expect(resolveSsoStart('live', 'https://idp.example/start')).toEqual({
      kind: 'live',
      href: 'https://idp.example/start',
    })
    expect(resolveSsoStart('mock', null)).toEqual({ kind: 'mock' })
  })

  it('resets every registered API cache, including the eight legacy services', () => {
    const actions: unknown[] = []
    resetAllApiCaches((action) => actions.push(action))
    expect(registeredApis).toHaveLength(9)
    expect(actions).toHaveLength(9)
    const types = actions.map((action) => (action as { type?: string }).type ?? '')
    expect(types).toContain('authApi/resetApiState')
    expect(types).toContain('userApi/resetApiState')
    expect(types).toContain('taskApi/resetApiState')
    expect(types).toContain('adminApi/resetApiState')
    expect(types).toContain('platformApi/resetApiState')
  })
})
