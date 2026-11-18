import { describe, expect, it } from 'vitest'
import { makeSample } from '../../../../entities/sample/model/fixture'
import {
  joinSampleLocation,
  planSampleEdit,
  sampleEditDraft,
  sampleLocationChoice,
  sampleLocationText,
} from './edit-plan'

function draftOf(sample: ReturnType<typeof makeSample>, patch: Partial<ReturnType<typeof sampleEditDraft>> = {}) {
  return { ...sampleEditDraft(sample), ...patch }
}

function savedCalls(sample: ReturnType<typeof makeSample>, draft: ReturnType<typeof sampleEditDraft>) {
  const plan = planSampleEdit(sample, draft)
  if (!plan.ok) throw new Error(plan.issue)
  return plan.calls
}

describe('sample card edit plan', () => {
  it('does not call the API when nothing changed', () => {
    const sample = makeSample()
    expect(planSampleEdit(sample, draftOf(sample))).toEqual({ ok: true, calls: [] })
    expect(savedCalls(sample, draftOf(sample, { inspectionNote: `${sample.inspectionNote} ` }))).toEqual([])
  })

  it('requires a note for a restricted or rejected inspection', () => {
    const sample = makeSample({ inspection: 'Соответствует', inspectionNote: '' })
    expect(planSampleEdit(sample, draftOf(sample, { inspection: 'Не соответствует', inspectionNote: '  ' }))).toEqual({
      ok: false,
      issue: 'inspectionNote',
    })
    expect(planSampleEdit(sample, draftOf(sample, { inspection: 'С ограничениями', inspectionNote: ' трещина ' }))).toEqual({
      ok: true,
      calls: [{ kind: 'inspection', inspection: 'С ограничениями', inspectionNote: 'трещина' }],
    })
  })

  it('requires the receipt date and place when a planned sample becomes received', () => {
    const planned = makeSample({
      stage: 'Запланирован отбор',
      receivedAt: '',
      location: '',
      inspection: 'Не проведён',
      inspectionNote: '',
    })
    expect(planSampleEdit(planned, draftOf(planned, { stage: 'Поступила' }))).toEqual({ ok: false, issue: 'location' })
    expect(planSampleEdit(planned, draftOf(planned, { stage: 'Поступила', location: 'Лаборатория' }))).toEqual({
      ok: false,
      issue: 'receivedAt',
    })
    expect(planSampleEdit(planned, draftOf(planned, {
      stage: 'Поступила',
      location: 'Лаборатория',
      receivedAt: '2026-11-17',
    }))).toEqual({
      ok: true,
      calls: [{ kind: 'status', stage: 'Поступила', location: 'Лаборатория', receivedAt: '2026-11-17' }],
    })
  })

  it('lets a planned sample change place without a receipt date', () => {
    const planned = makeSample({
      stage: 'Запланирован отбор',
      receivedAt: '',
      location: '',
      inspection: 'Не проведён',
      inspectionNote: '',
    })
    expect(planSampleEdit(planned, draftOf(planned, { location: 'Склад' }))).toEqual({
      ok: true,
      calls: [{ kind: 'place', location: 'Склад', receivedAt: '' }],
    })
  })

  it('sends status and inspection separately and keeps an unchanged place out of the status call', () => {
    const sample = makeSample({ stage: 'Поступила', inspection: 'Не проведён', inspectionNote: '' })
    const plan = planSampleEdit(sample, draftOf(sample, { stage: 'На исследовании', inspection: 'Соответствует' }))
    expect(plan).toEqual({
      ok: true,
      calls: [
        { kind: 'status', stage: 'На исследовании' },
        { kind: 'inspection', inspection: 'Соответствует', inspectionNote: '' },
      ],
    })
  })

  it('treats a legacy status label as unchanged until the user picks another status', () => {
    const sample = makeSample({ stage: 'В исследовании' })
    expect(sampleEditDraft(sample).stage).toBe('На исследовании')
    expect(savedCalls(sample, sampleEditDraft(sample))).toEqual([])
  })

  it('round-trips a known room and a free-text place', () => {
    expect(sampleLocationText(sampleLocationChoice('Зона приёмки проб, полка 1'))).toBe('Зона приёмки проб, полка 1')
    expect(sampleLocationChoice('Стеллаж А-2').choice).toBe('custom:Стеллаж А-2')
    expect(joinSampleLocation('Лаборатория', 'шкаф 2')).toBe('Лаборатория, шкаф 2')
    expect(sampleLocationText({ choice: '__other__', other: ' Архив ', details: 'коробка' })).toBe('Архив, коробка')
  })
})
