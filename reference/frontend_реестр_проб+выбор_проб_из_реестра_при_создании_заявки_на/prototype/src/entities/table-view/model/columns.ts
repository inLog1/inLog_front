import {
  SYSTEM_COLUMN_IDS,
  TABLE_SOURCE_SCHEMA_VERSION,
  type CatalogColumn,
  type CatalogResult,
  type SourceField,
  type SourceRecord,
  type SourceVersion,
  type SystemColumnId,
  type TableCell,
} from './types'

const SYSTEM_ORDER: readonly SystemColumnId[] = [
  SYSTEM_COLUMN_IDS.createdAt,
  SYSTEM_COLUMN_IDS.author,
  SYSTEM_COLUMN_IDS.version,
  SYSTEM_COLUMN_IDS.recordId,
]

export type ReadCell = TableCell & {
  /**
   * False when a stored primitive is not the type of the record's version.
   * Typed comparisons do not match it and do not coerce it.
   */
  comparable: boolean
}

/**
 * Calendar date as written. Digits are not passed through the local timezone.
 * Same rule as form values; this slice does not import the form slice.
 */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

export function isSystemColumn(id: string): id is SystemColumnId {
  return (SYSTEM_ORDER as readonly string[]).includes(id)
}

function systemColumn(id: SystemColumnId): CatalogColumn {
  return {
    id,
    source: 'system',
    label: '',
    types: [],
    mixed: false,
    retired: false,
    sortable: true,
    options: [],
  }
}

/**
 * Columns come only from the versions the caller passes.
 * Those must be published versions. A draft is omitted by not being passed.
 * The label is taken from the newest version that still contains the field id.
 */
export function buildColumnCatalog(formId: string, versions: readonly SourceVersion[]): CatalogResult {
  const relevant = versions.filter((version) => version.formId === formId)
  if (relevant.some((version) => version.schema.schemaVersion !== TABLE_SOURCE_SCHEMA_VERSION)) {
    return { ok: false, code: 'unknown_schema' }
  }
  const ordered = [...relevant].sort((left, right) => left.number - right.number || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  const fields = new Map<string, {
    label: string
    types: SourceField['type'][]
    inCurrent: boolean
    options: Map<string, string>
    order: number
  }>()
  let order = 0
  for (const version of ordered) {
    const seen = new Set<string>()
    for (const field of version.schema.fields) {
      if (seen.has(field.id)) continue
      seen.add(field.id)
      let slot = fields.get(field.id)
      if (!slot) {
        slot = { label: field.label, types: [], inCurrent: false, options: new Map(), order: order }
        order += 1
        fields.set(field.id, slot)
      }
      slot.label = field.label
      if (!slot.types.includes(field.type)) slot.types.push(field.type)
      if (version.current) slot.inCurrent = true
      if (field.type === 'single_choice') {
        const optionSeen = new Set<string>()
        for (const option of field.options) {
          if (optionSeen.has(option.id)) continue
          optionSeen.add(option.id)
          slot.options.set(option.id, option.label)
        }
      }
    }
  }
  const columns = SYSTEM_ORDER.map((id) => systemColumn(id))
  for (const [id, slot] of [...fields.entries()].sort((left, right) => left[1].order - right[1].order)) {
    const mixed = slot.types.length > 1
    columns.push({
      id,
      source: 'field',
      label: slot.label,
      types: slot.types,
      mixed,
      retired: !slot.inCurrent,
      sortable: !mixed,
      options: [...slot.options.entries()].map(([optionId, label]) => ({ id: optionId, label })),
    })
  }
  return { ok: true, columns }
}

function valueCell(
  type: TableCell['type'],
  value: string | number | boolean,
  optionLabel: string | null,
  comparable = true,
): ReadCell {
  return { state: 'value', type, value, optionLabel, comparable }
}

function emptyCell(type: TableCell['type']): ReadCell {
  return { state: 'empty', type, value: null, optionLabel: null, comparable: false }
}

function absentCell(): ReadCell {
  return { state: 'absent', type: null, value: null, optionLabel: null, comparable: false }
}

function readField(field: SourceField, raw: unknown): ReadCell {
  if (field.type === 'text' || field.type === 'textarea') {
    if (typeof raw !== 'string' || raw.trim() === '') return emptyCell(field.type)
    return valueCell(field.type, raw, null)
  }
  if (field.type === 'number') {
    if (typeof raw === 'number' && Number.isFinite(raw)) return valueCell('number', raw, null)
    if (raw == null || raw === '') return emptyCell('number')
    if (typeof raw === 'string' || typeof raw === 'boolean') return valueCell('number', raw, null, false)
    return emptyCell('number')
  }
  if (field.type === 'date') {
    if (typeof raw === 'string' && isCalendarDate(raw)) return valueCell('date', raw, null)
    if (raw == null || raw === '') return emptyCell('date')
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return valueCell('date', raw, null, false)
    }
    return emptyCell('date')
  }
  if (field.type === 'single_choice') {
    if (typeof raw === 'string' && raw !== '') {
      const option = field.options.find((item) => item.id === raw)
      return valueCell('single_choice', raw, option?.label ?? null)
    }
    if (raw == null || raw === '') return emptyCell('single_choice')
    if (typeof raw === 'number' || typeof raw === 'boolean') return valueCell('single_choice', raw, null, false)
    return emptyCell('single_choice')
  }
  if (raw === true || raw === false) return valueCell('boolean', raw, null)
  if (raw == null) return emptyCell('boolean')
  if (typeof raw === 'string' || typeof raw === 'number') return valueCell('boolean', raw, null, false)
  return emptyCell('boolean')
}

/**
 * Interprets one cell by the record's own version.
 * Absent, empty, 0 and false stay distinct. Nothing is rewritten on the record.
 */
export function readCell(
  column: CatalogColumn,
  record: SourceRecord,
  version: SourceVersion | null,
  authorName: string,
): ReadCell {
  if (column.id === SYSTEM_COLUMN_IDS.createdAt) return valueCell('createdAt', record.createdAt, null)
  if (column.id === SYSTEM_COLUMN_IDS.author) return valueCell('author', authorName, null)
  if (column.id === SYSTEM_COLUMN_IDS.recordId) return valueCell('recordId', record.id, null)
  if (column.id === SYSTEM_COLUMN_IDS.version) {
    return version ? valueCell('version', version.number, null) : emptyCell('version')
  }
  if (!version || version.schema.schemaVersion !== TABLE_SOURCE_SCHEMA_VERSION) return absentCell()
  const field = version.schema.fields.find((item) => item.id === column.id)
  if (!field) return absentCell()
  return readField(field, record.values[field.id])
}

export function columnKind(column: CatalogColumn): 'text' | 'number' | 'date' | 'choice' | 'boolean' | 'mixed' | 'createdAt' | 'author' | 'version' | 'recordId' {
  if (column.id === SYSTEM_COLUMN_IDS.createdAt) return 'createdAt'
  if (column.id === SYSTEM_COLUMN_IDS.author) return 'author'
  if (column.id === SYSTEM_COLUMN_IDS.version) return 'version'
  if (column.id === SYSTEM_COLUMN_IDS.recordId) return 'recordId'
  if (column.mixed || column.types.length !== 1) return 'mixed'
  const type = column.types[0]
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  if (type === 'single_choice') return 'choice'
  if (type === 'boolean') return 'boolean'
  return 'text'
}
