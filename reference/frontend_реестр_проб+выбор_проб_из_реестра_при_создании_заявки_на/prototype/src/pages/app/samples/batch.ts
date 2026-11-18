import { SAMPLE_TYPES, displayWell, inheritedSampleOrigin, sampleTypeOf, type Sample, type SampleKind, type SampleType } from './model'
import { findRegistrationDuplicates } from './duplicates'

export const COLUMNS = [
  ['code', 'Исходная маркировка'], ['kind', 'Тип пробы'], ['material', 'Уточнение типа'],
  ['field', 'Месторождение / участок'], ['well', 'Скважина'], ['formation', 'Пласт'],
  ['interval', 'Интервал отбора, м'], ['collectedAt', 'Дата отбора'], ['receivedAt', 'Дата поступления'],
  ['container', 'Тара и её номер'], ['quantity', 'Количество / объём'], ['supplier', 'Передающая сторона'],
  ['document', 'Сопроводительный документ'], ['location', 'Местонахождение'], ['conditions', 'Условия отбора и примечания'],
  ['parentCode', 'ID родительской пробы'],
  ['subsampleInterval', 'Интервал подпробы, м'],
] as const

type Key = typeof COLUMNS[number][0]
type Fields = Record<Key, string>
export type BatchRow = { line: number; fields: Fields; errors: string[] }
export type BatchResult = { rows: BatchRow[]; error?: string }
export type InputRow = { cells: string[]; line: number; errors?: string[] }

/** Matching markings are a warning, not proof that the samples are duplicates. */
export function countKnownMarkings(rows: BatchRow[], current: Sample[], organizationId: number): number {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('ru')
  const known = new Set(current.filter(item => item.organizationId === organizationId && !item.deletedAt && item.externalCode?.trim()).map(item => normalize(item.externalCode!)))
  return rows.filter(row => row.fields.code.trim() && known.has(normalize(row.fields.code))).length
}

/** RFC-style quoting, semicolon or comma separators, including quoted newlines. */
function parseCsv(text: string): InputRow[] {
  const input = text.replace(/^\uFEFF/, '')
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  const separator = firstLine.includes(';') ? ';' : ','
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { value += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else { value += c; if (c === '\n') line++ }
    } else if (c === '"') {
      if (value.trim() || closed) throw new Error('Некорректные кавычки в CSV-файле.')
      value = ''; quoted = true
    } else if (c === separator) { cells.push(value.trim()); value = ''; closed = false }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      cells.push(value.trim()); rows.push({cells, line:start}); cells = []; value = ''; closed = false; line++; start = line
    } else {
      if (closed && !/\s/.test(c)) throw new Error('Некорректные символы после кавычек в CSV-файле.')
      if (!closed) value += c
    }
  }
  if (quoted) throw new Error('Не закрыты кавычки в CSV-файле.')
  if (value || cells.length) { cells.push(value.trim()); rows.push({cells, line:start}) }
  return rows
}

function dateValue(raw: string): string | null {
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw)
  if (!iso && !ru) return null
  const y = Number(iso ? iso[1] : ru![3]), m = Number(iso ? iso[2] : ru![2]), d = Number(iso ? iso[3] : ru![1])
  const date = new Date(Date.UTC(y, m - 1, d))
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseBatch(text: string, current: Sample[], organizationId: number): BatchResult {
  let data: ReturnType<typeof parseCsv>
  try { data = parseCsv(text) } catch (error) { return {rows:[], error:error instanceof Error ? error.message : 'Не удалось прочитать файл.'} }
  return validateBatchRows(data, current, organizationId)
}

