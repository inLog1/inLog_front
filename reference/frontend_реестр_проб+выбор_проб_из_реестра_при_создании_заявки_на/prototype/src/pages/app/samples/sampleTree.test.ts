import { describe, expect, it } from 'vitest'
import { demoSamples } from './model'
import { buildSampleTree, flattenSampleTree } from './sampleTree'

describe('sample tree in registry and picker', () => {
  const root = {...demoSamples[0], id:'root'}
  const child = {...root, id:'child', parentId:'root'}
  const grandchild = {...root, id:'grandchild', parentId:'child'}
  const other = {...root, id:'other'}
  const records = [grandchild, child, root, other]
  it('keeps descendants with their ancestor regardless of their order in the registry', () => {
    const tree = buildSampleTree(records, records)
    expect(tree.map(node => node.sample.id)).toEqual(['root','other'])
    expect(flattenSampleTree(tree, new Set(), new Set(), false).map(row => row.sample.id)).toEqual(['root','other'])
    expect(flattenSampleTree(tree, new Set(['root','child']), new Set(), false).map(row => [row.sample.id,row.depth])).toEqual([['root',0],['child',1],['grandchild',2],['other',0]])
  })
  it('keeps nonmatching ancestors for a matching descendant and opens the path during filtering', () => {
    const tree = buildSampleTree(records, [grandchild])
    const rows = flattenSampleTree(tree, new Set(), new Set(), true)
    expect(rows.map(row => [row.sample.id,row.matches])).toEqual([['root',false],['child',false],['grandchild',true]])
    expect(flattenSampleTree(tree, new Set(), new Set(['root']), true).map(row => row.sample.id)).toEqual(['root'])
  })
  it('keeps orphans visible and terminates on malformed cycles', () => {
    const orphan = {...child, parentId:'missing'}
    expect(buildSampleTree([orphan], [orphan])[0].sample.id).toBe(orphan.id)
    const a = {...root, id:'a', parentId:'b'}, b = {...root, id:'b', parentId:'a'}
    expect(flattenSampleTree(buildSampleTree([a,b],[a,b]), new Set(['a','b']), new Set(), false)).toHaveLength(2)
  })
})
