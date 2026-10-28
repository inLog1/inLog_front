import { hasInputFields } from './schema'
import type { FormAnswer, FormField } from './types'

export type AnswerLabels = {
  blank: string
  yes: string
  no: string
}

/**
 * Document text for one stored answer.
 * `0` and `false` stay visible. An absent answer is the blank label, never a zero or false.
 */
export function formatAnswer(
  field: Pick<FormField, 'type' | 'options'>,
  value: FormAnswer | undefined,
  labels: AnswerLabels,
): string {
  if (field.type === 'boolean') {
    if (value === true) return labels.yes
    if (value === false) return labels.no
    return labels.blank
  }
  if (value == null || value === '') return labels.blank
  if (field.type === 'single_choice') {
    if (typeof value !== 'string') return labels.blank
    const option = field.options.find((item) => item.id === value)
    return option ? option.label : value
  }
  if (field.type === 'date' && typeof value === 'string') {
    const [year, month, day] = value.split('-')
    if (year && month && day) return `${day}.${month}.${year}`
  }
  if (field.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : labels.blank
  }
  return String(value)
}

/** Required stars belong on the editor, the preview, and the fill form. A saved record is a document. */
export function showsRequiredMark(
  mode: 'edit' | 'document',
  field: Pick<FormField, 'required' | 'type'>,
): boolean {
  return mode === 'edit' && field.required && field.type !== 'boolean'
}

/** Creating a record needs the create right and at least one input on this published version. */
export function fillAllowsSubmit(schema: { fields: ReadonlyArray<{ type: string }> }, canCreate: boolean): boolean {
  return canCreate && hasInputFields(schema)
}

/**
 * The record card opens only after create returns an id.
 * A rejected save has no id, so the fill screen stays put.
 */
export function createdRecordId(created: { id?: unknown } | null | undefined): string | null {
  if (!created || typeof created.id !== 'string' || created.id.trim() === '') return null
  return created.id
}

export type PublishedScreen = 'loading' | 'forbidden' | 'unpublished' | 'failed' | 'empty' | 'ready'

/**
 * An empty published schema is a successful response with no inputs.
 * A network or server failure stays a failure even when no fields are known yet.
 */
export function publishedFormScreen(input: {
  loading: boolean
  error: { status: number | null; code: string | null } | null
  fieldCount: number | null
}): PublishedScreen {
  if (input.error) {
    if (input.error.status === 403 || input.error.code === 'forbidden') return 'forbidden'
    if (input.error.status === 404 || input.error.code === 'not_found') return 'unpublished'
    return 'failed'
  }
  if (input.loading || input.fieldCount == null) return 'loading'
  if (input.fieldCount === 0) return 'empty'
  return 'ready'
}
