import { findRegistrationDuplicates } from './duplicates'
import { sampleTypeOf, withInheritedOrigin } from './origin'
import { registerSamples } from './sample'
import type { Sample, SampleCodeCounters } from './types'

export const ATTACHMENT_TYPES = [
  'Акт приёма-передачи',
  'Ведомость проб',
  'Сопроводительный документ',
  'Акт входного контроля / осмотра',
  'Фото входного контроля',
] as const

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number] | 'Ведомость проб / керна'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_TOTAL_BYTES = 30 * 1024 * 1024
export const MAX_ATTACHMENT_FILES = 10

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export function displayAttachmentType(type: AttachmentType): string {
  return type === 'Ведомость проб / керна' ? 'Ведомость проб' : type
}

/**
 * Browser MIME may be empty. A supported extension is accepted when the type is empty,
 * missing, or `application/octet-stream`. A conflicting type is rejected.
 */
export function attachmentMime(filename: string, mimeType: string): string | null {
  const extension = filename.toLowerCase().split('.').pop() ?? ''
  const expected = MIME_BY_EXTENSION[extension]
  const given = mimeType.trim().toLowerCase()
  if (!expected) return null
  if (!given || given === expected || given === 'application/octet-stream') return expected
  return null
}

export type SampleAttachment = {
  id: string
  organizationId: number
  sampleIds: string[]
  type: AttachmentType
  filename: string
  mimeType: string
  size: number
  /** Payload the mock store will keep. A production file service is a later contract. */
  bytes: Uint8Array
  documentNumber: string
  documentDate: string
  uploadedAt: string
  uploadedBy: string
}

export type AttachmentInput = Pick<SampleAttachment, 'filename' | 'mimeType' | 'bytes'>

export type SampleAttachmentState = {
  samples: Sample[]
  attachments: SampleAttachment[]
}

export type RegistrationDocuments = {
  type: AttachmentType
  files: AttachmentInput[]
  existingId?: string
}

export type AttachmentActor = {
  organizationId: number
  actor: string
  at: string
}

function activeSamples(samples: readonly Sample[], ids: readonly string[], organizationId: number): Sample[] {
  const unique = [...new Set(ids)]
  if (!unique.length) throw new Error('missing-sample')
  const found = unique.map((id) => samples.find((sample) => sample.id === id && sample.organizationId === organizationId && !sample.deletedAt))
  if (found.some((sample) => !sample)) throw new Error('missing-sample')
  return found as Sample[]
}

function withAttachmentEvents(samples: readonly Sample[], ids: readonly string[], actor: AttachmentActor, action: string, files: readonly SampleAttachment[]): Sample[] {
  const selected = new Set(ids)
  return samples.map((sample) => {
    if (!selected.has(sample.id) || sample.organizationId !== actor.organizationId) return sample
    return {
      ...sample,
      events: [
        ...sample.events,
        ...files.map((file) => ({ at: actor.at, actor: actor.actor.trim() || undefined, text: `${action}: ${file.filename} (${file.type})` })),
      ],
    }
  })
}

