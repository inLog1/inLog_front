import { describe, expect, it } from 'vitest'
import {
  MAX_BATCH_BYTES,
  SAMPLE_BATCH_COLUMNS,
  batchSamples,
  countKnownMarkings,
  inspectBatchFileSize,
  parseSampleBatch,
  sampleBatchTemplateCsv,
} from './batch'
import { makeSample } from './fixture'

function line(code: string, overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    code,
    kind: 'Вода',
    material: 'Пластовая вода',
    field: 'Северное',
    well: '001',
    receivedAt: '11.11.2026',
    location: 'Склад',
    ...overrides,
  }
  return SAMPLE_BATCH_COLUMNS.map(([key]) => fields[key] ?? '').join(';')
}

const csv = (...lines: string[]) => sampleBatchTemplateCsv() + lines.join('\r\n')

describe('sample CSV batch', () => {
  it('accepts rows, keeps the marking and normalizes the receipt date', () => {
    const result = parseSampleBatch(csv(...Array.from({ length: 100 }, (_, index) => line(`Ф-${index + 1}`))), [], 101)
    expect(result.error).toBeUndefined()
    expect(result.rows).toHaveLength(100)
    expect(result.rows.every((row) => !row.errors.length)).toBe(true)
    const items = batchSamples(result.rows, 101, '2026-11-11T12:00:00Z')
    expect(items[0]).toMatchObject({
      code: '',
      externalCode: 'Ф-1',
      well: '001',
      receivedAt: '2026-11-11',
      sampleType: 'Вода',
      kind: 'Флюид',
      inspection: 'Не проведён',
      organizationId: 101,
    })
    expect(items.every((item) => item.code === '')).toBe(true)
  })

  it('handles quoted delimiters and a line break inside a cell', () => {
    const result = parseSampleBatch(csv(line('NEW', { conditions: '"Газ; режим ""А""\nпроверить"' })), [], 101)
    expect(result.rows[0].fields.conditions).toBe('Газ; режим "А"\nпроверить')
    expect(result.rows[0].errors).toEqual([])
  })

  it('keeps the receipt details from the file', () => {
    const details = { container: 'Контейнер 5', quantity: '5 л', supplier: 'Передающая сторона', document: 'Акт № 12', conditions: 'Условия отбора' }
    const result = parseSampleBatch(csv(line('SOURCE', details)), [], 101)
    expect(batchSamples(result.rows, 101, '2026-11-12T12:00:00Z')[0]).toMatchObject(details)
  })

  it('reports a bad date and an empty place, and still allows a repeated marking', () => {
    const existing = [makeSample({ externalCode: 'К-26-001' })]
    const result = parseSampleBatch(csv(line('К-26-001'), line('NEW', { receivedAt: '31.02.2026', location: '' }), line('new')), existing, 101)
    expect(result.rows.map((row) => row.line)).toEqual([2, 3, 4])
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[1].errors.join(' ')).toContain('Дата поступления')
    expect(result.rows[1].errors.join(' ')).toContain('Местонахождение')
    expect(result.rows[2].errors).toEqual([])
    expect(() => batchSamples(result.rows, 101, '')).toThrow('invalid-batch')
    expect(countKnownMarkings(result.rows, [makeSample({ externalCode: ' к-26-001 ' })], 101)).toBe(1)
    expect(countKnownMarkings(result.rows, [makeSample({ externalCode: ' к-26-001 ' })], 102)).toBe(0)
  })

  it('accepts previous headings and treats an old id column as the original marking', () => {
    const oldHeader = sampleBatchTemplateCsv()
      .replace('Исходная маркировка;', 'Лабораторный шифр;')
      .replace('Тип пробы;Уточнение типа', 'Тип пробы;Материал')
      .replace('Интервал отбора, м', 'Интервал или глубина, м')
    const result = parseSampleBatch(oldHeader + line('OLD', { kind: 'Флюид', material: 'Пластовая вода' }), [], 101)
    expect(result.rows[0].errors).toEqual([])
    expect(batchSamples(result.rows, 101, '')[0]).toMatchObject({
      externalCode: 'OLD',
      code: '',
      kind: 'Флюид',
      sampleType: 'Вода',
      material: 'Пластовая вода',
    })
    const previousHeader = sampleBatchTemplateCsv().replace('Исходная маркировка;', 'ID;')
    expect(batchSamples(parseSampleBatch(previousHeader + line('OLD-2'), [], 101).rows, 101, '')[0].externalCode).toBe('OLD-2')
    const olderLabel = sampleBatchTemplateCsv().replace('Исходная маркировка;', 'ID заказчика / исходная маркировка;')
    expect(batchSamples(parseSampleBatch(olderLabel + line('OLD-3'), [], 101).rows, 101, '')[0].externalCode).toBe('OLD-3')
    const previousTypes = sampleBatchTemplateCsv().replace('Тип пробы;Уточнение типа', 'Вид пробы;Уточнение вида')
    expect(batchSamples(parseSampleBatch(previousTypes + line('OLD-4'), [], 101).rows, 101, '')[0]).toMatchObject({
      externalCode: 'OLD-4',
      sampleType: 'Вода',
    })
  })

  it('allows an empty marking and rejects two marking columns', () => {
    expect(parseSampleBatch(csv(line('')), [], 101).rows[0].errors).toEqual([])
    const noMarking = sampleBatchTemplateCsv().replace('Исходная маркировка;', '') + line('').slice(1)
    expect(parseSampleBatch(noMarking, [], 101).rows[0].errors).toEqual([])
    expect(parseSampleBatch(sampleBatchTemplateCsv().replace('Тип пробы;', 'ID;Тип пробы;') + line('A'), [], 101).error).toContain('только один')
  })

  it('rejects an exact repeat and accepts the same marking with different registration data', () => {
    const original = parseSampleBatch(csv(line('ABC')), [], 101)
    const existing = batchSamples(original.rows, 101, '2026-11-12T12:00:00Z')
    const repeat = parseSampleBatch(csv(line('ABC')), existing, 101)
    expect(repeat.rows[0].errors.join(' ')).toContain('уже есть')
    const repeatedRows = parseSampleBatch(csv(line('ABC'), line('ABC')), [], 101)
    expect(repeatedRows.rows[0].errors).toEqual([])
    expect(repeatedRows.rows[1].errors.join(' ')).toContain('повторяется')
    expect(parseSampleBatch(csv(line('ABC', { container: 'Другая тара' })), existing, 101).rows[0].errors).toEqual([])
  })

  it('rejects a malformed file, a batch over the row limit, and a file over 2 MB', () => {
    expect(parseSampleBatch('wrong;header\na;b', [], 101).error).toContain('Заголовки')
    expect(parseSampleBatch(csv(line('new', { conditions: '"незакрыто' })), [], 101).error).toContain('кавычки')
    expect(parseSampleBatch(csv(...Array.from({ length: 1001 }, (_, index) => line(`R-${index}`))), [], 101).error).toContain('1000')
    expect(inspectBatchFileSize(MAX_BATCH_BYTES)).toBe('ok')
    expect(inspectBatchFileSize(MAX_BATCH_BYTES + 1)).toBe('file-size')
  })
})
