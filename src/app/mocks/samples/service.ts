import { effectiveGrants, grantAllows } from '../../../entities/access/model/grants'
import {
  ATTACHMENT_TYPES,
  addSampleAttachments,
  batchSamples,
  changeControl,
  deleteSample,
  displayWell,
  findAvailableParent,
  inspectBatchFileSize,
  inspectManualSample,
  isCurrentSampleStage,
  isSampleType,
  isSampleInspection,
  kindForSampleType,
  linkSampleAttachment,
  parseSampleBatch,
  registerSamplesWithDocuments,
  sampleTypeOf,
  unlinkSampleAttachment,
  inheritedSampleOrigin,
  type AddSampleDocumentsInput,
  type AttachmentType,
  type ChangeSampleInspectionInput,
  type ChangeSamplePlaceInput,
  type ChangeSampleStatusInput,
  type RegisterSampleBatchInput,
  type RegisterSampleInput,
  type RegisterSubsampleInput,
  type Sample,
  type SampleAttachment,
  type SampleBatchResult,
  type SampleDocumentLinkInput,
  type SampleDocumentView,
  type SampleInspection,
  type SampleOrganizationKind,
  type SampleStage,
} from '../../../entities/sample'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockOrganization, MockState, MockUser } from '../db/types'

/**
 * Temporary access mapping until the registry has its own grants.
 * Read follows requests.read, registration follows requests.create, and every change follows requests.update.
 * The check is the grant itself. A role display name is not an input.
 * corporate_superadmin is included only when the existing catalog already grants that requests action
 * on the installation corporation. A grant on one organization does not open another.
 */

const DOMAIN_CODES: Record<string, { status: number; code: string }> = {
  required: { status: 400, code: 'invalid_sample' },
  'invalid-parent': { status: 400, code: 'invalid_parent' },
  'invalid-parent-type': { status: 400, code: 'invalid_parent' },
  'subsample-interval': { status: 400, code: 'invalid_interval' },
  note: { status: 400, code: 'note_required' },
  location: { status: 400, code: 'location_required' },
  receivedAt: { status: 400, code: 'received_at_required' },
  stage: { status: 400, code: 'invalid_stage' },
  duplicate: { status: 409, code: 'duplicate_sample' },
  'duplicate-id': { status: 409, code: 'duplicate_sample' },
  'duplicate-sample': { status: 409, code: 'duplicate_sample' },
  'has-children': { status: 409, code: 'has_children' },
  'counter-overflow': { status: 409, code: 'counter_overflow' },
  'organization-mismatch': { status: 400, code: 'organization_mismatch' },
  'missing-sample': { status: 404, code: 'not_found' },
  'missing-file': { status: 404, code: 'not_found' },
  'invalid-type': { status: 400, code: 'invalid_type' },
  'invalid-inspection': { status: 400, code: 'invalid_inspection' },
  'invalid-body': { status: 400, code: 'invalid_body' },
  'invalid-file': { status: 400, code: 'invalid_file' },
  'file-count': { status: 400, code: 'file_count' },
  'file-size': { status: 400, code: 'file_size' },
  'total-size': { status: 400, code: 'total_size' },
  'invalid-batch': { status: 400, code: 'invalid_batch' },
  'invalid-date': { status: 400, code: 'invalid_date' },
}

const ISSUE_CODES: Record<string, string> = {
  required: 'invalid_sample',
  invalid_type: 'invalid_type',
  note: 'note_required',
  'subsample-interval': 'invalid_interval',
}

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string, extra?: Record<string, unknown>): FlowResult {
  return done(state, status, { code, ...extra })
}

function domainProblem(state: MockState, error: unknown): FlowResult {
  if (error instanceof Error) {
    const mapped = DOMAIN_CODES[error.message]
    if (mapped) return problem(state, mapped.status, mapped.code)
  }
  throw error
}

function organizationOf(state: MockState, organizationId: number): MockOrganization | null {
  if (!Number.isInteger(organizationId) || organizationId <= 0) return null
  return state.organizations.find((item) => item.id === organizationId && item.corporationId === state.corporation.id) ?? null
}

