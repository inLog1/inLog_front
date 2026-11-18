import { displaySampleStage, sampleTypeOf, type Sample } from './model'

export const ALL_TYPES = 'Все типы проб'
export const ALL_STAGES = 'Все статусы проб'
export const ALL_INSPECTIONS = 'Все заключения контроля'

export function filterSamples(samples: Sample[], filters: { search: string; kind: string; stage: string; inspection: string }) {
  const counts = { kind:new Map<string, number>(), stage:new Map<string, number>(), inspection:new Map<string, number>() }
  const increment = (map: Map<string, number>, label: string) => map.set(label, (map.get(label) ?? 0) + 1)
  const query = filters.search.trim().toLocaleLowerCase('ru')
  const filtered: Sample[] = []
  for (const item of samples) {
    const kind = sampleTypeOf(item)
    const stage = displaySampleStage(item.stage) ?? 'Не указан'
    const parentCode = item.parentId ? samples.find(parent => parent.id === item.parentId)?.code : ''
    const matchesSearch = [item.code, item.externalCode, parentCode, kind, item.material, item.field, item.well, item.formation, item.container, item.location, item.supplier].join(' ').toLocaleLowerCase('ru').includes(query)
    if (!matchesSearch) continue
    const kindMatches = filters.kind === ALL_TYPES || filters.kind === kind
    const stageMatches = filters.stage === ALL_STAGES || filters.stage === stage
    const inspectionMatches = filters.inspection === ALL_INSPECTIONS || filters.inspection === item.inspection
    if (stageMatches && inspectionMatches) { increment(counts.kind, ALL_TYPES); increment(counts.kind, kind) }
    if (kindMatches && inspectionMatches) { increment(counts.stage, ALL_STAGES); increment(counts.stage, stage) }
    if (kindMatches && stageMatches) { increment(counts.inspection, ALL_INSPECTIONS); increment(counts.inspection, item.inspection) }
    if (kindMatches && stageMatches && inspectionMatches) filtered.push(item)
  }
  // Receipt dates can predate registration by months; recent imports must remain visible.
  filtered.sort((left, right) => (right.events[0]?.at ?? '').localeCompare(left.events[0]?.at ?? '') || right.code.localeCompare(left.code, 'ru', { numeric:true }))
  return { filtered, counts }
}
