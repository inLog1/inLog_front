import { canonicalSchema } from './schema'
import type { FormSchema, FormStatus } from './types'

export type PublicationBase = {
  title: string
  description: string
  schema: FormSchema
  versionNumber: number
} | null

export type ChangeSummary = {
  firstPublication: boolean
  nextNumber: number
  added: string[]
  removed: string[]
  renamed: string[]
  retyped: string[]
  titleChanged: boolean
  descriptionChanged: boolean
}

export function publicationStatus(
  title: string,
  description: string,
  draft: FormSchema,
  published: PublicationBase,
): FormStatus {
  if (!published) return 'draft'
  const sameText = title === published.title && description === published.description
  const sameSchema = canonicalSchema(draft) === canonicalSchema(published.schema)
  return sameText && sameSchema ? 'published' : 'published-dirty'
}

/** Counts and a few labels. This is not a visual diff. */
export function summarizeChanges(
  published: PublicationBase,
  next: { title: string; description: string; schema: FormSchema },
): ChangeSummary {
  if (!published) {
    return {
      firstPublication: true,
      nextNumber: 1,
      added: next.schema.fields.map(labelOf),
      removed: [],
      renamed: [],
      retyped: [],
      titleChanged: false,
      descriptionChanged: false,
    }
  }
  const previous = new Map(published.schema.fields.map((field) => [field.id, field]))
  const current = new Map(next.schema.fields.map((field) => [field.id, field]))
  const added: string[] = []
  const removed: string[] = []
  const renamed: string[] = []
  const retyped: string[] = []
  for (const field of next.schema.fields) {
    const before = previous.get(field.id)
    if (!before) added.push(labelOf(field))
    else {
      if (before.label !== field.label) renamed.push(`${before.label} → ${field.label}`)
      if (before.type !== field.type) retyped.push(labelOf(field))
    }
  }
  for (const field of published.schema.fields) {
    if (!current.has(field.id)) removed.push(labelOf(field))
  }
  return {
    firstPublication: false,
    nextNumber: published.versionNumber + 1,
    added,
    removed,
    renamed,
    retyped,
    titleChanged: published.title !== next.title,
    descriptionChanged: published.description !== next.description,
  }
}

function labelOf(field: { id: string; label: string }): string {
  const label = field.label.trim()
  return label === '' ? field.id : label
}
