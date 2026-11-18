import { isSampleType } from './catalog'
import { childSequenceFloor, formatChildSampleCode, formatRootSampleCode, registrationYear, rootSequenceFloor, sameSampleCode } from './codes'
import { displaySampleStage, displayWell, formatSampleDate, sampleTypeOf, withInheritedOrigin } from './origin'
import {
  SAMPLE_INSPECTIONS,
  SAMPLE_STAGES,
  type Sample,
  type SampleCodeCounters,
  type SampleInspection,
  type SampleStage,
} from './types'

export type ManualSampleInput = {
  sampleType?: string
  field: string
  well: string
  parentId?: string
  stage?: SampleStage
  receivedAt: string
  location: string
  inspection?: SampleInspection
  inspectionNote?: string
  subsampleInterval?: string
}

export type ManualSampleIssue = {
  field: string
  code: 'required' | 'invalid_type' | 'note' | 'subsample-interval'
}

const NEGATIVE_INSPECTION: readonly SampleInspection[] = ['С ограничениями', 'Не соответствует']

/**
 * Checks a manual registration before a number is issued.
 * A subsample leaves origin empty: those fields are copied from the parent at save time.
 */
export function inspectManualSample(input: ManualSampleInput): ManualSampleIssue[] {
  const issues: ManualSampleIssue[] = []
  const planned = input.stage === 'Запланирован отбор'
  if (!input.parentId) {
    if (!input.sampleType?.trim()) issues.push({ field: 'sampleType', code: 'required' })
    else if (!isSampleType(input.sampleType)) issues.push({ field: 'sampleType', code: 'invalid_type' })
    if (!input.field.trim()) issues.push({ field: 'field', code: 'required' })
    if (!displayWell(input.well)) issues.push({ field: 'well', code: 'required' })
  }
  if (input.subsampleInterval?.trim() && !input.parentId) {
    issues.push({ field: 'subsampleInterval', code: 'subsample-interval' })
  }
  if (!planned && !input.receivedAt.trim()) issues.push({ field: 'receivedAt', code: 'required' })
  if (!planned && !input.location.trim()) issues.push({ field: 'location', code: 'required' })
  if (input.inspection && NEGATIVE_INSPECTION.includes(input.inspection) && !input.inspectionNote?.trim()) {
    issues.push({ field: 'inspectionNote', code: 'note' })
  }
  return issues
}

export function isCurrentSampleStage(value: string): value is (typeof SAMPLE_STAGES)[number] {
  return (SAMPLE_STAGES as readonly string[]).includes(value)
}

export function isSampleInspection(value: string): value is SampleInspection {
  return (SAMPLE_INSPECTIONS as readonly string[]).includes(value)
}

/** Parent in the same organization, still in the registry, and not disposed. */
export function findAvailableParent(records: readonly Sample[], parentId: string, organizationId: number): Sample | undefined {
  const parent = records.find((record) => record.id === parentId && record.organizationId === organizationId && !record.deletedAt)
  if (!parent || parentId === '' || displaySampleStage(parent.stage) === 'Утилизирована') return undefined
  return parent
}

export function addSample(records: readonly Sample[], item: Sample): Sample[] {
  const planned = item.stage === 'Запланирован отбор'
  const hasType = Boolean(item.sampleType) || Boolean(item.material.trim())
  if (!item.code.trim() || !hasType || !item.field.trim() || !item.well.trim() || (!planned && (!item.receivedAt || !item.location.trim()))) {
    throw new Error('required')
  }
  if (item.subsampleInterval?.trim() && !item.parentId) throw new Error('subsample-interval')
  const duplicate = records.some((record) => !record.deletedAt && record.organizationId === item.organizationId && sameSampleCode(record.code, item.code))
  if (duplicate) throw new Error('duplicate')
  return [...records, item]
}

/**
 * Issues numbers for items whose parent, when set, is already in `records`.
 * A parent created in the same call is not visible to later rows.
 * Deleted numbers stay occupied. Records that are already stored keep their codes.
 */
