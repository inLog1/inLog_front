import { describe, expect, it } from 'vitest'
import { beginDevSwitch, isCurrentDevSwitch } from './dev-switch'

describe('dev switch generation', () => {
  it('keeps only the latest switch allowed to commit', () => {
    const first = beginDevSwitch()
    const second = beginDevSwitch()

    expect(isCurrentDevSwitch(first)).toBe(false)
    expect(isCurrentDevSwitch(second)).toBe(true)
  })
})
