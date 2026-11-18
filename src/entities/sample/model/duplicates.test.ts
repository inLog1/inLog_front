import { describe, expect, it } from 'vitest'
import { deleteSafeDuplicates, findRegistrationDuplicates, findSafeDuplicateIds } from './duplicates'
import { makeSample } from './fixture'
import { registerSamplesWithDocuments } from './attachments'

const first = makeSample({
  id: 'first',
  code: 'PRB-2026-000001',
  externalCode: 'SRC-1',
  stage: 'Поступила',
  inspection: 'Не проведён',
  inspectionNote: '',
  events: [{ at: '2026-11-11T10:00:00Z', text: 'Зарегистрировано поступление. Статус: Поступила' }],
})
const repeated = makeSample({
  ...first,
  id: 'copy',
  code: 'PRB-2026-000002',
  events: [{ at: '2026-11-12T10:00:00Z', text: 'Зарегистрировано поступление. Статус: Поступила' }],
})

describe('duplicate samples', () => {
  it('soft-deletes the later exact copy and keeps the earlier row', () => {
    const samples = [first, repeated]
    expect(findSafeDuplicateIds(samples, 101)).toEqual(['copy'])
    const next = deleteSafeDuplicates(samples, 101, '2026-11-12T12:00:00Z', 'Администратор')
    expect(next.find((item) => item.id === 'first')).toEqual(first)
    expect(next.find((item) => item.id === 'copy')?.deletedAt).toBe('2026-11-12T12:00:00Z')
    expect(samples[1].deletedAt).toBeUndefined()
  })

  it('keeps a row that was edited, differs, has a file, or is already used by a request', () => {
    const edited = { ...repeated, events: [...repeated.events, { at: '2026-11-12', text: 'Изменено' }] }
    expect(findSafeDuplicateIds([first, edited], 101)).toEqual([])
    expect(findSafeDuplicateIds([first, { ...repeated, container: 'иная тара' }], 101)).toEqual([])
    expect(findSafeDuplicateIds([first, repeated], 101, { attachedSampleIds: ['copy'] })).toEqual([])
    expect(findSafeDuplicateIds([first, repeated], 101, { referencedSampleIds: ['copy'] })).toEqual([])
    expect(findRegistrationDuplicates([{ ...repeated, externalCode: '' }], [first], 101).size).toBe(0)
    expect(findRegistrationDuplicates([repeated], [first], 102).size).toBe(0)
  })

  it('detects an exact repeat against the registry and inside one batch', () => {
    expect([...findRegistrationDuplicates([repeated], [first], 101)]).toEqual([0])
    expect([...findRegistrationDuplicates([first, repeated], [], 101)]).toEqual([1])
  })

  it('rejects a duplicate registration before a number is returned', () => {
    const state = { samples: [first, repeated], attachments: [] }
    expect(() => registerSamplesWithDocuments(
      state,
      {},
      { organizationId: 101, actor: '', at: '2026-11-12T12:00:00Z' },
      [{ ...repeated, id: 'new', code: '' }],
    )).toThrow('duplicate-sample')
    expect(state.samples).toHaveLength(2)
    expect(state.samples[1].deletedAt).toBeUndefined()
  })
})
