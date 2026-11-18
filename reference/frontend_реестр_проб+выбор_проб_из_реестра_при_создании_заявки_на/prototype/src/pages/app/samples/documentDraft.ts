import { attachmentMime, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_FILES, MAX_ATTACHMENT_TOTAL_BYTES, type AttachmentType, type RegistrationDocuments } from './attachments'

export type DocumentDraft = { type: AttachmentType; files: File[]; existingId: string }
export const emptyDocumentDraft = (): DocumentDraft => ({ type:'Акт приёма-передачи', files:[], existingId:'' })

export async function prepareDocuments(draft: DocumentDraft): Promise<RegistrationDocuments | undefined> {
  if (!draft.files.length && !draft.existingId) return undefined
  if (draft.files.length > MAX_ATTACHMENT_FILES) throw new Error('Можно выбрать до 10 файлов.')
  if (draft.files.some(file => !file.size || file.size > MAX_ATTACHMENT_BYTES)) throw new Error('Каждый файл должен быть не пустым и не больше 10 МБ.')
  if (draft.files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('Общий размер файлов не должен превышать 30 МБ.')
  if (draft.files.some(file => { const mime = attachmentMime(file.name, file.type); return !mime || (draft.type === 'Фото входного контроля' && !mime.startsWith('image/')) })) throw new Error('Проверьте формат файлов и выбранный тип документа.')
  return { type:draft.type, existingId:draft.existingId || undefined, files:await Promise.all(draft.files.map(async file => ({filename:file.name, mimeType:file.type, bytes:new Uint8Array(await file.arrayBuffer())}))) }
}

