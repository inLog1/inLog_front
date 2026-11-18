import { describe, expect, it } from 'vitest'
import { constraintPhrases } from './attribute-field'

describe('constraint phrases', () => {
  it('describes each field type in short phrases', () => {
    expect(constraintPhrases('text', { maxLength: 80 })).toEqual([
      { key: 'directories.catalog.constraints.summary.max-length', values: { count: 80 } },
    ])
    expect(constraintPhrases('checkbox', undefined)).toEqual([
      { key: 'directories.catalog.constraints.summary.not-needed' },
    ])
    expect(constraintPhrases('number', { min: 0, max: 10, step: 0.5, integer: false })).toEqual([
      { key: 'directories.catalog.constraints.summary.range', values: { min: 0, max: 10 } },
      { key: 'directories.catalog.constraints.summary.step', values: { step: 0.5 } },
      { key: 'directories.catalog.constraints.summary.decimal' },
    ])
    expect(constraintPhrases('date', { minDate: '2020-01-31', dateFormat: 'dmy' })).toEqual([
      { key: 'directories.catalog.constraints.summary.not-before', values: { date: '31.01.2020' } },
      { key: 'directories.catalog.constraints.date-formats.dmy' },
    ])
    expect(constraintPhrases('text', undefined)).toEqual([])
  })
})