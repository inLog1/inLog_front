import type { Sample } from './model'

export type SampleTreeNode = { sample:Sample; matches:boolean; children:SampleTreeNode[] }
export type VisibleSampleTreeRow = { sample:Sample; matches:boolean; depth:number; hasChildren:boolean; expanded:boolean }

/** Include ancestors as context even when only a descendant matches the filters. */
export function buildSampleTree(records: readonly Sample[], matching: readonly Sample[]): SampleTreeNode[] {
  const byId = new Map(records.map(sample => [sample.id, sample]))
  const matched = new Set(matching.map(sample => sample.id))
  const included = new Set(matched)
  for (const item of matching) {
    const visited = new Set([item.id])
    let parent = item.parentId
    while (parent && byId.has(parent) && !visited.has(parent)) {
      included.add(parent); visited.add(parent); parent = byId.get(parent)?.parentId
    }
  }
  const nodes = new Map(records.filter(item => included.has(item.id)).map(sample => [sample.id, {sample, matches:matched.has(sample.id), children:[]} as SampleTreeNode]))
  const roots: SampleTreeNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.sample.parentId
    const parent = parentId ? nodes.get(parentId) : undefined
    let cursor = parentId
    const visited = new Set([node.sample.id])
    while (cursor && nodes.has(cursor) && !visited.has(cursor)) { visited.add(cursor); cursor = nodes.get(cursor)?.sample.parentId }
    if (parent && !(cursor && visited.has(cursor))) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function flattenSampleTree(roots: readonly SampleTreeNode[], expanded: ReadonlySet<string>, collapsed: ReadonlySet<string>, autoExpand: boolean): VisibleSampleTreeRow[] {
  const rows: VisibleSampleTreeRow[] = []
  const visit = (node:SampleTreeNode, depth:number) => {
    const hasChildren = node.children.length > 0
    const open = hasChildren && (expanded.has(node.sample.id) || (autoExpand && !collapsed.has(node.sample.id)))
    rows.push({sample:node.sample, matches:node.matches, depth, hasChildren, expanded:open})
    if (open) node.children.forEach(child => visit(child, depth + 1))
  }
  roots.forEach(root => visit(root, 0))
  return rows
}
