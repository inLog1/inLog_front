import { SAMPLE_TYPES, type SampleType } from './catalog'
import { findRegistrationDuplicates } from './duplicates'
import { displayWell, inheritedSampleOrigin, sampleTypeOf } from './origin'
import type { Sample, SampleKind } from './types'

/** XLSX parsing and formula rejection stay on the workbook stage. This module reads CSV text only. */
export const MAX_BATCH_BYTES = 2 * 1024 * 1024
export const MAX_BATCH_ROWS = 1000

export const SAMPLE_BATCH_COLUMNS = [
  ['code', 'Исходная маркировка'],
  ['kind', 'Тип пробы'],
  ['material', 'Уточнение типа'],
  ['field', 'Месторождение / участок'],
  ['well', 'Скважина'],
  ['formation', 'Пласт'],
  ['interval', 'Интервал отбора, м'],
  ['collectedAt', 'Дата отбора'],
  ['receivedAt', 'Дата поступления'],
  ['container', 'Тара и её номер'],
  ['quantity', 'Количество / объём'],
  ['supplier', 'Передающая сторона'],
  ['document', 'Сопроводительный документ'],
  ['location', 'Местонахождение'],
  ['conditions', 'Условия отбора и примечания'],
  ['parentCode', 'ID родительской пробы'],
  ['subsampleInterval', 'Интервал подпробы, м'],
] as const

type ColumnKey = (typeof SAMPLE_BATCH_COLUMNS)[number][0]
type BatchFields = Record<ColumnKey, string>

export type SampleBatchRow = {
  line: number
  fields: BatchFields
  errors: string[]
}

export type SampleBatchResult = {
  rows: SampleBatchRow[]
  error?: string
}

export type SampleBatchInputRow = {
  cells: string[]
  line: number
  errors?: string[]
}

export function inspectBatchFileSize(size: number): 'ok' | 'file-size' {
  return size > MAX_BATCH_BYTES ? 'file-size' : 'ok'
}

/** Same original marking in this organization. A warning, not by itself an exact duplicate. */
export function countKnownMarkings(rows: readonly SampleBatchRow[], current: readonly Sample[], organizationId: number): number {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('ru')
  const known = new Set(
    current
      .filter((item) => item.organizationId === organizationId && !item.deletedAt && item.externalCode?.trim())
      .map((item) => normalize(item.externalCode!)),
  )
  return rows.filter((row) => row.fields.code.trim() && known.has(normalize(row.fields.code))).length
}

function parseCsv(text: string): SampleBatchInputRow[] {
  const input = text.replace(/^\uFEFF/, '')
  const firstLine = input.split(/\r?\n/, 1)[0] ?? ''
  const separator = firstLine.includes(';') ? ';' : ','
  const rows: SampleBatchInputRow[] = []
  let cells: string[] = []
  let value = ''
  let quoted = false
  let closed = false
  let line = 1
  let start = 1
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
        closed = true
      } else {
        value += char
        if (char === '\n') line += 1
      }
      continue
    }
    if (char === '"') {
      if (value.trim() || closed) throw new Error('Некорректные кавычки в CSV-файле.')
      value = ''
      quoted = true
      continue
    }
    if (char === separator) {
      cells.push(value.trim())
      value = ''
      closed = false
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      cells.push(value.trim())
      rows.push({ cells, line: start })
      cells = []
      value = ''
      closed = false
      line += 1
      start = line
      continue
    }
    if (closed && !/\s/.test(char)) throw new Error('Некорректные символы после кавычек в CSV-файле.')
    if (!closed) value += char
  }
  if (quoted) throw new Error('Не закрыты кавычки в CSV-файле.')
  if (value || cells.length) {
    cells.push(value.trim())
    rows.push({ cells, line: start })
  }
  return rows
}

function dateValue(raw: string): string | null {
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw)
  const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw)
  if (!iso && !ru) return null
  const year = Number(iso ? iso[1] : ru![3])
  const month = Number(iso ? iso[2] : ru![2])
  const day = Number(iso ? iso[3] : ru![1])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function columnLabel(key: ColumnKey): string {
  return SAMPLE_BATCH_COLUMNS.find(([column]) => column === key)?.[1] ?? key
}

