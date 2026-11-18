import type { MockState } from '../../../app/mocks/db/types'
import { mayDeleteSample } from './access'
import { sampleTypeOf, type Sample } from './model'

/** Match the source marking and registration details; status and history are not identity. */
export function sampleFingerprint(item: Sample): string | null {
  if (!item.externalCode?.trim()) return null
  const values = [item.externalCode, item.parentId ?? '', sampleTypeOf(item), item.material, item.field, item.well, item.formation, item.interval, item.subsampleInterval ?? '', item.collectedAt, item.receivedAt, item.container, item.quantity, item.supplier, item.document, item.conditions, item.location]
  return JSON.stringify(values.map(value => value.trim().toLocaleLowerCase('ru')))
}

export function findRegistrationDuplicates(items: Sample[], existing: Sample[], organizationId: number): Set<number> {
  const seen = new Set(existing.filter(item => item.organizationId === organizationId && !item.deletedAt).map(sampleFingerprint).filter((key): key is string => key !== null))
  const duplicates = new Set<number>()
  items.forEach((item, index) => {
    const key = sampleFingerprint(item)
    if (!key) return
    if (seen.has(key)) duplicates.add(index)
    else seen.add(key)
  })
  return duplicates
}

/** Only remove unmodified, unattached exact copies; keep the oldest record. */
export function findSafeDuplicateIds(state: MockState, organizationId: number): string[] {
  const attached = new Set((state.sampleAttachments ?? []).filter(file => file.organizationId === organizationId).flatMap(file => file.sampleIds))
  const referenced = new Set((state.requests ?? []).flatMap(request => {
    const details = request.details
    if (!details) return []
    const meta = details.programMeta
    return [...details.sampleIds, ...details.needs.flatMap(need => need.sampleIds ?? []), ...(meta?.lines ?? []).flatMap(line => line.sampleIds ?? []), ...(meta?.approvedSnapshot?.lines ?? []).flatMap(line => line.sampleIds ?? [])]
  }))
  const parents = new Set((state.samples ?? []).filter(item => !item.deletedAt).map(item => item.parentId).filter(Boolean))
  const candidates = (state.samples ?? []).filter(item => item.organizationId === organizationId && !item.deletedAt && !item.parentId && !parents.has(item.id) && item.events.length === 1 && item.events[0].text.startsWith('Зарегистрировано поступление') && !attached.has(item.id) && !referenced.has(item.id))
  candidates.sort((a,b) => a.events[0].at.localeCompare(b.events[0].at) || a.code.localeCompare(b.code, 'ru', {numeric:true}))
  const groups = new Map<string, Sample[]>()
  for (const item of candidates) {
    const fingerprint = sampleFingerprint(item)
    if (!fingerprint) continue
    const key = JSON.stringify([fingerprint, item.stage, item.inspection, item.inspectionNote])
    const group = groups.get(key) ?? []
    group.push(item); groups.set(key, group)
  }
  return [...groups.values()].flatMap(group => group.slice(1).map(item => item.id))
}

export function removeSafeDuplicates(state: MockState, organizationId: number, userId: number | null, actor: string, at: string): MockState {
  if (!mayDeleteSample(state, userId, organizationId)) throw new Error('forbidden')
  const duplicateIds = new Set(findSafeDuplicateIds(state, organizationId))
  return { ...state, samples:(state.samples ?? []).map(item => duplicateIds.has(item.id) ? {...item, deletedAt:at, events:[...item.events, {at, actor:actor.trim() || undefined, text:'Повторная запись удалена из реестра'}]} : item) }
}
