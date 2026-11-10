import type { RequestDraftDetails, RequestProgramLine, RequestSubject } from './draft'
import {
  emptyResearchNeed,
  type RequestNeedClarification,
  type RequestResearchNeed,
} from './needs'
import { readProgramMeta, type RequestProgramMeta } from './program'
import {
  REQUEST_ENTITY_ID,
  isDepthUnit,
  type RequestField,
  type RequestInterval,
  type RequestWell,
} from './study'

export type { RequestProgramApproval, RequestProgramMeta, RequestProgramSnapshot, RequestProgramStudyLine } from './program'
export { REQUEST_PROGRAM_APPROVALS, emptyProgramMeta, readProgramMeta } from './program'

export const REQUEST_CLARIFICATION_CODES = ['legacy_subject_kept', 'legacy_program_unlinked'] as const

export type RequestClarificationCode = (typeof REQUEST_CLARIFICATION_CODES)[number]

/** A stable note that some legacy values could not be turned into wells or need links. */
export type RequestDraftClarification = {
  id: string
  code: RequestClarificationCode
  sourceId: string
}

const LEGACY_FIELD_ID = 'legacy-field'
const LEGACY_WELL_ID = 'legacy-well'
const LEGACY_SUBJECT_NOTE = 'legacy-subject'
const LEGACY_PROGRAM_NOTE = 'legacy-program'

export type StudyListing = {
  fields: boolean
  needs: boolean
  clarifications: boolean
}

/**
 * Fills the study collection only when the stored draft has no such list yet.
 * A second call sees the lists and does not append another copy.
 * Programme lines and the original subject stay in place.
 */
export function withDerivedStudy(details: RequestDraftDetails, listed: StudyListing): RequestDraftDetails {
  const fields = listed.fields ? details.fields : deriveFields(details.subject)
  const needs = listed.needs ? details.needs : deriveNeeds(details.program)
  const clarifications = listed.clarifications ? details.clarifications : deriveClarifications(details, listed)
  return { ...details, fields, needs, clarifications, programMeta: details.programMeta }
}

export function readStoredStudy(stored: Record<string, unknown> | null): {
  fields: RequestField[]
  needs: RequestResearchNeed[]
  clarifications: RequestDraftClarification[]
  programMeta: RequestProgramMeta
  listed: StudyListing
} {
  const fieldsListed = !!stored && Array.isArray(stored.fields)
  const needsListed = !!stored && Array.isArray(stored.needs)
  const clarificationsListed = !!stored && Array.isArray(stored.clarifications)
  return {
    fields: fieldsListed ? readFields(stored.fields) : [],
    needs: needsListed ? readNeeds(stored.needs) : [],
    clarifications: clarificationsListed ? readClarifications(stored.clarifications) : [],
    programMeta: readProgramMeta(stored?.programMeta),
    listed: { fields: fieldsListed, needs: needsListed, clarifications: clarificationsListed },
  }
}

export function subjectNeedsClarification(subject: RequestSubject): boolean {
  if (subject.objectKind) return true
  if (subject.padId || subject.formationId || subject.objectNumber || subject.materialId || subject.deliveryDate || subject.note) return true
  if (subject.core.diameterMm || subject.core.recoveryPercent) return true
  const fluid = subject.fluid
  return Boolean(
    fluid.wellTypeId || fluid.sampleKindId || fluid.fluidKindId || fluid.sampledOn || fluid.sampleVolumeMl || fluid.sampleCounts.length > 0,
  )
}

/**
 * One field and, when the old draft named a well, one well.
 * Intervals are not invented. The display name stays blank because the old record stored a catalogue id.
 */
export function deriveFields(subject: RequestSubject): RequestField[] {
  const fieldId = subject.fieldId.trim()
  const wellId = subject.wellId.trim()
  if (!fieldId && !wellId) return []
  const wells: RequestWell[] = wellId
    ? [{ id: LEGACY_WELL_ID, catalogWellId: wellId, wellName: '', intervals: [] }]
    : []
  return [{ id: LEGACY_FIELD_ID, catalogFieldId: fieldId, fieldName: '', wells }]
}

/**
 * One need per programme line, with no well targets.
 * The line itself stays in `program`. Quantity is copied only when the line already has a unit.
 */
export function deriveNeeds(program: readonly RequestProgramLine[]): RequestResearchNeed[] {
  return program.flatMap((line) => {
    const id = legacyNeedId(line.id)
    if (!id) return []
    const need = emptyResearchNeed(id)
    const quantity = pairedQuantity(line.quantity, line.unitId)
    return [{
      ...need,
      researchId: line.workKindId,
      quantity: quantity ? quantity.quantity : null,
      unitId: quantity ? quantity.unitId : '',
      clarification: 'unlinked_program_line',
      legacyLineId: line.id,
    }]
  })
}

