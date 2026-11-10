import { REQUEST_TITLE_MAX } from './types'

/**
 * Depths are non-negative measured depths.
 * `m` is the only unit until a later catalogue says otherwise.
 * A well may list no intervals.
 */
export const REQUEST_DEPTH_UNITS = ['m'] as const

export type RequestDepthUnit = (typeof REQUEST_DEPTH_UNITS)[number]

export const REQUEST_ENTITY_ID = /^[A-Za-z0-9_-]{1,80}$/

export const REQUEST_STUDY_MAX = 30

export type RequestInterval = {
  id: string
  from: number
  to: number
  unit: RequestDepthUnit
}

export type RequestWell = {
  id: string
  /** Catalogue id when the well is known. Empty when the name was typed by hand. */
  catalogWellId: string
  wellName: string
  intervals: RequestInterval[]
}

export type RequestField = {
  id: string
  /** Catalogue id when the field is known. Empty when the name was typed by hand. */
  catalogFieldId: string
  fieldName: string
  wells: RequestWell[]
}

export type DepthIntervalCode = 'invalid_number' | 'invalid_bounds' | 'invalid_unit'

export type DepthIntervalValue = {
  from: number
  to: number
  unit: RequestDepthUnit
}

export type StudyIssueCode = 'invalid_draft' | 'invalid_text' | 'invalid_object' | DepthIntervalCode

export type StudyIssue = {
  field: string
  code: StudyIssueCode
}

type FieldCatalog = {
  fields: readonly string[]
  wells: readonly string[]
}

/** Reusable depth check. Negative depths are rejected. `from` must be less than `to`. */
export function inspectDepthInterval(value: unknown): { ok: true; value: DepthIntervalValue } | { ok: false; code: DepthIntervalCode } {
  const body = asRecord(value)
  if (!body) return { ok: false, code: 'invalid_number' }
  const from = depthNumber(body.from)
  const to = depthNumber(body.to)
  if (from == null || to == null) return { ok: false, code: 'invalid_number' }
  if (from < 0 || to < 0) return { ok: false, code: 'invalid_number' }
  if (from >= to) return { ok: false, code: 'invalid_bounds' }
  if (typeof body.unit !== 'string' || !isDepthUnit(body.unit)) return { ok: false, code: 'invalid_unit' }
  return { ok: true, value: { from, to, unit: body.unit } }
}

export function isDepthUnit(value: string): value is RequestDepthUnit {
  return (REQUEST_DEPTH_UNITS as readonly string[]).includes(value)
}

export function findFieldById(fields: readonly RequestField[], fieldId: string): RequestField | null {
  return fields.find((field) => field.id === fieldId) ?? null
}

export function findWellById(fields: readonly RequestField[], wellId: string): { field: RequestField; well: RequestWell } | null {
  for (const field of fields) {
    const well = field.wells.find((item) => item.id === wellId)
    if (well) return { field, well }
  }
  return null
}

export function findIntervalById(
  fields: readonly RequestField[],
  intervalId: string,
): { field: RequestField; well: RequestWell; interval: RequestInterval } | null {
  for (const field of fields) {
    for (const well of field.wells) {
      const interval = well.intervals.find((item) => item.id === intervalId)
      if (interval) return { field, well, interval }
    }
  }
  return null
}

export function studyHasNamedField(fields: readonly RequestField[]): boolean {
  return fields.some((field) => field.catalogFieldId.trim() !== '' || field.fieldName.trim() !== '')
}

export function studyHasNamedWell(fields: readonly RequestField[]): boolean {
  return fields.some((field) => field.wells.some((well) => well.catalogWellId.trim() !== '' || well.wellName.trim() !== ''))
}

/**
 * Strict read of a study collection sent by a client.
 * A missing list is an empty collection. Indexes are not identifiers.
 */
export function inspectStudyFields(
  value: unknown,
  catalog: FieldCatalog,
): { ok: true; fields: RequestField[] } | { ok: false; issues: StudyIssue[] } {
  if (value === undefined) return { ok: true, fields: [] }
  if (!Array.isArray(value)) return { ok: false, issues: [{ field: 'fields', code: 'invalid_draft' }] }
  if (value.length > REQUEST_STUDY_MAX) return { ok: false, issues: [{ field: 'fields', code: 'invalid_draft' }] }
  const issues: StudyIssue[] = []
  const fields: RequestField[] = []
  const fieldIds = new Set<string>()
  const wellIds = new Set<string>()
  const intervalIds = new Set<string>()
  let valid = true
  value.forEach((item, index) => {
    const parsed = inspectField(item, index, catalog, fieldIds, wellIds, intervalIds)
    issues.push(...parsed.issues)
    if (!parsed.field) {
      valid = false
      return
    }
    fields.push(parsed.field)
  })
  return valid ? { ok: true, fields } : { ok: false, issues }
}

