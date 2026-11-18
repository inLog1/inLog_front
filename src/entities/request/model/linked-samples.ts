import type { RequestDraftDetails } from './draft'
import { readProgramMeta } from './program'

/**
 * Limited view of a sample already stored on one request.
 * This is not a sample card. Inspection notes, history, files and location stay out:
 * this stage has no owner-controlled grant for those fields.
 * `parentId` is set only when that parent is also linked to the same request.
 * `organizationId` says which party owns the row so the client does not open another registry.
 */
export type RequestLinkedSample = {
  id: string
  organizationId: number
  code: string
  sampleType: string
  externalCode: string
  field: string
  well: string
  formation: string
  interval: string
  intervalInherited: boolean
  stage: string
  inspection: string
  deleted: boolean
  parentId?: string
}

export type RequestLinkedSamplesResponse = {
  samples: RequestLinkedSample[]
}

/**
 * Ids on the current needs and the current programme lines.
 * These are the links a later write may keep without a new assignment check.
 * An id that is present only in the approved snapshot is not in this set.
 */
export function requestActiveSampleLinkIds(details: RequestDraftDetails | null | undefined): string[] {
  if (!details) return []
  const meta = readProgramMeta(details.programMeta)
  return uniqueIds([
    ...(details.needs ?? []).flatMap((need) => need.sampleIds ?? []),
    ...meta.lines.flatMap((line) => line.sampleIds ?? []),
  ])
}

/**
 * Ids kept for reading a request and the samples linked to it.
 * Needs, the current programme lines, and the approved snapshot are included.
 * The snapshot stays after later edits. It is not permission to assign the id again:
 * a new assignment uses `requestActiveSampleLinkIds`.
 * A client-supplied list is not an input. Legacy catalogue `details.sampleIds` is not a registry link.
 * The snapshot is a copy of ids. It does not freeze sample names; that would be a separate projection copy taken at approval.
 */
export function requestLinkedSampleIds(details: RequestDraftDetails | null | undefined): string[] {
  if (!details) return []
  const meta = readProgramMeta(details.programMeta)
  return uniqueIds([
    ...requestActiveSampleLinkIds(details),
    ...(meta.approvedSnapshot?.lines ?? []).flatMap((line) => line.sampleIds ?? []),
  ])
}

function uniqueIds(values: readonly string[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const id of values) {
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}
