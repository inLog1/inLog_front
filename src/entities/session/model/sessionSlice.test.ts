import { describe, expect, it } from 'vitest'
import { sessionActions, sessionReducer } from './sessionSlice'

describe('session generation', () => {
  it('clears the previous subject when a new bootstrap starts', () => {
    const authenticated = sessionReducer(
      undefined,
      sessionActions.setAuthenticated({ subjectId: 1, accessState: 'ready' }),
    )
    const advanced = sessionReducer(authenticated, sessionActions.advanceGeneration())
    const loading = sessionReducer(advanced, sessionActions.beginBootstrap())

    expect(advanced.generation).toBe(1)
    expect(loading.phase).toBe('loading')
    expect(loading.subjectId).toBeNull()
  })
})
