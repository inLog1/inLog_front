import {
  FORM_FIELD_TYPES,
  FORM_SCHEMA_VERSION,
  type FormField,
  type FormFieldType,
  type FormOption,
  type FormSchema,
  type SchemaIssue,
} from './types'

const SCHEMA_KEYS = new Set(['schemaVersion', 'fields'])
const FIELD_KEYS = new Set(['id', 'type', 'label', 'help', 'required', 'minLength', 'maxLength', 'min', 'max', 'options'])
const OPTION_KEYS = new Set(['id', 'label'])
const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/

export function emptySchema(): FormSchema {
  return { schemaVersion: FORM_SCHEMA_VERSION, fields: [] }
}

export function createField(type: FormFieldType, id = newId()): FormField {
  return {
    id,
    type,
    label: '',
    help: '',
    required: false,
    minLength: null,
    maxLength: null,
    min: null,
    max: null,
    options: type === 'single_choice' ? [{ id: newId(), label: '' }] : [],
  }
}

export function changeFieldType(field: FormField, type: FormFieldType): FormField {
  const next = createField(type, field.id)
  next.label = field.label
  next.help = field.help
  next.required = field.required
  return next
}

export function moveField(fields: readonly FormField[], id: string, direction: -1 | 1): FormField[] {
  const index = fields.findIndex((field) => field.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= fields.length) return [...fields]
  const next = [...fields]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function newId(): string {
  return crypto.randomUUID()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function unknownKey(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowed.has(key))
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function lengthBound(value: unknown): number | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) return 'invalid'
  return value
}

function numberBound(value: unknown): number | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'invalid'
  return value
}

function parseOption(value: unknown): FormOption | 'invalid' | 'unknown' {
  if (!isRecord(value)) return 'invalid'
  if (unknownKey(value, OPTION_KEYS)) return 'unknown'
  if (!isId(value.id) || typeof value.label !== 'string' || value.label.length > 200) return 'invalid'
  return { id: value.id, label: value.label }
}

function parseField(value: unknown): { field?: FormField; issues: SchemaIssue[] } {
  if (!isRecord(value)) return { issues: [{ code: 'invalid_shape' }] }
  if (unknownKey(value, FIELD_KEYS)) return { issues: [{ code: 'unknown_key' }] }
  const id = value.id
  if (!isId(id)) return { issues: [{ code: 'invalid_shape' }] }
  if (typeof value.type !== 'string' || !FORM_FIELD_TYPES.includes(value.type as FormFieldType)) {
    return { issues: [{ code: 'invalid_type', fieldId: id }] }
  }
  if (typeof value.label !== 'string' || value.label.length > 200) return { issues: [{ code: 'invalid_shape', fieldId: id }] }
  if (typeof value.help !== 'string' || value.help.length > 500) return { issues: [{ code: 'invalid_shape', fieldId: id }] }
  if (typeof value.required !== 'boolean') return { issues: [{ code: 'invalid_shape', fieldId: id }] }
  const minLength = lengthBound(value.minLength)
  const maxLength = lengthBound(value.maxLength)
  const min = numberBound(value.min)
  const max = numberBound(value.max)
  if (minLength === 'invalid' || maxLength === 'invalid' || min === 'invalid' || max === 'invalid') {
    return { issues: [{ code: 'invalid_range', fieldId: id }] }
  }
  if (minLength != null && maxLength != null && minLength > maxLength) {
    return { issues: [{ code: 'invalid_range', fieldId: id }] }
  }
  if (min != null && max != null && min > max) return { issues: [{ code: 'invalid_range', fieldId: id }] }
  if (!Array.isArray(value.options)) return { issues: [{ code: 'invalid_shape', fieldId: id }] }
  const options: FormOption[] = []
  for (const item of value.options) {
    const option = parseOption(item)
    if (option === 'unknown') return { issues: [{ code: 'unknown_key', fieldId: id }] }
    if (option === 'invalid') return { issues: [{ code: 'invalid_options', fieldId: id }] }
    options.push(option)
  }
  const type = value.type as FormFieldType
  const usesLength = type === 'text' || type === 'textarea'
  const usesNumber = type === 'number'
  const usesOptions = type === 'single_choice'
  if (!usesLength && (minLength != null || maxLength != null)) return { issues: [{ code: 'inapplicable', fieldId: id }] }
  if (!usesNumber && (min != null || max != null)) return { issues: [{ code: 'inapplicable', fieldId: id }] }
  if (!usesOptions && options.length > 0) return { issues: [{ code: 'inapplicable', fieldId: id }] }
  const optionIds = new Set<string>()
  for (const option of options) {
    if (optionIds.has(option.id)) return { issues: [{ code: 'duplicate_option', fieldId: id }] }
    optionIds.add(option.id)
  }
  return {
    field: {
      id,
      type,
      label: value.label,
      help: value.help,
      required: value.required,
      minLength,
      maxLength,
      min,
      max,
      options,
    },
    issues: [],
  }
}

export function parseSchema(
  value: unknown,
  mode: 'draft' | 'publish',
): { ok: true; schema: FormSchema } | { ok: false; issues: SchemaIssue[] } {
  if (!isRecord(value)) return { ok: false, issues: [{ code: 'invalid_shape' }] }
  if (unknownKey(value, SCHEMA_KEYS)) return { ok: false, issues: [{ code: 'unknown_key' }] }
  if (value.schemaVersion !== FORM_SCHEMA_VERSION) return { ok: false, issues: [{ code: 'unknown_schema' }] }
  if (!Array.isArray(value.fields) || value.fields.length > 100) return { ok: false, issues: [{ code: 'invalid_shape' }] }
  const fields: FormField[] = []
  const issues: SchemaIssue[] = []
  const ids = new Set<string>()
  for (const item of value.fields) {
    const parsed = parseField(item)
    issues.push(...parsed.issues)
    if (!parsed.field) continue
    if (ids.has(parsed.field.id)) issues.push({ code: 'duplicate_field', fieldId: parsed.field.id })
    ids.add(parsed.field.id)
    if (mode === 'publish') issues.push(...publishIssues(parsed.field))
    fields.push(parsed.field)
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, schema: { schemaVersion: FORM_SCHEMA_VERSION, fields } }
}

function publishIssues(field: FormField): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  if (field.label.trim() === '') issues.push({ code: 'empty_label', fieldId: field.id })
  if (field.type === 'single_choice') {
    if (field.options.length === 0) issues.push({ code: 'empty_options', fieldId: field.id })
    for (const option of field.options) {
      if (option.label.trim() === '') issues.push({ code: 'empty_option', fieldId: field.id })
    }
  }
  return issues
}

export function canonicalSchema(schema: FormSchema): string {
  return JSON.stringify({
    schemaVersion: schema.schemaVersion,
    fields: schema.fields.map((field) => ({
      id: field.id,
      type: field.type,
      label: field.label,
      help: field.help,
      required: field.required,
      minLength: field.minLength,
      maxLength: field.maxLength,
      min: field.min,
      max: field.max,
      options: field.options.map((option) => ({ id: option.id, label: option.label })),
    })),
  })
}

/** Labels and help are plain text. The renderer must not parse them as HTML. */
export function displayText(value: string): string {
  return value
}
