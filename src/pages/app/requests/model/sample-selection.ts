import type { RequestLinkedSample } from '../../../../entities/request'
import {
  displaySampleInterval,
  displaySampleStage,
  displayWell,
  hasSelectedLineage,
  isSampleInspection,
  isSampleType,
  kindForSampleType,
  sampleTypeOf,
  SAMPLE_STAGES,
  type Sample,
  type SampleInspection,
  type SampleStage,
} from '../../../../entities/sample'

/**
 * Registry material and the request sample type are different catalogues.
 * Depth / surface / separator is `sampleTypeId` on the request.
 * Core / oil / gas / water / condensate / other is the registry type.
 * Nothing here maps one list onto the other.
 */
export const REGISTRY_MATERIAL_LIMITS_REQUEST_TYPE = false

export type SamplePickFilters = {
  search: string
  /** Empty means every selectable status. */
  stage: string
  /** Empty means every inspection result. */
  inspection: string
}

export type StudyObjectName = {
  field: string
  well: string
}

export type LinkedSampleState =
  | { kind: 'ready'; sample: Sample }
  | { kind: 'disposed'; sample: Sample }
  | { kind: 'deleted'; sample: Sample }
  | { kind: 'missing' }

const WARNING_INSPECTIONS = new Set<SampleInspection>(['Не проведён', 'С ограничениями', 'Не соответствует'])

/**
 * The picker may query only the organization the caller already names,
 * and only when this session may read that organization's registry.
 * Live mode has no sample API. A party to the request is not a second argument:
 * the other organization's registry is not requested from here.
 */
export function sampleRegistryRequest(input: {
  apiMode: string | undefined
  organizationId: number | null
  canRead: boolean
}): { organizationId: number; includeDeleted: true } | null {
  if (input.apiMode !== 'mock') return null
  if (input.organizationId == null || !input.canRead) return null
  return { organizationId: input.organizationId, includeDeleted: true }
}

export function samplesKeptForPicker(records: readonly Sample[]): Sample[] {
  return records.filter((sample) => !sample.deletedAt)
}

/** Rows the user may add. Deleted and disposed records stay out of this set. Planned rows stay in. */
export function selectableSamples(records: readonly Sample[], filters: SamplePickFilters): Sample[] {
  const query = filters.search.trim().toLocaleLowerCase('ru')
  const stage = filters.stage.trim()
  const inspection = filters.inspection.trim()
  return records.filter((sample) => {
    if (sample.deletedAt) return false
    if (displaySampleStage(sample.stage) === 'Утилизирована') return false
    if (stage && displaySampleStage(sample.stage) !== stage) return false
    if (inspection && sample.inspection !== inspection) return false
    if (!query) return true
    return searchText(sample, records).includes(query)
  })
}

export function selectableSampleIds(records: readonly Sample[], filters: SamplePickFilters): string[] {
  return selectableSamples(records, filters).map((sample) => sample.id)
}

/** Toggles one id. A parent id does not add or remove its children. */
export function toggleSampleId(selected: readonly string[], sampleId: string): string[] {
  return selected.includes(sampleId) ? selected.filter((id) => id !== sampleId) : [...selected, sampleId]
}

/**
 * Adds or removes every id that matches the current filters.
 * The caller must pass the filtered ids, not the rows currently expanded on screen.
 */
export function toggleFoundSamples(selected: readonly string[], foundIds: readonly string[]): string[] {
  if (foundIds.length === 0) return [...selected]
  const found = new Set(foundIds)
  const allSelected = foundIds.every((id) => selected.includes(id))
  if (allSelected) return selected.filter((id) => !found.has(id))
  return [...new Set([...selected, ...foundIds])]
}

export function classifyLinkedSample(sampleId: string, records: readonly Sample[]): LinkedSampleState {
  const sample = records.find((item) => item.id === sampleId)
  if (!sample) return { kind: 'missing' }
  if (sample.deletedAt) return { kind: 'deleted', sample }
  if (displaySampleStage(sample.stage) === 'Утилизирована') return { kind: 'disposed', sample }
  return { kind: 'ready', sample }
}

