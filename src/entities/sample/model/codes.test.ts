import { describe, expect, it } from 'vitest'
import {
  formatChildSampleCode,
  formatRootSampleCode,
  isRootSampleCode,
  isSampleCode,
  previewRootSampleCode,
  registrationYear,
} from './codes'
import { makeSample } from './fixture'
import { registerSamples } from './sample'

const at = '2026-11-12T12:00:00Z'

describe('sample registration numbers', () => {
  it('formats and checks root, child and nested numbers', () => {
    expect(formatRootSampleCode(2026, 1)).toBe('PRB-2026-000001')
    expect(formatChildSampleCode('PRB-2026-000001', 1)).toBe('PRB-2026-000001-01')
    expect(formatChildSampleCode('PRB-2026-000001-01', 1)).toBe('PRB-2026-000001-01-01')
    expect(isSampleCode('PRB-2026-000001')).toBe(true)
    expect(isSampleCode('prb-2026-000001-01-01')).toBe(true)
    expect(isRootSampleCode('PRB-2026-000001')).toBe(true)
    expect(isRootSampleCode('PRB-2026-000001-01')).toBe(false)
    expect(isSampleCode('PRB-2026-00001')).toBe(false)
    expect(isSampleCode('PRB-2026-000001-1')).toBe(false)
    expect(isSampleCode('')).toBe(false)
    expect(() => formatRootSampleCode(2026, 0)).toThrow('counter-overflow')
    expect(() => formatChildSampleCode('  ', 1)).toThrow('invalid-parent')
  })

  it('previews the next root number without advancing a hidden counter', () => {
    const records = [makeSample({ code: 'PRB-2026-000007', deletedAt: at })]
    const counters = {}
    expect(previewRootSampleCode(records, counters, at)).toBe('PRB-2026-000008')
    expect(previewRootSampleCode(records, counters, at)).toBe('PRB-2026-000008')
    expect(counters).toEqual({})
    expect(registrationYear('2027-06-01T12:00:00Z')).toBe('2027')
    expect(() => registrationYear('not-a-date')).toThrow('invalid-date')
  })

  it('assigns consecutive root numbers and leaves stored numbers unchanged', () => {
    const existing = makeSample({ id: 'kept', code: 'PRB-2025-000099' })
    const batch = Array.from({ length: 3 }, (_, index) => makeSample({
      id: `new-${index}`,
      code: '',
      externalCode: `Заказчик-${index}`,
    }))
    const result = registerSamples([existing], { '2026': 4 }, batch, at)
    expect(result.records[0]).toEqual(existing)
    expect(result.records.slice(1).map((item) => item.code)).toEqual([
      'PRB-2026-000005',
      'PRB-2026-000006',
      'PRB-2026-000007',
    ])
    expect(result.counters['2026']).toBe(7)
    expect(batch[0].code).toBe('')
  })

  it('does not reuse a deleted number and starts again in a new registration year', () => {
    const deleted = makeSample({ id: 'old', organizationId: 202, code: 'prb-2026-000007', deletedAt: at })
    const first = registerSamples([deleted], {}, [makeSample({ id: 'new', code: '' })], at)
    expect(first.records.at(-1)?.code).toBe('PRB-2026-000008')
    const second = registerSamples([], first.counters, [makeSample({ id: 'next', organizationId: 202, code: '' })], at)
    expect(second.records[0].code).toBe('PRB-2026-000009')
    const nextYear = registerSamples([], { '2026': 100 }, [makeSample({ id: 'one', code: '' })], '2027-06-01T12:00:00Z')
    expect(nextYear.records[0].code).toBe('PRB-2027-000001')
    expect(nextYear.counters).toEqual({ '2026': 100, '2027': 1 })
  })

  it('rejects an invalid row without changing the caller collections', () => {
    const records = [makeSample({ id: 'old', code: 'PRB-2026-000003' })]
    const counters = { '2026': 3 }
    expect(() => registerSamples(records, counters, [
      makeSample({ id: 'valid', code: '' }),
      makeSample({ id: 'bad', code: '', field: '' }),
    ], at)).toThrow('required')
    expect(records).toHaveLength(1)
    expect(records[0].code).toBe('PRB-2026-000003')
    expect(counters).toEqual({ '2026': 3 })
  })
})
