import {
  entityId,
  findIntervalById,
  findWellById,
  type RequestField,
  type RequestInterval,
  type RequestWell,
} from './study'

/**
 * `well` means the whole well and carries no interval ids.
 * `intervals` lists specific intervals of that well and is never empty.
 * An empty list is not another way to say "the whole well".
 */
export const REQUEST_NEED_SELECTIONS = ['well', 'intervals'] as const

export type RequestNeedSelection = (typeof REQUEST_NEED_SELECTIONS)[number]

export type RequestNeedTarget = {
  wellId: string
  selection: RequestNeedSelection
  intervalIds: string[]
}

export const REQUEST_NEED_CLARIFICATIONS = ['', 'unlinked_program_line'] as const

export type RequestNeedClarification = (typeof REQUEST_NEED_CLARIFICATIONS)[number]

/**
 * One requested outcome. It points at wells by id and does not copy the field card.
 * `researchId` empty means the research is not chosen. `quantity` null means it was not planned.
 */
export type RequestResearchNeed = {
  id: string
  targets: RequestNeedTarget[]
  researchId: string
  desiredResult: string
  sampleTypeId: string
  quantity: number | null
  unitId: string
  comment: string
  clarification: RequestNeedClarification
  /** Set when this row was mirrored from a programme line. Empty for a native need. */
  legacyLineId: string
}

export const REQUEST_NEED_MAX = 30
export const REQUEST_NEED_TEXT_MAX = 1000

export type NeedIssueCode = 'invalid_draft' | 'invalid_text' | 'invalid_need' | 'invalid_quantity' | 'invalid_unit' | 'invalid_link'

export type NeedIssue = {
  field: string
  code: NeedIssueCode
}

export type NeedLinkCode =
  | 'missing_well'
  | 'missing_interval'
  | 'interval_not_on_well'
  | 'ambiguous_selection'
  | 'duplicate_target'

export type NeedLinkIssue = {
  field: string
  code: NeedLinkCode
}

type NeedCatalog = {
  workKinds: readonly string[]
  sampleKinds: readonly string[]
  units: readonly string[]
}

export function emptyResearchNeed(id: string): RequestResearchNeed {
  return {
    id,
    targets: [],
    researchId: '',
    desiredResult: '',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
  }
}

/**
 * A planned quantity is optional.
 * When it is present it is a positive finite number and the unit is required.
 * When it is absent, the unit may stay blank.
 */
export function inspectPlannedQuantity(
  quantity: unknown,
  unitId: unknown,
  units: readonly string[],
): { ok: true; quantity: number | null; unitId: string } | { ok: false; code: 'invalid_quantity' | 'invalid_unit' | 'invalid_need' } {
  if (typeof unitId !== 'string') return { ok: false, code: 'invalid_need' }
  const unit = unitId.trim()
  if (unit !== '' && !units.includes(unit)) return { ok: false, code: 'invalid_unit' }
  if (quantity == null) return { ok: true, quantity: null, unitId: unit }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return { ok: false, code: 'invalid_quantity' }
  if (unit === '') return { ok: false, code: 'invalid_quantity' }
  return { ok: true, quantity, unitId: unit }
}

/**
 * Draft save allows both sides to be blank.
 * Send requires a selected research or a written result. A written result does not create a catalogue row.
 */
export function inspectResearchChoice(input: {
  researchId: string
  desiredResult: string
  mode: 'draft' | 'send'
}): { ok: true } | { ok: false; code: 'missing_result' } {
  if (input.mode === 'draft') return { ok: true }
  if (input.researchId.trim() !== '' || input.desiredResult.trim() !== '') return { ok: true }
  return { ok: false, code: 'missing_result' }
}

export function inspectResearchNeeds(
  value: unknown,
  catalog: NeedCatalog,
): { ok: true; needs: RequestResearchNeed[] } | { ok: false; issues: NeedIssue[] } {
  if (value === undefined) return { ok: true, needs: [] }
  if (!Array.isArray(value)) return { ok: false, issues: [{ field: 'needs', code: 'invalid_draft' }] }
  if (value.length > REQUEST_NEED_MAX) return { ok: false, issues: [{ field: 'needs', code: 'invalid_need' }] }
  const issues: NeedIssue[] = []
  const needs: RequestResearchNeed[] = []
  const seen = new Set<string>()
  let valid = true
  value.forEach((item, index) => {
    const parsed = inspectNeed(item, index, catalog, seen)
    issues.push(...parsed.issues)
    if (!parsed.need) {
      valid = false
      return
    }
    needs.push(parsed.need)
  })
  return valid ? { ok: true, needs } : { ok: false, issues }
}

/** Wells a need points at. Missing ids are omitted here and reported by inspectNeedLinks. */
export function wellsSelectedByNeed(
  fields: readonly RequestField[],
  need: RequestResearchNeed,
): Array<{ field: RequestField; well: RequestWell }> {
  return need.targets.flatMap((target) => {
    const found = findWellById(fields, target.wellId)
    return found ? [found] : []
  })
}

