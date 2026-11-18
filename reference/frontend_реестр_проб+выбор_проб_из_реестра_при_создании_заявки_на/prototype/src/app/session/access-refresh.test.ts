import { describe, expect, it } from 'vitest'
import { invalidateAfterAccessVersion } from './access-refresh'

describe('access version refresh', () => {
  it('drops form, table and section caches together with the older work caches', () => {
    const actions: unknown[] = []
    invalidateAfterAccessVersion((action) => {
      actions.push(action)
    })
    const text = JSON.stringify(actions)
    expect(text).toContain('Forms')
    expect(text).toContain('TableViews')
    expect(text).toContain('Sections')
    expect(text).toContain('AccessControl')
    expect(text).toContain('Tasks')
    expect(text).toContain('Nodes')
  })
})
