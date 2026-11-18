import { describe, expect, it } from 'vitest'
import { demoSamples } from './model'
import { batchSamples, COLUMNS, countKnownMarkings, parseBatch, templateCsv } from './batch'

function line(code: string, overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = { code, kind:'Вода', material:'Пластовая вода', field:'Северное', well:'001', receivedAt:'11.11.2026', location:'Склад', ...overrides }
  return COLUMNS.map(([key]) => fields[key] ?? '').join(';')
}
const csv = (...lines: string[]) => templateCsv() + lines.join('\r\n')

describe('batch import', () => {
  it('accepts 100 rows and preserves identifiers and dates', () => {
    const result = parseBatch(csv(...Array.from({length:100}, (_,i) => line(`Ф-${i+1}`))), [], 101)
    expect(result.error).toBeUndefined()
    expect(result.rows).toHaveLength(100)
    expect(result.rows.every(row => !row.errors.length)).toBe(true)
    const items = batchSamples(result.rows, 101, '2026-11-11T12:00:00Z')
    expect(items[0]).toMatchObject({code:'', externalCode:'Ф-1', well:'001', receivedAt:'2026-11-11', sampleType:'Вода', kind:'Флюид', inspection:'Не проведён', organizationId:101})
  })
  it('handles quoted delimiters and multiline cells', () => {
    const result = parseBatch(csv(line('NEW', {conditions:'"Газ; режим ""А""\nпроверить"'})), [], 101)
    expect(result.rows[0].fields.conditions).toBe('Газ; режим "А"\nпроверить')
    expect(result.rows[0].errors).toEqual([])
  })
  it('preserves the receipt details supplied in the spreadsheet', () => {
    const details = {container:'Контейнер 5', quantity:'5 л', supplier:'Передающая сторона', document:'Акт № 12', conditions:'Условия отбора'}
    const result = parseBatch(csv(line('SOURCE', details)), [], 101)
    expect(batchSamples(result.rows, 101, '2026-11-12T12:00:00Z')[0]).toMatchObject(details)
  })
  it('identifies missing required fields and invalid dates while allowing repeated external markings', () => {
    const result = parseBatch(csv(line('К-26-001'), line('NEW', {receivedAt:'31.02.2026', location:''}), line('new')), demoSamples, 101)
    expect(result.rows.map(row => row.line)).toEqual([2,3,4])
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[1].errors.join(' ')).toContain('Дата поступления')
    expect(result.rows[1].errors.join(' ')).toContain('Местонахождение')
    expect(result.rows[2].errors).toEqual([])
    expect(() => batchSamples(result.rows, 101, '')).toThrow('invalid-batch')
  })
  it('accepts previous templates without losing the material description', () => {
    const oldHeader = templateCsv().replace('Исходная маркировка;', 'Лабораторный шифр;').replace('Тип пробы;Уточнение типа', 'Тип пробы;Материал').replace('Интервал отбора, м', 'Интервал или глубина, м')
    const result = parseBatch(oldHeader + line('OLD', {kind:'Флюид', material:'Пластовая вода'}), [], 101)
    expect(result.rows[0].errors).toEqual([])
    expect(batchSamples(result.rows, 101, '')[0]).toMatchObject({externalCode:'OLD', code:'', kind:'Флюид', sampleType:'Вода', material:'Пластовая вода'})
    const previousHeader = templateCsv().replace('Исходная маркировка;', 'ID;')
    const previous = parseBatch(previousHeader + line('OLD-2'), [], 101)
    expect(previous.rows[0].errors).toEqual([])
    expect(batchSamples(previous.rows, 101, '')[0].externalCode).toBe('OLD-2')
    const olderLabel = templateCsv().replace('Исходная маркировка;', 'ID заказчика / исходная маркировка;')
    expect(batchSamples(parseBatch(olderLabel + line('OLD-3'), [], 101).rows, 101, '')[0].externalCode).toBe('OLD-3')
    const previousTypes = templateCsv().replace('Тип пробы;Уточнение типа', 'Вид пробы;Уточнение вида')
    expect(batchSamples(parseBatch(previousTypes + line('OLD-4'), [], 101).rows, 101, '')[0]).toMatchObject({externalCode:'OLD-4', sampleType:'Вода'})
  })
  it('accepts an empty or absent optional marking column and rejects ambiguous columns', () => {
    expect(parseBatch(csv(line('')), [], 101).rows[0].errors).toEqual([])
    const noMarking = templateCsv().replace('Исходная маркировка;', '') + line('').slice(1)
    expect(parseBatch(noMarking, [], 101).rows[0].errors).toEqual([])
    expect(parseBatch(templateCsv().replace('Тип пробы;', 'ID;Тип пробы;') + line('A'), [], 101).error).toContain('только один')
  })
  it('warns about known markings in the same organization without rejecting rows', () => {
    const rows = parseBatch(csv(line('ABC'), line('NEW')), [], 101).rows
    const existing = [{...demoSamples[0], externalCode:' abc '}]
    expect(countKnownMarkings(rows, existing, 101)).toBe(1)
    expect(countKnownMarkings(rows, existing, 102)).toBe(0)
    expect(rows.every(row => !row.errors.length)).toBe(true)
  })
  it('blocks exact repeats against the registry and within the spreadsheet', () => {
    const original = parseBatch(csv(line('ABC')), [], 101)
    const existing = batchSamples(original.rows, 101, '2026-11-12T12:00:00Z')
    const repeat = parseBatch(csv(line('ABC')), existing, 101)
    expect(repeat.rows[0].errors.join(' ')).toContain('уже есть')
    const repeatedRows = parseBatch(csv(line('ABC'), line('ABC')), [], 101)
    expect(repeatedRows.rows[0].errors).toEqual([])
    expect(repeatedRows.rows[1].errors.join(' ')).toContain('повторяется')
    expect(parseBatch(csv(line('ABC', {container:'Другая тара'})), existing, 101).rows[0].errors).toEqual([])
  })
  it('rejects malformed files', () => {
    expect(parseBatch('wrong;header\na;b', [], 101).error).toContain('Заголовки')
    expect(parseBatch(csv(line('new', {conditions:'"незакрыто'})), [], 101).error).toContain('кавычки')
  })
})
