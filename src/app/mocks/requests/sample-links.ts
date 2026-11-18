import { displaySampleStage, type Sample } from '../../../entities/sample'

/** One code for every rejected new link. The body does not say whether the row exists. */
export const SAMPLE_LINK_DENIED = 'sample_link_denied'

/**
 * Ids the caller wants that this request did not already store.
 * Membership of the incoming list is not evidence of an earlier link.
 * The stored list has to be read from the request before this operation.
 */
export function addedSampleLinkIds(storedIds: readonly string[], nextIds: readonly string[]): string[] {
  const stored = new Set(storedIds)
  const added: string[] = []
  const seen = new Set<string>()
  for (const id of nextIds) {
    if (stored.has(id) || seen.has(id)) continue
    seen.add(id)
    added.push(id)
  }
  return added
}

/**
 * A new registry link may be added only from the caller's own organization,
 * and only when that caller may read that registry.
 * An id already in `storedIds` stays. Disposal, logical deletion and a missing
 * row do not remove it, and they do not make that stored id addable again later.
 * `storedIds` are the current needs and programme lines. An approved snapshot is
 * not a stored link: an id that exists only there is a new assignment.
 * Sample type is not compared: this check is only about which row may be linked.
 */
export function sampleLinksAllowed(input: {
  samples: readonly Sample[]
  storedIds: readonly string[]
  nextIds: readonly string[]
  actorOrganizationId: number
  canReadOwnRegistry: boolean
}): boolean {
  const added = addedSampleLinkIds(input.storedIds, input.nextIds)
  if (added.length === 0) return true
  if (!input.canReadOwnRegistry) return false
  const byId = indexSamples(input.samples)
  return added.every((id) => activeOwnSample(byId.get(id), input.actorOrganizationId))
}

/**
 * Ids a derived draft may keep on a need.
 * The new request does not inherit the source request's links.
 * Nothing is kept when another organization files the draft, or when this
 * organization cannot read its own registry.
 * Otherwise each id has to exist, belong to this organization, and still be active.
 * A missing, deleted, or disposed row is dropped. Order of the ids that remain is kept.
 */
export function derivedSampleLinkIds(input: {
  samples: readonly Sample[]
  ids: readonly string[]
  sameOrganization: boolean
  actorOrganizationId: number
  canReadOwnRegistry: boolean
}): string[] {
  if (!input.sameOrganization || !input.canReadOwnRegistry) return []
  const byId = indexSamples(input.samples)
  return input.ids.filter((id) => activeOwnSample(byId.get(id), input.actorOrganizationId))
}

function indexSamples(samples: readonly Sample[]): Map<string, Sample> {
  const byId = new Map<string, Sample>()
  for (const sample of samples) {
    if (!byId.has(sample.id)) byId.set(sample.id, sample)
  }
  return byId
}

function activeOwnSample(sample: Sample | undefined, actorOrganizationId: number): boolean {
  if (!sample || sample.organizationId !== actorOrganizationId) return false
  if (sample.deletedAt) return false
  if (displaySampleStage(sample.stage) === 'Утилизирована') return false
  return true
}
