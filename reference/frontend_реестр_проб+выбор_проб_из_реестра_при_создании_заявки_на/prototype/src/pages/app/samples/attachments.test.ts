import { describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { createSeed } from '../../../app/mocks/db/seed'
import { ensureMockState, readMockState, setMockLockSource, updateMockState } from '../../../app/mocks/db/repository'
import { addSampleAttachments, attachmentMime, linkSampleAttachment, MAX_ATTACHMENT_BYTES, registerWithDocuments, unlinkSampleAttachment, updateSampleControl, type AttachmentActor } from './attachments'
import { initialSamples } from './model'

const context: AttachmentActor = { organizationId:101, userId:1, actor:'Иванов И.И.', at:'2026-11-12T08:30:00Z' }
const pdf = { filename:'акт.pdf', mimeType:'application/pdf', bytes:new Uint8Array([37,80,68,70]) }
const photo = { filename:'тара.jpg', mimeType:'image/jpeg', bytes:new Uint8Array([1,2,3]) }
const seed = () => ({ ...createSeed(), samples:initialSamples(true) })

describe('sample attachments', () => {
  it('checks current access and active sample before changing control details', () => {
    const state = seed()
    const updated = updateSampleControl(state, context, 'core-1', 'Соответствует', '', 'Склад', 'На хранении', '2026-11-12')
    expect(updated.samples?.find(item => item.id === 'core-1')?.location).toBe('Склад')
    expect(() => updateSampleControl(state, {...context, userId:3}, 'core-1', 'Соответствует', '', 'Склад', 'На хранении', '2026-11-12')).toThrow('forbidden')
    expect(() => updateSampleControl(state, {...context, organizationId:102}, 'core-1', 'Соответствует', '', 'Склад', 'На хранении', '2026-11-12')).toThrow('missing-sample')
    const deleted = {...state, samples:state.samples.map(item => item.id === 'core-1' ? {...item, deletedAt:'2026-11-12'} : item)}
    expect(() => updateSampleControl(deleted, context, 'core-1', 'Соответствует', '', 'Склад', 'На хранении', '2026-11-12')).toThrow('missing-sample')
  })
  it('stores one file for multiple samples with events and metadata', () => {
    const state = seed()
    const next = addSampleAttachments(state, context, ['core-1','core-2'], 'Акт приёма-передачи', '10', '2026-11-12', [pdf])
    expect(next.sampleAttachments).toHaveLength(1)
    expect(next.sampleAttachments?.[0]).toMatchObject({sampleIds:['core-1','core-2'], filename:'акт.pdf', documentNumber:'10', documentDate:'2026-11-12', uploadedBy:'Иванов И.И.', size:4})
    expect(next.samples?.find(item => item.id === 'core-1')?.events.at(-1)?.text).toContain('акт.pdf')
    expect(next.samples?.find(item => item.id === 'core-2')?.events.at(-1)?.actor).toBe('Иванов И.И.')
    expect(state.samples[0].events).not.toEqual(next.samples?.[0].events)
  })
  it('registers a batch and links one common document to every new sample', () => {
    const state = seed()
    const items = ['batch-one','batch-two'].map(id => ({...state.samples[0], id, code:'', events:[]}))
    const result = registerWithDocuments(state, context, items, {type:'Акт приёма-передачи', files:[pdf]})
    expect(result.sampleAttachments?.[0].sampleIds).toEqual(['batch-one','batch-two'])
    expect(result.samples?.find(item => item.id === 'batch-one')?.code).toBe('PRB-2026-000001')
    expect(result.samples?.find(item => item.id === 'batch-two')?.events[0].text).toContain('акт.pdf')
    expect(state.samples).toHaveLength(initialSamples(true).length)
  })
  it('does not partially register a batch if the document is invalid or access is denied', () => {
    const state = seed()
    const item = {...state.samples[0], id:'new-batch-item', code:'', events:[]}
    expect(() => registerWithDocuments(state, context, [item], {type:'Фото входного контроля', files:[pdf]})).toThrow('invalid-file')
    expect(() => registerWithDocuments(state, {...context,userId:99999}, [item])).toThrow('forbidden')
    expect(state.samples.some(sample => sample.id === item.id)).toBe(false)
    expect(state.sampleAttachments).toBeUndefined()
  })
  it('reuses an existing document when registering another sample', () => {
    const before = addSampleAttachments(seed(), context, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])
    const documentId = before.sampleAttachments![0].id
    const item = {...before.samples![0], id:'another-sample', code:'', events:[]}
    const result = registerWithDocuments(before, context, [item], {type:'Акт приёма-передачи', files:[], existingId:documentId})
    expect(result.sampleAttachments).toHaveLength(1)
    expect(result.sampleAttachments?.[0].sampleIds).toEqual(['core-1','another-sample'])
    expect(result.samples?.find(sample => sample.id === item.id)?.events[0].text).toContain('акт.pdf')
    expect(() => registerWithDocuments(before, context, [item], {type:'Акт приёма-передачи', files:[], existingId:'missing'})).toThrow('missing-file')
  })
  it('links an existing file and unlinks only the chosen sample', () => {
    const initial = addSampleAttachments(seed(), context, ['core-1','core-2'], 'Фото входного контроля', '', '', [photo])
    const id = initial.sampleAttachments![0].id
    const linked = linkSampleAttachment(initial, context, 'fluid-1', id)
    expect(linked.sampleAttachments![0].sampleIds).toEqual(['core-1','core-2','fluid-1'])
    expect(linkSampleAttachment(linked, context, 'fluid-1', id)).toBe(linked)
    const withoutOne = unlinkSampleAttachment(linked, context, 'core-1', id)
    expect(withoutOne.sampleAttachments![0].sampleIds).toEqual(['core-2','fluid-1'])
    expect(withoutOne.samples?.find(item => item.id === 'core-1')?.events.at(-1)?.text).toContain('Убран файл')
    const withoutTwo = unlinkSampleAttachment(withoutOne, context, 'core-2', id)
    expect(unlinkSampleAttachment(withoutTwo, context, 'fluid-1', id).sampleAttachments).toEqual([])
  })
  it('checks role, organization and active samples for all mutations', () => {
    const state = seed()
    expect(() => addSampleAttachments(state, {...context,userId:3}, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('forbidden')
    expect(() => addSampleAttachments(state, {...context,organizationId:102}, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('missing-sample')
    expect(() => addSampleAttachments(state, context, ['core-1','unknown'], 'Акт приёма-передачи', '', '', [pdf])).toThrow('missing-sample')
    const initial = addSampleAttachments(state, context, ['core-1'], 'Акт приёма-передачи', '', '', [pdf])
    const id = initial.sampleAttachments![0].id
    expect(() => linkSampleAttachment(initial, {...context,organizationId:102}, 'core-1', id)).toThrow('missing-sample')
    const otherOrg = { ...initial, samples:[...(initial.samples ?? []), {...initial.samples![0], id:'other-org', organizationId:102}] }
    expect(() => linkSampleAttachment(otherOrg, {...context,organizationId:102}, 'other-org', id)).toThrow('missing-file')
    expect(() => unlinkSampleAttachment(initial, {...context,userId:3}, 'core-1', id)).toThrow('forbidden')
  })
  it('validates formats, photos and file sizes', () => {
    expect(attachmentMime('образец.xlsx', '')).toContain('spreadsheetml')
    expect(attachmentMime('image.jpg', 'text/html')).toBeNull()
    expect(attachmentMime('image.svg', 'image/svg+xml')).toBeNull()
    expect(() => addSampleAttachments(seed(), context, ['core-1'], 'Фото входного контроля', '', '', [pdf])).toThrow('invalid-file')
    expect(() => addSampleAttachments(seed(), context, ['core-1'], 'Акт приёма-передачи', '', '', [{...pdf,bytes:new Uint8Array()}])).toThrow('file-size')
    expect(() => addSampleAttachments(seed(), context, ['core-1'], 'Акт приёма-передачи', '', '', [{...pdf,bytes:new Uint8Array(MAX_ATTACHMENT_BYTES + 1)}])).toThrow('file-size')
    expect(() => addSampleAttachments(seed(), context, ['core-1'], 'Акт приёма-передачи', '', '', [])).toThrow('file-count')
    const state = seed()
    expect(() => addSampleAttachments(state, context, ['core-1'], 'Фото входного контроля', '', '', [photo, pdf])).toThrow('invalid-file')
    expect(state.sampleAttachments).toBeUndefined()
  })
  it('persists binary content and shared links in the mock database', async () => {
    Object.assign(globalThis, { indexedDB })
    setMockLockSource(() => ({ request: ((_name: string, _options: unknown, callback: (lock: object) => unknown) => { void callback({}); return Promise.resolve() }) as LockManager['request'] }))
    const namespace = `inlog:mock:sample-files-${crypto.randomUUID()}`
    try {
      await ensureMockState(namespace)
      await updateMockState(state => addSampleAttachments({...state,samples:initialSamples(true)}, context, ['core-1','core-2'], 'Акт приёма-передачи', '', '', [pdf]), namespace)
      const stored = await readMockState(namespace)
      expect(stored.ok && stored.state.sampleAttachments?.[0].sampleIds).toEqual(['core-1','core-2'])
      expect(stored.ok && Array.from(stored.state.sampleAttachments?.[0].bytes ?? [])).toEqual([37,80,68,70])
    } finally { setMockLockSource(null) }
  })
})