export function inspectionWarnings(sampleIds: readonly string[], records: readonly Sample[]): Array<{
  sampleId: string
  code: string
  inspection: SampleInspection
  note: string
}> {
  const warnings: Array<{ sampleId: string; code: string; inspection: SampleInspection; note: string }> = []
  for (const sampleId of sampleIds) {
    const state = classifyLinkedSample(sampleId, records)
    if (state.kind !== 'ready' && state.kind !== 'disposed') continue
    if (!WARNING_INSPECTIONS.has(state.sample.inspection)) continue
    warnings.push({
      sampleId,
      code: state.sample.code,
      inspection: state.sample.inspection,
      note: state.sample.inspectionNote.trim(),
    })
  }
  return warnings
}

export function selectionHasLineage(sampleIds: readonly string[], records: readonly Sample[]): boolean {
  return hasSelectedLineage(records, sampleIds)
}

/**
 * Name comparison only. Registry rows have no catalogue field or well id.
 * A blank name on either side is not a mismatch.
 */
export function sampleOriginMismatch(sample: Pick<Sample, 'field' | 'well'>, objects: readonly StudyObjectName[]): boolean {
  const field = normalizeName(sample.field)
  const well = normalizeName(displayWell(sample.well))
  if (!field || !well) return false
  const known = objects.flatMap((item) => {
    const objectField = normalizeName(item.field)
    const objectWell = normalizeName(displayWell(item.well))
    return objectField && objectWell ? [{ field: objectField, well: objectWell }] : []
  })
  if (known.length === 0) return false
  return !known.some((item) => item.field === field && item.well === well)
}

/** Saved ids that are not in the caller's own registry. They stay on the row. */
export function idsOutsideRegistry(savedIds: readonly string[], registryIds: readonly string[]): string[] {
  const own = new Set(registryIds)
  return savedIds.filter((id) => !own.has(id))
}

const LEGACY_STAGES = ['Входной контроль', 'В исследовании', 'Исследование завершено', 'Передана'] as const

function stageOf(value: string): SampleStage | undefined {
  if ((SAMPLE_STAGES as readonly string[]).includes(value)) return value as SampleStage
  if ((LEGACY_STAGES as readonly string[]).includes(value)) return value as SampleStage
  return undefined
}

/**
 * A projection is enough for warnings and for a row the caller cannot open.
 * Inspection notes are not on the projection, so this record does not invent one.
 * The result is not a registry card and is not offered as a new choice.
 */
export function linkedProjectionRecord(item: RequestLinkedSample): Sample {
  const sampleType = isSampleType(item.sampleType) ? item.sampleType : undefined
  const stage = stageOf(item.stage)
  return {
    id: item.id,
    organizationId: item.organizationId,
    code: item.code,
    externalCode: item.externalCode,
    ...(item.parentId ? { parentId: item.parentId } : {}),
    kind: sampleType ? kindForSampleType(sampleType) : 'Керн',
    material: '',
    ...(sampleType ? { sampleType } : {}),
    field: item.field,
    well: item.well,
    formation: item.formation,
    interval: item.interval,
    collectedAt: '',
    receivedAt: '',
    container: '',
    quantity: '',
    supplier: '',
    document: '',
    conditions: '',
    location: '',
    inspection: isSampleInspection(item.inspection) ? item.inspection : 'Не проведён',
    inspectionNote: '',
    ...(stage ? { stage } : {}),
    events: [],
    ...(item.deleted ? { deletedAt: 'retained' } : {}),
  }
}

/** Own registry rows plus projections the registry does not already contain. */
export function samplesForRequestWarnings(
  registry: readonly Sample[],
  linked: readonly RequestLinkedSample[],
): Sample[] {
  const own = new Set(registry.map((sample) => sample.id))
  return [...registry, ...linked.filter((item) => !own.has(item.id)).map(linkedProjectionRecord)]
}