export function validateBatchRows(data: InputRow[], current: Sample[], organizationId: number): BatchResult {
  if (!data.length) return {rows:[], error:'Файл пуст.'}
  const header = data[0].cells
  const legacy = header.includes('Тип пробы') && header.includes('Материал') && !header.includes('Уточнение типа') && !header.includes('Уточнение вида')
  const markingHeaders = ['Исходная маркировка', 'ID заказчика / исходная маркировка', 'ID', 'Лабораторный шифр'].filter(label => header.includes(label))
  if (markingHeaders.length > 1) return {rows:[], error:'Укажите только один столбец исходной маркировки.'}
  const headerFor = (key: Key, label: string) => {
    if (key === 'code') return markingHeaders[0] ?? label
    if (key === 'kind' && !header.includes(label) && header.includes('Вид пробы')) return 'Вид пробы'
    if (legacy && key === 'material') return 'Материал'
    if (key === 'material' && !header.includes(label) && header.includes('Уточнение вида')) return 'Уточнение вида'
    if (key === 'interval' && !header.includes(label) && header.includes('Интервал или глубина, м')) return 'Интервал или глубина, м'
    return label
  }
  const missing = COLUMNS.filter(([key, label]) => key !== 'code' && key !== 'parentCode' && key !== 'subsampleInterval' && !header.includes(headerFor(key, label))).map(([, label]) => label)
  if (missing.length || new Set(header).size !== header.length) return {rows:[], error:`Заголовки не совпадают с шаблоном${missing.length ? `: отсутствуют ${missing.join(', ')}` : ': есть повторяющиеся столбцы'}.`}
  const inputRows = data.slice(1).filter(row => row.cells.some(Boolean) || row.errors?.length)
  if (!inputRows.length) return {rows:[], error:'В файле нет строк с пробами.'}
  if (inputRows.length > 1000) return {rows:[], error:'За один раз можно загрузить не более 1000 проб.'}
  const rows = inputRows.map(row => {
    const fields = Object.fromEntries(COLUMNS.map(([key, label]) => [key, row.cells[header.indexOf(headerFor(key, label))] ?? ''])) as Fields
    const errors: string[] = [...(row.errors ?? [])]
    if (row.cells.length > header.length) errors.push('Лишние значения в строке')
    const parent = fields.parentCode ? current.find(item => item.organizationId === organizationId && !item.deletedAt && item.stage !== 'Утилизирована' && item.code.toLocaleLowerCase('ru') === fields.parentCode.trim().toLocaleLowerCase('ru')) : undefined
    if (fields.subsampleInterval && !fields.parentCode) errors.push('Интервал подпробы указывается только для подпробы')
    for (const key of ['collectedAt','receivedAt'] as const) {
      const normalized = dateValue(fields[key])
      if (normalized === null) errors.push(`${key === 'collectedAt' ? 'Дата отбора' : 'Дата поступления'}: укажите ДД.ММ.ГГГГ или ГГГГ-ММ-ДД`)
      else fields[key] = normalized
    }
    if (parent) {
      const origin = inheritedSampleOrigin(parent)
      for (const key of ['field','well','formation','interval','collectedAt'] as const) {
        const given = key === 'well' ? displayWell(fields[key]) : fields[key].trim()
        const expected = key === 'well' ? displayWell(origin[key]) : origin[key].trim()
        if (given && given.toLocaleLowerCase('ru') !== expected.toLocaleLowerCase('ru')) errors.push(`${COLUMNS.find(([k]) => k === key)![1]}: значение подпробы должно совпадать с родительской пробой; оставьте поле пустым`)
        fields[key] = origin[key]
      }
    }
    for (const key of (legacy ? ['material','field','well','receivedAt','location'] : ['field','well','receivedAt','location']) as Key[]) {
      if (!fields[key]) errors.push(`Не заполнено: ${COLUMNS.find(([k]) => k === key)![1]}`)
    }
    if (!fields.kind && !parent) errors.push('Не заполнено: Тип пробы')
    if (parent && sampleTypeOf(parent) === 'Не указан') errors.push('Тип родительской пробы не указан')
    if (parent && fields.kind && fields.kind !== sampleTypeOf(parent)) errors.push('Тип подпробы должен совпадать с типом родительской пробы; оставьте поле пустым')
    if (parent && sampleTypeOf(parent) !== 'Не указан' && !fields.kind) fields.kind = sampleTypeOf(parent)
    if (fields.kind && !(SAMPLE_TYPES as readonly string[]).includes(fields.kind) && !(legacy && fields.kind === 'Флюид')) errors.push('Тип пробы: выберите значение из списка в шаблоне')
    if (fields.parentCode && !current.some(item => item.organizationId === organizationId && !item.deletedAt && item.stage !== 'Утилизирована' && item.code.toLocaleLowerCase('ru') === fields.parentCode.trim().toLocaleLowerCase('ru'))) errors.push('Родительская проба не найдена в реестре или недоступна')
    return {line:row.line, fields, errors}
  })
  const valid = rows.filter(row => !row.errors.length)
  const items = batchSamples(valid, organizationId, '', undefined, current)
  for (const index of findRegistrationDuplicates(items, current, organizationId)) valid[index].errors.push('Такая проба с той же исходной маркировкой и данными уже есть в реестре или повторяется в файле')
  return { rows }
}

export function batchSamples(rows: BatchRow[], organizationId: number, at: string, actor?: string, current: Sample[] = []): Sample[] {
  if (rows.some(row => row.errors.length)) throw new Error('invalid-batch')
  return rows.map(({fields}) => {
    const {parentCode, ...sampleFields} = fields
    const parent = parentCode ? current.find(item => item.organizationId === organizationId && !item.deletedAt && item.code.toLocaleLowerCase('ru') === parentCode.trim().toLocaleLowerCase('ru')) : undefined
    if (parentCode && !parent) throw new Error('invalid-parent')
    const kind: SampleKind = parent?.kind ?? (fields.kind === 'Керн' ? 'Керн' : 'Флюид')
    const material = fields.material || fields.kind || (parent ? sampleTypeOf(parent) : '')
    const type = parent ? sampleTypeOf(parent) : fields.kind === 'Флюид' ? sampleTypeOf({ kind, material }) : fields.kind as SampleType
    return {...sampleFields, ...(parent ? {...inheritedSampleOrigin(parent), parentId:parent.id} : {}), code:'', externalCode:fields.code.trim() || undefined, id:crypto.randomUUID(), organizationId, kind, material, ...(type !== 'Не указан' ? {sampleType:type} : {}), inspection:'Не проведён', inspectionNote:'', stage:'Поступила', events:[{at, actor:actor?.trim() || undefined, text:'Зарегистрировано поступление. Статус: Поступила'}]}
  })
}

export function templateCsv(): string { return '\uFEFF' + COLUMNS.map(([, label]) => label).join(';') + '\r\n' }
