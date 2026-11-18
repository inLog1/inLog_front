import { describe, expect, it } from 'vitest'
import { buildColumnCatalog, readCell } from './columns'
import { acceptTableResponse } from './query-guard'
import { classifyCreatedAtValue, matchesCreatedAt, utcDayBounds } from './created-at'
import { parseQueryConfig, parseViewDocument, runTableQuery } from './query'
import { tableViewsMode } from './availability'
import { effectiveWork, readWorkQuery, workDiffers, writeWorkQuery } from './url-state'
import {
  SYSTEM_COLUMN_IDS,
  TABLE_VIEW_SCHEMA_VERSION,
  type QueryConfig,
  type SourceRecord,
  type SourceVersion,
  type ViewFilter,
} from './types'

const formId = 'form-sample1'

function field(
  id: string,
  type: SourceVersion['schema']['fields'][number]['type'],
  label: string,
  options: { id: string; label: string }[] = [],
) {
  return { id, type, label, options }
}

function version(
  id: string,
  number: number,
  fields: SourceVersion['schema']['fields'],
  current: boolean,
  schemaVersion = 1,
): SourceVersion {
  return { id, formId, number, current, schema: { schemaVersion, fields } }
}

function record(
  id: string,
  formVersionId: string,
  values: SourceRecord['values'],
  extra: Partial<SourceRecord> = {},
): SourceRecord {
  return {
    id,
    formId,
    organizationId: 101,
    formVersionId,
    values,
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 3,
    ...extra,
  }
}

const name = 'field-name'
const mass = 'field-mass'
const date = 'field-date'
const kind = 'field-kind'
const flag = 'field-flag'
const extra = 'field-extra'
const core = 'option-core'
const soil = 'option-soil'
const sand = 'option-sand'
const sameA = 'option-same-a'
const sameB = 'option-same-b'

const v1 = version('ver-sample1', 1, [
  field(name, 'text', 'Название образца'),
  field(mass, 'number', 'Масса'),
  field(date, 'date', 'Дата поступления'),
  field(kind, 'single_choice', 'Вид образца', [
    { id: core, label: 'Керн' },
    { id: soil, label: 'Почва' },
    { id: sameA, label: 'Керн' },
    { id: sameB, label: 'Керн' },
  ]),
  field(flag, 'boolean', 'Повтор'),
  field(extra, 'text', 'Комментарий'),
], false)

const v2 = version('ver-sample2', 2, [
  field(name, 'text', 'Наименование образца'),
  field(mass, 'number', 'Масса образца'),
  field(date, 'date', 'Дата поступления'),
  field(kind, 'single_choice', 'Вид образца', [
    { id: core, label: 'Керн свежий' },
    { id: soil, label: 'Почва' },
    { id: sand, label: 'Песок' },
    { id: sameA, label: 'Керн' },
    { id: sameB, label: 'Керн' },
  ]),
  field(flag, 'boolean', 'Повтор'),
], true)

const versions = [v1, v2]

const recA = record('rec-a', v1.id, {
  [name]: 'Керн А',
  [mass]: 0,
  [date]: '2026-01-02',
  [kind]: core,
  [flag]: false,
  [extra]: 'старый',
}, { createdAt: '2026-10-02T00:00:00.000Z', createdBy: 3 })

const recB = record('rec-b', v2.id, {
  [name]: 'Почва Б',
  [mass]: 10,
  [date]: '2026-10-01',
  [kind]: core,
  [flag]: true,
}, { createdAt: '2026-10-03T00:00:00.000Z', createdBy: 4 })

const recC = record('rec-c', v2.id, {
  [name]: '',
  [mass]: null,
  [date]: null,
  [kind]: null,
  [flag]: false,
}, { createdAt: '2026-10-04T00:00:00.000Z' })

const recD = record('rec-d', v1.id, {
  [name]: 'керн а',
  [mass]: 2,
  [date]: '2026-03-01',
  [kind]: sameB,
  [flag]: false,
  [extra]: '   ',
}, { createdAt: '2026-10-02T00:00:00.000Z', createdBy: 3 })

const recE = record('rec-e', v2.id, {
  [name]: 'Пустой флаг',
  [mass]: 5,
  [date]: '2026-05-05',
  [kind]: soil,
}, { createdAt: '2026-10-05T00:00:00.000Z' })

