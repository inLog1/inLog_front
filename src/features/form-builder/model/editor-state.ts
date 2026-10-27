import type { FormDraftResponse, FormSchema } from '../../../entities/form'

export type EditorBuffer = {
  formId: string
  savedKey: string
  title: string
  description: string
  schema: FormSchema
  formRevision: number
  draftRevision: number
  dirty: boolean
  published: FormDraftResponse['published']
}

export function bufferFromDraft(data: FormDraftResponse): EditorBuffer {
  return {
    formId: data.form.id,
    savedKey: `${data.form.id}:${data.form.revision}:${data.draft.revision}`,
    title: data.form.title,
    description: data.form.description,
    schema: data.draft.schema,
    formRevision: data.form.revision,
    draftRevision: data.draft.revision,
    dirty: false,
    published: data.published,
  }
}
