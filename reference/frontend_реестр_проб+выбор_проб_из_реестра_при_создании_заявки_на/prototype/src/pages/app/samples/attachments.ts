import { toSnapshot } from '../../../app/mocks/auth/flow'
import type { MockState } from '../../../app/mocks/db/types'
import { can } from '../../../entities/access/model/grants'
import { changeControl, inheritedSampleOrigin, registerSamples, sampleTypeOf, type Inspection, type Sample, type SampleStage } from './model'
import { findRegistrationDuplicates } from './duplicates'

export const ATTACHMENT_TYPES = [
  'Акт приёма-передачи',
  'Ведомость проб',
  'Сопроводительный документ',
  'Акт входного контроля / осмотра',
  'Фото входного контроля',
] as const
export type AttachmentType = typeof ATTACHMENT_TYPES[number] | 'Ведомость проб / керна'
export function displayAttachmentType(type: AttachmentType): string { return type === 'Ведомость проб / керна' ? 'Ведомость проб' : type }
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_TOTAL_BYTES = 30 * 1024 * 1024
export const MAX_ATTACHMENT_FILES = 10

export type SampleAttachment = {
  id: string; organizationId: number; sampleIds: string[]; type: AttachmentType
  filename: string; mimeType: string; size: number; bytes: Uint8Array
  documentNumber: string; documentDate: string; uploadedAt: string; uploadedBy: string
}
export type AttachmentInput = Pick<SampleAttachment, 'filename' | 'mimeType' | 'bytes'>
export type AttachmentActor = { organizationId: number; userId: number | null; actor: string; at: string }

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Browser-provided MIME can be missing; use only supported extensions and reject mismatches. */
export function attachmentMime(filename: string, mimeType: string): string | null {
  const extension = filename.toLowerCase().split('.').pop() ?? ''
  const expected = MIME_BY_EXTENSION[extension]
  const given = mimeType.trim().toLowerCase()
  return expected && (!given || given === expected || given === 'application/octet-stream') ? expected : null
}

function authorize(state: MockState, context: AttachmentActor, action: 'create' | 'update' = 'update') {
  const user = state.users.find(item => item.id === context.userId && item.status !== 'blocked')
  const org = state.organizations.find(item => item.id === context.organizationId)
  if (!user || !org || !can(toSnapshot(state), user.id, 'requests', action, { type:'organization', organizationId:org.id, corporationId:org.corporationId })) throw new Error('forbidden')
}

function targetSamples(state: MockState, ids: string[], organizationId: number): Sample[] {
  const unique = [...new Set(ids)]
  if (!unique.length) throw new Error('missing-sample')
  const samples = unique.map(id => (state.samples ?? []).find(sample => sample.id === id && sample.organizationId === organizationId && !sample.deletedAt))
  if (samples.some(sample => !sample)) throw new Error('missing-sample')
  return samples as Sample[]
}

/** Recheck current permissions and the active target in the same state update. */
export function updateSampleControl(state: MockState, context: AttachmentActor, sampleId: string, decision: Inspection, note: string, location: string, stage: SampleStage | undefined, receivedAt: string): MockState {
  authorize(state, context)
  targetSamples(state, [sampleId], context.organizationId)
  return {...state, samples:changeControl(state.samples ?? [], sampleId, context.organizationId, decision, note, location, context.at, {stage, actor:context.actor, receivedAt})}
}

function withAttachmentEvents(state: MockState, ids: string[], context: AttachmentActor, action: string, files: SampleAttachment[]): MockState {
  const selected = new Set(ids)
  return { ...state, samples:(state.samples ?? []).map(sample => !selected.has(sample.id) || sample.organizationId !== context.organizationId ? sample : {
    ...sample,
    events:[...sample.events, ...files.map(file => ({ at:context.at, actor:context.actor.trim() || undefined, text:`${action}: ${file.filename} (${file.type})` }))],
  }) }
}

export function addSampleAttachments(state: MockState, context: AttachmentActor, sampleIds: string[], type: AttachmentType, number: string, date: string, files: AttachmentInput[]): MockState {
  authorize(state, context)
  return storeAttachments(state, context, sampleIds, type, number, date, files)
}

export type RegistrationDocuments = { type: AttachmentType; files: AttachmentInput[]; existingId?: string }

