import { REQUEST_ENTITY_ID } from './study'

/** How many registry ids one need or programme line may store. */
export const REQUEST_LINE_SAMPLE_MAX = 1000

/**
 * Strict check for a write.
 * The caller passes the value only when the key is present.
 * An empty list is a saved choice of no samples.
 */
export function inspectLineSampleIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > REQUEST_LINE_SAMPLE_MAX) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !REQUEST_ENTITY_ID.test(id) || seen.has(id)) return null
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * Lenient read of a stored list.
 * A missing key stays missing, so an old row is not rewritten.
 * One invalid entry is dropped instead of discarding the whole row.
 */
export function readLineSampleIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !REQUEST_ENTITY_ID.test(id) || seen.has(id)) continue
    if (ids.length >= REQUEST_LINE_SAMPLE_MAX) break
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/** Absent and empty are the same composition. Order is part of the saved list. */
export function sameLineSampleIds(left?: readonly string[], right?: readonly string[]): boolean {
  const a = left ?? []
  const b = right ?? []
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/** A new array, or nothing when the row never stored a list. */
export function copiedSampleIds(ids?: readonly string[]): { sampleIds: string[] } | undefined {
  if (!ids) return undefined
  return { sampleIds: [...ids] }
}
