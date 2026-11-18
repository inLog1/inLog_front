import { describe, expect, it } from 'vitest'
import { demoSamples, registerSamples, deleteSample } from './model'
import { batchSamples, COLUMNS, validateBatchRows } from './batch'
import { createSampleTemplate, readSampleWorkbook } from './workbook'
import * as ExcelJS from 'exceljs'
import { hasSelectedLineage } from './lineage'

describe('sample lineage', () => {
  const parent = {...demoSamples[0], code:'PRB-2026-000001'}
  const child = {...parent, id:'child', code:'', parentId:parent.id, events:[{at:'2026-11-13T10:00:00Z', actor:'Тест', text:'Зарегистрировано поступление'}]}
  it('registers a child with a parent-based ID and records lineage in both histories', () => {
    const result = registerSamples([parent], {}, [child], '2026-11-13T10:00:00Z')
    const registered = result.records.find(item => item.id === 'child')!
    expect(registered.code).toBe('PRB-2026-000001-01')
    expect(registered.parentId).toBe(parent.id)
    expect(registered.events.at(-1)?.text).toContain(parent.code)
    expect(result.records[0].events.at(-1)?.text).toContain(registered.code)
    expect(() => deleteSample(result.records, parent.id, 101, '2026-11-14', 'Тест')).toThrow('has-children')
    const removed = deleteSample(result.records, registered.id, 101, '2026-11-14', 'Тест')
    expect(removed.find(item => item.id === parent.id)?.events.at(-1)?.text).toContain('Подпроба PRB-2026-000001-01 удалена')
    expect(() => deleteSample(removed, parent.id, 101, '2026-11-14', 'Тест')).not.toThrow()
  })
  it('inherits type, numbers siblings without reusing deleted codes, and supports nested children', () => {
    const wrongType = {...child, sampleType:'Газ' as const, kind:'Флюид' as const, field:'Другое', well:'999', formation:'Иной', interval:'1–2', subsampleInterval:'1140–1141', collectedAt:'2025-01-01'}
    const first = registerSamples([parent], {}, [wrongType, {...wrongType, id:'second'}], '2026-11-13T10:00:00Z')
    expect(first.records.slice(-2).map(item => [item.code, item.sampleType, item.kind])).toEqual([
      ['PRB-2026-000001-01', 'Керн', 'Керн'], ['PRB-2026-000001-02', 'Керн', 'Керн'],
    ])
    expect(first.records.find(item => item.id === 'child')).toMatchObject({field:parent.field, well:parent.well, formation:parent.formation, interval:parent.interval, collectedAt:parent.collectedAt})
    expect(first.records.find(item => item.id === 'child')?.subsampleInterval).toBe('1140–1141')
    const removed = deleteSample(first.records, 'child', 101, '2026-11-14', 'Тест')
    const more = registerSamples(removed, first.counters, [{...child, id:'third'}, {...child, id:'nested', parentId:'second'}], '2026-11-14T10:00:00Z')
    expect(more.records.find(item => item.id === 'third')?.code).toBe('PRB-2026-000001-03')
    expect(more.records.find(item => item.id === 'nested')?.code).toBe('PRB-2026-000001-02-01')
    expect(more.records.find(item => item.id === 'nested')?.interval).toBe('1140–1141')
  })
  it('rejects missing, foreign or disposed parents', () => {
    for (const records of [[], [{...parent, organizationId:102}], [{...parent, stage:'Утилизирована' as const}]]) {
      expect(() => registerSamples(records, {}, [child], '2026-11-13T10:00:00Z')).toThrow('invalid-parent')
    }
  })
  it('detects selected ancestors without selecting intermediate samples', () => {
    const grandchild = {...child, id:'grandchild', parentId:child.id}
    expect(hasSelectedLineage([parent, child, grandchild], [parent.id, grandchild.id])).toBe(true)
    expect(hasSelectedLineage([parent, child, grandchild], [grandchild.id])).toBe(false)
    expect(hasSelectedLineage([parent, {...grandchild, linkedAncestorIds:[parent.id]}], [parent.id, grandchild.id])).toBe(true)
  })
  it('reads parent ID from XLSX, validates it and resolves it to the saved record', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await createSampleTemplate())
    const sheet = workbook.getWorksheet('Пробы')!
    sheet.getRow(2).values = ['', 'Керн', '', 'Северное', '101', '', '', '', '2026-11-13', '', '', '', '', 'Склад', '', parent.code]
    const data = await workbook.xlsx.writeBuffer()
    const result = await readSampleWorkbook(data, [parent], 101)
    expect(result.rows[0].errors).toEqual([])
    expect(batchSamples(result.rows, 101, '2026-11-13', undefined, [parent])[0].parentId).toBe(parent.id)
    sheet.getCell('B2').value = ''
    const blankType = await readSampleWorkbook(await workbook.xlsx.writeBuffer(), [parent], 101)
    expect(blankType.rows[0].errors).toEqual([])
    expect(batchSamples(blankType.rows, 101, '', undefined, [parent])[0].sampleType).toBe('Керн')
    sheet.getCell('D2').value = ''
    sheet.getCell('E2').value = ''
    const blankOrigin = await readSampleWorkbook(await workbook.xlsx.writeBuffer(), [parent], 101)
    expect(blankOrigin.rows[0].errors).toEqual([])
    expect(batchSamples(blankOrigin.rows, 101, '', undefined, [parent])[0]).toMatchObject({field:parent.field, well:parent.well, formation:parent.formation, interval:parent.interval, collectedAt:parent.collectedAt})
    sheet.getCell('Q2').value = '1140–1141'
    const withInterval = await readSampleWorkbook(await workbook.xlsx.writeBuffer(), [parent], 101)
    expect(withInterval.rows[0].errors).toEqual([])
    expect(batchSamples(withInterval.rows, 101, '', undefined, [parent])[0].subsampleInterval).toBe('1140–1141')
    sheet.getCell('D2').value = 'Другое месторождение'
    expect((await readSampleWorkbook(await workbook.xlsx.writeBuffer(), [parent], 101)).rows[0].errors.join()).toContain('Месторождение / участок: значение подпробы должно совпадать')
    sheet.getCell('B2').value = 'Газ'
    expect((await readSampleWorkbook(await workbook.xlsx.writeBuffer(), [parent], 101)).rows[0].errors.join()).toContain('Тип подпробы должен совпадать')
    expect((await readSampleWorkbook(data, [], 101)).rows[0].errors.join()).toContain('Родительская проба')
    const legacyHeader = COLUMNS.slice(0, -1).map(([, label]) => label)
    const row = ['', 'Керн', '', 'Северное', '101', '', '', '', '2026-11-13', '', '', '', '', 'Склад', '']
    expect(validateBatchRows([{cells:legacyHeader,line:1},{cells:row,line:2}], [], 101).rows[0].errors).toEqual([])
  })
})
