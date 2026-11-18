import { describe, expect, it } from 'vitest'
import { makeSample } from '../../../../entities/sample/model/fixture'
import {
  emptyRegistryFilters,
  registryPage,
  stageFilterValues,
} from './registry-view'

const blank = emptyRegistryFilters()

describe('sample registry page', () => {
  it('keeps a matching subsample under its parent and does not count that parent as a match', () => {
    const parent = makeSample({
      id: 'parent',
      code: 'PRB-2026-000010',
      events: [{ at: '2026-01-01T00:00:00Z', text: 'Создана запись' }],
    })
    const child = makeSample({
      id: 'child',
      parentId: 'parent',
      code: 'PRB-2026-000010-01',
      field: 'Южное',
      events: [{ at: '2026-02-01T00:00:00Z', text: 'Создана подпроба' }],
    })
    const page = registryPage([parent, child], { ...blank, search: child.code }, 1, 15, new Set(), new Set())
    expect(page.filteredCount).toBe(1)
    expect(page.rootCount).toBe(1)
    expect(page.rows.map((row) => [row.sample.id, row.matches, row.depth])).toEqual([
      ['parent', false, 0],
      ['child', true, 1],
    ])
  })

  it('collapses a group without dropping the parent and nests a second level', () => {
    const parent = makeSample({ id: 'parent', code: 'P', events: [{ at: '2026-01-01T00:00:00Z', text: 'a' }] })
    const child = makeSample({ id: 'child', parentId: 'parent', code: 'P-01', events: [{ at: '2026-01-02T00:00:00Z', text: 'b' }] })
    const nested = makeSample({ id: 'nested', parentId: 'child', code: 'P-01-01', events: [{ at: '2026-01-03T00:00:00Z', text: 'c' }] })
    const open = registryPage([parent, child, nested], blank, 1, 15, new Set(), new Set())
    expect(open.rows.map((row) => [row.sample.id, row.depth])).toEqual([
      ['parent', 0],
      ['child', 1],
      ['nested', 2],
    ])
    const closed = registryPage([parent, child, nested], blank, 1, 15, new Set(), new Set(['parent']))
    expect(closed.rows.map((row) => row.sample.id)).toEqual(['parent'])
  })

  it('pages by root samples and keeps every child on the parent page', () => {
    const parents = Array.from({ length: 16 }, (_, index) => makeSample({
      id: `p${index}`,
      code: `P${String(index).padStart(2, '0')}`,
      events: [{ at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`, text: 'Зарегистрировано' }],
    }))
    const child = makeSample({
      id: 'child',
      parentId: 'p15',
      code: 'P15-01',
      events: [{ at: '2026-02-01T00:00:00Z', text: 'Создана подпроба' }],
    })
    const records = [...parents, child]
    const first = registryPage(records, blank, 1, 15, new Set(), new Set())
    expect(first.pages).toBe(2)
    expect(first.rootCount).toBe(16)
    expect(first.rows.some((row) => row.sample.id === 'child' && row.depth === 1)).toBe(true)
    expect(first.rows.some((row) => row.sample.id === 'p0')).toBe(false)
    const second = registryPage(records, blank, 2, 15, new Set(), new Set())
    expect(second.rows.map((row) => row.sample.id)).toEqual(['p0'])
    expect(second.page).toBe(2)
  })

  it('adds a legacy displayed status to the stage filter', () => {
    const values = stageFilterValues([makeSample({ stage: 'Передана' })])
    expect(values[0]).toBe(blank.stage)
    expect(values).toContain('Передана')
    expect(values.filter((value) => value === 'На исследовании')).toHaveLength(1)
  })
})
