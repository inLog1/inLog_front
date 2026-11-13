import {
  inspectNeedLinks,
  inspectPlannedQuantity,
  inspectResearchNeeds,
  type RequestNeedTarget,
  type RequestResearchNeed,
} from './needs'
import { REQUEST_ENTITY_ID, type RequestField } from './study'

/**
 * Approval of the study programme. It is not the request status.
 * `unspecified` means nobody has stored a programme decision yet.
 * A draft save cannot move the value off `unspecified`.
 */
export const REQUEST_PROGRAM_APPROVALS = [
  'unspecified',
  'draft',
  'pending_customer',
  'returned',
  'approved',
] as const

export type RequestProgramApproval = (typeof REQUEST_PROGRAM_APPROVALS)[number]

/** One study the programme will actually perform. It does not replace the customer's need. */
export type RequestProgramStudyLine = {
  id: string
  /** Need this line answers. Empty when the line is an addition. */
  needId: string
  targets: RequestNeedTarget[]
  researchId: string
  sampleTypeId: string
  quantity: number | null
  unitId: string
  note: string
}

/** Immutable copy taken when the programme is approved. */
export type RequestProgramSnapshot = {
  version: number
  preparedBy: 'customer' | 'laboratory'
  authorUserId: number
  approvedByUserId: number
  approvedAt: string
  lines: RequestProgramStudyLine[]
  note: string
}

export type RequestProgramMeta = {
  authorUserId: number | null
  preparedBy: '' | 'customer' | 'laboratory'
  approval: RequestProgramApproval
  lines: RequestProgramStudyLine[]
  note: string
  version: number
  preparedAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  approvedByUserId: number | null
  returnReason: string
  approvedSnapshot: RequestProgramSnapshot | null
}

export const REQUEST_PROGRAM_NOTE_MAX = 1000

export type ProgramIssue = { field: string; code: 'invalid_program' | 'invalid_need' | 'invalid_link' | 'invalid_quantity' | 'invalid_text' }

type ProgramCatalog = {
  workKinds: readonly string[]
  sampleKinds: readonly string[]
  units: readonly string[]
}

export function emptyProgramMeta(): RequestProgramMeta {
  return {
    authorUserId: null,
    preparedBy: '',
    approval: 'unspecified',
    lines: [],
    note: '',
    version: 0,
    preparedAt: null,
    submittedAt: null,
    approvedAt: null,
    approvedByUserId: null,
    returnReason: '',
    approvedSnapshot: null,
  }
}

export function isProgramApproval(value: unknown): value is RequestProgramApproval {
  return typeof value === 'string' && (REQUEST_PROGRAM_APPROVALS as readonly string[]).includes(value)
}

/** A native need without a selected research still needs a laboratory decision. */
export function needRequiresProgramChoice(need: RequestResearchNeed): boolean {
  return need.clarification !== 'unlinked_program_line' && need.researchId.trim() === ''
}

/**
 * The customer already named a research for every native need.
 * Legacy programme lines that already carry a work kind do not count as open.
 */
export function customerProgramIsComplete(needs: readonly RequestResearchNeed[]): boolean {
  const native = needs.filter((need) => need.clarification !== 'unlinked_program_line')
  if (native.length === 0) return needs.some((need) => need.researchId.trim() !== '')
  return native.every((need) => need.researchId.trim() !== '')
}

export function lineFromNeed(need: RequestResearchNeed): RequestProgramStudyLine {
  const id = need.id.length <= 74 ? `pg-${need.id}` : need.id
  return {
    id,
    needId: need.id,
    targets: need.targets.map((target) => ({ ...target, intervalIds: [...target.intervalIds] })),
    researchId: need.researchId,
    sampleTypeId: need.sampleTypeId,
    quantity: need.quantity,
    unitId: need.unitId,
    note: '',
  }
}

/**
 * Laboratory lines replace the research for the needs they name.
 * Needs the laboratory did not retarget stay as the customer wrote them.
 * An empty laboratory list means the programme is still the customer's selection.
 */
