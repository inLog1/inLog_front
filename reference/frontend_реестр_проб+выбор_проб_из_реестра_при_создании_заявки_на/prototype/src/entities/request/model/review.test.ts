import { describe, expect, it } from 'vitest'
import { copyRequestDetails } from './clone'
import { emptyRequestDraft } from './draft'
import { emptyProgramMeta } from './program'
import { canReviseRequest, readRequestReason } from './review'

describe('request review access', () => {
  it('lets the customer organization revise a returned request and keeps a sent request closed', () => {
    expect(canReviseRequest({ status: 'rework', customerOrganizationId: 201 }, 201)).toBe(true)
    expect(canReviseRequest({ status: 'rework', customerOrganizationId: 201 }, 101)).toBe(false)
    expect(canReviseRequest({ status: 'sent', customerOrganizationId: 201 }, 201)).toBe(false)
    expect(canReviseRequest({ status: 'rejected', customerOrganizationId: 201 }, 201)).toBe(false)
    expect(canReviseRequest({ status: 'withdrawn', customerOrganizationId: 201 }, 201)).toBe(false)
    expect(canReviseRequest({ status: 'draft', customerOrganizationId: 201 }, 101)).toBe(true)
  })

  it('requires a reason and keeps the trimmed text', () => {
    expect(readRequestReason('  нет интервала  ')).toEqual({ ok: true, reason: 'нет интервала' })
    expect(readRequestReason('   ')).toEqual({ ok: false, code: 'reason_required' })
    expect(readRequestReason(undefined)).toEqual({ ok: false, code: 'reason_required' })
    expect(readRequestReason('я'.repeat(1001))).toEqual({ ok: false, code: 'invalid_text' })
  })
})

describe('request copy', () => {
  it('gives objects and needs new ids and keeps their links inside the copy', () => {
    const details = emptyRequestDraft()
    details.projectName = 'Пористость'
    details.programMeta = { ...emptyProgramMeta(), authorUserId: 5, preparedBy: 'laboratory' }
    details.program = [{
      id: 'line-1',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '2',
      demand: '',
      curatorId: '',
      dueDate: '',
      code: '',
      note: '',
    }]
    details.fields = [{
      id: 'field-1',
      catalogFieldId: 'field-north',
      fieldName: 'Северное',
      wells: [{
        id: 'well-1',
        catalogWellId: 'well-12',
        wellName: '12',
        intervals: [{ id: 'int-1', from: 10, to: 20, unit: 'm' }],
      }],
    }]
    details.needs = [{
      id: 'need-1',
      researchId: 'work-porosity',
      desiredResult: '',
      sampleTypeId: '',
      quantity: null,
      unitId: '',
      comment: '',
      clarification: '',
      legacyLineId: 'line-1',
      targets: [{ wellId: 'well-1', selection: 'intervals', intervalIds: ['int-1'] }],
    }]
    details.clarifications = [{ id: 'note-1', code: 'legacy_subject_kept', sourceId: 'subject' }]
    let n = 0
    const copy = copyRequestDetails(details, (prefix) => `copy-${prefix}-${++n}`)
    expect(copy.fields[0]?.id).not.toBe('field-1')
    expect(copy.fields[0]?.wells[0]?.id).not.toBe('well-1')
    expect(copy.fields[0]?.wells[0]?.intervals[0]?.id).not.toBe('int-1')
    expect(copy.needs[0]?.id).not.toBe('need-1')
    expect(copy.needs[0]?.targets[0]?.wellId).toBe(copy.fields[0]?.wells[0]?.id)
    expect(copy.needs[0]?.targets[0]?.intervalIds).toEqual([copy.fields[0]?.wells[0]?.intervals[0]?.id])
    expect(copy.needs[0]?.legacyLineId).toBe(copy.program[0]?.id)
    expect(copy.program[0]?.id).not.toBe('line-1')
    expect(copy.clarifications[0]?.id).not.toBe('note-1')
    expect(copy.clarifications[0]?.code).toBe('legacy_subject_kept')
    expect(copy.programMeta).toEqual(emptyProgramMeta())
    expect(copy.projectName).toBe('Пористость')
    expect(details.needs[0]?.targets[0]?.wellId).toBe('well-1')
  })
})
