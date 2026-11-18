import {
  displaySampleStage,
  displayWell,
  findAvailableParent,
  inspectManualSample,
  sampleTypeOf,
  sameSampleCode,
  type ManualSampleIssue,
  type RegisterSampleInput,
  type RegisterSubsampleInput,
  type Sample,
} from '../../../../entities/sample'
import { sampleFailureCode } from './display'
import { sampleLocationText, type SampleLocationChoice } from './edit-plan'

/** Statuses a manual registration may set. Other statuses stay on the sample card. */
export const REGISTRATION_STAGES = ['Поступила', 'Запланирован отбор'] as const

export type RegistrationStage = (typeof REGISTRATION_STAGES)[number]

export const REGISTRATION_SECTIONS = [
  { id: 'sample-identification' },
  { id: 'sample-origin' },
  { id: 'sample-receipt' },
  { id: 'sample-documents' },
] as const

export type RegistrationDraft = {
  parentCode: string
  externalCode: string
  sampleType: string
  material: string
  field: string
  well: string
  formation: string
  interval: string
  subsampleInterval: string
  collectedAt: string
  conditions: string
  stage: RegistrationStage
  receivedAt: string
  place: SampleLocationChoice
  supplier: string
  container: string
  quantity: string
}

export type ParentProblem = 'missing' | 'foreign' | 'disposed' | 'deleted' | 'untyped'

export type ParentResolution =
  | { status: 'none' }
  | { status: 'ready'; parent: Sample }
  | { status: ParentProblem }

export type RegistrationIssue = {
  field: string
  code: ManualSampleIssue['code'] | 'parent' | ParentProblem
}

export type RegistrationRequest =
  | { kind: 'sample'; body: RegisterSampleInput }
  | { kind: 'subsample'; body: RegisterSubsampleInput }

const EMPTY_PLACE: SampleLocationChoice = { choice: '__none__', other: '', details: '' }

const ISSUE_KEY: Readonly<Record<string, string>> = {
  'sampleType:required': 'samples.registration.issue.type',
  'sampleType:invalid_type': 'samples.registration.issue.invalid-type',
  'field:required': 'samples.registration.issue.field',
  'well:required': 'samples.registration.issue.well',
  'receivedAt:required': 'samples.errors.received_at_required',
  'location:required': 'samples.errors.location_required',
  'subsampleInterval:subsample-interval': 'samples.registration.issue.subsample-interval',
  'parentCode:parent': 'samples.registration.issue.parent',
}

const API_FIELD: Readonly<Record<string, string>> = {
  invalid_type: 'sampleType',
  invalid_parent: 'parentCode',
  inherited_mismatch: 'parentCode',
  invalid_interval: 'subsampleInterval',
  invalid_stage: 'stage',
  received_at_required: 'receivedAt',
  location_required: 'location',
}

const API_CODES = new Set([
  'invalid_sample',
  'invalid_type',
  'invalid_parent',
  'inherited_mismatch',
  'invalid_interval',
  'invalid_date',
  'invalid_stage',
  'invalid_inspection',
  'forbidden',
  'not_found',
  'unavailable',
  'duplicate_sample',
  'counter_overflow',
  'invalid_body',
])

const KNOWN_FIELDS = new Set([
  'sampleType',
  'field',
  'well',
  'receivedAt',
  'location',
  'subsampleInterval',
  'parentCode',
  'collectedAt',
  'stage',
])

export function emptyRegistrationDraft(): RegistrationDraft {
  return {
    parentCode: '',
    externalCode: '',
    sampleType: '',
    material: '',
    field: '',
    well: '',
    formation: '',
    interval: '',
    subsampleInterval: '',
    collectedAt: '',
    conditions: '',
    stage: 'Поступила',
    receivedAt: '',
    place: { ...EMPTY_PLACE },
    supplier: '',
    container: '',
    quantity: '',
  }
}

export function registrationSignature(draft: RegistrationDraft): string {
  return JSON.stringify(draft)
}