export function effectiveProgramLines(
  needs: readonly RequestResearchNeed[],
  meta: RequestProgramMeta,
): RequestProgramStudyLine[] {
  if (meta.lines.length === 0) {
    return needs.filter((need) => need.researchId.trim() !== '').map(lineFromNeed)
  }
  const replaced = new Set(meta.lines.map((line) => line.needId).filter((id) => id !== ''))
  const kept = needs
    .filter((need) => need.researchId.trim() !== '' && !replaced.has(need.id))
    .map(lineFromNeed)
  return [...kept, ...meta.lines.map(copyLine)]
}

/**
 * True when every study line is the customer's need copied across:
 * same research, sample, quantity, unit and wells, and no laboratory note.
 * Such a line is not a second stage of the request.
 */
export function programLinesRepeatNeeds(
  needs: readonly RequestResearchNeed[],
  lines: readonly RequestProgramStudyLine[],
): boolean {
  if (lines.length === 0 || lines.some((line) => line.note.trim() !== '')) return false
  const sourced = needs.filter((need) => need.researchId.trim() !== '')
  if (lines.length !== sourced.length) return false
  const pending = new Map(sourced.map((need) => [need.id, need]))
  for (const line of lines) {
    const need = pending.get(line.needId)
    if (!need) return false
    pending.delete(line.needId)
    if (line.researchId !== need.researchId || line.sampleTypeId !== need.sampleTypeId) return false
    if (line.quantity !== need.quantity || line.unitId !== need.unitId) return false
    if (!sameTargetSet(line.targets, need.targets)) return false
  }
  return pending.size === 0
}

export function programPreparedSide(
  needs: readonly RequestResearchNeed[],
  meta: RequestProgramMeta,
): '' | 'customer' | 'laboratory' {
  if (meta.preparedBy === 'customer' || meta.preparedBy === 'laboratory') return meta.preparedBy
  if (customerProgramIsComplete(needs) && meta.lines.length === 0) return 'customer'
  return ''
}

export function inspectProgramStudyLines(
  value: unknown,
  catalog: ProgramCatalog,
): { ok: true; lines: RequestProgramStudyLine[] } | { ok: false; issues: ProgramIssue[] } {
  if (!Array.isArray(value)) return { ok: false, issues: [{ field: 'lines', code: 'invalid_program' }] }
  if (value.length > 30) return { ok: false, issues: [{ field: 'lines', code: 'invalid_program' }] }
  const adapted: unknown[] = []
  const needIds: string[] = []
  for (const item of value) {
    const body = asRecord(item)
    if (!body) return { ok: false, issues: [{ field: 'lines', code: 'invalid_program' }] }
    const needId = body.needId
    if (typeof needId !== 'string' || (needId !== '' && !REQUEST_ENTITY_ID.test(needId))) {
      return { ok: false, issues: [{ field: 'lines.needId', code: 'invalid_program' }] }
    }
    const note = body.note === undefined ? '' : body.note
    if (typeof note !== 'string' || note.trim().length > REQUEST_PROGRAM_NOTE_MAX) {
      return { ok: false, issues: [{ field: 'lines.note', code: 'invalid_text' }] }
    }
    needIds.push(needId)
    adapted.push({
      id: body.id,
      targets: body.targets,
      researchId: body.researchId,
      desiredResult: '',
      sampleTypeId: body.sampleTypeId ?? '',
      quantity: body.quantity ?? null,
      unitId: body.unitId ?? '',
      comment: note.trim(),
      clarification: '',
      legacyLineId: '',
    })
  }
  const parsed = inspectResearchNeeds(adapted, catalog)
  if (!parsed.ok) {
    return { ok: false, issues: parsed.issues.map((issue) => ({ field: issue.field, code: 'invalid_program' as const })) }
  }
  const seenNeed = new Set<string>()
  const lines = parsed.needs.map((need, index) => {
    const needId = needIds[index] ?? ''
    if (needId !== '' && seenNeed.has(needId)) {
      return null
    }
    if (needId !== '') seenNeed.add(needId)
    return {
      id: need.id,
      needId,
      targets: need.targets,
      researchId: need.researchId,
      sampleTypeId: need.sampleTypeId,
      quantity: need.quantity,
      unitId: need.unitId,
      note: need.comment,
    }
  })
  if (lines.some((line) => line == null)) return { ok: false, issues: [{ field: 'lines.needId', code: 'invalid_program' }] }
  return { ok: true, lines: lines.filter((line): line is RequestProgramStudyLine => line != null) }
}

