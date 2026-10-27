import { describe, expect, it } from 'vitest'
import { displayedConnectionValues } from './displayed-connection-values'

describe('displayedConnectionValues', () => {
  it('includes a fixed parent without a separate value change', () => {
    const value = displayedConnectionValues([4], [
      { value: '4', fixed: false },
      { value: '7', fixed: true },
    ])
    const missingFixed = ['7'].filter((item) => !value.includes(item))
    expect(value).toEqual(['4', '7'])
    expect(missingFixed).toEqual([])
  })
})
