import { describe, expect, it } from 'vitest'
import { MOCK_TEST_PANEL_LAUNCHER, MOCK_TEST_PANEL_OPEN } from './panel-position'

describe('mock test panel position', () => {
  it('stays on the left and inside the viewport so it does not cover the form actions', () => {
    for (const value of [MOCK_TEST_PANEL_LAUNCHER, MOCK_TEST_PANEL_OPEN]) {
      expect(value).toContain('left-3')
      expect(value).toContain('md:left-64')
      expect(value).not.toContain('right-')
      expect(value).toContain('100vw')
    }
  })
})