/**
 * A programme can be approved only when every open need has a research
 * and every line points at a real catalogue row and at real wells.
 * A missing quantity is allowed. A present quantity still needs a unit.
 */
export function inspectProgramForApproval(input: {
  fields: readonly RequestField[]
  needs: readonly RequestResearchNeed[]
  meta: RequestProgramMeta
  catalog: ProgramCatalog
}): { ok: true; lines: RequestProgramStudyLine[]; note: string } | { ok: false; issues: ProgramIssue[] } {
  const note = input.meta.note.trim()
  if (note.length > REQUEST_PROGRAM_NOTE_MAX) return { ok: false, issues: [{ field: 'note', code: 'invalid_text' }] }
  const lines = effectiveProgramLines(input.needs, input.meta)
  if (lines.length === 0) return { ok: false, issues: [{ field: 'lines', code: 'invalid_program' }] }
  const issues: ProgramIssue[] = []
  lines.forEach((line, index) => {
    if (line.researchId.trim() === '' || !input.catalog.workKinds.includes(line.researchId)) {
      issues.push({ field: `lines.${index}.researchId`, code: 'invalid_program' })
    }
    if (line.sampleTypeId !== '' && !input.catalog.sampleKinds.includes(line.sampleTypeId)) {
      issues.push({ field: `lines.${index}.sampleTypeId`, code: 'invalid_program' })
    }
    const planned = inspectPlannedQuantity(line.quantity, line.unitId, input.catalog.units)
    if (!planned.ok) issues.push({ field: `lines.${index}.quantity`, code: 'invalid_quantity' })
  })
  const open = input.needs.filter(needRequiresProgramChoice)
  open.forEach((need) => {
    const cover = lines.find((line) => line.needId === need.id && line.researchId.trim() !== '')
    if (!cover) issues.push({ field: `needs.${need.id}`, code: 'invalid_need' })
  })
  const linked = inspectNeedLinks(input.fields, lines.map(lineAsNeed))
  linked.forEach((issue) => issues.push({ field: issue.field, code: 'invalid_link' }))
  if (lines.some((line) => line.targets.length === 0)) issues.push({ field: 'lines.targets', code: 'invalid_link' })
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, lines: lines.map(copyLine), note }
}

export function readProgramMeta(value: unknown): RequestProgramMeta {
  const empty = emptyProgramMeta()
  const body = asRecord(value)
  if (!body) return empty
  const authorUserId = body.authorUserId
  const preparedBy = body.preparedBy === 'customer' || body.preparedBy === 'laboratory' ? body.preparedBy : ''
  const approval = isProgramApproval(body.approval) ? body.approval : 'unspecified'
  return {
    authorUserId: typeof authorUserId === 'number' && Number.isInteger(authorUserId) && authorUserId > 0 ? authorUserId : null,
    preparedBy,
    approval,
    lines: readLines(body.lines),
    note: typeof body.note === 'string' ? body.note.slice(0, REQUEST_PROGRAM_NOTE_MAX) : '',
    version: typeof body.version === 'number' && Number.isInteger(body.version) && body.version >= 0 ? body.version : 0,
    preparedAt: readStamp(body.preparedAt),
    submittedAt: readStamp(body.submittedAt),
    approvedAt: readStamp(body.approvedAt),
    approvedByUserId: typeof body.approvedByUserId === 'number' && Number.isInteger(body.approvedByUserId) && body.approvedByUserId > 0
      ? body.approvedByUserId
      : null,
    returnReason: typeof body.returnReason === 'string' ? body.returnReason.slice(0, REQUEST_PROGRAM_NOTE_MAX) : '',
    approvedSnapshot: readSnapshot(body.approvedSnapshot),
  }
}

