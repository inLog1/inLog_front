import { describe, expect, it } from 'vitest'
import { hasSelectedLineage } from './lineage'
import { makeSample } from './fixture'
import { deleteSample, registerSamples } from './sample'
import { batchSamples, parseSampleBatch, SAMPLE_BATCH_COLUMNS, sampleBatchTemplateCsv } from './batch'
import { displaySampleInterval } from './origin'

const at = '2026-11-13T10:00:00Z'

describe('sample subsamples', () => {
  const parent = makeSample({ code: 'PRB-2026-000001' })
  const child = makeSample({
    id: 'child',
    code: '',
    parentId: parent.id,
    sampleType: 'Газ',
    kind: 'Флюид',
    field: 'Другое',
    well: '999',
    formation: 'Иной',
    interval: '1–2',
    subsampleInterval: '1140–1141',
    collectedAt: '2025-01-01',
    events: [{ at, actor: 'Тест', text: 'Зарегистрировано поступление' }],
  })

  it('creates a child number, copies origin, and refuses to delete a parent that still has a child', () => {
    const result = registerSamples([parent], {}, [child], at)
    const registered = result.records.find((item) => item.id === 'child')!
    expect(registered.code).toBe('PRB-2026-000001-01')
    expect(registered.parentId).toBe(parent.id)
    expect(registered.sampleType).toBe('Керн')
    expect(registered.kind).toBe('Керн')
    expect(registered).toMatchObject({
      field: parent.field,
      well: parent.well,
      formation: parent.formation,
      interval: parent.interval,
      collectedAt: parent.collectedAt,
      subsampleInterval: '1140–1141',
    })
    expect(displaySampleInterval(registered)).toEqual({ value: '1140–1141', inherited: false })
    expect(registered.events.at(-1)?.text).toContain(parent.code)
    expect(result.records[0].events.at(-1)?.text).toContain(registered.code)
    expect(result.records[0].code).toBe(parent.code)
    expect(() => deleteSample(result.records, parent.id, 101, '2026-11-14', 'Тест')).toThrow('has-children')
    const removed = deleteSample(result.records, registered.id, 101, '2026-11-14', 'Тест')
    expect(removed.find((item) => item.id === parent.id)?.events.at(-1)?.text).toContain('Подпроба PRB-2026-000001-01 удалена')
    expect(() => deleteSample(removed, parent.id, 101, '2026-11-14', 'Тест')).not.toThrow()
  })

  it('numbers siblings without reusing a deleted suffix and nests the next level on the parent interval', () => {
    const first = registerSamples([parent], {}, [child, { ...child, id: 'second' }], at)
    expect(first.records.slice(-2).map((item) => item.code)).toEqual(['PRB-2026-000001-01', 'PRB-2026-000001-02'])
    const removed = deleteSample(first.records, 'child', 101, '2026-11-14', 'Тест')
    const more = registerSamples(removed, first.counters, [
      { ...child, id: 'third' },
      { ...child, id: 'nested', parentId: 'second', subsampleInterval: '' },
    ], '2026-11-14T10:00:00Z')
    expect(more.records.find((item) => item.id === 'third')?.code).toBe('PRB-2026-000001-03')
    const nested = more.records.find((item) => item.id === 'nested')
    expect(nested?.code).toBe('PRB-2026-000001-02-01')
    expect(nested?.interval).toBe('1140–1141')
    expect(displaySampleInterval(nested!)).toEqual({ value: '1140–1141', inherited: true })
    expect(isSampleCodeSafe(nested?.code)).toBe(true)
  })

  it('rejects a missing, foreign, disposed or same-batch parent', () => {
    const disposed = { ...parent, stage: 'Утилизирована' as const }
    const foreign = { ...parent, organizationId: 102 }
    for (const records of [[], [foreign], [disposed]]) {
      expect(() => registerSamples(records, {}, [child], at)).toThrow('invalid-parent')
    }
    const pendingParent = makeSample({ id: 'pending', code: '' })
    expect(() => registerSamples([], {}, [pendingParent, { ...child, parentId: 'pending' }], at)).toThrow('invalid-parent')
  })

  it('detects a selected ancestor without selecting the sample between them', () => {
    const grandchild = { ...child, id: 'grandchild', parentId: child.id }
    expect(hasSelectedLineage([parent, child, grandchild], [parent.id, grandchild.id])).toBe(true)
    expect(hasSelectedLineage([parent, child, grandchild], [grandchild.id])).toBe(false)
    expect(hasSelectedLineage([parent, { ...grandchild, linkedAncestorIds: [parent.id] }], [parent.id, grandchild.id])).toBe(true)
  })

  it('reads a parent number from CSV and checks inherited cells', () => {
    const header = sampleBatchTemplateCsv()
    const row = (cells: Record<string, string>) => SAMPLE_BATCH_COLUMNS.map(([key]) => cells[key] ?? '').join(';')
    const base = {
      kind: 'Керн',
      field: 'Северное',
      well: '101',
      receivedAt: '2026-11-13',
      location: 'Склад',
      parentCode: parent.code,
    }
    const matched = parseSampleBatch(header + row(base), [parent], 101)
    expect(matched.rows[0].errors).toEqual([])
    expect(batchSamples(matched.rows, 101, at, undefined, [parent])[0].parentId).toBe(parent.id)

    const blankType = parseSampleBatch(header + row({ ...base, kind: '' }), [parent], 101)
    expect(blankType.rows[0].errors).toEqual([])
    expect(batchSamples(blankType.rows, 101, '', undefined, [parent])[0].sampleType).toBe('Керн')

    const blankOrigin = parseSampleBatch(header + row({ ...base, field: '', well: '', kind: '' }), [parent], 101)
    expect(blankOrigin.rows[0].errors).toEqual([])
    expect(batchSamples(blankOrigin.rows, 101, '', undefined, [parent])[0]).toMatchObject({
      field: parent.field,
      well: parent.well,
      formation: parent.formation,
      interval: parent.interval,
      collectedAt: parent.collectedAt,
    })

    const withInterval = parseSampleBatch(header + row({ ...base, subsampleInterval: '1140–1141' }), [parent], 101)
    expect(withInterval.rows[0].errors).toEqual([])
    expect(batchSamples(withInterval.rows, 101, '', undefined, [parent])[0].subsampleInterval).toBe('1140–1141')

    const otherField = parseSampleBatch(header + row({ ...base, field: 'Другое месторождение' }), [parent], 101)
    expect(otherField.rows[0].errors.join()).toContain('Месторождение / участок: значение подпробы должно совпадать')
    const otherType = parseSampleBatch(header + row({ ...base, kind: 'Газ' }), [parent], 101)
    expect(otherType.rows[0].errors.join()).toContain('Тип подпробы должен совпадать')
    expect(parseSampleBatch(header + row(base), [], 101).rows[0].errors.join()).toContain('Родительская проба')

    const withoutOwnInterval = `${SAMPLE_BATCH_COLUMNS.slice(0, -1).map(([, label]) => label).join(';')}\r\n${row(base).split(';').slice(0, -1).join(';')}`
    expect(parseSampleBatch(withoutOwnInterval, [parent], 101).rows[0].errors).toEqual([])
  })
})

function isSampleCodeSafe(code: string | undefined): boolean {
  return /^PRB-\d{4}-\d{6,}(?:-\d{2,})*$/i.test(code ?? '')
}