function deriveClarifications(details: RequestDraftDetails, listed: StudyListing): RequestDraftClarification[] {
  const notes: RequestDraftClarification[] = []
  if (!listed.fields && subjectNeedsClarification(details.subject)) {
    notes.push({ id: LEGACY_SUBJECT_NOTE, code: 'legacy_subject_kept', sourceId: 'subject' })
  }
  if (!listed.needs && details.program.length > 0) {
    notes.push({ id: LEGACY_PROGRAM_NOTE, code: 'legacy_program_unlinked', sourceId: 'program' })
  }
  return notes
}

function legacyNeedId(lineId: string): string | null {
  const id = `legacy-${lineId}`
  return REQUEST_ENTITY_ID.test(id) ? id : null
}

function pairedQuantity(quantity: string, unitId: string): { quantity: number; unitId: string } | null {
  if (unitId.trim() === '') return null
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(quantity)) return null
  const value = Number(quantity)
  if (!Number.isFinite(value) || value <= 0) return null
  return { quantity: value, unitId }
}

function readFields(value: unknown): RequestField[] {
  if (!Array.isArray(value)) return []
  const fields: RequestField[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    seen.add(body.id)
    fields.push({
      id: body.id,
      catalogFieldId: typeof body.catalogFieldId === 'string' ? body.catalogFieldId : '',
      fieldName: typeof body.fieldName === 'string' ? body.fieldName : '',
      wells: readWells(body.wells),
    })
  }
  return fields
}

function readWells(value: unknown): RequestWell[] {
  if (!Array.isArray(value)) return []
  const wells: RequestWell[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    seen.add(body.id)
    wells.push({
      id: body.id,
      catalogWellId: typeof body.catalogWellId === 'string' ? body.catalogWellId : '',
      wellName: typeof body.wellName === 'string' ? body.wellName : '',
      intervals: readIntervals(body.intervals),
    })
  }
  return wells
}

function readIntervals(value: unknown): RequestInterval[] {
  if (!Array.isArray(value)) return []
  const intervals: RequestInterval[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    if (typeof body.from !== 'number' || typeof body.to !== 'number' || !Number.isFinite(body.from) || !Number.isFinite(body.to)) continue
    if (typeof body.unit !== 'string' || !isDepthUnit(body.unit)) continue
    seen.add(body.id)
    intervals.push({ id: body.id, from: body.from, to: body.to, unit: body.unit })
  }
  return intervals
}

function readNeeds(value: unknown): RequestResearchNeed[] {
  if (!Array.isArray(value)) return []
  const needs: RequestResearchNeed[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    seen.add(body.id)
    const clarification = readClarification(body.clarification)
    needs.push({
      id: body.id,
      targets: readTargets(body.targets),
      researchId: typeof body.researchId === 'string' ? body.researchId : '',
      desiredResult: typeof body.desiredResult === 'string' ? body.desiredResult : '',
      sampleTypeId: typeof body.sampleTypeId === 'string' ? body.sampleTypeId : '',
      quantity: typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : null,
      unitId: typeof body.unitId === 'string' ? body.unitId : '',
      comment: typeof body.comment === 'string' ? body.comment : '',
      clarification,
      legacyLineId: typeof body.legacyLineId === 'string' ? body.legacyLineId : '',
    })
  }
  return needs
}

function readTargets(value: unknown): RequestResearchNeed['targets'] {
  if (!Array.isArray(value)) return []
  const targets: RequestResearchNeed['targets'] = []
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.wellId !== 'string' || !REQUEST_ENTITY_ID.test(body.wellId)) continue
    const intervalIds = Array.isArray(body.intervalIds)
      ? body.intervalIds.filter((id): id is string => typeof id === 'string' && REQUEST_ENTITY_ID.test(id))
      : []
    if (body.selection === 'well') {
      targets.push({ wellId: body.wellId, selection: 'well', intervalIds: [] })
      continue
    }
    if (body.selection === 'intervals' && intervalIds.length > 0) {
      targets.push({ wellId: body.wellId, selection: 'intervals', intervalIds })
    }
  }
  return targets
}

function readClarifications(value: unknown): RequestDraftClarification[] {
  if (!Array.isArray(value)) return []
  const notes: RequestDraftClarification[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    if (body.code !== 'legacy_subject_kept' && body.code !== 'legacy_program_unlinked') continue
    if (typeof body.sourceId !== 'string') continue
    seen.add(body.id)
    notes.push({ id: body.id, code: body.code, sourceId: body.sourceId })
  }
  return notes
}

function readClarification(value: unknown): RequestNeedClarification {
  return value === 'unlinked_program_line' ? value : ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
