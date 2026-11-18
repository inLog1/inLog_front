import type { Sample } from './types'

export const SAMPLE_ROOT_PAGE_SIZES = [15, 25, 35] as const

export type SampleRootPageSize = (typeof SAMPLE_ROOT_PAGE_SIZES)[number]

export type SampleTreeNode = {
  sample: Sample
  matches: boolean
  children: SampleTreeNode[]
}

export type VisibleSampleTreeRow = {
  sample: Sample
  matches: boolean
  depth: number
  hasChildren: boolean
  expanded: boolean
}

/** Ancestors of a match stay in the tree so a found subsample keeps its parent context. */
export function buildSampleTree(records: readonly Sample[], matching: readonly Sample[]): SampleTreeNode[] {
  const byId = new Map(records.map((sample) => [sample.id, sample]))
  const matched = new Set(matching.map((sample) => sample.id))
  const included = new Set(matched)
  for (const item of matching) {
    const visited = new Set([item.id])
    let parent = item.parentId
    while (parent && byId.has(parent) && !visited.has(parent)) {
      included.add(parent)
      visited.add(parent)
      parent = byId.get(parent)?.parentId
    }
  }
  const nodes = new Map(records.filter((item) => included.has(item.id)).map((sample) => [
    sample.id,
    { sample, matches: matched.has(sample.id), children: [] as SampleTreeNode[] },
  ]))
  const roots: SampleTreeNode[] = []
  for (const node of nodes.values()) {
    const parentId = node.sample.parentId
    const parent = parentId ? nodes.get(parentId) : undefined
    let cursor = parentId
    const visited = new Set([node.sample.id])
    while (cursor && nodes.has(cursor) && !visited.has(cursor)) {
      visited.add(cursor)
      cursor = nodes.get(cursor)?.sample.parentId
    }
    const cycle = Boolean(cursor && visited.has(cursor))
    if (parent && !cycle) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function flattenSampleTree(
  roots: readonly SampleTreeNode[],
  expanded: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
  autoExpand: boolean,
): VisibleSampleTreeRow[] {
  const rows: VisibleSampleTreeRow[] = []
  const visit = (node: SampleTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0
    const open = hasChildren && (expanded.has(node.sample.id) || (autoExpand && !collapsed.has(node.sample.id)))
    rows.push({ sample: node.sample, matches: node.matches, depth, hasChildren, expanded: open })
    if (open) node.children.forEach((child) => visit(child, depth + 1))
  }
  roots.forEach((root) => visit(root, 0))
  return rows
}

export function sampleRootPageCount(rootCount: number, pageSize: number): number {
  const size = pageSize < 1 ? 1 : pageSize
  return Math.max(1, Math.ceil(rootCount / size))
}

/**
 * Pages by root samples. The caller flattens each returned root with its children,
 * so a group is not split across pages.
 */
export function sliceSampleRoots<T>(roots: readonly T[], page: number, pageSize: number): readonly T[] {
  const size = pageSize < 1 ? 1 : pageSize
  const pages = sampleRootPageCount(roots.length, size)
  const current = Math.min(Math.max(page, 1), pages)
  const start = (current - 1) * size
  return roots.slice(start, start + size)
}
