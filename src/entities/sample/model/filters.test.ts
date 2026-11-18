import { describe, expect, it } from 'vitest'
import { ALL_SAMPLE_INSPECTIONS, ALL_SAMPLE_STAGES, ALL_SAMPLE_TYPES, filterSamples } from './filters'
import { makeSample } from './fixture'

const rows = [
  makeSample({ id: 'a', code: 'A', sampleType: 'Керн', field: 'Северное', stage: 'На хранении', inspection: 'Соответствует' }),
  makeSample({ id: 'b', code: 'B', sampleType: 'Керн', field: 'Северное', stage: 'Поступила', inspection: 'Не проведён' }),
  makeSample({ id: 'c', code: 'C', kind: 'Флюид', sampleType: 'Газ', field: 'Южное', stage: 'В исследовании', inspection: 'Соответствует' }),
  makeSample({ id: 'd', code: 'D', kind: 'Флюид', sampleType: undefined, material: 'Жидкость сепарации', field: 'Северное', stage: undefined, inspection: 'Не проведён' }),
]
const all = { search: '', sampleType: ALL_SAMPLE_TYPES, stage: ALL_SAMPLE_STAGES, inspection: ALL_SAMPLE_INSPECTIONS }

describe('sample filters', () => {
  it('counts every matching row, including an unknown type and a legacy status', () => {
    const { filtered, counts } = filterSamples(rows, all)
    expect(filtered).toHaveLength(4)
    expect(counts.sampleType.get(ALL_SAMPLE_TYPES)).toBe(4)
    expect(counts.sampleType.get('Керн')).toBe(2)
    expect(counts.sampleType.get('Не указан')).toBe(1)
    expect(counts.stage.get('На исследовании')).toBe(1)
    expect(counts.stage.get('Не указан')).toBe(1)
    expect(counts.inspection.get('Соответствует')).toBe(2)
  })

  it('counts each facet against the search text and the other two facets', () => {
    const { filtered, counts } = filterSamples(rows, { ...all, search: 'Северное', sampleType: 'Керн', stage: 'На хранении', inspection: 'Соответствует' })
    expect(filtered.map((item) => item.id)).toEqual(['a'])
    expect(counts.sampleType.get(ALL_SAMPLE_TYPES)).toBe(1)
    expect(counts.sampleType.get('Керн')).toBe(1)
    expect(counts.stage.get(ALL_SAMPLE_STAGES)).toBe(1)
    expect(counts.inspection.get(ALL_SAMPLE_INSPECTIONS)).toBe(1)
    const changed = filterSamples(rows, { ...all, sampleType: 'Керн', stage: 'На хранении' })
    expect(changed.counts.sampleType.get('Газ') ?? 0).toBe(0)
    expect(changed.counts.stage.get('Поступила')).toBe(1)
    expect(changed.counts.stage.get(ALL_SAMPLE_STAGES)).toBe(2)
    expect(changed.counts.inspection.get('Соответствует')).toBe(1)
  })

  it('returns empty counts when nothing matches and does not change the input', () => {
    const result = filterSamples(rows, { ...all, search: 'не существует' })
    expect(result.filtered).toEqual([])
    expect(result.counts.sampleType.size).toBe(0)
    expect(rows.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sorts by registration history ahead of the receipt date', () => {
    const old = makeSample({
      id: 'old',
      code: 'PRB-2026-000001',
      receivedAt: '2026-11-12',
      events: [{ at: '2026-11-10T10:00:00Z', text: 'Зарегистрирована' }],
    })
    const imported = makeSample({
      id: 'imported',
      code: 'PRB-2026-000002',
      receivedAt: '2026-01-01',
      events: [{ at: '2026-11-12T10:00:00Z', text: 'Зарегистрирована' }],
    })
    const sameBatch = { ...imported, id: 'newer', code: 'PRB-2026-000003' }
    expect(filterSamples([old, imported, sameBatch], all).filtered.map((item) => item.code)).toEqual([
      'PRB-2026-000003',
      'PRB-2026-000002',
      'PRB-2026-000001',
    ])
  })
})