function storeAttachments(
  state: SampleAttachmentState,
  actor: AttachmentActor,
  sampleIds: readonly string[],
  type: AttachmentType,
  number: string,
  date: string,
  files: readonly AttachmentInput[],
): SampleAttachmentState {
  const targets = activeSamples(state.samples, sampleIds, actor.organizationId)
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(type)) throw new Error('invalid-type')
  if (!files.length || files.length > MAX_ATTACHMENT_FILES) throw new Error('file-count')
  if (files.reduce((sum, file) => sum + file.bytes.byteLength, 0) > MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('total-size')
  const added: SampleAttachment[] = files.map((file) => {
    const mime = attachmentMime(file.filename, file.mimeType)
    if (!mime || (type === 'Фото входного контроля' && !mime.startsWith('image/'))) throw new Error('invalid-file')
    if (!file.bytes.byteLength || file.bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('file-size')
    return {
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      sampleIds: targets.map((item) => item.id),
      type,
      filename: file.filename,
      mimeType: mime,
      size: file.bytes.byteLength,
      bytes: file.bytes,
      documentNumber: number.trim(),
      documentDate: date,
      uploadedAt: actor.at,
      uploadedBy: actor.actor.trim(),
    }
  })
  return {
    samples: withAttachmentEvents(state.samples, targets.map((item) => item.id), actor, 'Добавлен файл', added),
    attachments: [...state.attachments, ...added],
  }
}

export function addSampleAttachments(
  state: SampleAttachmentState,
  actor: AttachmentActor,
  sampleIds: readonly string[],
  type: AttachmentType,
  number: string,
  date: string,
  files: readonly AttachmentInput[],
): SampleAttachmentState {
  return storeAttachments(state, actor, sampleIds, type, number, date, files)
}

/**
 * Registers samples and their shared documents as one result.
 * A thrown error leaves the caller's arrays unchanged: the caller saves only the returned value.
 * Who may call this is decided by the mock service, not here.
 */
export function registerSamplesWithDocuments(
  state: SampleAttachmentState,
  counters: SampleCodeCounters,
  actor: AttachmentActor,
  items: readonly Sample[],
  documents?: RegistrationDocuments,
): { records: Sample[]; counters: SampleCodeCounters; attachments: SampleAttachment[] } {
  if (items.some((item) => item.organizationId !== actor.organizationId)) throw new Error('organization-mismatch')
  const normalized = items.map((item) => {
    const parent = item.parentId
      ? state.samples.find((record) => record.id === item.parentId && record.organizationId === item.organizationId && !record.deletedAt)
      : undefined
    const type = parent ? sampleTypeOf(parent) : undefined
    return parent && type && type !== 'Не указан' ? withInheritedOrigin(item, parent) : item
  })
  if (findRegistrationDuplicates(normalized, state.samples, actor.organizationId).size) throw new Error('duplicate-sample')
  if (documents?.existingId) {
    const file = state.attachments.find((item) => item.id === documents.existingId && item.organizationId === actor.organizationId)
    if (!file) throw new Error('missing-file')
  }
  const registered = registerSamples(state.samples, counters, items, actor.at)
  let next: SampleAttachmentState = { samples: registered.records, attachments: [...state.attachments] }
  if (documents?.existingId) {
    const file = next.attachments.find((item) => item.id === documents.existingId && item.organizationId === actor.organizationId)
    if (!file) throw new Error('missing-file')
    const ids = items.map((item) => item.id)
    next = {
      samples: withAttachmentEvents(next.samples, ids, actor, 'Добавлен файл', [file]),
      attachments: next.attachments.map((item) => item.id === file.id ? { ...item, sampleIds: [...new Set([...item.sampleIds, ...ids])] } : item),
    }
  }
  if (documents?.files.length) {
    next = storeAttachments(next, actor, items.map((item) => item.id), documents.type, '', '', documents.files)
  }
  return { records: next.samples, counters: registered.counters, attachments: next.attachments }
}

export function linkSampleAttachment(
  state: SampleAttachmentState,
  actor: AttachmentActor,
  sampleId: string,
  fileId: string,
): SampleAttachmentState {
  activeSamples(state.samples, [sampleId], actor.organizationId)
  const file = state.attachments.find((item) => item.id === fileId && item.organizationId === actor.organizationId)
  if (!file) throw new Error('missing-file')
  if (file.sampleIds.includes(sampleId)) return state
  return {
    samples: withAttachmentEvents(state.samples, [sampleId], actor, 'Добавлен файл', [file]),
    attachments: state.attachments.map((item) => item.id === fileId && item.organizationId === actor.organizationId
      ? { ...item, sampleIds: [...item.sampleIds, sampleId] }
      : item),
  }
}

export function unlinkSampleAttachment(
  state: SampleAttachmentState,
  actor: AttachmentActor,
  sampleId: string,
  fileId: string,
): SampleAttachmentState {
  activeSamples(state.samples, [sampleId], actor.organizationId)
  const file = state.attachments.find((item) => item.id === fileId && item.organizationId === actor.organizationId && item.sampleIds.includes(sampleId))
  if (!file) throw new Error('missing-file')
  const remaining = file.sampleIds.filter((id) => id !== sampleId)
  const attachments = state.attachments.flatMap((item) => {
    if (item.id !== fileId || item.organizationId !== actor.organizationId) return [item]
    return remaining.length ? [{ ...item, sampleIds: remaining }] : []
  })
  return {
    samples: withAttachmentEvents(state.samples, [sampleId], actor, 'Убран файл из пробы', [file]),
    attachments,
  }
}
