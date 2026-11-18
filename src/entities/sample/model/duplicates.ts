import { sampleTypeOf } from './origin'
import type { Sample } from './types'

export type SampleUsage = {
  /** Samples that already have a file link. */
  attachedSampleIds?: readonly string[]
  /** Samples already stored on a request. The request model is not imported here. */
  referencedSampleIds?: readonly string[]
}

/** Marking plus registration details. Status and history are not part of the fingerprint. */
export function sampleFingerprint(item: Sample): string | null {
  if (!item.externalCode?.trim()) return null
  const values = [
    item.externalCode,
    item.parentId ?? '',
    sampleTypeOf(item),
    item.material,
    item.field,
    item.well,
    item.formation,
    item.interval,
    item.subsampleInterval ?? '',
    item.collectedAt,
    item.receivedAt,
    item.container,
    item.quantity,
    item.supplier,
    item.document,
    item.conditions,
    item.location,
  ]
  return JSON.stringify(values.map((value) => value.trim().toLocaleLowerCase('ru')))
}

/** Indexes of `items` that repeat an active sample of the same organization, or an earlier row of this batch. */
export function findRegistrationDuplicates(items: readonly Sample[], existing: readonly Sample[], organizationId: number): Set<number> {
  const seen = new Set(
    existing
      .filter((item) => item.organizationId === organizationId && !item.deletedAt)
      .map(sampleFingerprint)
      .filter((key): key is string => key !== null),
  )
  const duplicates = new Set<number>()
  items.forEach((item, index) => {
    const key = sampleFingerprint(item)
    if (!key) return
    if (seen.has(key)) duplicates.add(index)
    else seen.add(key)
  })
  return duplicates
}

/**
 * Later exact copies that were never edited, linked, referenced, or used as a parent.
 * The oldest row of each group stays. Rows without an original marking are not compared.
 */
export function findSafeDuplicateIds(samples: readonly Sample[], organizationId: number, usage: SampleUsage = {}): string[] {
  const blocked = new Set([...(usage.attachedSampleIds ?? []), ...(usage.referencedSampleIds ?? [])])
  const parents = new Set(samples.filter((item) => !item.deletedAt).map((item) => item.parentId).filter((id): id is string => Boolean(id)))
  const candidates = samples.filter((item) => item.organizationId === organizationId
    && !item.deletedAt
    && !item.parentId
    && !parents.has(item.id)
    && item.events.length === 1
    && item.events[0].text.startsWith('Зарегистрировано поступление')
    && !blocked.has(item.id))
  const ordered = [...candidates].sort((left, right) => left.events[0].at.localeCompare(right.events[0].at)
    || left.code.localeCompare(right.code, 'ru', { numeric: true }))
  const groups = new Map<string, Sample[]>()
  for (const item of ordered) {
    const fingerprint = sampleFingerprint(item)
    if (!fingerprint) continue
    const key = JSON.stringify([fingerprint, item.stage, item.inspection, item.inspectionNote])
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap((group) => group.slice(1).map((item) => item.id))
}

/** Soft-deletes the ids `findSafeDuplicateIds` returns. Does not decide who is allowed to delete. */
export function deleteSafeDuplicates(
  samples: readonly Sample[],
  organizationId: number,
  at: string,
  actor: string,
  usage: SampleUsage = {},
): Sample[] {
  const duplicateIds = new Set(findSafeDuplicateIds(samples, organizationId, usage))
  const name = actor.trim() || undefined
  return samples.map((item) => duplicateIds.has(item.id)
    ? { ...item, deletedAt: at, events: [...item.events, { at, actor: name, text: 'Повторная запись удалена из реестра' }] }
    : item)
}