export function registrationChanged(current: RegistrationDraft, baseline: RegistrationDraft): boolean {
  return registrationSignature(current) !== registrationSignature(baseline)
}

/** Status is the only value this switch changes. Receipt data stays until the user edits it. */
export function registrationWithStage(draft: RegistrationDraft, stage: RegistrationStage): RegistrationDraft {
  return { ...draft, stage }
}

/**
 * One saved sample. Shared origin and receipt stay for the next entry.
 * Marking, container, quantity, sample-specific conditions and the own subsample interval are cleared.
 */
export function continueRegistrationDraft(draft: RegistrationDraft): RegistrationDraft {
  return {
    ...draft,
    externalCode: '',
    container: '',
    quantity: '',
    conditions: '',
    subsampleInterval: '',
  }
}

export function registrationParentHref(base: string, parentId: string): string {
  const url = new URL(base, 'http://localhost')
  url.searchParams.delete('project')
  url.searchParams.set('parent', parentId)
  return `${url.pathname}${url.search}`
}

export function resolveRegistrationParent(
  records: readonly Sample[],
  organizationId: number,
  parentCode: string,
): ParentResolution {
  const code = parentCode.trim()
  if (!code) return { status: 'none' }
  const matches = records.filter((item) => sameSampleCode(item.code, code))
  if (matches.length === 0) return { status: 'missing' }
  const own = matches.filter((item) => item.organizationId === organizationId)
  if (own.length === 0) return { status: 'foreign' }
  const live = own.filter((item) => !item.deletedAt)
  if (live.length === 0) return { status: 'deleted' }
  const open = live.find((item) => displaySampleStage(item.stage) !== 'Утилизирована')
  if (!open) return { status: 'disposed' }
  const available = findAvailableParent(records, open.id, organizationId)
  if (!available) return { status: 'missing' }
  if (sampleTypeOf(available) === 'Не указан') return { status: 'untyped' }
  return { status: 'ready', parent: available }
}

export function resolveRegistrationParentById(
  records: readonly Sample[],
  organizationId: number,
  parentId: string,
): ParentResolution {
  const id = parentId.trim()
  if (!id) return { status: 'none' }
  const record = records.find((item) => item.id === id)
  if (!record) return { status: 'missing' }
  if (record.organizationId !== organizationId) return { status: 'foreign' }
  if (record.deletedAt) return { status: 'deleted' }
  return resolveRegistrationParent(records, organizationId, record.code)
}

export function applyInitialParent(
  draft: RegistrationDraft,
  records: readonly Sample[],
  organizationId: number,
  parentId: string,
): { draft: RegistrationDraft; notice: ParentProblem | null } {
  const resolved = resolveRegistrationParentById(records, organizationId, parentId)
  if (resolved.status === 'none' || resolved.status === 'ready') {
    return {
      draft: resolved.status === 'ready' ? { ...draft, parentCode: resolved.parent.code } : draft,
      notice: null,
    }
  }
  return { draft: { ...draft, parentCode: '' }, notice: resolved.status }
}

export function registrationParentKey(status: ParentProblem): string {
  return `samples.registration.parent.${status}`
}

export function registrationIssueKey(issue: RegistrationIssue): string {
  if (issue.field === 'parentCode' && isParentProblem(issue.code)) return registrationParentKey(issue.code)
  return ISSUE_KEY[`${issue.field}:${issue.code}`] ?? 'samples.registration.api.invalid_sample'
}

function isParentProblem(code: string): code is ParentProblem {
  return code === 'missing' || code === 'foreign' || code === 'disposed' || code === 'deleted' || code === 'untyped'
}

export function registrationApiKey(code: string): string {
  return API_CODES.has(code) ? `samples.registration.api.${code}` : 'samples.registration.api.unknown'
}