export function registerSamples(
  records: readonly Sample[],
  counters: SampleCodeCounters,
  items: readonly Sample[],
  at: string,
): { records: Sample[]; counters: SampleCodeCounters } {
  const year = registrationYear(at)
  let last = rootSequenceFloor(records, counters, year)
  let next: Sample[] = [...records]
  for (const item of items) {
    if (next.some((record) => record.id === item.id)) throw new Error('duplicate-id')
    const parent = item.parentId ? findAvailableParent(records, item.parentId, item.organizationId) : undefined
    if (item.parentId && (!parent || item.parentId === item.id)) throw new Error('invalid-parent')
    let code: string
    if (parent) {
      if (sampleTypeOf(parent) === 'Не указан') throw new Error('invalid-parent-type')
      const suffix = childSequenceFloor(next, parent.code) + 1
      if (!Number.isSafeInteger(suffix)) throw new Error('counter-overflow')
      code = formatChildSampleCode(parent.code, suffix)
    } else {
      if (!Number.isSafeInteger(last + 1)) throw new Error('counter-overflow')
      last += 1
      code = formatRootSampleCode(Number(year), last)
    }
    const actor = item.events[0]?.actor
    const prepared = parent ? withInheritedOrigin({ ...item, code }, parent) : { ...item, code }
    next = addSample(next, {
      ...prepared,
      events: parent ? [...item.events, { at, actor, text: `Родительская проба: ${parent.code}` }] : item.events,
    })
    if (parent) {
      next = next.map((record) => record.id === parent.id
        ? { ...record, events: [...record.events, { at, actor, text: `Создана подпроба ${code}` }] }
        : record)
    }
  }
  return { records: next, counters: { ...counters, [year]: last } }
}

export function deleteSample(records: readonly Sample[], id: string, organizationId: number, at: string, actor: string): Sample[] {
  const hasActiveChildren = records.some((item) => !item.deletedAt && item.organizationId === organizationId && item.parentId === id)
  const active = records.some((item) => item.id === id && item.organizationId === organizationId && !item.deletedAt)
  if (hasActiveChildren && active) throw new Error('has-children')
  const removed = records.find((item) => item.id === id && item.organizationId === organizationId && !item.deletedAt)
  const name = actor.trim() || undefined
  return records.map((item) => {
    if (item.id === removed?.id) {
      return { ...item, deletedAt: at, events: [...item.events, { at, actor: name, text: 'Проба удалена из реестра' }] }
    }
    if (removed && item.id === removed.parentId && item.organizationId === organizationId) {
      return { ...item, events: [...item.events, { at, actor: name, text: `Подпроба ${removed.code} удалена из реестра` }] }
    }
    return item
  })
}

export function changeControl(
  records: readonly Sample[],
  id: string,
  organizationId: number,
  decision: SampleInspection,
  note: string,
  location: string,
  at: string,
  options: { stage?: SampleStage; actor?: string; receivedAt?: string } = {},
): Sample[] {
  if (NEGATIVE_INSPECTION.includes(decision) && !note.trim()) throw new Error('note')
  return records.map((item) => {
    if (item.id !== id || item.organizationId !== organizationId) return item
    const selectedStage = options.stage ?? item.stage
    const receivedAt = options.receivedAt ?? item.receivedAt
    if (selectedStage !== 'Запланирован отбор' && !location.trim()) throw new Error('location')
    if (selectedStage !== 'Запланирован отбор' && !receivedAt) throw new Error('receivedAt')
    if (options.stage && !isCurrentSampleStage(options.stage) && options.stage !== item.stage) throw new Error('stage')
    const events = [...item.events]
    const actor = options.actor?.trim() || undefined
    if (item.inspection !== decision) events.push({ at, actor, text: `Входной контроль: ${item.inspection} → ${decision}` })
    if (item.inspectionNote !== note) events.push({ at, actor, text: `Замечание: ${item.inspectionNote || 'не указано'} → ${note || 'не указано'}` })
    if (item.location !== location) events.push({ at, actor, text: `Местонахождение: ${item.location || 'не указано'} → ${location}` })
    if (item.receivedAt !== receivedAt) events.push({ at, actor, text: `Дата поступления: ${formatSampleDate(item.receivedAt)} → ${formatSampleDate(receivedAt)}` })
    if (options.stage && displaySampleStage(item.stage) !== displaySampleStage(options.stage)) {
      events.push({ at, actor, text: `Статус: ${displaySampleStage(item.stage) || 'не указан'} → ${displaySampleStage(options.stage)}` })
    }
    return { ...item, inspection: decision, inspectionNote: note, location, receivedAt, ...(options.stage ? { stage: options.stage } : {}), events }
  })
}