function allows(state: MockState, userId: number, organizationId: number, action: 'read' | 'create' | 'update'): boolean {
  if (!organizationOf(state, organizationId)) return false
  return grantAllows(effectiveGrants(toSnapshot(state), userId), 'requests', action, {
    organizationId,
    projectId: null,
  })
}

function personName(user: MockUser): string {
  return [user.surname, user.name, user.patronymic].filter((part) => part.trim()).join(' ')
}

function guard(
  state: MockState,
  token: string | null,
  organizationId: number,
  action: 'read' | 'create' | 'update',
): { ok: true; user: MockUser; organization: MockOrganization } | { ok: false; result: FlowResult } {
  const who = principal(state, token)
  if (!who.ok) return { ok: false, result: who.result }
  const organization = organizationOf(state, organizationId)
  if (!organization) return { ok: false, result: problem(state, 404, 'not_found') }
  if (!allows(state, who.user.id, organizationId, action)) return { ok: false, result: problem(state, 403, 'forbidden') }
  return { ok: true, user: who.user, organization }
}

function samplesOf(state: MockState): Sample[] {
  return state.samples ?? []
}

function attachmentsOf(state: MockState): SampleAttachment[] {
  return state.sampleAttachments ?? []
}

function ownedSample(state: MockState, organizationId: number, sampleId: string): Sample | undefined {
  return samplesOf(state).find((item) => item.id === sampleId && item.organizationId === organizationId)
}