export function parseSampleBatch(text: string, current: readonly Sample[], organizationId: number): SampleBatchResult {
  let data: SampleBatchInputRow[]
  try {
    data = parseCsv(text)
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Не удалось прочитать файл.' }
  }
  return validateSampleBatchRows(data, current, organizationId)
}

export function validateSampleBatchRows(data: readonly SampleBatchInputRow[], current: readonly Sample[], organizationId: number): SampleBatchResult {
  if (!data.length) return { rows: [], error: 'Файл пуст.' }
  const header = data[0].cells
  const legacy = header.includes('Тип пробы') && header.includes('Материал') && !header.includes('Уточнение типа') && !header.includes('Уточнение вида')
  const markingHeaders = ['Исходная маркировка', 'ID заказчика / исходная маркировка', 'ID', 'Лабораторный шифр'].filter((label) => header.includes(label))
  if (markingHeaders.length > 1) return { rows: [], error: 'Укажите только один столбец исходной маркировки.' }
  const headerFor = (key: ColumnKey, label: string) => {
    if (key === 'code') return markingHeaders[0] ?? label
    if (key === 'kind' && !header.includes(label) && header.includes('Вид пробы')) return 'Вид пробы'
    if (legacy && key === 'material') return 'Материал'
    if (key === 'material' && !header.includes(label) && header.includes('Уточнение вида')) return 'Уточнение вида'
    if (key === 'interval' && !header.includes(label) && header.includes('Интервал или глубина, м')) return 'Интервал или глубина, м'
    return label
  }
  const missing = SAMPLE_BATCH_COLUMNS
    .filter(([key, label]) => key !== 'code' && key !== 'parentCode' && key !== 'subsampleInterval' && !header.includes(headerFor(key, label)))
    .map(([, label]) => label)
  if (missing.length || new Set(header).size !== header.length) {
    const detail = missing.length ? `: отсутствуют ${missing.join(', ')}` : ': есть повторяющиеся столбцы'
    return { rows: [], error: `Заголовки не совпадают с шаблоном${detail}.` }
  }
  const inputRows = data.slice(1).filter((row) => row.cells.some(Boolean) || row.errors?.length)
  if (!inputRows.length) return { rows: [], error: 'В файле нет строк с пробами.' }
  if (inputRows.length > MAX_BATCH_ROWS) return { rows: [], error: 'За один раз можно загрузить не более 1000 проб.' }
  const rows = inputRows.map((row) => {
    const fields = Object.fromEntries(SAMPLE_BATCH_COLUMNS.map(([key, label]) => [key, row.cells[header.indexOf(headerFor(key, label))] ?? ''])) as BatchFields
    const errors = [...(row.errors ?? [])]
    if (row.cells.length > header.length) errors.push('Лишние значения в строке')
    const parent = fields.parentCode
      ? current.find((item) => item.organizationId === organizationId && !item.deletedAt && item.stage !== 'Утилизирована' && item.code.toLocaleLowerCase('ru') === fields.parentCode.trim().toLocaleLowerCase('ru'))
      : undefined
    if (fields.subsampleInterval && !fields.parentCode) errors.push('Интервал подпробы указывается только для подпробы')
    for (const key of ['collectedAt', 'receivedAt'] as const) {
      const normalized = dateValue(fields[key])
      if (normalized === null) errors.push(`${key === 'collectedAt' ? 'Дата отбора' : 'Дата поступления'}: укажите ДД.ММ.ГГГГ или ГГГГ-ММ-ДД`)
      else fields[key] = normalized
    }
    if (parent) {
      const origin = inheritedSampleOrigin(parent)
      for (const key of ['field', 'well', 'formation', 'interval', 'collectedAt'] as const) {
        const given = key === 'well' ? displayWell(fields[key]) : fields[key].trim()
        const expected = key === 'well' ? displayWell(origin[key]) : origin[key].trim()
        if (given && given.toLocaleLowerCase('ru') !== expected.toLocaleLowerCase('ru')) {
          errors.push(`${columnLabel(key)}: значение подпробы должно совпадать с родительской пробой; оставьте поле пустым`)
        }
        fields[key] = origin[key]
      }
    }
    const requiredKeys = (legacy ? ['material', 'field', 'well', 'receivedAt', 'location'] : ['field', 'well', 'receivedAt', 'location']) as ColumnKey[]
    for (const key of requiredKeys) {
      if (!fields[key]) errors.push(`Не заполнено: ${columnLabel(key)}`)
    }
    if (!fields.kind && !parent) errors.push('Не заполнено: Тип пробы')
    if (parent && sampleTypeOf(parent) === 'Не указан') errors.push('Тип родительской пробы не указан')
    if (parent && fields.kind && fields.kind !== sampleTypeOf(parent)) errors.push('Тип подпробы должен совпадать с типом родительской пробы; оставьте поле пустым')
    if (parent && sampleTypeOf(parent) !== 'Не указан' && !fields.kind) fields.kind = sampleTypeOf(parent)
    if (fields.kind && !(SAMPLE_TYPES as readonly string[]).includes(fields.kind) && !(legacy && fields.kind === 'Флюид')) {
      errors.push('Тип пробы: выберите значение из списка в шаблоне')
    }
    if (fields.parentCode && !parent) errors.push('Родительская проба не найдена в реестре или недоступна')
    return { line: row.line, fields, errors }
  })
  const valid = rows.filter((row) => !row.errors.length)
  const items = batchSamples(valid, organizationId, '', undefined, current)
  for (const index of findRegistrationDuplicates(items, current, organizationId)) {
    valid[index].errors.push('Такая проба с той же исходной маркировкой и данными уже есть в реестре или повторяется в файле')
  }
  return { rows }
}

