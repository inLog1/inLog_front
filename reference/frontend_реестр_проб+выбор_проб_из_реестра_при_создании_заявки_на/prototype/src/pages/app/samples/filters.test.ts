import { describe, expect, it } from 'vitest'
import { ALL_INSPECTIONS, ALL_STAGES, ALL_TYPES, filterSamples } from './filters'
import { demoSamples, type Sample } from './model'

const rows: Sample[] = [
  {...demoSamples[0], id:'a', code:'A', sampleType:'Керн', field:'Северное', stage:'На хранении', inspection:'Соответствует'},
  {...demoSamples[0], id:'b', code:'B', sampleType:'Керн', field:'Северное', stage:'Поступила', inspection:'Не проведён'},
  {...demoSamples[0], id:'c', code:'C', kind:'Флюид', sampleType:'Газ', field:'Южное', stage:'В исследовании', inspection:'Соответствует'},
  {...demoSamples[0], id:'d', code:'D', kind:'Флюид', sampleType:undefined, material:'Жидкость сепарации', field:'Северное', stage:undefined, inspection:'Не проведён'},
]
const all = {search:'', kind:ALL_TYPES, stage:ALL_STAGES, inspection:ALL_INSPECTIONS}

describe('sample filter counts', () => {
  it('counts all matching rows rather than the current page and includes unknown and legacy values', () => {
    const { filtered, counts } = filterSamples(rows, all)
    expect(filtered).toHaveLength(4)
    expect(counts.kind.get(ALL_TYPES)).toBe(4)
    expect(counts.kind.get('Керн')).toBe(2)
    expect(counts.kind.get('Не указан')).toBe(1)
    expect(counts.stage.get('На исследовании')).toBe(1)
    expect(counts.stage.get('Не указан')).toBe(1)
    expect(counts.inspection.get('Соответствует')).toBe(2)
  })
  it('counts each filter against search and the other two filters', () => {
    const { filtered, counts } = filterSamples(rows, {...all, search:'Северное', kind:'Керн', stage:'На хранении', inspection:'Соответствует'})
    expect(filtered.map(item => item.id)).toEqual(['a'])
    expect(counts.kind.get(ALL_TYPES)).toBe(1)
    expect(counts.kind.get('Керн')).toBe(1)
    expect(counts.stage.get(ALL_STAGES)).toBe(1)
    expect(counts.inspection.get(ALL_INSPECTIONS)).toBe(1)
    const changed = filterSamples(rows, {...all, kind:'Керн', stage:'На хранении'})
    expect(changed.counts.kind.get('Газ') ?? 0).toBe(0)
    expect(changed.counts.stage.get('Поступила')).toBe(1)
    expect(changed.counts.stage.get(ALL_STAGES)).toBe(2)
    expect(changed.counts.inspection.get('Соответствует')).toBe(1)
  })
  it('returns empty counts for no matches without mutating records', () => {
    const result = filterSamples(rows, {...all, search:'не существует'})
    expect(result.filtered).toEqual([])
    expect(result.counts.kind.size).toBe(0)
    expect(rows.map(item => item.id)).toEqual(['a','b','c','d'])
  })
  it('shows recently registered samples before older ones regardless of receipt date', () => {
    const old = {...rows[0], code:'PRB-2026-000001', receivedAt:'2026-11-12', events:[{at:'2026-11-10T10:00:00Z', text:'Зарегистрирована'}]}
    const imported = {...rows[1], code:'PRB-2026-000002', receivedAt:'2026-01-01', events:[{at:'2026-11-12T10:00:00Z', text:'Зарегистрирована'}]}
    const sameBatch = {...imported, id:'newer', code:'PRB-2026-000003'}
    expect(filterSamples([old, imported, sameBatch], all).filtered.map(item => item.code)).toEqual(['PRB-2026-000003','PRB-2026-000002','PRB-2026-000001'])
  })
})