function activeSample(state: MockState, organizationId: number, sampleId: string): Sample | undefined {
  const sample = ownedSample(state, organizationId, sampleId)
  return sample && !sample.deletedAt ? sample : undefined
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function optionalDate(value: string | undefined): 'ok' | 'invalid' {
  const text = value?.trim() ?? ''
  if (!text) return 'ok'
  return isCalendarDate(text) ? 'ok' : 'invalid'
}

function documentView(file: SampleAttachment): SampleDocumentView {
  return {
    id: file.id,
    organizationId: file.organizationId,
    sampleIds: [...file.sampleIds],
    type: file.type,
    filename: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    documentNumber: file.documentNumber,
    documentDate: file.documentDate,
    uploadedAt: file.uploadedAt,
    uploadedBy: file.uploadedBy,
  }
}

function documentsFor(state: MockState, organizationId: number, sampleId: string): SampleDocumentView[] {
  return attachmentsOf(state)
    .filter((file) => file.organizationId === organizationId && file.sampleIds.includes(sampleId))
    .map(documentView)
}

function withSaved(
  state: MockState,
  saved: { records: Sample[]; counters: MockState['sampleCodeCounters']; attachments: SampleAttachment[] },
): MockState {
  return {
    ...state,
    samples: saved.records,
    sampleCodeCounters: saved.counters ?? {},
    sampleAttachments: saved.attachments,
  }
}

function registrationText(stage: SampleStage): string {
  return stage === 'Запланирован отбор'
    ? 'Запланирован отбор'
    : `Зарегистрировано поступление. Статус: ${stage}`
}

function parentChainCycles(records: readonly Sample[], parentId: string, childId: string, organizationId: number): boolean {
  const seen = new Set<string>([childId])
  let current: string | undefined = parentId
  while (current) {
    if (seen.has(current)) return true
    seen.add(current)
    current = records.find((item) => item.id === current && item.organizationId === organizationId)?.parentId
  }
  return false
}

function inheritedConflict(parent: Sample, input: RegisterSubsampleInput): boolean {
  const origin = inheritedSampleOrigin(parent)
  const expectedType = sampleTypeOf(parent)
  const givenType = input.sampleType?.trim() ?? ''
  if (givenType && givenType.toLocaleLowerCase('ru') !== expectedType.toLocaleLowerCase('ru')) return true
  const pairs: Array<[string, string]> = [
    [input.field?.trim() ?? '', origin.field],
    [displayWell(input.well ?? ''), displayWell(origin.well)],
    [input.formation?.trim() ?? '', origin.formation],
    [input.interval?.trim() ?? '', origin.interval],
    [input.collectedAt?.trim() ?? '', origin.collectedAt],
  ]
  return pairs.some(([given, expected]) => given !== '' && given.toLocaleLowerCase('ru') !== expected.trim().toLocaleLowerCase('ru'))
}

function stageOf(value: string | undefined): SampleStage | null {
  if (value == null || value === '') return 'Поступила'
  return isCurrentSampleStage(value) ? value : null
}

function inspectionOf(value: string | undefined): SampleInspection | null {
  if (value == null || value === '') return 'Не проведён'
  return isSampleInspection(value) ? value : null
}

function blankSample(
  organizationId: number,
  at: string,
  actor: string,
  stage: SampleStage,
  inspection: SampleInspection,
  fields: Pick<Sample, 'field' | 'well' | 'formation' | 'interval' | 'collectedAt' | 'receivedAt' | 'location' | 'material' | 'container' | 'quantity' | 'supplier' | 'document' | 'conditions'> & {
    sampleType?: Sample['sampleType']
    externalCode?: string
    parentId?: string
    subsampleInterval?: string
  },
): Sample {
  const sampleType = fields.sampleType
  return {
    id: crypto.randomUUID(),
    organizationId,
    code: '',
    ...(fields.externalCode?.trim() ? { externalCode: fields.externalCode.trim() } : {}),
    ...(fields.parentId ? { parentId: fields.parentId } : {}),
    kind: sampleType ? kindForSampleType(sampleType) : 'Флюид',
    material: fields.material,
    ...(sampleType ? { sampleType } : {}),
    field: fields.field,
    well: fields.well,
    formation: fields.formation,
    interval: fields.interval,
    ...(fields.subsampleInterval?.trim() ? { subsampleInterval: fields.subsampleInterval.trim() } : {}),
    collectedAt: fields.collectedAt,
    receivedAt: fields.receivedAt,
    container: fields.container,
    quantity: fields.quantity,
    supplier: fields.supplier,
    document: fields.document,
    conditions: fields.conditions,
    location: fields.location,
    inspection,
    inspectionNote: '',
    stage,
    events: [{ at, actor, text: registrationText(stage) }],
  }
}

function saveItems(state: MockState, organizationId: number, actor: string, at: string, items: Sample[]): FlowResult {
  try {
    const saved = registerSamplesWithDocuments(
      { samples: samplesOf(state), attachments: attachmentsOf(state) },
      state.sampleCodeCounters ?? {},
      { organizationId, actor, at },
      items,
    )
    const created = new Set(items.map((item) => item.id))
    const next = withSaved(state, saved)
    return done(next, 201, { samples: saved.records.filter((item) => created.has(item.id)) })
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function listSamples(
  state: MockState,
  token: string | null,
  organizationId: number,
  options?: { includeDeleted?: boolean },
): FlowResult {
  const access = guard(state, token, organizationId, 'read')
  if (!access.ok) return access.result
  return done(state, 200, {
    samples: samplesOf(state).filter((item) => item.organizationId === organizationId && (options?.includeDeleted || !item.deletedAt)),
    organizationKind: access.organization.kind satisfies SampleOrganizationKind,
  })
}

export function readSample(state: MockState, token: string | null, organizationId: number, sampleId: string): FlowResult {
  const access = guard(state, token, organizationId, 'read')
  if (!access.ok) return access.result
  const sample = ownedSample(state, organizationId, sampleId)
  if (!sample) return problem(state, 404, 'not_found')
  return done(state, 200, { sample })
}

export function readSampleHistory(state: MockState, token: string | null, organizationId: number, sampleId: string): FlowResult {
  const opened = readSample(state, token, organizationId, sampleId)
  if (opened.status !== 200) return opened
  const sample = (opened.body as { sample: Sample }).sample
  return done(state, 200, { events: sample.events })
}

export function registerSample(state: MockState, token: string | null, input: RegisterSampleInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'create')
  if (!access.ok) return access.result
  const stage = stageOf(input.stage)
  const inspection = inspectionOf(input.inspection)
  if (!stage) return problem(state, 400, 'invalid_stage')
  if (!inspection) return problem(state, 400, 'invalid_inspection')
  if (optionalDate(input.collectedAt) === 'invalid' || optionalDate(input.receivedAt) === 'invalid') {
    return problem(state, 400, 'invalid_date')
  }
  const manual = {
    sampleType: input.sampleType,
    field: input.field,
    well: input.well,
    stage,
    receivedAt: input.receivedAt ?? '',
    location: input.location ?? '',
    inspection,
    inspectionNote: input.inspectionNote,
  }
  const issues = inspectManualSample({ ...manual, sampleType: input.sampleType.trim(), field: input.field.trim(), well: input.well.trim() })
  if (issues.length) return problem(state, 400, ISSUE_CODES[issues[0].code] ?? 'invalid_sample', { field: issues[0].field })
  const sampleType = input.sampleType.trim()
  if (!isSampleType(sampleType)) return problem(state, 400, 'invalid_type')
  const at = new Date().toISOString()
  const actor = personName(access.user)
  const planned = stage === 'Запланирован отбор'
  const item = blankSample(input.organizationId, at, actor, stage, inspection, {
    sampleType,
    field: input.field.trim(),
    well: input.well.trim(),
    formation: input.formation?.trim() ?? '',
    interval: input.interval?.trim() ?? '',
    collectedAt: input.collectedAt?.trim() ?? '',
    receivedAt: planned ? '' : (input.receivedAt?.trim() ?? ''),
    location: input.location?.trim() ?? '',
    material: input.material?.trim() ?? '',
    container: input.container?.trim() ?? '',
    quantity: input.quantity?.trim() ?? '',
    supplier: input.supplier?.trim() ?? '',
    document: input.document?.trim() ?? '',
    conditions: input.conditions?.trim() ?? '',
    externalCode: input.externalCode,
  })
  item.inspectionNote = input.inspectionNote?.trim() ?? ''
  const saved = saveItems(state, input.organizationId, actor, at, [item])
  if (saved.status !== 201) return saved
  const sample = (saved.body as { samples: Sample[] }).samples[0]
  return done(saved.state, 201, { sample })
}

export function registerSubsample(state: MockState, token: string | null, input: RegisterSubsampleInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'create')
  if (!access.ok) return access.result
  if (!input.parentId.trim()) return problem(state, 400, 'invalid_parent')
  const stage = stageOf(input.stage)
  const inspection = inspectionOf(input.inspection)
  if (!stage) return problem(state, 400, 'invalid_stage')
  if (!inspection) return problem(state, 400, 'invalid_inspection')
  if (optionalDate(input.collectedAt) === 'invalid' || optionalDate(input.receivedAt) === 'invalid') {
    return problem(state, 400, 'invalid_date')
  }
  const records = samplesOf(state)
  const parent = findAvailableParent(records, input.parentId, input.organizationId)
  if (!parent) return problem(state, 400, 'invalid_parent')
  const childId = crypto.randomUUID()
  if (parentChainCycles(records, parent.id, childId, input.organizationId)) return problem(state, 400, 'invalid_parent')
  if (inheritedConflict(parent, input)) return problem(state, 400, 'inherited_mismatch')
  const issues = inspectManualSample({
    sampleType: '',
    field: '',
    well: '',
    parentId: parent.id,
    stage,
    receivedAt: input.receivedAt ?? '',
    location: input.location ?? '',
    inspection,
    inspectionNote: input.inspectionNote,
    subsampleInterval: input.subsampleInterval,
  })
  if (issues.length) return problem(state, 400, ISSUE_CODES[issues[0].code] ?? 'invalid_sample', { field: issues[0].field })
  const at = new Date().toISOString()
  const actor = personName(access.user)
  const planned = stage === 'Запланирован отбор'
  const item = blankSample(input.organizationId, at, actor, stage, inspection, {
    parentId: parent.id,
    field: '',
    well: '',
    formation: '',
    interval: '',
    collectedAt: '',
    receivedAt: planned ? '' : (input.receivedAt?.trim() ?? ''),
    location: input.location?.trim() ?? '',
    material: input.material?.trim() ?? '',
    container: input.container?.trim() ?? '',
    quantity: input.quantity?.trim() ?? '',
    supplier: input.supplier?.trim() ?? '',
    document: input.document?.trim() ?? '',
    conditions: input.conditions?.trim() ?? '',
    externalCode: input.externalCode,
    subsampleInterval: input.subsampleInterval,
  })
  item.id = childId
  item.inspectionNote = input.inspectionNote?.trim() ?? ''
  const saved = saveItems(state, input.organizationId, actor, at, [item])
  if (saved.status !== 201) return saved
  const sample = (saved.body as { samples: Sample[] }).samples[0]
  return done(saved.state, 201, { sample })
}

function batchProblem(state: MockState, parsed: SampleBatchResult): FlowResult | null {
  if (parsed.error) return problem(state, 400, 'invalid_batch', { detail: parsed.error })
  if (parsed.rows.some((row) => row.errors.length > 0)) {
    return problem(state, 400, 'invalid_batch', {
      rows: parsed.rows.map((row) => ({ line: row.line, errors: [...row.errors] })),
    })
  }
  return null
}

export function registerSampleBatch(state: MockState, token: string | null, input: RegisterSampleBatchInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'create')
  if (!access.ok) return access.result
  if (typeof input.csv !== 'string') return problem(state, 400, 'invalid_body')
  if (inspectBatchFileSize(new TextEncoder().encode(input.csv).byteLength) !== 'ok') return problem(state, 400, 'file_size')
  const samples = samplesOf(state)
  const first = parseSampleBatch(input.csv, samples, input.organizationId)
  const firstProblem = batchProblem(state, first)
  if (firstProblem) return firstProblem
  const again = parseSampleBatch(input.csv, samples, input.organizationId)
  const againProblem = batchProblem(state, again)
  if (againProblem) return againProblem
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const items = batchSamples(again.rows, input.organizationId, at, actor, samples)
    return saveItems(state, input.organizationId, actor, at, items)
  } catch (error) {
    return domainProblem(state, error)
  }
}

