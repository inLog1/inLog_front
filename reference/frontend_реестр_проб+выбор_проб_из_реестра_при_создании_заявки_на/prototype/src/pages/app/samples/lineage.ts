import type { Sample } from './model'

/** Check only selected records; an intermediate ancestor need not itself be selected. */
export function hasSelectedLineage(records: readonly Sample[], selected: readonly string[]): boolean {
  const selectedIds = new Set(selected)
  const byId = new Map(records.map(sample => [sample.id, sample]))
  return selected.some(id => {
    const sample = byId.get(id)
    if (sample?.linkedAncestorIds?.some(ancestor => selectedIds.has(ancestor))) return true
    let parentId = sample?.parentId
    const visited = new Set([id])
    while (parentId && !visited.has(parentId)) {
      if (selectedIds.has(parentId)) return true
      visited.add(parentId)
      parentId = byId.get(parentId)?.parentId
    }
    return false
  })
}