/** Intervals named by a need. A whole-well target contributes none. */
export function intervalsSelectedByNeed(
  fields: readonly RequestField[],
  need: RequestResearchNeed,
): Array<{ field: RequestField; well: RequestWell; interval: RequestInterval }> {
  return need.targets.flatMap((target) => {
    if (target.selection !== 'intervals') return []
    return target.intervalIds.flatMap((intervalId) => {
      const found = findIntervalById(fields, intervalId)
      if (!found || found.well.id !== target.wellId) return []
      return [found]
    })
  })
}

/** Dangling or ambiguous links. An empty target list is incomplete, not dangling. */
export function inspectNeedLinks(fields: readonly RequestField[], needs: readonly RequestResearchNeed[]): NeedLinkIssue[] {
  const issues: NeedLinkIssue[] = []
  needs.forEach((need, index) => {
    const seenWells = new Set<string>()
    need.targets.forEach((target, targetIndex) => {
      const path = `needs.${index}.targets.${targetIndex}`
      if (seenWells.has(target.wellId)) issues.push({ field: path, code: 'duplicate_target' })
      seenWells.add(target.wellId)
      const well = findWellById(fields, target.wellId)
      if (!well) {
        issues.push({ field: path, code: 'missing_well' })
        return
      }
      if (target.selection === 'well') {
        if (target.intervalIds.length > 0) issues.push({ field: path, code: 'ambiguous_selection' })
        return
      }
      if (target.intervalIds.length === 0) {
        issues.push({ field: path, code: 'ambiguous_selection' })
        return
      }
      const seenIntervals = new Set<string>()
      target.intervalIds.forEach((intervalId) => {
        if (seenIntervals.has(intervalId)) issues.push({ field: `${path}.intervalIds`, code: 'duplicate_target' })
        seenIntervals.add(intervalId)
        const interval = findIntervalById(fields, intervalId)
        if (!interval) {
          issues.push({ field: `${path}.intervalIds`, code: 'missing_interval' })
          return
        }
        if (interval.well.id !== target.wellId) issues.push({ field: `${path}.intervalIds`, code: 'interval_not_on_well' })
      })
    })
  })
  return issues
}

export type RemovalEffect = {
  kind: 'well' | 'interval'
  id: string
  needIds: string[]
}

/** Needs that mention this well. The caller can show this before deleting. No dialog is opened here. */
export function describeWellRemoval(needs: readonly RequestResearchNeed[], wellId: string): RemovalEffect {
  return {
    kind: 'well',
    id: wellId,
    needIds: needs.filter((need) => need.targets.some((target) => target.wellId === wellId)).map((need) => need.id),
  }
}

/** Needs that name this interval. A whole-well target does not count. */
export function describeIntervalRemoval(needs: readonly RequestResearchNeed[], intervalId: string): RemovalEffect {
  return {
    kind: 'interval',
    id: intervalId,
    needIds: needs.filter((need) => need.targets.some((target) => target.selection === 'intervals' && target.intervalIds.includes(intervalId))).map((need) => need.id),
  }
}

export function withoutRequestWell<T extends { fields: RequestField[]; needs: RequestResearchNeed[] }>(details: T, wellId: string): T {
  return {
    ...details,
    fields: details.fields.map((field) => ({
      ...field,
      wells: field.wells.filter((well) => well.id !== wellId),
    })),
    needs: details.needs.map((need) => ({
      ...need,
      targets: need.targets.filter((target) => target.wellId !== wellId),
    })),
  }
}

/**
 * Drops the interval and every reference to it.
 * A target that loses its last interval is removed. It does not become "the whole well".
 */
export function withoutRequestInterval<T extends { fields: RequestField[]; needs: RequestResearchNeed[] }>(details: T, intervalId: string): T {
  return {
    ...details,
    fields: details.fields.map((field) => ({
      ...field,
      wells: field.wells.map((well) => ({
        ...well,
        intervals: well.intervals.filter((interval) => interval.id !== intervalId),
      })),
    })),
    needs: details.needs.map((need) => ({
      ...need,
      targets: need.targets.flatMap((target) => {
        if (!target.intervalIds.includes(intervalId)) return [target]
        const intervalIds = target.intervalIds.filter((id) => id !== intervalId)
        if (target.selection === 'intervals' && intervalIds.length === 0) return []
        return [{ ...target, intervalIds }]
      }),
    })),
  }
}

/** Native needs participate in a future send. A mirrored programme line keeps the old line rules. */
export function researchNeedSendGaps(need: RequestResearchNeed): Array<'desired_result' | 'need_targets' | 'quantity'> {
  if (need.clarification === 'unlinked_program_line') return []
  const gaps: Array<'desired_result' | 'need_targets' | 'quantity'> = []
  if (!inspectResearchChoice({ researchId: need.researchId, desiredResult: need.desiredResult, mode: 'send' }).ok) gaps.push('desired_result')
  if (need.targets.length === 0) gaps.push('need_targets')
  if (need.quantity != null && (need.unitId.trim() === '' || need.quantity <= 0)) gaps.push('quantity')
  return gaps
}

