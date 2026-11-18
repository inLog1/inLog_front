import {
  attachmentMime,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_FILES,
  MAX_ATTACHMENT_TOTAL_BYTES,
  type AttachmentInput,
  type AttachmentType,
  type RegistrationDocuments,
} from './attachments'

export type DocumentDraftFile = {
  name: string
  type: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

export type DocumentDraft = {
  type: AttachmentType
  files: DocumentDraftFile[]
  existingId: string
}

export function emptyDocumentDraft(): DocumentDraft {
  return { type: 'Акт приёма-передачи', files: [], existingId: '' }
}

/** File limits and the photo rule, before any bytes are stored. */
export function inspectDocumentDraft(draft: Pick<DocumentDraft, 'type' | 'files'>): 'ok' | 'file-count' | 'file-size' | 'total-size' | 'invalid-file' {
  if (draft.files.length > MAX_ATTACHMENT_FILES) return 'file-count'
  if (draft.files.some((file) => !file.size || file.size > MAX_ATTACHMENT_BYTES)) return 'file-size'
  if (draft.files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_TOTAL_BYTES) return 'total-size'
  const invalid = draft.files.some((file) => {
    const mime = attachmentMime(file.name, file.type)
    return !mime || (draft.type === 'Фото входного контроля' && !mime.startsWith('image/'))
  })
  if (invalid) return 'invalid-file'
  return 'ok'
}

export async function prepareDocuments(draft: DocumentDraft): Promise<RegistrationDocuments | undefined> {
  if (!draft.files.length && !draft.existingId) return undefined
  const issue = inspectDocumentDraft(draft)
  if (issue !== 'ok') throw new Error(issue)
  const files: AttachmentInput[] = await Promise.all(draft.files.map(async (file) => ({
    filename: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })))
  return { type: draft.type, existingId: draft.existingId || undefined, files }
}