/** Register the samples and their common files as one mock database operation. */
export function registerWithDocuments(state: MockState, context: AttachmentActor, items: Sample[], documents?: RegistrationDocuments): MockState {
  authorize(state, context, 'create')
  if (items.some(item => item.organizationId !== context.organizationId)) throw new Error('forbidden')
  const normalized = items.map(item => {
    const parent = item.parentId && (state.samples ?? []).find(record => record.id === item.parentId && record.organizationId === item.organizationId && !record.deletedAt)
    const type = parent && sampleTypeOf(parent)
    return parent && type && type !== 'Не указан' ? {...item, ...inheritedSampleOrigin(parent), kind:parent.kind, sampleType:type} : item
  })
  if (findRegistrationDuplicates(normalized, state.samples ?? [], context.organizationId).size) throw new Error('duplicate-sample')
  const result = registerSamples(state.samples ?? [], state.sampleIdCounters ?? {}, items, context.at)
  let next: MockState = { ...state, samples:result.records, sampleIdCounters:result.counters }
  if (documents?.existingId) {
    const file = (next.sampleAttachments ?? []).find(item => item.id === documents.existingId && item.organizationId === context.organizationId)
    if (!file) throw new Error('missing-file')
    const ids = items.map(item => item.id)
    next = { ...withAttachmentEvents(next, ids, context, 'Добавлен файл', [file]), sampleAttachments:(next.sampleAttachments ?? []).map(item => item.id === file.id ? {...item, sampleIds:[...new Set([...item.sampleIds, ...ids])]} : item) }
  }
  return documents?.files.length ? storeAttachments(next, context, items.map(item => item.id), documents.type, '', '', documents.files) : next
}

function storeAttachments(state: MockState, context: AttachmentActor, sampleIds: string[], type: AttachmentType, number: string, date: string, files: AttachmentInput[]): MockState {
  const targets = targetSamples(state, sampleIds, context.organizationId)
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(type)) throw new Error('invalid-type')
  if (!files.length || files.length > MAX_ATTACHMENT_FILES) throw new Error('file-count')
  if (files.reduce((sum, file) => sum + file.bytes.byteLength, 0) > MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('total-size')
  const added: SampleAttachment[] = files.map(file => {
    const mime = attachmentMime(file.filename, file.mimeType)
    if (!mime || (type === 'Фото входного контроля' && !mime.startsWith('image/'))) throw new Error('invalid-file')
    if (!file.bytes.byteLength || file.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('file-size')
    return { id:crypto.randomUUID(), organizationId:context.organizationId, sampleIds:targets.map(item => item.id), type, filename:file.filename, mimeType:mime, size:file.bytes.byteLength, bytes:file.bytes, documentNumber:number.trim(), documentDate:date, uploadedAt:context.at, uploadedBy:context.actor.trim() }
  })
  return { ...withAttachmentEvents(state, targets.map(item => item.id), context, 'Добавлен файл', added), sampleAttachments:[...(state.sampleAttachments ?? []), ...added] }
}

export function linkSampleAttachment(state: MockState, context: AttachmentActor, sampleId: string, fileId: string): MockState {
  authorize(state, context)
  targetSamples(state, [sampleId], context.organizationId)
  const file = (state.sampleAttachments ?? []).find(item => item.id === fileId && item.organizationId === context.organizationId)
  if (!file) throw new Error('missing-file')
  if (file.sampleIds.includes(sampleId)) return state
  return { ...withAttachmentEvents(state, [sampleId], context, 'Добавлен файл', [file]), sampleAttachments:(state.sampleAttachments ?? []).map(item => item.id === fileId && item.organizationId === context.organizationId ? { ...item, sampleIds:[...item.sampleIds, sampleId] } : item) }
}

export function unlinkSampleAttachment(state: MockState, context: AttachmentActor, sampleId: string, fileId: string): MockState {
  authorize(state, context)
  targetSamples(state, [sampleId], context.organizationId)
  const file = (state.sampleAttachments ?? []).find(item => item.id === fileId && item.organizationId === context.organizationId && item.sampleIds.includes(sampleId))
  if (!file) throw new Error('missing-file')
  const remaining = file.sampleIds.filter(id => id !== sampleId)
  const files = (state.sampleAttachments ?? []).flatMap(item => item.id !== fileId || item.organizationId !== context.organizationId ? [item] : remaining.length ? [{...item, sampleIds:remaining}] : [])
  return { ...withAttachmentEvents(state, [sampleId], context, 'Убран файл из пробы', [file]), sampleAttachments:files }
}