/** Draft writes may echo the empty workflow. They cannot store lines or an approval. */
export function draftProgramMetaIsBlank(value: unknown): boolean {
  if (value === undefined) return true
  const body = asRecord(value)
  if (!body) return false
  if (body.lines !== undefined && (!Array.isArray(body.lines) || body.lines.length > 0)) return false
  if (body.note !== undefined && body.note !== '') return false
  if (body.version !== undefined && body.version !== 0) return false
  if (body.preparedAt !== undefined && body.preparedAt !== null) return false
  if (body.submittedAt !== undefined && body.submittedAt !== null) return false
  if (body.approvedAt !== undefined && body.approvedAt !== null) return false
  if (body.approvedByUserId !== undefined && body.approvedByUserId !== null) return false
  if (body.returnReason !== undefined && body.returnReason !== '') return false
  if (body.approvedSnapshot !== undefined && body.approvedSnapshot !== null) return false
  return true
}

export function copyProgramSnapshot(meta: RequestProgramMeta, lines: readonly RequestProgramStudyLine[], approvedByUserId: number, approvedAt: string): RequestProgramSnapshot | null {
  if (meta.preparedBy !== 'customer' && meta.preparedBy !== 'laboratory') return null
  if (meta.authorUserId == null) return null
  return {
    version: meta.version,
    preparedBy: meta.preparedBy,
    authorUserId: meta.authorUserId,
    approvedByUserId,
    approvedAt,
    lines: lines.map(copyLine),
    note: meta.note,
  }
}

function sameTargetSet(left: readonly RequestNeedTarget[], right: readonly RequestNeedTarget[]): boolean {
  if (left.length !== right.length) return false
  const key = (target: RequestNeedTarget) => `${target.wellId}|${target.selection}|${[...target.intervalIds].sort().join(',')}`
  const keys = (targets: readonly RequestNeedTarget[]) => targets.map(key).sort()
  return keys(left).every((item, index) => item === keys(right)[index])
}

function lineAsNeed(line: RequestProgramStudyLine): RequestResearchNeed {
  return {
    id: line.id,
    targets: line.targets,
    researchId: line.researchId,
    desiredResult: '',
    sampleTypeId: line.sampleTypeId,
    quantity: line.quantity,
    unitId: line.unitId,
    comment: line.note,
    clarification: '',
    legacyLineId: '',
  }
}

function copyLine(line: RequestProgramStudyLine): RequestProgramStudyLine {
  return {
    ...line,
    targets: line.targets.map((target) => ({ ...target, intervalIds: [...target.intervalIds] })),
  }
}

function readLines(value: unknown): RequestProgramStudyLine[] {
  if (!Array.isArray(value)) return []
  const lines: RequestProgramStudyLine[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    if (!body || typeof body.id !== 'string' || !REQUEST_ENTITY_ID.test(body.id) || seen.has(body.id)) continue
    seen.add(body.id)
    const needId = typeof body.needId === 'string' && (body.needId === '' || REQUEST_ENTITY_ID.test(body.needId)) ? body.needId : ''
    lines.push({
      id: body.id,
      needId,
      targets: readTargets(body.targets),
      researchId: typeof body.researchId === 'string' ? body.researchId : '',
      sampleTypeId: typeof body.sampleTypeId === 'string' ? body.sampleTypeId : '',
      quantity: typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : null,
      unitId: typeof body.unitId === 'string' ? body.unitId : '',
      note: typeof body.note === 'string' ? body.note : '',
    })
  }
  return lines
}

function readTargets(value: unknown): RequestNeedTarget[] {
  if (!Array.isArray(value)) return []
  const targets: RequestNeedTarget[] = []
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

function readSnapshot(value: unknown): RequestProgramSnapshot | null {
  const body = asRecord(value)
  if (!body) return null
  if (body.preparedBy !== 'customer' && body.preparedBy !== 'laboratory') return null
  if (typeof body.authorUserId !== 'number' || typeof body.approvedByUserId !== 'number') return null
  if (typeof body.approvedAt !== 'string' || body.approvedAt.trim() === '') return null
  if (typeof body.version !== 'number' || !Number.isInteger(body.version) || body.version < 1) return null
  return {
    version: body.version,
    preparedBy: body.preparedBy,
    authorUserId: body.authorUserId,
    approvedByUserId: body.approvedByUserId,
    approvedAt: body.approvedAt,
    lines: readLines(body.lines),
    note: typeof body.note === 'string' ? body.note : '',
  }
}

function readStamp(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