export function researchNeedIsReady(need: RequestResearchNeed): boolean {
  return researchNeedSendGaps(need).length === 0 && need.clarification !== 'unlinked_program_line' && need.targets.length > 0
}

function inspectNeed(
  value: unknown,
  index: number,
  catalog: NeedCatalog,
  seen: Set<string>,
): { need: RequestResearchNeed | null; issues: NeedIssue[] } {
  const path = `needs.${index}`
  const body = asRecord(value)
  const issues: NeedIssue[] = []
  if (!body || !knownKeys(body, ['id', 'targets', 'researchId', 'desiredResult', 'sampleTypeId', 'quantity', 'unitId', 'comment'], ['clarification', 'legacyLineId'])) {
    return { need: null, issues: [{ field: path, code: 'invalid_need' }] }
  }
  const id = entityId(body.id)
  const duplicate = id != null && seen.has(id)
  if (id == null || duplicate) issues.push({ field: `${path}.id`, code: 'invalid_need' })
  if (id && !duplicate) seen.add(id)
  const researchId = choice(body.researchId, catalog.workKinds)
  const sampleTypeId = choice(body.sampleTypeId, catalog.sampleKinds)
  const desiredResult = text(body.desiredResult, REQUEST_NEED_TEXT_MAX)
  const comment = text(body.comment, REQUEST_NEED_TEXT_MAX)
  const clarification = optionalClarification(body.clarification)
  const legacyLineId = optionalLineId(body.legacyLineId)
  if (researchId == null) issues.push({ field: `${path}.researchId`, code: 'invalid_need' })
  if (sampleTypeId == null) issues.push({ field: `${path}.sampleTypeId`, code: 'invalid_need' })
  if (desiredResult == null) issues.push({ field: `${path}.desiredResult`, code: 'invalid_text' })
  if (comment == null) issues.push({ field: `${path}.comment`, code: 'invalid_text' })
  if (clarification == null) issues.push({ field: `${path}.clarification`, code: 'invalid_need' })
  if (legacyLineId == null) issues.push({ field: `${path}.legacyLineId`, code: 'invalid_need' })
  const planned = inspectPlannedQuantity(body.quantity, body.unitId, catalog.units)
  if (!planned.ok) issues.push({ field: `${path}.quantity`, code: planned.code })
  const targets = inspectTargets(body.targets, path, issues)
  if (
    id == null || duplicate || researchId == null || sampleTypeId == null || desiredResult == null || comment == null
    || clarification == null || legacyLineId == null || !planned.ok || !targets
  ) return { need: null, issues }
  return {
    need: {
      id,
      targets,
      researchId,
      desiredResult,
      sampleTypeId,
      quantity: planned.quantity,
      unitId: planned.unitId,
      comment,
      clarification,
      legacyLineId,
    },
    issues,
  }
}

function inspectTargets(value: unknown, path: string, issues: NeedIssue[]): RequestNeedTarget[] | null {
  if (!Array.isArray(value)) {
    issues.push({ field: `${path}.targets`, code: 'invalid_need' })
    return null
  }
  if (value.length > REQUEST_NEED_MAX) {
    issues.push({ field: `${path}.targets`, code: 'invalid_need' })
    return null
  }
  const targets: RequestNeedTarget[] = []
  let valid = true
  value.forEach((item, index) => {
    const parsed = inspectTarget(item, `${path}.targets.${index}`)
    if (!parsed.ok) {
      issues.push({ field: parsed.field, code: 'invalid_need' })
      valid = false
      return
    }
    targets.push(parsed.target)
  })
  return valid ? targets : null
}

function inspectTarget(value: unknown, path: string): { ok: true; target: RequestNeedTarget } | { ok: false; field: string } {
  const body = asRecord(value)
  if (!body || !knownKeys(body, ['wellId', 'selection', 'intervalIds'])) return { ok: false, field: path }
  const wellId = entityId(body.wellId)
  if (wellId == null) return { ok: false, field: `${path}.wellId` }
  if (body.selection !== 'well' && body.selection !== 'intervals') return { ok: false, field: `${path}.selection` }
  if (!Array.isArray(body.intervalIds) || body.intervalIds.some((item) => entityId(item) == null)) {
    return { ok: false, field: `${path}.intervalIds` }
  }
  const intervalIds = body.intervalIds.filter((item): item is string => typeof item === 'string')
  if (body.selection === 'well' && intervalIds.length > 0) return { ok: false, field: path }
  if (body.selection === 'intervals' && intervalIds.length === 0) return { ok: false, field: path }
  return { ok: true, target: { wellId, selection: body.selection, intervalIds } }
}

function optionalClarification(value: unknown): RequestNeedClarification | null {
  if (value === undefined || value === '') return ''
  return value === 'unlinked_program_line' ? value : null
}

function optionalLineId(value: unknown): string | null {
  if (value === undefined || value === '') return ''
  return entityId(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function knownKeys(body: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set<string>([...required, ...optional])
  const present = Object.keys(body)
  if (!present.every((key) => allowed.has(key))) return false
  return required.every((key) => Object.prototype.hasOwnProperty.call(body, key))
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
