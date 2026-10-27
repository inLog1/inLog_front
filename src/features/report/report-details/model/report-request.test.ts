import { describe, expect, it } from 'vitest'
import { reportResponseIsCurrent } from './report-request'

describe('report request context', () => {
  it('drops a response that belongs to an older organization or an older request', () => {
    const current = { organizationId: 102, serial: 2 }
    expect(reportResponseIsCurrent({ organizationId: 101, serial: 2 }, current)).toBe(false)
    expect(reportResponseIsCurrent({ organizationId: 102, serial: 1 }, current)).toBe(false)
    expect(reportResponseIsCurrent(current, current)).toBe(true)
  })
})
