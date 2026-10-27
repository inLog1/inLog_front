export const FORM_SCHEMA_VERSION = 1

export const FORM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'single_choice', 'boolean'] as const

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export type FormOption = {
  id: string
  label: string
}

/** Stable field id. The label is display text and is not the value key. */
export type FormField = {
  id: string
  type: FormFieldType
  label: string
  help: string
  required: boolean
  minLength: number | null
  maxLength: number | null
  min: number | null
  max: number | null
  options: FormOption[]
}

export type FormSchema = {
  schemaVersion: number
  fields: FormField[]
}

export type FormAnswer = string | number | boolean | null

export type FormAnswers = Record<string, FormAnswer>

export type FormStatus = 'draft' | 'published' | 'published-dirty'

export type FormListItem = {
  id: string
  organizationId: number
  title: string
  description: string
  status: FormStatus
  publishedVersionNumber: number | null
  publishedVersionId: string | null
}

export type PublishedFormVersion = {
  versionId: string
  versionNumber: number
  title: string
  description: string
  schema: FormSchema
  publishedAt: string
}

export type FormDraftResponse = {
  form: {
    id: string
    organizationId: number
    title: string
    description: string
    revision: number
    publishedVersionId: string | null
    publishedVersionNumber: number | null
    status: FormStatus
  }
  draft: {
    schema: FormSchema
    baseVersionId: string | null
    revision: number
  }
  /** Present because the caller can update. The fill endpoint does not return this. */
  published: PublishedFormVersion | null
}

export type PublishedFormResponse = {
  formId: string
  organizationId: number
  title: string
  description: string
  versionId: string
  versionNumber: number
  schema: FormSchema
  publishedAt: string
}

export type FormRecordListItem = {
  id: string
  createdAt: string
  authorName: string
  versionNumber: number
  formVersionId: string
}

export type FormRecordResponse = {
  id: string
  organizationId: number
  formId: string
  formVersionId: string
  versionNumber: number
  title: string
  description: string
  schema: FormSchema
  values: FormAnswers
  authorName: string
  createdAt: string
}

export type SchemaIssue = {
  code: string
  fieldId?: string
}

export type FieldErrorCode =
  | 'required'
  | 'min_length'
  | 'max_length'
  | 'min'
  | 'max'
  | 'invalid_number'
  | 'invalid_date'
  | 'invalid_option'
  | 'invalid_type'
