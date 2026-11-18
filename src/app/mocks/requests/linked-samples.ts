import {
  displaySampleInterval,
  displaySampleStage,
  displayWell,
  sampleTypeOf,
  type Sample,
} from '../../../entities/sample'
import type { RequestLinkedSample } from '../../../entities/request/model/linked-samples'

/**
 * Current rows for ids the request already stored.
 * An approved snapshot keeps those ids and is not a second copy of these fields.
 * A name as it was on the approval day needs an explicit copy of this projection at approval time.
 */
export function projectLinkedSamples(
  records: readonly Sample[],
  linkedIds: readonly string[],
  partyOrganizationIds: readonly number[],
): RequestLinkedSample[] {
  const allowed = new Set(linkedIds)
  const parties = new Set(partyOrganizationIds)
  const byId = new Map<string, Sample>()
  for (const sample of records) {
    if (!allowed.has(sample.id) || !parties.has(sample.organizationId) || byId.has(sample.id)) continue
    byId.set(sample.id, sample)
  }
  return linkedIds.flatMap((id) => {
    const sample = byId.get(id)
    return sample ? [projectOne(sample, allowed)] : []
  })
}

function projectOne(sample: Sample, linkedIds: ReadonlySet<string>): RequestLinkedSample {
  const interval = displaySampleInterval(sample)
  const parentId = sample.parentId && linkedIds.has(sample.parentId) ? sample.parentId : undefined
  return {
    id: sample.id,
    organizationId: sample.organizationId,
    code: sample.code,
    sampleType: sampleTypeOf(sample),
    externalCode: sample.externalCode ?? '',
    field: sample.field,
    well: displayWell(sample.well),
    formation: sample.formation,
    interval: interval.value,
    intervalInherited: interval.inherited,
    stage: displaySampleStage(sample.stage) ?? '',
    inspection: sample.inspection,
    deleted: Boolean(sample.deletedAt),
    ...(parentId ? { parentId } : {}),
  }
}
