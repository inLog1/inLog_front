import { describe, expect, it } from 'vitest'
import * as ExcelJS from 'exceljs'
import { createSampleTemplate, readSampleWorkbook } from './workbook'
import { COLUMNS } from './batch'

async function workbook() {
  const result = new ExcelJS.Workbook()
  await result.xlsx.load(await createSampleTemplate())
  return result
}

describe('XLSX sample template', () => {
  it('creates an Excel workbook with readable headers and text identifiers', async () => {
    const book = await workbook()
    const sheet = book.getWorksheet('Пробы')!
    expect(sheet.getCell('A1').value).toBe('Исходная маркировка')
    expect(sheet.getCell('B1').value).toBe('Тип пробы')
    expect(sheet.getCell('P1').value).toBe('ID родительской пробы')
    expect(COLUMNS.map((_, index) => sheet.getRow(1).getCell(index + 1).value)).toEqual(COLUMNS.map(([, label]) => label))
    expect(sheet.getCell('A2').numFmt).toBe('@')
    expect(sheet.getCell('E2').numFmt).toBe('@')
    expect(sheet.getCell('I2').numFmt).toBe('dd.mm.yyyy')
    expect(sheet.getCell('B2').dataValidation?.type).toBe('list')
  })
  it('reads 100 samples including Excel dates and leading-zero identifiers', async () => {
    const book = await workbook()
    const sheet = book.getWorksheet('Пробы')!
    for (let i=0; i<100; i++) {
      const row = sheet.getRow(i+2)
      row.getCell(1).value = `Ф-${i+1}`
      row.getCell(2).value = 'Вода'
      row.getCell(3).value = 'Пластовая вода'
      row.getCell(4).value = 'Северное'
      row.getCell(5).value = '001'
      row.getCell(9).value = new Date('2026-11-11T00:00:00Z')
      row.getCell(14).value = 'Склад'
    }
    const result = await readSampleWorkbook(await book.xlsx.writeBuffer(), [], 101)
    expect(result.error).toBeUndefined()
    expect(result.rows).toHaveLength(100)
    expect(result.rows.every(row => !row.errors.length)).toBe(true)
    expect(result.rows[0].fields).toMatchObject({well:'001', receivedAt:'2026-11-11'})
  })
  it('rejects formulas and a workbook without the required sheet', async () => {
    const book = await workbook()
    const sheet = book.getWorksheet('Пробы')!
    const row = sheet.getRow(2)
    row.getCell(1).value = {formula:'"К-1"', result:'К-1'}
    row.getCell(2).value = 'Керн'
    row.getCell(3).value = 'Керн'
    row.getCell(4).value = 'Поле'
    row.getCell(5).value = '101'
    row.getCell(9).value = '2026-11-11'
    row.getCell(14).value = 'Склад'
    const result = await readSampleWorkbook(await book.xlsx.writeBuffer(), [], 101)
    expect(result.rows[0].errors.join(' ')).toContain('без формулы')
    sheet.name = 'Другое'
    expect((await readSampleWorkbook(await book.xlsx.writeBuffer(), [], 101)).error).toContain('Пробы')
  })
  it('accepts an earlier XLSX template and preserves the old description', async () => {
    const book = await workbook()
    const sheet = book.getWorksheet('Пробы')!
    sheet.getCell('A1').value = 'Лабораторный шифр'
    sheet.getCell('B1').value = 'Тип пробы'
    sheet.getCell('C1').value = 'Материал'
    sheet.getCell('G1').value = 'Интервал или глубина, м'
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Ф-1'
    row.getCell(2).value = 'Флюид'
    row.getCell(3).value = 'Донная проба нефти'
    row.getCell(4).value = 'Озёрное'
    row.getCell(5).value = '100'
    row.getCell(9).value = '2026-11-11'
    row.getCell(14).value = 'Склад'
    const result = await readSampleWorkbook(await book.xlsx.writeBuffer(), [], 101)
    expect(result.error).toBeUndefined()
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[0].fields.material).toBe('Донная проба нефти')
  })
  it('accepts the previous type labels without losing any values', async () => {
    const book = await workbook()
    const sheet = book.getWorksheet('Пробы')!
    sheet.getCell('B1').value = 'Вид пробы'
    sheet.getCell('C1').value = 'Уточнение вида'
    const row = sheet.getRow(2)
    row.values = ['Р-1', 'Нефть', 'Донная', 'Озёрное', '100', '', '', '', '2026-11-11', '', '', '', '', 'Склад']
    const result = await readSampleWorkbook(await book.xlsx.writeBuffer(), [], 101)
    expect(result.error).toBeUndefined()
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[0].fields).toMatchObject({kind:'Нефть', material:'Донная', code:'Р-1'})
  })
})
