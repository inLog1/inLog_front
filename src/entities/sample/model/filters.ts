import { displaySampleStage, sampleTypeOf } from './origin'
import type { Sample } from './types'

export const ALL_SAMPLE_TYPES = 'Все типы проб'
export const ALL_SAMPLE_STAGES = 'Все статусы проб'
export const ALL_SAMPLE_INSPECTIONS = 'Все заключения контроля'

export type SampleListFilters = {
  search: string
  /** Registry material, or `ALL_SAMPLE_TYPES`. This is not request `sampleTypeId`. */
  sampleType: string
  stage: string
  inspection: string
}

export type SampleListCounts = {
  sampleType: Map<string, number>
  stage: Map<string, number>
  inspection: Map<string, number>
}

function bump(map: Map<string, number>, label: string) {
  map.set(label, (map.get(label) ?? 0) + 1)
}

/**
 * Search, type, status and inspection over the rows the caller already loaded.
 * Counts for one facet ignore that facet and respect the other two, plus the search text.
 * Sorting follows the first history entry, so a late import stays above an older receipt date.
 */
export function filterSamples(samples: readonly Sample[], filters: SampleListFilters): { filtered: Sample[]; counts: SampleListCounts } {
  const counts: SampleListCounts = { sampleType: new Map(), stage: new Map(), inspection: new Map() }
  const query = filters.search.trim().toLocaleLowerCase('ru')
  const filtered: Sample[] = []
  for (const item of samples) {
    const sampleType = sampleTypeOf(item)
    const stage = displaySampleStage(item.stage) ?? 'Не указан'
    const parentCode = item.parentId ? samples.find((parent) => parent.id === item.parentId)?.code : ''
    const haystack = [item.code, item.externalCode, parentCode, sampleType, item.material, item.field, item.well, item.formation, item.container, item.location, item.supplier]
      .join(' ')
      .toLocaleLowerCase('ru')
    if (query && !haystack.includes(query)) continue
    const typeMatches = filters.sampleType === ALL_SAMPLE_TYPES || filters.sampleType === sampleType
    const stageMatches = filters.stage === ALL_SAMPLE_STAGES || filters.stage === stage
    const inspectionMatches = filters.inspection === ALL_SAMPLE_INSPECTIONS || filters.inspection === item.inspection
    if (stageMatches && inspectionMatches) {
      bump(counts.sampleType, ALL_SAMPLE_TYPES)
      bump(counts.sampleType, sampleType)
    }
    if (typeMatches && inspectionMatches) {
      bump(counts.stage, ALL_SAMPLE_STAGES)
      bump(counts.stage, stage)
    }
    if (typeMatches && stageMatches) {
      bump(counts.inspection, ALL_SAMPLE_INSPECTIONS)
      bump(counts.inspection, item.inspection)
    }
    if (typeMatches && stageMatches && inspectionMatches) filtered.push(item)
  }
  filtered.sort((left, right) => (right.events[0]?.at ?? '').localeCompare(left.events[0]?.at ?? '')
    || right.code.localeCompare(left.code, 'ru', { numeric: true }))
  return { filtered, counts }
}
