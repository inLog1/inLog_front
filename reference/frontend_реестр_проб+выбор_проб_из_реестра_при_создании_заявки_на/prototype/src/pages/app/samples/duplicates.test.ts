import { describe, expect, it } from 'vitest'
import { createSeed } from '../../../app/mocks/db/seed'
import { demoSamples } from './model'
import { findRegistrationDuplicates, findSafeDuplicateIds, removeSafeDuplicates } from './duplicates'
import { registerWithDocuments } from './attachments'

const first = {...demoSamples[0], id:'first', code:'PRB-2026-000001', externalCode:'SRC-1', stage:'Поступила' as const, inspection:'Не проведён' as const, inspectionNote:'', events:[{at:'2026-11-11T10:00:00Z', text:'Зарегистрировано поступление. Статус: Поступила'}]}
const repeated = {...first, id:'copy', code:'PRB-2026-000002', events:[{at:'2026-11-12T10:00:00Z', text:'Зарегистрировано поступление. Статус: Поступила'}]}
const state = () => ({...createSeed(), samples:[first, repeated]})

describe('duplicate samples', () => {
  it('finds and soft-deletes the later exact unmodified copy while preserving the original', () => {
    const initial = state()
    expect(findSafeDuplicateIds(initial, 101)).toEqual(['copy'])
    const next = removeSafeDuplicates(initial, 101, 1, 'Администратор', '2026-11-12T12:00:00Z')
    expect(next.samples?.find(item => item.id === 'first')).toEqual(first)
    expect(next.samples?.find(item => item.id === 'copy')?.deletedAt).toBe('2026-11-12T12:00:00Z')
    expect(initial.samples[1]).not.toHaveProperty('deletedAt')
    expect(() => removeSafeDuplicates(initial, 101, 3, 'Сотрудник', '')).toThrow('forbidden')
  })
  it('does not remove samples with edited history, different data, or attachments', () => {
    const edited = {...repeated, events:[...repeated.events, {at:'2026-11-12', text:'Изменено'}]}
    expect(findSafeDuplicateIds({...state(), samples:[first, edited]}, 101)).toEqual([])
    expect(findSafeDuplicateIds({...state(), samples:[first, {...repeated, container:'иная тара'}]}, 101)).toEqual([])
    const attachment = {id:'file', organizationId:101, sampleIds:['copy'], type:'Акт приёма-передачи' as const, filename:'a.pdf', mimeType:'application/pdf', size:1, bytes:new Uint8Array([1]), documentNumber:'', documentDate:'', uploadedAt:'', uploadedBy:''}
    expect(findSafeDuplicateIds({...state(), sampleAttachments:[attachment]}, 101)).toEqual([])
  })
  it('detects duplicates against existing records and within the same import', () => {
    expect([...findRegistrationDuplicates([repeated], [first], 101)]).toEqual([0])
    expect([...findRegistrationDuplicates([first, repeated], [], 101)]).toEqual([1])
    expect(findRegistrationDuplicates([{...repeated, externalCode:''}], [first], 101).size).toBe(0)
    expect(findRegistrationDuplicates([repeated], [first], 102).size).toBe(0)
  })
  it('checks again before saving and does not persist a duplicate batch', () => {
    expect(() => registerWithDocuments(state(), {organizationId:101,userId:1,actor:'',at:'2026-11-12T12:00:00Z'}, [{...repeated,id:'new',code:''}])).toThrow('duplicate-sample')
  })
})
