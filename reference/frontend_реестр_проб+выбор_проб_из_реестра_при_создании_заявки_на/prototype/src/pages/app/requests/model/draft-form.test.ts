import { describe, expect, it } from 'vitest'
import { emptyRequestDraft, emptyResearchNeed } from '../../../../entities/request'
import {
  appendStudyWell,
  countStudyWells,
  intervalDraftIssue,
  quantityDraftValue,
  setNeedInterval,
  setNeedWholeWell,
  studyEntityId,
} from './draft-form'

describe('request draft form helpers', () => {
  it('groups wells from several deposits and keeps a typed well name', () => {
    const first = appendStudyWell(emptyRequestDraft(), {
      fieldId: 'field-a',
      catalogFieldId: 'field-north',
      fieldName: 'Северное',
      wellId: 'well-a',
      catalogWellId: 'well-12',
      wellName: '12',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = appendStudyWell(first.details, {
      fieldId: 'field-b',
      catalogFieldId: 'field-north',
      fieldName: 'Северное',
      wellId: 'well-b',
      catalogWellId: '',
      wellName: '102',
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.details.fields).toHaveLength(1)
    expect(second.details.fields[0]?.wells.map((well) => well.id)).toEqual(['well-a', 'well-b'])
    const other = appendStudyWell(second.details, {
      fieldId: 'field-c',
      catalogFieldId: 'field-east',
      fieldName: 'Восточное',
      wellId: 'well-c',
      catalogWellId: 'well-18',
      wellName: '18',
    })
    expect(other.ok).toBe(true)
    if (!other.ok) return
    expect(countStudyWells(other.details.fields)).toBe(3)
    expect(other.details.fields.map((field) => field.catalogFieldId)).toEqual(['field-north', 'field-east'])
    const duplicate = appendStudyWell(other.details, {
      fieldId: 'field-d',
      catalogFieldId: 'field-north',
      fieldName: 'Северное',
      wellId: 'well-d',
      catalogWellId: 'well-12',
      wellName: '12',
    })
    expect(duplicate).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('lets one need point at a whole well or at chosen intervals', () => {
    const need = emptyResearchNeed('need-1')
    const whole = setNeedWholeWell(need, 'well-a', true)
    expect(whole.targets).toEqual([{ wellId: 'well-a', selection: 'well', intervalIds: [] }])
    const intervals = setNeedInterval(whole, 'well-a', 'int-1', true)
    expect(intervals.targets).toEqual([{ wellId: 'well-a', selection: 'intervals', intervalIds: ['int-1'] }])
    const both = setNeedInterval(intervals, 'well-b', 'int-2', true)
    expect(both.targets.map((target) => target.wellId)).toEqual(['well-a', 'well-b'])
    const cleared = setNeedInterval(both, 'well-a', 'int-1', false)
    expect(cleared.targets.map((target) => target.wellId)).toEqual(['well-b'])
    expect(studyEntityId('well')).toMatch(/^well-[A-Za-z0-9-]{36}$/)
  })

  it('checks interval text and a planned quantity before they reach the draft', () => {
    expect(intervalDraftIssue('1200', '1210', 'm')).toBeNull()
    expect(intervalDraftIssue('1210', '1200', 'm')).toBe('invalid_bounds')
    expect(intervalDraftIssue('', '10', 'm')).toBe('invalid_number')
    expect(intervalDraftIssue('1', '2', 'ft')).toBe('invalid_unit')
    expect(quantityDraftValue('')).toEqual({ ok: true, quantity: null })
    expect(quantityDraftValue('4,5')).toEqual({ ok: true, quantity: 4.5 })
    expect(quantityDraftValue('0').ok).toBe(false)
  })
})
