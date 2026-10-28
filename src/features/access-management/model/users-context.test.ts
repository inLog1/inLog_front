import { describe, expect, it } from 'vitest'
import { usersRequestMatches } from './users-context'

describe('users request context', () => {
  it('accepts only the query that is on screen', () => {
    const requested = { organization: 101 as const, q: 'Соколова', page: 1, pageSize: 20 }
    expect(usersRequestMatches(requested, requested)).toBe(true)
    expect(usersRequestMatches({ ...requested, q: 'Морозов' }, requested)).toBe(false)
    expect(usersRequestMatches({ ...requested, organization: 'all' }, requested)).toBe(false)
    expect(usersRequestMatches({ ...requested, page: 2 }, requested)).toBe(false)
    expect(usersRequestMatches(null, requested)).toBe(false)
  })
})
