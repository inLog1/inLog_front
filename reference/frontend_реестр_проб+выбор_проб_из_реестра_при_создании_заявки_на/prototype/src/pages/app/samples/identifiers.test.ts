import { describe, expect, it } from 'vitest'
import { demoSamples, initialSamples, migrateDemoSampleIds, registerSamples, type Sample } from './model'

const makeSample = (id: string, organizationId = 101): Sample => ({
  ...structuredClone(demoSamples[0]), id, organizationId, code:'', externalCode:`Заказчик-${id}`,
})
const at = '2026-11-12T12:00:00Z'

describe('automatic sample identifiers', () => {
  it('assigns consecutive IDs to a batch without altering existing samples', () => {
    const existing = structuredClone(demoSamples)
    const batch = Array.from({length:100}, (_, i) => makeSample(String(i)))
    const result = registerSamples(existing, {}, batch, at)
    expect(result.records.slice(0, existing.length)).toEqual(existing)
    expect(result.records[existing.length]).toMatchObject({code:'PRB-2026-000001', externalCode:'Заказчик-0'})
    expect(result.records.at(-1)?.code).toBe('PRB-2026-000100')
    expect(result.counters['2026']).toBe(100)
    expect(batch[0].code).toBe('')
  })
  it('shares the counter across organizations and does not reuse IDs after deletion', () => {
    const old = {...makeSample('old', 202), code:'prb-2026-000007', deletedAt:at}
    const result = registerSamples([old], {}, [makeSample('new')], at)
    expect(result.records.at(-1)?.code).toBe('PRB-2026-000008')
    const afterRemoval = registerSamples([], result.counters, [makeSample('next', 202)], at)
    expect(afterRemoval.records[0].code).toBe('PRB-2026-000009')
  })
  it('starts a new sequence for a new registration year', () => {
    const result = registerSamples([], {'2026':100}, [makeSample('one')], '2027-06-01T12:00:00Z')
    expect(result.records[0].code).toBe('PRB-2027-000001')
    expect(result.counters).toEqual({'2026':100, '2027':1})
  })
  it('fails without changing the source data if a batch has an invalid sample', () => {
    const records = [makeSample('old')]
    const counters = {'2026':3}
    expect(() => registerSamples(records, counters, [makeSample('valid'), {...makeSample('bad'), field:''}], at)).toThrow('required')
    expect(records).toHaveLength(1)
    expect(counters).toEqual({'2026':3})
  })
  it('updates only the original examples and preserves their edits and original markings', () => {
    const examples = initialSamples(true)
    examples[0] = {...examples[0], location:'Изменённое место'}
    const user = {...makeSample('user'), code:'PRB-2026-000003'}
    const result = migrateDemoSampleIds([...examples, user], {'2026':20})
    const ids = result.records.map(item => item.code)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.records[0]).toMatchObject({id:examples[0].id, code:'PRB-2026-000021', externalCode:examples[0].code, location:'Изменённое место'})
    expect(result.records.at(-1)).toEqual(user)
    expect(result.counters['2026']).toBe(31)
    expect(migrateDemoSampleIds(result.records, result.counters).changed).toBe(false)
  })
  it('does not change a non-example record with an old-looking code', () => {
    const user = {...makeSample('user'), code:demoSamples[0].code}
    const result = migrateDemoSampleIds([user], {})
    expect(result.changed).toBe(false)
    expect(result.records[0]).toEqual(user)
  })
})