function inspectField(
  value: unknown,
  index: number,
  catalog: FieldCatalog,
  fieldIds: Set<string>,
  wellIds: Set<string>,
  intervalIds: Set<string>,
): { field: RequestField | null; issues: StudyIssue[] } {
  const path = `fields.${index}`
  const body = asRecord(value)
  const issues: StudyIssue[] = []
  if (!body || !knownKeys(body, ['id', 'catalogFieldId', 'fieldName', 'wells'])) {
    return { field: null, issues: [{ field: path, code: 'invalid_draft' }] }
  }
  const id = entityId(body.id)
  const duplicate = id != null && fieldIds.has(id)
  const catalogFieldId = choice(body.catalogFieldId, catalog.fields)
  const fieldName = text(body.fieldName, REQUEST_TITLE_MAX)
  if (id == null || duplicate) issues.push({ field: `${path}.id`, code: 'invalid_object' })
  if (id && !duplicate) fieldIds.add(id)
  if (catalogFieldId == null) issues.push({ field: `${path}.catalogFieldId`, code: 'invalid_object' })
  if (fieldName == null) issues.push({ field: `${path}.fieldName`, code: 'invalid_text' })
  const wells = inspectWells(body.wells, path, catalog, wellIds, intervalIds, issues)
  if (id == null || duplicate || catalogFieldId == null || fieldName == null || !wells) return { field: null, issues }
  return { field: { id, catalogFieldId, fieldName, wells }, issues }
}

function inspectWells(
  value: unknown,
  path: string,
  catalog: FieldCatalog,
  wellIds: Set<string>,
  intervalIds: Set<string>,
  issues: StudyIssue[],
): RequestWell[] | null {
  if (!Array.isArray(value)) {
    issues.push({ field: `${path}.wells`, code: 'invalid_draft' })
    return null
  }
  if (value.length > REQUEST_STUDY_MAX) {
    issues.push({ field: `${path}.wells`, code: 'invalid_draft' })
    return null
  }
  const wells: RequestWell[] = []
  let valid = true
  value.forEach((item, index) => {
    const parsed = inspectWell(item, `${path}.wells.${index}`, catalog, wellIds, intervalIds)
    issues.push(...parsed.issues)
    if (!parsed.well) {
      valid = false
      return
    }
    wells.push(parsed.well)
  })
  return valid ? wells : null
}

function inspectWell(
  value: unknown,
  path: string,
  catalog: FieldCatalog,
  wellIds: Set<string>,
  intervalIds: Set<string>,
): { well: RequestWell | null; issues: StudyIssue[] } {
  const body = asRecord(value)
  const issues: StudyIssue[] = []
  if (!body || !knownKeys(body, ['id', 'catalogWellId', 'wellName', 'intervals'])) {
    return { well: null, issues: [{ field: path, code: 'invalid_draft' }] }
  }
  const id = entityId(body.id)
  const duplicate = id != null && wellIds.has(id)
  const catalogWellId = choice(body.catalogWellId, catalog.wells)
  const wellName = text(body.wellName, REQUEST_TITLE_MAX)
  if (id == null || duplicate) issues.push({ field: `${path}.id`, code: 'invalid_object' })
  if (id && !duplicate) wellIds.add(id)
  if (catalogWellId == null) issues.push({ field: `${path}.catalogWellId`, code: 'invalid_object' })
  if (wellName == null) issues.push({ field: `${path}.wellName`, code: 'invalid_text' })
  const intervals = inspectIntervals(body.intervals, path, intervalIds, issues)
  if (id == null || duplicate || catalogWellId == null || wellName == null || !intervals) return { well: null, issues }
  return { well: { id, catalogWellId, wellName, intervals }, issues }
}

function inspectIntervals(
  value: unknown,
  path: string,
  intervalIds: Set<string>,
  issues: StudyIssue[],
): RequestInterval[] | null {
  if (!Array.isArray(value)) {
    issues.push({ field: `${path}.intervals`, code: 'invalid_draft' })
    return null
  }
  if (value.length > REQUEST_STUDY_MAX) {
    issues.push({ field: `${path}.intervals`, code: 'invalid_draft' })
    return null
  }
  const intervals: RequestInterval[] = []
  let valid = true
  value.forEach((item, index) => {
    const parsed = inspectStoredInterval(item, `${path}.intervals.${index}`, intervalIds)
    issues.push(...parsed.issues)
    if (!parsed.interval) {
      valid = false
      return
    }
    intervals.push(parsed.interval)
  })
  return valid ? intervals : null
}

function inspectStoredInterval(
  value: unknown,
  path: string,
  intervalIds: Set<string>,
): { interval: RequestInterval | null; issues: StudyIssue[] } {
  const body = asRecord(value)
  const issues: StudyIssue[] = []
  if (!body || !knownKeys(body, ['id', 'from', 'to', 'unit'])) {
    return { interval: null, issues: [{ field: path, code: 'invalid_draft' }] }
  }
  const id = entityId(body.id)
  const duplicate = id != null && intervalIds.has(id)
  if (id == null || duplicate) issues.push({ field: `${path}.id`, code: 'invalid_object' })
  if (id && !duplicate) intervalIds.add(id)
  const depth = inspectDepthInterval(body)
  if (!depth.ok) issues.push({ field: path, code: depth.code })
  if (id == null || duplicate || !depth.ok) return { interval: null, issues }
  return { interval: { id, ...depth.value }, issues }
}

export function entityId(value: unknown): string | null {
  if (typeof value !== 'string' || !REQUEST_ENTITY_ID.test(value)) return null
  return value
}

function depthNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function knownKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set<string>(keys)
  const present = Object.keys(body)
  return present.every((key) => allowed.has(key)) && keys.every((key) => Object.prototype.hasOwnProperty.call(body, key))
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

function choice(value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return allowed.includes(trimmed) ? trimmed : null
}
