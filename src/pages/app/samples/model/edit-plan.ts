import {
  displaySampleStage,
  isSampleInspection,
  type Sample,
  type SampleInspection,
} from '../../../../entities/sample'

const NOTE_REQUIRED: readonly SampleInspection[] = ['С ограничениями', 'Не соответствует']

export const SAMPLE_LOCATION_ROOMS = [
  { id: 'intake', value: 'Зона приёмки проб' },
  { id: 'control', value: 'Зона входного контроля' },
  { id: 'storage', value: 'Помещение хранения' },
  { id: 'lab', value: 'Лаборатория' },
] as const

export type SampleLocationChoice = {
  choice: string
  other: string
  details: string
}

export type SampleEditDraft = {
  stage: string
  inspection: string
  inspectionNote: string
  location: string
  receivedAt: string
}

export type SampleEditIssue = 'inspectionNote' | 'location' | 'receivedAt'

export type SampleEditCall =
  | { kind: 'status'; stage: string; location?: string; receivedAt?: string }
  | { kind: 'place'; location: string; receivedAt: string }
  | { kind: 'inspection'; inspection: string; inspectionNote: string }

export type SampleEditPlan =
  | { ok: false; issue: SampleEditIssue }
  | { ok: true; calls: SampleEditCall[] }

export function splitSampleLocation(value: string): { room: string; details: string } {
  const [head, ...rest] = value.split(',')
  return { room: head.trim(), details: rest.join(',').trim() }
}

export function joinSampleLocation(room: string, details: string): string {
  return [room.trim(), details.trim()].filter(Boolean).join(', ')
}

export function sampleLocationChoice(value: string): SampleLocationChoice {
  const { room, details } = splitSampleLocation(value)
  const known = SAMPLE_LOCATION_ROOMS.find((item) => item.value === room)
  if (!room) return { choice: '__none__', other: '', details }
  if (known) return { choice: known.id, other: '', details }
  return { choice: `custom:${room}`, other: '', details }
}

export function sampleLocationText(choice: SampleLocationChoice): string {
  if (choice.choice === '__none__') return joinSampleLocation('', choice.details)
  if (choice.choice === '__other__') return joinSampleLocation(choice.other, choice.details)
  const known = SAMPLE_LOCATION_ROOMS.find((item) => item.id === choice.choice)
  if (known) return joinSampleLocation(known.value, choice.details)
  if (choice.choice.startsWith('custom:')) return joinSampleLocation(choice.choice.slice('custom:'.length), choice.details)
  return joinSampleLocation('', choice.details)
}

export function sampleEditDraft(sample: Sample): SampleEditDraft {
  return {
    stage: displaySampleStage(sample.stage) ?? '',
    inspection: sample.inspection,
    inspectionNote: sample.inspectionNote,
    location: sample.location,
    receivedAt: sample.receivedAt,
  }
}

/**
 * One save compares the draft with the stored sample.
 * An unchanged field is omitted, so the API is not asked to write an empty event.
 * A planned sample does not require a receipt date or a place.
 */
export function planSampleEdit(sample: Sample, draft: SampleEditDraft): SampleEditPlan {
  const stage = draft.stage.trim()
  const inspection = draft.inspection.trim()
  const note = draft.inspectionNote.trim()
  const location = draft.location.trim()
  const receivedAt = stage === 'Запланирован отбор' ? sample.receivedAt.trim() : draft.receivedAt.trim()
  const planned = stage === 'Запланирован отбор'
  if (isSampleInspection(inspection) && NOTE_REQUIRED.includes(inspection) && !note) {
    return { ok: false, issue: 'inspectionNote' }
  }
  if (!planned && !location) return { ok: false, issue: 'location' }
  if (!planned && !receivedAt) return { ok: false, issue: 'receivedAt' }

  const calls: SampleEditCall[] = []
  const currentStage = displaySampleStage(sample.stage) ?? ''
  const stageChanged = stage !== '' && stage !== currentStage
  const locationChanged = location !== sample.location.trim()
  const receivedChanged = receivedAt !== sample.receivedAt.trim()
  const inspectionChanged = inspection !== sample.inspection || note !== sample.inspectionNote.trim()
  if (stageChanged) {
    calls.push({
      kind: 'status',
      stage,
      ...(locationChanged ? { location } : {}),
      ...(receivedChanged ? { receivedAt } : {}),
    })
  } else if (locationChanged || receivedChanged) {
    calls.push({ kind: 'place', location, receivedAt })
  }
  if (inspectionChanged) calls.push({ kind: 'inspection', inspection, inspectionNote: note })
  return { ok: true, calls }
}
