import { describe, expect, it } from 'vitest'
import { resolveDirectoryFocus } from './directory-focus'

describe('directory focus', () => {
  it('rejects a foreign or invalid organization instead of substituting another', () => {
    expect(resolveDirectoryFocus(null, [101])).toEqual({ status: 'all' })
    expect(resolveDirectoryFocus('101', [101])).toEqual({ status: 'open', organizationId: 101 })
    expect(resolveDirectoryFocus('102', [101])).toEqual({ status: 'rejected' })
    expect(resolveDirectoryFocus('0', [101])).toEqual({ status: 'rejected' })
    expect(resolveDirectoryFocus('abc', [101])).toEqual({ status: 'rejected' })
  })
})
