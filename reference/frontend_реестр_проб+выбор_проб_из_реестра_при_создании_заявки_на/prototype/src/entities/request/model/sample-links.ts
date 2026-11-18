import { REQUEST_ENTITY_ID } from './study'

export const REQUEST_LINE_SAMPLE_MAX = 1000

export function inspectLineSampleIds(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > REQUEST_LINE_SAMPLE_MAX) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !REQUEST_ENTITY_ID.test(id) || seen.has(id)) return null
    seen.add(id); ids.push(id)
  }
  return ids
}
