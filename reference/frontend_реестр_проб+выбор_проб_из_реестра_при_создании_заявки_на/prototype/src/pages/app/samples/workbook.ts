import * as ExcelJS from 'exceljs'
import { COLUMNS, validateBatchRows, type BatchResult, type InputRow } from './batch'
import { SAMPLE_TYPES, type Sample } from './model'

const SHEET_NAME = 'Пробы'
const DATE_COLUMNS = new Set([8, 9])
const TEXT_COLUMNS = new Set([1, 5, 16])

/** A blank workbook. Identifiers are formatted as text to preserve leading zeros. */
export async function createSampleTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'inLog'
  const sheet = workbook.addWorksheet(SHEET_NAME, {views:[{state:'frozen', ySplit:1}]})
  sheet.columns = COLUMNS.map(([, label], index) => ({ header:label, width:[24,18,28,28,18,18,25,18,19,28,28,26,28,28,45,25,25][index] }))
  const header = sheet.getRow(1)
  header.height = 34
  header.font = {bold:true, color:{argb:'FFFFFFFF'}, size:11}
  header.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF145948'}}
  header.alignment = {vertical:'middle', wrapText:true}
  sheet.autoFilter = {from:'A1', to:'Q1'}
  for (let row = 2; row <= 1001; row++) {
    for (const column of TEXT_COLUMNS) sheet.getCell(row, column).numFmt = '@'
    for (const column of DATE_COLUMNS) sheet.getCell(row, column).numFmt = 'dd.mm.yyyy'
    sheet.getCell(row, 2).dataValidation = {type:'list', allowBlank:true, formulae:[`"${SAMPLE_TYPES.join(',')}"`], showErrorMessage:true, errorTitle:'Тип пробы', error:'Выберите тип пробы из списка'}
  }
  return workbook.xlsx.writeBuffer()
}

/** Read only the designated worksheet; formulas and Excel errors must be fixed before import. */
export async function readSampleWorkbook(data: ArrayBuffer, current: Sample[], organizationId: number): Promise<BatchResult> {
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(data) } catch { return {rows:[], error:'Не удалось прочитать XLSX-файл. Проверьте, что это корректный файл Excel.'} }
  const sheet = workbook.getWorksheet(SHEET_NAME)
  if (!sheet) return {rows:[], error:'Не найден лист «Пробы». Используйте скачанный шаблон.'}
  const dateColumns = new Set<number>()
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    if (cell.text.trim() === 'Дата отбора' || cell.text.trim() === 'Дата поступления') dateColumns.add(columnNumber)
  })
  const rows: InputRow[] = []
  sheet.eachRow((row, rowNumber) => {
    const cells = Array<string>(sheet.getRow(1).cellCount).fill('')
    const errors: string[] = []
    row.eachCell((cell, columnNumber) => {
      const value = cell.value
      if (value == null || value === '') return
      if (columnNumber > COLUMNS.length) { errors.push('Лишние значения в строке'); return }
      if (value instanceof Date) {
        if (!dateColumns.has(columnNumber) || Number.isNaN(value.getTime())) { errors.push(`Неверный тип в столбце ${columnNumber}`); return }
        cells[columnNumber - 1] = value.toISOString().slice(0,10)
      } else if (typeof value === 'string' || typeof value === 'number') {
        cells[columnNumber - 1] = String(value).trim()
      } else {
        errors.push(`Столбец «${sheet.getRow(1).getCell(columnNumber).text || columnNumber}»: укажите значение без формулы или ошибки`)
      }
    })
    rows.push({line:rowNumber, cells, errors})
  })
  if (rows[0]?.line !== 1 || rows[0].errors?.length) return {rows:[], error:'Проверьте строку заголовков на листе «Пробы».'}
  return validateBatchRows(rows, current, organizationId)
}
