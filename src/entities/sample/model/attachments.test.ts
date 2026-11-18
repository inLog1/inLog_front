import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENT_BYTES,
  addSampleAttachments,
  attachmentMime,
  linkSampleAttachment,
  registerSamplesWithDocuments,
  unlinkSampleAttachment,
  type AttachmentActor,
} from './attachments'
import { makeSample } from './fixture'
import { inspectDocumentDraft, prepareDocuments } from './documentDraft'

const actor: AttachmentActor = { organizationId: 101, actor: 'Иванов И.И.', at: '2026-11-12T08:30:00Z' }
const pdf = { filename: 'акт.pdf', mimeType: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]) }
const photo = { filename: 'тара.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) }

function state() {
  return {
    samples: [makeSample({ id: 'core-1' }), makeSample({ id: 'core-2', code: 'PRB-2026-000002' })],
    attachments: [],
  }
}

describe('sample documents', () => {
  it('stores one file on several samples and writes a history entry on each', () => {
    const initial = state()
    const next = addSampleAttachments(initial, actor, ['core-1', 'core-2'], 'Акт приёма-передачи', '10', '2026-11-12', [pdf])
    expect(next.attachments).toHaveLength(1)
    expect(next.attachments[0]).toMatchObject({
      sampleIds: ['core-1', 'core-2'],
      filename: 'акт.pdf',
      documentNumber: '10',
      documentDate: '2026-11-12',
      uploadedBy: 'Иванов И.И.',
      size: 4,
    })
    expect(next.samples.find((item) => item.id === 'core-1')?.events.at(-1)?.text).toContain('акт.pdf')
    expect(next.samples.find((item) => item.id === 'core-2')?.events.at(-1)?.actor).toBe('Иванов И.И.')
    expect(initial.samples[0].events).not.toEqual(next.samples[0].events)
    expect(initial.attachments).toEqual([])
  })

  it('registers a batch and links one document to every new sample', () => {
    const initial = state()
    const items = ['batch-one', 'batch-two'].map((id) => makeSample({
      ...initial.samples[0],
      id,
      code: '',
      externalCode: undefined,
      events: [],
    }))
    const result = registerSamplesWithDocuments(initial, {}, actor, items, { type: 'Акт приёма-передачи', files: [pdf] })
    expect(result.attachments[0].sampleIds).toEqual(['batch-one', 'batch-two'])
    expect(result.records.find((item) => item.id === 'batch-one')?.code).toBe('PRB-2026-000003')
    expect(result.records.find((item) => item.id === 'batch-two')?.events.at(-1)?.text).toContain('акт.pdf')
    expect(initial.samples).toHaveLength(2)
    expect(initial.attachments).toEqual([])
  })

  it('does not return a partial batch when the document is invalid', () => {
    const initial = state()
    const item = makeSample({ ...initial.samples[0], id: 'new-batch-item', code: '', externalCode: undefined, events: [] })
    expect(() => registerSamplesWithDocuments(initial, {}, actor, [item], { type: 'Фото входного контроля', files: [pdf] })).toThrow('invalid-file')
    expect(initial.samples.some((sample) => sample.id === item.id)).toBe(false)
    expect(initial.attachments).toEqual([])
  })

  it('reuses an existing document for another registration', () => {
    const before = addSampleAttachments(state(), actor, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])
    const documentId = before.attachments[0].id
    const item = makeSample({ ...before.samples[0], id: 'another-sample', code: '', externalCode: undefined, events: [] })
    const result = registerSamplesWithDocuments(before, { '2026': 2 }, actor, [item], {
      type: 'Акт приёма-передачи',
      files: [],
      existingId: documentId,
    })
    expect(result.attachments).toHaveLength(1)
    expect(result.attachments[0].sampleIds).toEqual(['core-1', 'another-sample'])
    expect(result.records.find((sample) => sample.id === item.id)?.events[0].text).toContain('акт.pdf')
    expect(() => registerSamplesWithDocuments(before, {}, actor, [item], {
      type: 'Акт приёма-передачи',
      files: [],
      existingId: 'missing',
    })).toThrow('missing-file')
  })

  it('links an existing file and drops the link for one sample only', () => {
    const initial = addSampleAttachments(state(), actor, ['core-1', 'core-2'], 'Фото входного контроля', '', '', [photo])
    const id = initial.attachments[0].id
    const withThird = {
      ...initial,
      samples: [...initial.samples, makeSample({ id: 'fluid-1', code: 'PRB-2026-000003', kind: 'Флюид', sampleType: 'Вода' })],
    }
    const linked = linkSampleAttachment(withThird, actor, 'fluid-1', id)
    expect(linked.attachments[0].sampleIds).toEqual(['core-1', 'core-2', 'fluid-1'])
    expect(linkSampleAttachment(linked, actor, 'fluid-1', id)).toBe(linked)
    const withoutOne = unlinkSampleAttachment(linked, actor, 'core-1', id)
    expect(withoutOne.attachments[0].sampleIds).toEqual(['core-2', 'fluid-1'])
    expect(withoutOne.samples.find((item) => item.id === 'core-1')?.events.at(-1)?.text).toContain('Убран файл')
    const withoutTwo = unlinkSampleAttachment(withoutOne, actor, 'core-2', id)
    expect(unlinkSampleAttachment(withoutTwo, actor, 'fluid-1', id).attachments).toEqual([])
  })

  it('requires an active sample of the same organization', () => {
    const initial = state()
    expect(() => addSampleAttachments(initial, { ...actor, organizationId: 102 }, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('missing-sample')
    expect(() => addSampleAttachments(initial, actor, ['core-1', 'unknown'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('missing-sample')
    const deleted = { ...initial, samples: initial.samples.map((item) => item.id === 'core-1' ? { ...item, deletedAt: actor.at } : item) }
    expect(() => addSampleAttachments(deleted, actor, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('missing-sample')
    const stored = addSampleAttachments(initial, actor, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])
    expect(() => linkSampleAttachment(stored, { ...actor, organizationId: 102 }, 'core-1', stored.attachments[0].id)).toThrow('missing-sample')
  })

  it('checks extensions, photos and size limits', () => {
    expect(attachmentMime('образец.xlsx', '')).toContain('spreadsheetml')
    expect(attachmentMime('image.jpg', 'text/html')).toBeNull()
    expect(attachmentMime('image.svg', 'image/svg+xml')).toBeNull()
    expect(() => addSampleAttachments(state(), actor, ['core-1'], 'Фото входного контроля', '', '', [pdf])).toThrow('invalid-file')
    expect(() => addSampleAttachments(state(), actor, ['core-1'], 'Акт приёма-передачи', '', '', [{ ...pdf, bytes: new Uint8Array() }])).toThrow('file-size')
    expect(() => addSampleAttachments(state(), actor, ['core-1'], 'Акт приёма-передачи', '', '', [{ ...pdf, bytes: new Uint8Array(MAX_ATTACHMENT_BYTES + 1) }])).toThrow('file-size')
    expect(() => addSampleAttachments(state(), actor, ['core-1'], 'Акт приёма-передачи', '', '', [])).toThrow('file-count')
    const initial = state()
    expect(() => addSampleAttachments(initial, actor, ['core-1'], 'Фото входного контроля', '', '', [photo, pdf])).toThrow('invalid-file')
    expect(initial.attachments).toEqual([])
    expect(inspectDocumentDraft({ type: 'Фото входного контроля', files: [{ name: 'акт.pdf', type: 'application/pdf', size: 4, arrayBuffer: async () => new ArrayBuffer(4) }] })).toBe('invalid-file')
    expect(inspectDocumentDraft({ type: 'Акт приёма-передачи', files: [{ name: 'акт.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }] })).toBe('file-size')
  })

  it('prepares document bytes only after the draft passes the limits', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const prepared = await prepareDocuments({
      type: 'Акт приёма-передачи',
      existingId: '',
      files: [{ name: 'акт.pdf', type: 'application/pdf', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer }],
    })
    expect(prepared?.files[0]).toMatchObject({ filename: 'акт.pdf', mimeType: 'application/pdf' })
    expect(Array.from(prepared?.files[0].bytes ?? [])).toEqual([1, 2, 3, 4])
    await expect(prepareDocuments({
      type: 'Акт приёма-передачи',
      existingId: '',
      files: [{ name: 'пусто.pdf', type: 'application/pdf', size: 0, arrayBuffer: async () => new ArrayBuffer(0) }],
    })).rejects.toThrow('file-size')
  })
})