export function inspectRegistration(draft: RegistrationDraft, parent: ParentResolution): RegistrationIssue[] {
  if (draft.parentCode.trim() && parent.status !== 'ready' && parent.status !== 'none') {
    return [{ field: 'parentCode', code: parent.status }]
  }
  const selected = parent.status === 'ready' ? parent.parent : null
  const planned = draft.stage === 'Запланирован отбор'
  return inspectManualSample({
    sampleType: selected ? sampleTypeOf(selected) : draft.sampleType,
    field: selected ? selected.field : draft.field,
    well: selected ? selected.well : draft.well,
    parentId: selected?.id,
    stage: draft.stage,
    receivedAt: planned ? '' : draft.receivedAt,
    location: sampleLocationText(draft.place),
    subsampleInterval: selected ? draft.subsampleInterval : undefined,
  })
}

function filled(value: string): string | undefined {
  const text = value.trim()
  return text ? text : undefined
}

export function registrationRequest(
  organizationId: number,
  draft: RegistrationDraft,
  parent: Sample | null,
): RegistrationRequest {
  const planned = draft.stage === 'Запланирован отбор'
  const location = sampleLocationText(draft.place).trim()
  const shared = {
    organizationId,
    stage: draft.stage,
    inspection: 'Не проведён' as const,
    ...(planned ? {} : { receivedAt: draft.receivedAt.trim() }),
    ...(location ? { location } : {}),
    ...(filled(draft.material) ? { material: draft.material.trim() } : {}),
    ...(filled(draft.container) ? { container: draft.container.trim() } : {}),
    ...(filled(draft.quantity) ? { quantity: draft.quantity.trim() } : {}),
    ...(filled(draft.supplier) ? { supplier: draft.supplier.trim() } : {}),
    ...(filled(draft.conditions) ? { conditions: draft.conditions.trim() } : {}),
    ...(filled(draft.externalCode) ? { externalCode: draft.externalCode.trim() } : {}),
  }
  if (!parent) {
    return {
      kind: 'sample',
      body: {
        ...shared,
        sampleType: draft.sampleType.trim(),
        field: draft.field.trim(),
        well: displayWell(draft.well),
        ...(filled(draft.formation) ? { formation: draft.formation.trim() } : {}),
        ...(filled(draft.interval) ? { interval: draft.interval.trim() } : {}),
        ...(filled(draft.collectedAt) ? { collectedAt: draft.collectedAt.trim() } : {}),
      },
    }
  }
  return {
    kind: 'subsample',
    body: {
      ...shared,
      parentId: parent.id,
      ...(filled(draft.subsampleInterval) ? { subsampleInterval: draft.subsampleInterval.trim() } : {}),
    } satisfies RegisterSubsampleInput,
  }
}

export function prepareRegistration(
  organizationId: number,
  draft: RegistrationDraft,
  records: readonly Sample[],
): { ok: false; issues: RegistrationIssue[] } | { ok: true; request: RegistrationRequest } {
  const parent = resolveRegistrationParent(records, organizationId, draft.parentCode)
  const issues = inspectRegistration(draft, parent)
  if (issues.length) return { ok: false, issues }
  return {
    ok: true,
    request: registrationRequest(organizationId, draft, parent.status === 'ready' ? parent.parent : null),
  }
}

export function registrationFailure(error: unknown): { code: string; field: string | null } {
  if (!error || typeof error !== 'object') return { code: 'unavailable', field: null }
  if ('status' in error && (error.status === 'FETCH_ERROR' || error.status === 'TIMEOUT_ERROR' || error.status === 'PARSING_ERROR')) {
    return { code: 'unavailable', field: null }
  }
  const code = sampleFailureCode(error) ?? 'unavailable'
  let reported: string | null = null
  if ('data' in error && error.data && typeof error.data === 'object' && 'field' in error.data) {
    const field = (error.data as { field?: unknown }).field
    if (typeof field === 'string') reported = field
  }
  const field = API_FIELD[code] ?? (reported && KNOWN_FIELDS.has(reported) ? reported : null)
  return { code, field }
}
