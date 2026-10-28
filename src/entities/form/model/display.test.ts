import { describe, expect, it } from 'vitest'
import { createdRecordId, fillAllowsSubmit, formatAnswer, publishedFormScreen, showsRequiredMark } from './display'
import type { FormSchema } from './types'

const labels = { blank: '—', yes: 'Да', no: 'Нет' }

const schema: FormSchema = {
  schemaVersion: 1,
  fields: [
    { id: 'field-text', type: 'text', label: 'Номер', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [] },
    { id: 'field-number', type: 'number', label: 'Масса', help: '', required: false, minLength: null, maxLength: null, min: null, max: null, options: [] },
    { id: 'field-flag', type: 'boolean', label: 'Повтор', help: '', required: true, minLength: null, maxLength: null, min: null, max: null, options: [] },
    { id: 'field-date', type: 'date', label: 'Дата', help: '', required: false, minLength: null, maxLength: null, min: null, max: null, options: [] },
    { id: 'field-kind', type: 'single_choice', label: 'Вид', help: '', required: false, minLength: null, maxLength: null, min: null, max: null, options: [{ id: 'option-core', label: 'Керн' }] },
  ],
}

describe('form document display', () => {
  it('keeps 0 and false and does not invent them for an empty answer', () => {
    const text = schema.fields[0]
    const number = schema.fields[1]
    const flag = schema.fields[2]
    const date = schema.fields[3]
    const choice = schema.fields[4]
    if (!text || !number || !flag || !date || !choice) throw new Error('schema')
    expect(formatAnswer(number, 0, labels)).toBe('0')
    expect(formatAnswer(flag, false, labels)).toBe('Нет')
    expect(formatAnswer(flag, true, labels)).toBe('Да')
    expect(formatAnswer(text, '', labels)).toBe('—')
    expect(formatAnswer(number, null, labels)).toBe('—')
    expect(formatAnswer(date, null, labels)).toBe('—')
    expect(formatAnswer(date, '2026-10-27', labels)).toBe('27.10.2026')
    expect(formatAnswer(choice, 'option-core', labels)).toBe('Керн')
    expect(formatAnswer(choice, null, labels)).toBe('—')
  })

  it('hides the required mark on a document and keeps it on an editable text field', () => {
    const text = schema.fields[0]
    const flag = schema.fields[2]
    if (!text || !flag) throw new Error('schema')
    expect(showsRequiredMark('document', text)).toBe(false)
    expect(showsRequiredMark('edit', text)).toBe(true)
    expect(showsRequiredMark('edit', flag)).toBe(false)
    expect(fillAllowsSubmit({ fields: [] }, true)).toBe(false)
    expect(fillAllowsSubmit(schema, false)).toBe(false)
    expect(fillAllowsSubmit(schema, true)).toBe(true)
  })

  it('opens a record only after an id and does not call an empty schema a network failure', () => {
    expect(createdRecordId(null)).toBeNull()
    expect(createdRecordId({})).toBeNull()
    expect(createdRecordId({ id: 'rec-1' })).toBe('rec-1')
    expect(publishedFormScreen({ loading: false, error: { status: 500, code: null }, fieldCount: 0 })).toBe('failed')
    expect(publishedFormScreen({ loading: false, error: { status: 404, code: 'not_found' }, fieldCount: null })).toBe('unpublished')
    expect(publishedFormScreen({ loading: false, error: { status: 403, code: 'forbidden' }, fieldCount: 2 })).toBe('forbidden')
    expect(publishedFormScreen({ loading: true, error: null, fieldCount: null })).toBe('loading')
    expect(publishedFormScreen({ loading: false, error: null, fieldCount: 0 })).toBe('empty')
    expect(publishedFormScreen({ loading: false, error: null, fieldCount: 2 })).toBe('ready')
  })
})