export function batchSamples(
  rows: readonly SampleBatchRow[],
  organizationId: number,
  at: string,
  actor?: string,
  current: readonly Sample[] = [],
): Sample[] {
  if (rows.some((row) => row.errors.length)) throw new Error('invalid-batch')
  return rows.map(({ fields }) => {
    const parent = fields.parentCode
      ? current.find((item) => item.organizationId === organizationId && !item.deletedAt && item.code.toLocaleLowerCase('ru') === fields.parentCode.trim().toLocaleLowerCase('ru'))
      : undefined
    if (fields.parentCode && !parent) throw new Error('invalid-parent')
    const kind: SampleKind = parent?.kind ?? (fields.kind === 'Керн' ? 'Керн' : 'Флюид')
    const material = fields.material || fields.kind || (parent ? sampleTypeOf(parent) : '')
    const type: SampleType | 'Не указан' = parent
      ? sampleTypeOf(parent)
      : fields.kind === 'Флюид'
        ? sampleTypeOf({ kind, material })
        : fields.kind as SampleType
    const origin = parent ? inheritedSampleOrigin(parent) : undefined
    return {
      id: crypto.randomUUID(),
      organizationId,
      code: '',
      externalCode: fields.code.trim() || undefined,
      ...(parent ? { parentId: parent.id } : {}),
      kind,
      material,
      ...(type !== 'Не указан' ? { sampleType: type } : {}),
      field: origin?.field ?? fields.field,
      well: origin?.well ?? fields.well,
      formation: origin?.formation ?? fields.formation,
      interval: origin?.interval ?? fields.interval,
      ...(fields.subsampleInterval ? { subsampleInterval: fields.subsampleInterval } : {}),
      collectedAt: origin?.collectedAt ?? fields.collectedAt,
      receivedAt: fields.receivedAt,
      container: fields.container,
      quantity: fields.quantity,
      supplier: fields.supplier,
      document: fields.document,
      conditions: fields.conditions,
      location: fields.location,
      inspection: 'Не проведён',
      inspectionNote: '',
      stage: 'Поступила',
      events: [{ at, actor: actor?.trim() || undefined, text: 'Зарегистрировано поступление. Статус: Поступила' }],
    }
  })
}

export function sampleBatchTemplateCsv(): string {
  return `\uFEFF${SAMPLE_BATCH_COLUMNS.map(([, label]) => label).join(';')}\r\n`
}
