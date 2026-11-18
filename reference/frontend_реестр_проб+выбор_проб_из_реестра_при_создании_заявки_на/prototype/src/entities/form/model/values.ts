import { FORM_SCHEMA_VERSION, type FieldErrorCode, type FormAnswers, type FormSchema } from './types'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A calendar date is the digits in the string.
 * It is not converted through the local timezone.
 */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function storedDate(value: string): string | null {
  return isCalendarDate(value) ? value : null
}

export function emptyAnswers(schema: FormSchema): FormAnswers {
  const answers: FormAnswers = {}
  for (const field of schema.fields) {
    if (field.type === 'boolean') answers[field.id] = false
    else if (field.type === 'text' || field.type === 'textarea') answers[field.id] = ''
    else answers[field.id] = null
  }
  return answers
}

export type AnswerReview =
  | { ok: true; values: FormAnswers }
  | { ok: false; code: 'unknown_schema' | 'invalid_payload' | 'unknown_key'; fields: Record<string, FieldErrorCode> }

/**
 * Preview and fill share this check. Calling it does not store a record.
 * `false` on a checkbox is a valid answer. Required does not mean the box must be checked.
 * An empty number is null and is distinct from 0.
 */
export function validateAnswers(schema: FormSchema, value: unknown): AnswerReview {
  if (schema.schemaVersion !== FORM_SCHEMA_VERSION) {
    return { ok: false, code: 'unknown_schema', fields: {} }
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, code: 'invalid_payload', fields: {} }
  }
  const source = value as Record<string, unknown>
  const known = new Set(schema.fields.map((field) => field.id))
  for (const key of Object.keys(source)) {
    if (!known.has(key)) return { ok: false, code: 'unknown_key', fields: {} }
  }
  const values: FormAnswers = {}
  const fields: Record<string, FieldErrorCode> = {}
  for (const field of schema.fields) {
    const checked = checkField(field, source[field.id])
    if (!checked.ok) fields[field.id] = checked.code
    else values[field.id] = checked.value
  }
  if (Object.keys(fields).length > 0) return { ok: false, code: 'invalid_payload', fields }
  return { ok: true, values }
}

function ok(value: FormAnswers[string]): { ok: true; value: FormAnswers[string] } {
  return { ok: true, value }
}

function fail(code: FieldErrorCode): { ok: false; code: FieldErrorCode } {
  return { ok: false, code }
}

function checkField(field: FormSchema['fields'][number], raw: unknown) {
  if (field.type === 'text' || field.type === 'textarea') return checkText(field, raw)
  if (field.type === 'number') return checkNumber(field, raw)
  if (field.type === 'date') return checkDate(field, raw)
  if (field.type === 'single_choice') return checkChoice(field, raw)
  if (raw !== true && raw !== false) return fail('invalid_type')
  return ok(raw)
}

function checkText(field: FormSchema['fields'][number], raw: unknown) {
  if (typeof raw !== 'string') return fail('invalid_type')
  if (field.required && raw.trim() === '') return fail('required')
  if (raw !== '' && field.minLength != null && raw.length < field.minLength) return fail('min_length')
  if (field.maxLength != null && raw.length > field.maxLength) return fail('max_length')
  return ok(raw)
}

function checkNumber(field: FormSchema['fields'][number], raw: unknown) {
  if (raw == null) return field.required ? fail('required') : ok(null)
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail('invalid_number')
  if (field.min != null && raw < field.min) return fail('min')
  if (field.max != null && raw > field.max) return fail('max')
  return ok(raw)
}

function checkDate(field: FormSchema['fields'][number], raw: unknown) {
  if (raw == null || raw === '') return field.required ? fail('required') : ok(null)
  if (typeof raw !== 'string' || storedDate(raw) == null) return fail('invalid_date')
  return ok(raw)
}

function checkChoice(field: FormSchema['fields'][number], raw: unknown) {
  if (raw == null || raw === '') return field.required ? fail('required') : ok(null)
  if (typeof raw !== 'string') return fail('invalid_type')
  if (!field.options.some((option) => option.id === raw)) return fail('invalid_option')
  return ok(raw)
}

/** Only a real submission may persist. Preview and record view never do. */
export function persistsAnswers(mode: 'preview' | 'fill' | 'record'): boolean {
  return mode === 'fill'
}
