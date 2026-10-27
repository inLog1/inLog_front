import { describe, expect, it } from 'vitest'
import { displayText, parseSchema } from './schema'
import { formsMode } from './availability'
import { publicationStatus, summarizeChanges } from './summary'
import { isCalendarDate, persistsAnswers, storedDate, validateAnswers } from './values'
import type { FormSchema } from './types'

const schema: FormSchema = {
  schemaVersion: 1,
  fields: [
    { id: 'field-text', type: 'text', label: 'Название', help: '', required: true, minLength: 1, maxLength: 20, min: null, max: null, options: [] },
    { id: 'field-number', type: 'number', label: 'Масса', help: '', required: true, minLength: null, maxLength: null, min: 0, max: null, options: [] },
    { id: 'field-date', type: 'date', label: 'Дата', help: '', required: false, minLength: null, maxLength: null, min: null, max: null, options: [] },
    { id: 'field-choice', type: 'single_choice', label: 'Вид', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [{ id: 'option-core', label: 'Керн' }] },
    { id: 'field-flag', type: 'boolean', label: 'Отметка', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [] },
  ],
}

describe('form rules', () => {
  it('keeps a calendar date as the same digits', () => {
    expect(isCalendarDate('2026-10-27')).toBe(true)
    expect(storedDate('2026-10-27')).toBe('2026-10-27')
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(storedDate('2026-13-01')).toBeNull()
  })

  it('treats 0, false and an empty string as real values', () => {
    const answers = {
      'field-text': '',
      'field-number': 0,
      'field-date': null,
      'field-choice': 'option-core',
      'field-flag': false,
    }
    const emptyText = validateAnswers(schema, answers)
    expect(emptyText.ok).toBe(false)
    if (!emptyText.ok) expect(emptyText.fields['field-text']).toBe('required')
    const filled = validateAnswers(schema, { ...answers, 'field-text': 'А' })
    expect(filled.ok).toBe(true)
    if (filled.ok) {
      expect(filled.values['field-number']).toBe(0)
      expect(filled.values['field-flag']).toBe(false)
      expect(filled.values['field-date']).toBeNull()
    }
    const negative = validateAnswers(schema, { ...answers, 'field-text': 'А', 'field-number': -1 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.fields['field-number']).toBe('min')
  })

  it('rejects an unknown value key and an unknown option without storing them', () => {
    const extra = validateAnswers(schema, {
      'field-text': 'А',
      'field-number': 1,
      'field-date': '2026-10-27',
      'field-choice': 'option-core',
      'field-flag': false,
      extra: 'nope',
    })
    expect(extra.ok).toBe(false)
    if (!extra.ok) expect(extra.code).toBe('unknown_key')
    const option = validateAnswers(schema, {
      'field-text': 'А',
      'field-number': 1,
      'field-date': null,
      'field-choice': 'option-missing',
      'field-flag': true,
    })
    expect(option.ok).toBe(false)
    if (!option.ok) expect(option.fields['field-choice']).toBe('invalid_option')
  })

  it('does not interpret an unknown schema version', () => {
    const parsed = parseSchema({ schemaVersion: 9, fields: schema.fields }, 'publish')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.map((issue) => issue.code)).toContain('unknown_schema')
    expect(parseSchema({ schemaVersion: 1, fields: [], extra: true }, 'draft').ok).toBe(false)
  })

  it('requires a label and a real choice only when publishing', () => {
    const draft = parseSchema({
      schemaVersion: 1,
      fields: [{ id: 'field-choice', type: 'single_choice', label: ' ', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [{ id: 'option-core', label: '' }] }],
    }, 'draft')
    expect(draft.ok).toBe(true)
    const published = parseSchema({
      schemaVersion: 1,
      fields: [{ id: 'field-choice', type: 'single_choice', label: ' ', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [{ id: 'option-core', label: '' }] }],
    }, 'publish')
    expect(published.ok).toBe(false)
  })

  it('keeps field ids when summarizing a rename and does not persist a preview', () => {
    const next = {
      title: 'Приём',
      description: '',
      schema: {
        ...schema,
        fields: schema.fields.map((field) => field.id === 'field-text' ? { ...field, label: 'Имя образца' } : field),
      },
    }
    const summary = summarizeChanges({ title: 'Приём', description: '', schema, versionNumber: 1 }, next)
    expect(summary.renamed).toEqual(['Название → Имя образца'])
    expect(summary.removed).toEqual([])
    expect(next.schema.fields[0]?.id).toBe('field-text')
    expect(persistsAnswers('preview')).toBe(false)
    expect(persistsAnswers('record')).toBe(false)
    expect(persistsAnswers('fill')).toBe(true)
    expect(displayText('<b>название</b>')).toBe('<b>название</b>')
    expect(publicationStatus('Приём', '', schema, { title: 'Приём', description: '', schema, versionNumber: 1 })).toBe('published')
    expect(publicationStatus('Приём', '', next.schema, { title: 'Приём', description: '', schema, versionNumber: 1 })).toBe('published-dirty')
  })

  it('stays unavailable outside mock mode', () => {
    expect(formsMode('mock')).toBe('mock')
    expect(formsMode('live')).toBe('unavailable')
    expect(formsMode(undefined)).toBe('unavailable')
  })
})