const recTextMass = record('rec-text-mass', v2.id, {
  [name]: 'Текст вместо числа',
  [mass]: '10',
  [date]: '2026-06-06',
  [kind]: sand,
  [flag]: false,
}, { createdAt: '2026-10-06T00:00:00.000Z' })

const records = [recA, recB, recC, recD, recE, recTextMass]

function config(patch: Partial<QueryConfig> & { filters?: ViewFilter[] }): QueryConfig {
  return {
    schemaVersion: TABLE_VIEW_SCHEMA_VERSION,
    columns: [name, mass, date, kind, flag, extra],
    filters: [],
    sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
    pageSize: 25,
    ...patch,
  }
}

function rows(patch: Partial<QueryConfig>, offset = 0, limit = 25, source = records) {
  const parsed = parseQueryConfig(config(patch), catalog())
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error('config')
  const result = runTableQuery({
    organizationId: 101,
    formId,
    viewId: 'view-sample1',
    versions,
    records: source,
    authors: new Map([[3, 'Соколова Кира'], [4, 'Морозов Глеб']]),
    config: parsed.config,
    offset,
    limit,
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('query')
  return result.body
}

function catalog() {
  const built = buildColumnCatalog(formId, versions)
  expect(built.ok).toBe(true)
  if (!built.ok) throw new Error('catalog')
  return built.columns
}

function cell(body: ReturnType<typeof rows>, recordId: string, columnId: string) {
  const row = body.rows.find((item) => item.recordId === recordId)
  if (!row) throw new Error(recordId)
  return row.cells[columnId]
}

describe('table view columns', () => {
  it('keeps one column when the label is renamed and marks a removed field', () => {
    const columns = catalog()
    const title = columns.find((column) => column.id === name)
    expect(title?.label).toBe('Наименование образца')
    expect(columns.filter((column) => column.id === name)).toHaveLength(1)
    const removed = columns.find((column) => column.id === extra)
    expect(removed?.retired).toBe(true)
    expect(removed?.label).toBe('Комментарий')
    expect(columns.find((column) => column.id === 'field-draft-only')).toBeUndefined()
  })

  it('does not merge choice options that share a label', () => {
    const choice = catalog().find((column) => column.id === kind)
    expect(choice?.options.filter((option) => option.label === 'Керн').map((option) => option.id)).toEqual([sameA, sameB])
    expect(choice?.options.find((option) => option.id === core)?.label).toBe('Керн свежий')
  })

  it('marks mixed types and refuses a typed comparison', () => {
    const mixedVersions = [
      version('ver-mix-1', 1, [field('field-mix', 'number', 'Масса')], false),
      version('ver-mix-2', 2, [field('field-mix', 'text', 'Масса текстом')], true),
    ]
    const built = buildColumnCatalog(formId, mixedVersions)
    expect(built.ok && built.columns.find((column) => column.id === 'field-mix')).toMatchObject({ mixed: true, sortable: false })
    const parsed = parseQueryConfig(config({
      columns: ['field-mix'],
      filters: [{ columnId: 'field-mix', op: 'gt', value: 1 }],
      sort: { columnId: SYSTEM_COLUMN_IDS.recordId, direction: 'asc' },
    }), built.ok ? built.columns : [])
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.some((item) => item.code === 'mixed_column')).toBe(true)
    const presence = parseQueryConfig(config({
      columns: ['field-mix'],
      filters: [{ columnId: 'field-mix', op: 'blank', value: null }],
      sort: { columnId: SYSTEM_COLUMN_IDS.recordId, direction: 'asc' },
    }), built.ok ? built.columns : [])
    expect(presence.ok).toBe(true)
  })

  it('does not read an unknown source schema as version 1', () => {
    const unknown = version('ver-unknown', 1, [field(name, 'text', 'Скрыто')], true, 2)
    const built = buildColumnCatalog(formId, [unknown])
    expect(built.ok).toBe(false)
    const result = runTableQuery({
      organizationId: 101,
      formId,
      viewId: null,
      versions: [unknown],
      records: [record('rec-secret', unknown.id, { [name]: 'секретное' })],
      authors: new Map(),
      config: config({}),
      offset: 0,
      limit: 10,
    })
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('секретное')
  })
})

describe('table view cells', () => {
  it('distinguishes a missing field, an empty value, zero and false', () => {
    const body = rows({})
    expect(cell(body, recA.id, mass)).toMatchObject({ state: 'value', value: 0 })
    expect(cell(body, recC.id, mass)).toMatchObject({ state: 'empty', value: null })
    expect(cell(body, recB.id, extra)).toMatchObject({ state: 'absent' })
    expect(cell(body, recD.id, extra)).toMatchObject({ state: 'empty' })
    expect(cell(body, recA.id, flag)).toMatchObject({ state: 'value', value: false })
    expect(cell(body, recE.id, flag)).toMatchObject({ state: 'empty' })
    expect(cell(body, recTextMass.id, mass)).toMatchObject({ state: 'value', value: '10' })
  })

  it('shows the choice label from the record version', () => {
    const body = rows({})
    expect(cell(body, recA.id, kind)).toMatchObject({ value: core, optionLabel: 'Керн' })
    expect(cell(body, recB.id, kind)).toMatchObject({ value: core, optionLabel: 'Керн свежий' })
  })
})

describe('table view filters and sort', () => {
  it('applies every supported comparison without coercing text to a number', () => {
    const ids = (filters: ViewFilter[]) => rows({ filters, sort: { columnId: SYSTEM_COLUMN_IDS.recordId, direction: 'asc' } }).rows.map((row) => row.recordId).sort()
    const sorted = (...list: string[]) => [...list].sort()
    expect(ids([{ columnId: name, op: 'contains', value: 'керн' }])).toEqual(sorted(recA.id, recD.id))
    expect(ids([{ columnId: name, op: 'eq', value: 'керн а' }])).toEqual(sorted(recA.id, recD.id))
    expect(ids([{ columnId: mass, op: 'eq', value: 0 }])).toEqual([recA.id])
    expect(ids([{ columnId: mass, op: 'gt', value: 0 }])).toEqual(sorted(recD.id, recE.id, recB.id))
    expect(ids([{ columnId: mass, op: 'lt', value: 2 }])).toEqual([recA.id])
    expect(ids([{ columnId: date, op: 'eq', value: '2026-03-01' }])).toEqual([recD.id])
    expect(ids([{ columnId: date, op: 'gte', value: '2026-03-01' }])).toEqual(sorted(recD.id, recE.id, recTextMass.id, recB.id))
    expect(ids([{ columnId: date, op: 'lte', value: '2026-03-01' }])).toEqual(sorted(recA.id, recD.id))
    expect(ids([{ columnId: kind, op: 'eq', value: sameB }])).toEqual([recD.id])
    expect(ids([{ columnId: kind, op: 'eq', value: sameA }])).toEqual([])
    expect(ids([{ columnId: flag, op: 'eq', value: false }])).toEqual(sorted(recA.id, recC.id, recD.id, recTextMass.id))
    expect(ids([{ columnId: flag, op: 'present', value: null }])).not.toContain(recE.id)
    expect(ids([{ columnId: mass, op: 'present', value: null }])).toEqual(sorted(recA.id, recD.id, recE.id, recTextMass.id, recB.id))
    expect(ids([{ columnId: mass, op: 'blank', value: null }])).toEqual([recC.id])
    const blankExtra = ids([{ columnId: extra, op: 'blank', value: null }])
    expect(blankExtra).toEqual(expect.arrayContaining([recB.id, recD.id, recC.id]))
    expect(blankExtra).not.toContain(recA.id)
    expect(ids([{ columnId: extra, op: 'eq', value: 'старый' }])).toEqual([recA.id])
    expect(ids([
      { columnId: name, op: 'contains', value: 'почва' },
      { columnId: mass, op: 'gt', value: 0 },
    ])).toEqual([recB.id])
    expect(ids([{ columnId: mass, op: 'eq', value: 10 }])).toEqual([recB.id])
  })

  it('sorts numbers and calendar dates, keeps empties last and breaks ties by id', () => {
    const numeric = records.filter((item) => item.id !== recTextMass.id)
    const byMass = rows({ sort: { columnId: mass, direction: 'asc' } }, 0, 25, numeric).rows.map((row) => row.recordId)
    expect(byMass.slice(0, 4)).toEqual([recA.id, recD.id, recE.id, recB.id])
    expect(byMass.at(-1)).toBe(recC.id)
    const massDesc = rows({ sort: { columnId: mass, direction: 'desc' } }, 0, 25, numeric).rows.map((row) => row.recordId)
    expect(massDesc[0]).toBe(recB.id)
    expect(massDesc.at(-1)).toBe(recC.id)
    const byDate = rows({ sort: { columnId: date, direction: 'asc' } }, 0, 25, numeric).rows.map((row) => row.recordId)
    expect(byDate.slice(0, 3)).toEqual([recA.id, recD.id, recE.id])
    expect(byDate.at(-1)).toBe(recC.id)
    const tied = [
      record('rec-m2', v2.id, { [mass]: 10, [name]: 'б', [flag]: false }, { createdAt: '2026-01-01T00:00:00.000Z' }),
      record('rec-m1', v2.id, { [mass]: 10, [name]: 'а', [flag]: false }, { createdAt: '2026-01-02T00:00:00.000Z' }),
    ]
    const tie = rows({ columns: [mass], filters: [], sort: { columnId: mass, direction: 'desc' } }, 0, 25, tied)
    expect(tie.rows.map((row) => row.recordId)).toEqual(['rec-m1', 'rec-m2'])
    const byAuthor = rows({
      columns: [SYSTEM_COLUMN_IDS.author],
      sort: { columnId: SYSTEM_COLUMN_IDS.author, direction: 'asc' },
    })
    const authors = byAuthor.rows.map((row) => row.cells[SYSTEM_COLUMN_IDS.author]?.value)
    expect(authors.indexOf('Морозов Глеб')).toBeLessThan(authors.indexOf('Соколова Кира'))
    const created = rows({}).rows.map((row) => row.recordId)
    expect(created[0]).toBe(recTextMass.id)
    expect(created.indexOf(recD.id)).toBeGreaterThan(created.indexOf(recA.id))
  })

  it('counts before the page slice and drops another form', () => {
    const many = Array.from({ length: 12 }, (_item, index) => record(
      `rec-page-${String(index).padStart(2, '0')}`,
      v2.id,
      { [name]: `Ряд ${index}`, [mass]: index, [flag]: false },
      { createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` },
    ))
    const foreign = record('rec-foreign', v2.id, { [name]: 'чужая', [mass]: 1, [flag]: false }, { formId: 'form-other1', organizationId: 102 })
    const page = rows({ sort: { columnId: mass, direction: 'asc' } }, 0, 10, [...many, foreign])
    expect(page.total).toBe(12)
    expect(page.rows).toHaveLength(10)
    expect(page.rows.some((row) => row.recordId === 'rec-foreign')).toBe(false)
    const next = rows({ sort: { columnId: mass, direction: 'asc' } }, 10, 10, many)
    expect(next.total).toBe(12)
    expect(next.rows).toHaveLength(2)
  })

  it('rejects an unknown field, an unknown operator and an unknown settings version', () => {
    const columns = catalog()
    const unknownField = parseQueryConfig(config({ columns: ['field-missing'] }), columns)
    expect(unknownField.ok).toBe(false)
    const unknownOp = parseQueryConfig(config({
      filters: [{ columnId: mass, op: 'like' as 'eq', value: 1 }],
    }), columns)
    expect(unknownOp.ok).toBe(false)
    const unknownSettings = parseViewDocument({ ...config({}), schemaVersion: 9, title: 'Реестр', description: '' }, columns)
    expect(unknownSettings.ok).toBe(false)
    if (!unknownSettings.ok) expect(unknownSettings.code).toBe('unknown_schema')
    expect(JSON.stringify(unknownSettings)).not.toContain('Керн А')
  })
})

describe('table view response guard and url', () => {
  it('ignores a late response from another form or an older filter', () => {
    const body = rows({ filters: [{ columnId: mass, op: 'eq', value: 0 }] })
    const expected = {
      organizationId: 101,
      formId,
      viewId: 'view-sample1',
      offset: 0,
      limit: 25,
      filters: body.appliedFilters,
      sort: body.appliedSort,
      columns: body.columns.map((column) => column.id),
    }
    expect(acceptTableResponse(expected, body)).toBe(true)
    expect(acceptTableResponse(expected, { ...body, formId: 'form-other1' })).toBe(false)
    expect(acceptTableResponse(expected, { ...body, organizationId: 102 })).toBe(false)
    expect(acceptTableResponse(expected, { ...body, appliedFilters: [] })).toBe(false)
    const direct = readCell(catalog().find((column) => column.id === mass)!, recA, v1, 'Соколова')
    expect(direct.value).toBe(0)
  })

  it('keeps the working query in the url and does not repair a broken param', () => {
    const saved = { pageSize: 25, sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' as const }, filters: [] as ViewFilter[] }
    const params = writeWorkQuery(new URLSearchParams('org=101'), {
      page: 1,
      pageSize: 10,
      sort: { columnId: mass, direction: 'asc' },
      filters: [{ columnId: mass, op: 'gt', value: 0 }],
    }, saved)
    expect(params.get('org')).toBe('101')
    const read = readWorkQuery(params)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(workDiffers(read.work, saved)).toBe(true)
    expect(effectiveWork(read.work, saved).page).toBe(1)
    expect(readWorkQuery(new URLSearchParams('filters=not-json')).ok).toBe(false)
    expect(tableViewsMode('live')).toBe('unavailable')
    expect(tableViewsMode('mock')).toBe('mock')
  })
})

describe('created-at calendar day', () => {
  it('matches a UTC day and leaves a form date as a calendar string', () => {
    const version = {
      id: 'ver-day',
      formId,
      number: 1,
      current: true,
      schema: { schemaVersion: 1, fields: [{ id: 'field-date', type: 'date' as const, label: 'Дата приёма', options: [] }] },
    }
    const stamp = (id: string, createdAt: string, date: string) => record(id, version.id, { 'field-date': date }, { createdAt })
    const rows = [
      stamp('rec-before', '2026-10-26T23:59:59.999Z', '2026-10-27'),
      stamp('rec-start', '2026-10-27T00:00:00.000Z', '2026-10-26'),
      stamp('rec-end', '2026-10-27T23:59:59.999Z', '2026-10-27'),
      stamp('rec-next', '2026-10-28T00:00:00.000Z', '2026-10-28'),
    ]
    const bounds = utcDayBounds('2026-10-27')
    expect(bounds).toEqual({ start: '2026-10-27T00:00:00.000Z', next: '2026-10-28T00:00:00.000Z' })
    const query = (filters: ViewFilter[]) => runTableQuery({
      organizationId: 101,
      formId,
      viewId: 'view-day',
      versions: [version],
      records: rows,
      authors: new Map(),
      config: {
        schemaVersion: 1,
        columns: [SYSTEM_COLUMN_IDS.createdAt, 'field-date'],
        filters,
        sort: { columnId: SYSTEM_COLUMN_IDS.recordId, direction: 'asc' },
        pageSize: 25,
      },
      offset: 0,
      limit: 25,
    })
    const ids = (filters: ViewFilter[]) => {
      const result = query(filters)
      expect(result.ok).toBe(true)
      return result.ok ? result.body.rows.map((row) => row.recordId).sort() : []
    }
    expect(ids([{ columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'eq', value: 'utc-day:2026-10-27' }])).toEqual(['rec-end', 'rec-start'])
    expect(ids([{ columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'gte', value: 'utc-day:2026-10-27' }])).toEqual(['rec-end', 'rec-next', 'rec-start'])
    expect(ids([{ columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'lte', value: 'utc-day:2026-10-27' }])).toEqual(['rec-before', 'rec-end', 'rec-start'])
    expect(ids([{ columnId: 'field-date', op: 'eq', value: '2026-10-27' }])).toEqual(['rec-before', 'rec-end'])
    expect(matchesCreatedAt('2026-10-27T00:00:00.000Z', 'eq', '2026-10-27T00:00:00.000Z')).toBe(true)
    expect(matchesCreatedAt('2026-10-27T01:00:00.000Z', 'eq', '2026-10-27T00:00:00.000Z')).toBe(false)
    const bare = parseQueryConfig({
      schemaVersion: 1,
      columns: [SYSTEM_COLUMN_IDS.createdAt],
      filters: [{ columnId: SYSTEM_COLUMN_IDS.createdAt, op: 'eq', value: '2026-10-27' }],
      sort: { columnId: SYSTEM_COLUMN_IDS.createdAt, direction: 'desc' },
      pageSize: 25,
    }, [{ id: SYSTEM_COLUMN_IDS.createdAt, source: 'system', label: '', types: [], mixed: false, retired: false, sortable: true, options: [] }])
    expect(bare.ok).toBe(false)
    if (!bare.ok) expect(bare.issues.some((issue) => issue.code === 'legacy_created_at')).toBe(true)
    expect(classifyCreatedAtValue('2026-10-01T00:00:00.000Z').kind).toBe('legacy-text')
  })
})