function applyControl(
  state: MockState,
  token: string | null,
  organizationId: number,
  sampleId: string,
  run: (sample: Sample, at: string, actor: string) => Sample[],
): FlowResult {
  const access = guard(state, token, organizationId, 'update')
  if (!access.ok) return access.result
  const current = activeSample(state, organizationId, sampleId)
  if (!current) return problem(state, 404, 'not_found')
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const samples = run(current, at, actor)
    const sample = samples.find((item) => item.id === sampleId && item.organizationId === organizationId)
    if (!sample) return problem(state, 404, 'not_found')
    return done({ ...state, samples }, 200, { sample })
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function changeSampleStatus(state: MockState, token: string | null, input: ChangeSampleStatusInput): FlowResult {
  return applyControl(state, token, input.organizationId, input.sampleId, (sample, at, actor) => {
    if (!isCurrentSampleStage(input.stage)) throw new Error('stage')
    if (optionalDate(input.receivedAt) === 'invalid') throw new Error('invalid-date')
    return changeControl(
      samplesOf(state),
      sample.id,
      input.organizationId,
      sample.inspection,
      sample.inspectionNote,
      input.location ?? sample.location,
      at,
      { stage: input.stage, actor, receivedAt: input.receivedAt ?? sample.receivedAt },
    )
  })
}

export function changeSampleInspection(state: MockState, token: string | null, input: ChangeSampleInspectionInput): FlowResult {
  return applyControl(state, token, input.organizationId, input.sampleId, (sample, at, actor) => {
    if (!isSampleInspection(input.inspection)) throw new Error('invalid-inspection')
    if (typeof input.inspectionNote !== 'string') throw new Error('invalid-body')
    return changeControl(
      samplesOf(state),
      sample.id,
      input.organizationId,
      input.inspection,
      input.inspectionNote,
      sample.location,
      at,
      { actor, receivedAt: sample.receivedAt },
    )
  })
}

export function changeSamplePlace(state: MockState, token: string | null, input: ChangeSamplePlaceInput): FlowResult {
  return applyControl(state, token, input.organizationId, input.sampleId, (sample, at, actor) => {
    if (typeof input.location !== 'string' || typeof input.receivedAt !== 'string') throw new Error('invalid-body')
    if (optionalDate(input.receivedAt) === 'invalid') throw new Error('invalid-date')
    return changeControl(
      samplesOf(state),
      sample.id,
      input.organizationId,
      sample.inspection,
      sample.inspectionNote,
      input.location,
      at,
      { actor, receivedAt: input.receivedAt },
    )
  })
}

export function deleteSampleRecord(state: MockState, token: string | null, organizationId: number, sampleId: string): FlowResult {
  const access = guard(state, token, organizationId, 'update')
  if (!access.ok) return access.result
  if (!activeSample(state, organizationId, sampleId)) return problem(state, 404, 'not_found')
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const samples = deleteSample(samplesOf(state), sampleId, organizationId, at, actor)
    const sample = samples.find((item) => item.id === sampleId)
    return done({ ...state, samples }, 200, { sample })
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function listSampleDocuments(state: MockState, token: string | null, organizationId: number, sampleId: string): FlowResult {
  const opened = readSample(state, token, organizationId, sampleId)
  if (opened.status !== 200) return opened
  return done(state, 200, { documents: documentsFor(state, organizationId, sampleId) })
}

function isAttachmentType(value: string): value is AttachmentType {
  return (ATTACHMENT_TYPES as readonly string[]).includes(value)
}

export function addSampleDocuments(state: MockState, token: string | null, input: AddSampleDocumentsInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'update')
  if (!access.ok) return access.result
  if (!isAttachmentType(input.type)) return problem(state, 400, 'invalid_type')
  if (input.documentDate && optionalDate(input.documentDate) === 'invalid') return problem(state, 400, 'invalid_date')
  const ids = [...new Set(input.sampleIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return problem(state, 400, 'invalid_sample')
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const saved = addSampleAttachments(
      { samples: samplesOf(state), attachments: attachmentsOf(state) },
      { organizationId: input.organizationId, actor, at },
      ids,
      input.type,
      input.documentNumber ?? '',
      input.documentDate ?? '',
      input.files,
    )
    const known = new Set(attachmentsOf(state).map((file) => file.id))
    const added = saved.attachments.filter((file) => !known.has(file.id))
    return done(
      { ...state, samples: saved.samples, sampleAttachments: saved.attachments },
      201,
      { documents: added.map(documentView) },
    )
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function linkSampleDocument(state: MockState, token: string | null, input: SampleDocumentLinkInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'update')
  if (!access.ok) return access.result
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const saved = linkSampleAttachment(
      { samples: samplesOf(state), attachments: attachmentsOf(state) },
      { organizationId: input.organizationId, actor, at },
      input.sampleId,
      input.fileId,
    )
    return done(
      { ...state, samples: saved.samples, sampleAttachments: saved.attachments },
      200,
      { documents: documentsFor({ ...state, sampleAttachments: saved.attachments }, input.organizationId, input.sampleId) },
    )
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function unlinkSampleDocument(state: MockState, token: string | null, input: SampleDocumentLinkInput): FlowResult {
  const access = guard(state, token, input.organizationId, 'update')
  if (!access.ok) return access.result
  const at = new Date().toISOString()
  const actor = personName(access.user)
  try {
    const saved = unlinkSampleAttachment(
      { samples: samplesOf(state), attachments: attachmentsOf(state) },
      { organizationId: input.organizationId, actor, at },
      input.sampleId,
      input.fileId,
    )
    return done(
      { ...state, samples: saved.samples, sampleAttachments: saved.attachments },
      200,
      { documents: documentsFor({ ...state, sampleAttachments: saved.attachments }, input.organizationId, input.sampleId) },
    )
  } catch (error) {
    return domainProblem(state, error)
  }
}

export function readSampleDocumentContent(
  state: MockState,
  token: string | null,
  organizationId: number,
  sampleId: string,
  fileId: string,
): FlowResult & { bytes?: Uint8Array; mimeType?: string } {
  const opened = readSample(state, token, organizationId, sampleId)
  if (opened.status !== 200) return opened
  const file = attachmentsOf(state).find((item) =>
    item.id === fileId && item.organizationId === organizationId && item.sampleIds.includes(sampleId))
  if (!file) return problem(state, 404, 'not_found')
  return { state, status: 200, body: null, bytes: file.bytes, mimeType: file.mimeType }
}
