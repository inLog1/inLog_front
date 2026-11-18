import { describe, expect, it } from 'vitest'
import { ALL_SAMPLE_INSPECTIONS, ALL_SAMPLE_STAGES, ALL_SAMPLE_TYPES, filterSamples } from './filters'
import { makeSample } from './fixture'
import { buildSampleTree, flattenSampleTree, sliceSampleRoots } from './sampleTree'

describe('sample tree', () => {
  const root = makeSample({ id: 'root' })
  const child = makeSample({ id: 'child', parentId: 'root' })
  const grandchild = makeSample({ id: 'grandchild', parentId: 'child' })
  const other = makeSample({ id: 'other' })
  const records = [grandchild, child, root, other]

  it('keeps descendants under their ancestor regardless of registry order', () => {
    const tree = buildSampleTree(records, records)
    expect(tree.map((node) => node.sample.id)).toEqual(['root', 'other'])
    expect(flattenSampleTree(tree, new Set(), new Set(), false).map((row) => row.sample.id)).toEqual(['root', 'other'])
    expect(flattenSampleTree(tree, new Set(['root', 'child']), new Set(), false).map((row) => [row.sample.id, row.depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grandchild', 2],
      ['other', 0],
    ])
  })

  it('keeps a non-matching ancestor when search hits only the descendant', () => {
    const parent = makeSample({ id: 'parent', code: 'PRB-2026-000001', externalCode: 'PARENT-MARK' })
    const nested = makeSample({ id: 'nested', code: 'PRB-2026-000001-01', parentId: 'parent', externalCode: 'CHILD-MARK' })
    const filtered = filterSamples([parent, nested], {
      search: 'CHILD-MARK',
      sampleType: ALL_SAMPLE_TYPES,
      stage: ALL_SAMPLE_STAGES,
      inspection: ALL_SAMPLE_INSPECTIONS,
    }).filtered
    expect(filtered.map((item) => item.id)).toEqual(['nested'])
    const rows = flattenSampleTree(buildSampleTree([parent, nested], filtered), new Set(), new Set(), true)
    expect(rows.map((row) => [row.sample.id, row.matches])).toEqual([
      ['parent', false],
      ['nested', true],
    ])
    const tree = buildSampleTree(records, [grandchild])
    expect(flattenSampleTree(tree, new Set(), new Set(['root']), true).map((row) => row.sample.id)).toEqual(['root'])
  })

  it('pages by root samples so a child stays on the parent page', () => {
    const tree = buildSampleTree(records, records)
    const page = sliceSampleRoots(tree, 1, 1)
    const rows = flattenSampleTree(page, new Set(['root', 'child']), new Set(), false)
    expect(rows.map((row) => row.sample.id)).toEqual(['root', 'child', 'grandchild'])
    expect(sliceSampleRoots(tree, 2, 1).map((node) => node.sample.id)).toEqual(['other'])
  })

  it('keeps an orphan visible and stops on a cycle', () => {
    const orphan = { ...child, parentId: 'missing' }
    expect(buildSampleTree([orphan], [orphan])[0].sample.id).toBe(orphan.id)
    const left = { ...root, id: 'a', parentId: 'b' }
    const right = { ...root, id: 'b', parentId: 'a' }
    expect(flattenSampleTree(buildSampleTree([left, right], [left, right]), new Set(['a', 'b']), new Set(), false)).toHaveLength(2)
  })
})