export type RequestSampleCard = {
  id: string
  code: string
  sampleType: string
  externalCode: string
  field: string
  well: string
  formation: string
  interval: string
  intervalInherited: boolean
  stage?: SampleStage
  inspection: SampleInspection
  inspectionNote: string
  deleted: boolean
  openable: boolean
  parentId?: string
}

export type ResolvedRequestSample =
  | { kind: 'pending' | 'unresolved' | 'missing' }
  | { kind: 'record'; card: RequestSampleCard }

/**
 * A sample in the caller's registry stays a normal registry row.
 * A sample only known through the request uses the limited projection and cannot be opened.
 * A missing registry is not a reason to drop the saved id.
 */
export function resolveRequestSample(input: {
  sampleId: string
  organizationId: number
  registryRecords: readonly Sample[]
  registryPending: boolean
  registryFailed: boolean
  registryAvailable: boolean
  linkedEnabled: boolean
  linkedRecords: readonly RequestLinkedSample[]
  linkedPending: boolean
  linkedFailed: boolean
}): ResolvedRequestSample {
  const own = input.registryRecords.find((sample) => sample.id === input.sampleId && sample.organizationId === input.organizationId)
  if (own) return { kind: 'record', card: cardFromRegistry(own) }
  if (input.linkedEnabled) {
    if (input.linkedPending) return { kind: 'pending' }
    const linked = input.linkedRecords.find((sample) => sample.id === input.sampleId)
    if (linked) return { kind: 'record', card: cardFromProjection(linked) }
  }
  if (input.registryPending && input.registryRecords.length === 0) return { kind: 'pending' }
  if (input.registryFailed || !input.registryAvailable || (input.linkedEnabled && input.linkedFailed)) return { kind: 'unresolved' }
  return { kind: 'missing' }
}

function cardFromRegistry(sample: Sample): RequestSampleCard {
  const interval = displaySampleInterval(sample)
  return {
    id: sample.id,
    code: sample.code,
    sampleType: sampleTypeOf(sample),
    externalCode: sample.externalCode ?? '',
    field: sample.field,
    well: displayWell(sample.well),
    formation: sample.formation,
    interval: interval.value,
    intervalInherited: interval.inherited,
    stage: sample.stage,
    inspection: sample.inspection,
    inspectionNote: sample.inspectionNote.trim(),
    deleted: Boolean(sample.deletedAt),
    openable: true,
    ...(sample.parentId ? { parentId: sample.parentId } : {}),
  }
}

function cardFromProjection(item: RequestLinkedSample): RequestSampleCard {
  const stage = stageOf(item.stage)
  return {
    id: item.id,
    code: item.code,
    sampleType: item.sampleType,
    externalCode: item.externalCode,
    field: item.field,
    well: item.well,
    formation: item.formation,
    interval: item.interval,
    intervalInherited: item.intervalInherited,
    ...(stage ? { stage } : {}),
    inspection: isSampleInspection(item.inspection) ? item.inspection : 'Не проведён',
    inspectionNote: '',
    deleted: item.deleted,
    openable: false,
    ...(item.parentId ? { parentId: item.parentId } : {}),
  }
}

export function originMismatchIds(
  sampleIds: readonly string[],
  records: readonly Sample[],
  objects: readonly StudyObjectName[],
): string[] {
  return sampleIds.filter((sampleId) => {
    const state = classifyLinkedSample(sampleId, records)
    if (state.kind !== 'ready' && state.kind !== 'disposed') return false
    return sampleOriginMismatch(state.sample, objects)
  })
}

function searchText(sample: Sample, records: readonly Sample[]): string {
  const interval = displaySampleInterval(sample)
  const parent = sample.parentId ? records.find((item) => item.id === sample.parentId)?.code : ''
  return [
    sample.code,
    sample.externalCode,
    parent,
    sampleTypeOf(sample),
    sample.material,
    sample.field,
    displayWell(sample.well),
    sample.formation,
    interval.value,
    sample.interval,
    sample.subsampleInterval,
    displaySampleStage(sample.stage),
    sample.inspection,
  ].join(' ').toLocaleLowerCase('ru')
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')
}
