import {
  inspectResearchNeeds,
  inspectNeedLinks,
  researchNeedIsReady,
  researchNeedSendGaps,
  type RequestResearchNeed,
} from './needs'
import {
  emptyProgramMeta,
  readStoredStudy,
  withDerivedStudy,
  type RequestDraftClarification,
  type RequestProgramMeta,
} from './normalize'
import { draftProgramMetaIsBlank } from './program'
import { inspectStudyFields, studyHasNamedWell, type RequestField } from './study'
import { REQUEST_TITLE_MAX } from './types'

/** Demonstration catalogs are id lists. Empty means the field was left blank. */
export type RequestDraftCatalogIds = {
  fields: readonly string[]
  wells: readonly string[]
  pads: readonly string[]
  formations: readonly string[]
  materials: readonly string[]
  fluidKinds: readonly string[]
  wellTypes: readonly string[]
  sampleKinds: readonly string[]
  workKinds: readonly string[]
  units: readonly string[]
  curators: readonly string[]
  samples: readonly string[]
}

export type RequestObjectKind = 'core' | 'fluid'

/** The scale used by the draft form. Medium is the default for a new request. */
export const REQUEST_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

/**
 * Priorities stored before the four-level scale.
 * They stay readable. The form does not remap them, because neither equals one new value.
 */
export const REQUEST_LEGACY_PRIORITIES = ['normal', 'urgent'] as const

export type RequestPriority = (typeof REQUEST_PRIORITIES)[number] | (typeof REQUEST_LEGACY_PRIORITIES)[number]

export function isRequestPriority(value: string): value is RequestPriority {
  return (REQUEST_PRIORITIES as readonly string[]).includes(value)
    || (REQUEST_LEGACY_PRIORITIES as readonly string[]).includes(value)
}

export type RequestSampleCount = {
  fluidKindId: string
  count: string
}

export type RequestCoreDetails = {
  diameterMm: string
  recoveryPercent: string
}

export type RequestFluidDetails = {
  wellTypeId: string
  sampleKindId: string
  fluidKindId: string
  sampledOn: string
  sampleVolumeMl: string
  sampleCounts: RequestSampleCount[]
}

export type RequestSubject = {
  objectKind: '' | RequestObjectKind
  fieldId: string
  wellId: string
  padId: string
  formationId: string
  objectNumber: string
  materialId: string
  deliveryDate: string
  note: string
  core: RequestCoreDetails
  fluid: RequestFluidDetails
}

/** Planning figures for a core programme. They do not calculate the work lines. */
export type RequestCorePlan = {
  totalRecovery: string
  consolidated: string
  unconsolidated: string
  jurassic: string
  wellCount: string
  cylinderYield: string
  thinSectionsPerMeter: string
  programDue: string
}

export type RequestProgramLine = {
  id: string
  workKindId: string
  unitId: string
  quantity: string
  demand: string
  curatorId: string
  dueDate: string
  code: string
  note: string
}

/**
 * Optional draft body stored on the same request record.
 * Older records omit it. Parties stay on the record itself.
 */
export type RequestDraftDetails = {
  projectName: string
  contractNumber: string
  contractDate: string
  contractUntil: string
  subsoilUser: string
  workBasis: string
  comment: string
  priority: '' | RequestPriority
  plannedCompletion: string
  subject: RequestSubject
  corePlan: RequestCorePlan
  program: RequestProgramLine[]
  sampleIds: string[]
  /** Several fields, each with its own wells. Empty on a draft that still uses `subject` only. */
  fields: RequestField[]
  /** Needs point at wells by id. They do not replace `program` lines already stored. */
  needs: RequestResearchNeed[]
  /**
   * Author and preparing side may be echoed on a draft.
   * Lines, approval and the approved snapshot are written only by the programme actions.
   */
  programMeta: RequestProgramMeta
  /** Legacy values that were kept as-is because a well or interval link would have been a guess. */
  clarifications: RequestDraftClarification[]
}

export const REQUEST_DRAFT_TEXT_MAX = 200
export const REQUEST_DRAFT_NOTE_MAX = 1000
export const REQUEST_PROGRAM_MAX = 30
export const REQUEST_SAMPLE_MAX = 40

export const DRAFT_ISSUE_CODES = [
  'invalid_draft',
  'invalid_text',
  'invalid_date',
  'invalid_contract_range',
  'invalid_object',
  'invalid_number',
  'invalid_quantity',
  'invalid_program',
  'invalid_sample',
  'inconsistent_core',
  'invalid_bounds',
  'invalid_unit',
  'invalid_need',
  'invalid_link',
] as const

export type DraftIssueCode = (typeof DRAFT_ISSUE_CODES)[number]

export type DraftIssue = {
  field: string
  code: DraftIssueCode
}

export const SEND_GAPS = [
  'parties',
  'project_name',
  'basis_document',
  'well',
  'program',
  'quantity',
  'desired_result',
  'need_targets',
  'need_links',
] as const

export type SendGap = (typeof SEND_GAPS)[number]

const DETAIL_KEYS = [
  'projectName',
  'contractNumber',
  'contractDate',
  'contractUntil',
  'workBasis',
  'comment',
  'plannedCompletion',
  'subject',
  'program',
  'sampleIds',
] as const

const DETAIL_OPTIONAL = ['subsoilUser', 'priority', 'corePlan', 'fields', 'needs', 'programMeta', 'clarifications'] as const

const SUBJECT_KEYS = [
  'objectKind',
  'fieldId',
  'wellId',
  'padId',
  'formationId',
  'objectNumber',
  'materialId',
  'deliveryDate',
  'note',
  'core',
  'fluid',
] as const

const CORE_KEYS = ['diameterMm', 'recoveryPercent'] as const
const FLUID_KEYS = ['fluidKindId', 'sampleVolumeMl'] as const
const FLUID_OPTIONAL = ['wellTypeId', 'sampleKindId', 'sampledOn', 'sampleCounts'] as const
const LINE_KEYS = ['id', 'workKindId', 'unitId', 'quantity', 'curatorId', 'dueDate', 'note'] as const
const LINE_OPTIONAL = ['demand', 'code'] as const
const CORE_PLAN_KEYS = [
  'totalRecovery',
  'consolidated',
  'unconsolidated',
  'jurassic',
  'wellCount',
  'cylinderYield',
  'thinSectionsPerMeter',
  'programDue',
] as const

export function emptyCorePlan(): RequestCorePlan {
  return {
    totalRecovery: '',
    consolidated: '',
    unconsolidated: '',
    jurassic: '',
    wellCount: '',
    cylinderYield: '',
    thinSectionsPerMeter: '',
    programDue: '',
  }
}

export function emptyRequestDraft(): RequestDraftDetails {
  return {
    projectName: '',
    contractNumber: '',
    contractDate: '',
    contractUntil: '',
    subsoilUser: '',
    workBasis: '',
    comment: '',
    priority: '',
    plannedCompletion: '',
    subject: {
      objectKind: '',
      fieldId: '',
      wellId: '',
      padId: '',
      formationId: '',
      objectNumber: '',
      materialId: '',
      deliveryDate: '',
      note: '',
      core: { diameterMm: '', recoveryPercent: '' },
      fluid: {
        wellTypeId: '',
        sampleKindId: '',
        fluidKindId: '',
        sampledOn: '',
        sampleVolumeMl: '',
        sampleCounts: [],
      },
    },
    corePlan: emptyCorePlan(),
    program: [],
    sampleIds: [],
    fields: [],
    needs: [],
    programMeta: emptyProgramMeta(),
    clarifications: [],
  }
}

export function newProgramLine(): RequestProgramLine {
  return {
    id: `line-${crypto.randomUUID()}`,
    workKindId: '',
    unitId: '',
    quantity: '',
    demand: '',
    curatorId: '',
    dueDate: '',
    code: '',
    note: '',
  }
}

/** A record saved before the wizard has no details. Its title stays visible as the project name. */
export function draftFromRecord(record: { title?: string; details?: unknown }): RequestDraftDetails {
  const empty = emptyRequestDraft()
  const title = typeof record.title === 'string' ? record.title : ''
  const stored = asRecord(record.details)
  if (!stored) return { ...empty, projectName: title }
  const subject = asRecord(stored.subject)
  const core = asRecord(subject?.core)
  const fluid = asRecord(subject?.fluid)
  const program = Array.isArray(stored.program)
    ? stored.program.flatMap((item) => {
      const line = programLineFrom(item)
      return line ? [line] : []
    })
    : []
  const sampleIds = Array.isArray(stored.sampleIds)
    ? stored.sampleIds.filter((item): item is string => typeof item === 'string')
    : []
  const priority = typeof stored.priority === 'string' && isRequestPriority(stored.priority) ? stored.priority : ''
  const study = readStoredStudy(stored)
  return withDerivedStudy({
    projectName: typeof stored.projectName === 'string' ? stored.projectName : title,
    contractNumber: typeof stored.contractNumber === 'string' ? stored.contractNumber : '',
    contractDate: typeof stored.contractDate === 'string' ? stored.contractDate : '',
    contractUntil: typeof stored.contractUntil === 'string' ? stored.contractUntil : '',
    subsoilUser: typeof stored.subsoilUser === 'string' ? stored.subsoilUser : '',
    workBasis: typeof stored.workBasis === 'string' ? stored.workBasis : '',
    comment: typeof stored.comment === 'string' ? stored.comment : '',
    priority,
    plannedCompletion: typeof stored.plannedCompletion === 'string' ? stored.plannedCompletion : '',
    subject: {
      objectKind: subject?.objectKind === 'core' || subject?.objectKind === 'fluid' ? subject.objectKind : '',
      fieldId: typeof subject?.fieldId === 'string' ? subject.fieldId : '',
      wellId: typeof subject?.wellId === 'string' ? subject.wellId : '',
      padId: typeof subject?.padId === 'string' ? subject.padId : '',
      formationId: typeof subject?.formationId === 'string' ? subject.formationId : '',
      objectNumber: typeof subject?.objectNumber === 'string' ? subject.objectNumber : '',
      materialId: typeof subject?.materialId === 'string' ? subject.materialId : '',
      deliveryDate: typeof subject?.deliveryDate === 'string' ? subject.deliveryDate : '',
      note: typeof subject?.note === 'string' ? subject.note : '',
      core: {
        diameterMm: typeof core?.diameterMm === 'string' ? core.diameterMm : '',
        recoveryPercent: typeof core?.recoveryPercent === 'string' ? core.recoveryPercent : '',
      },
      fluid: {
        wellTypeId: typeof fluid?.wellTypeId === 'string' ? fluid.wellTypeId : '',
        sampleKindId: typeof fluid?.sampleKindId === 'string' ? fluid.sampleKindId : '',
        fluidKindId: typeof fluid?.fluidKindId === 'string' ? fluid.fluidKindId : '',
        sampledOn: typeof fluid?.sampledOn === 'string' ? fluid.sampledOn : '',
        sampleVolumeMl: typeof fluid?.sampleVolumeMl === 'string' ? fluid.sampleVolumeMl : '',
        sampleCounts: sampleCountsFrom(fluid?.sampleCounts),
      },
    },
    corePlan: corePlanFrom(stored.corePlan),
    program,
    sampleIds,
    fields: study.fields,
    needs: study.needs,
    programMeta: study.programMeta,
    clarifications: study.clarifications,
  }, study.listed)
}

export function inspectRequestDraft(
  value: unknown,
  catalog: RequestDraftCatalogIds,
): { ok: true; details: RequestDraftDetails } | { ok: false; issues: DraftIssue[] } {
  const issues: DraftIssue[] = []
  const body = asRecord(value)
  if (!body || !knownKeys(body, DETAIL_KEYS, DETAIL_OPTIONAL)) {
    return { ok: false, issues: [{ field: 'details', code: 'invalid_draft' }] }
  }
  const projectName = text(body.projectName, REQUEST_TITLE_MAX)
  const contractNumber = text(body.contractNumber, REQUEST_DRAFT_TEXT_MAX)
  const subsoilUser = optionalText(body, 'subsoilUser', REQUEST_DRAFT_TEXT_MAX)
  const workBasis = text(body.workBasis, REQUEST_DRAFT_NOTE_MAX)
  const comment = text(body.comment, REQUEST_DRAFT_NOTE_MAX)
  const priority = optionalPriority(body.priority)
  if (projectName == null) issues.push({ field: 'projectName', code: 'invalid_text' })
  if (contractNumber == null) issues.push({ field: 'contractNumber', code: 'invalid_text' })
  if (subsoilUser == null) issues.push({ field: 'subsoilUser', code: 'invalid_text' })
  if (workBasis == null) issues.push({ field: 'workBasis', code: 'invalid_text' })
  if (comment == null) issues.push({ field: 'comment', code: 'invalid_text' })
  if (priority == null) issues.push({ field: 'priority', code: 'invalid_object' })
  const contractDate = day(body.contractDate)
  const contractUntil = day(body.contractUntil)
  const plannedCompletion = day(body.plannedCompletion)
  if (contractDate == null) issues.push({ field: 'contractDate', code: 'invalid_date' })
  if (contractUntil == null) issues.push({ field: 'contractUntil', code: 'invalid_date' })
  if (plannedCompletion == null) issues.push({ field: 'plannedCompletion', code: 'invalid_date' })
  if (contractDate && contractUntil && contractUntil < contractDate) {
    issues.push({ field: 'contractUntil', code: 'invalid_contract_range' })
  }
  const subject = inspectSubject(body.subject, catalog, issues)
  const corePlan = inspectCorePlan(body.corePlan, issues)
  const program = inspectProgram(body.program, catalog, issues)
  const sampleIds = inspectSamples(body.sampleIds, catalog, issues)
  const fields = inspectFields(body.fields, catalog, issues)
  const needs = inspectNeeds(body.needs, catalog, issues)
  const programMeta = inspectProgramMeta(body.programMeta, issues)
  const clarifications = inspectClarifications(body.clarifications, issues)
  if (fields && needs) {
    for (const link of inspectNeedLinks(fields, needs)) issues.push({ field: link.field, code: 'invalid_link' })
  }
  if (
    issues.length > 0 || !subject || !corePlan || !program || !sampleIds || !fields || !needs || !programMeta || !clarifications
    || projectName == null || contractNumber == null || subsoilUser == null || workBasis == null || comment == null
    || priority == null || contractDate == null || contractUntil == null || plannedCompletion == null
  ) {
    return { ok: false, issues }
  }
  return {
    ok: true,
    details: {
      projectName,
      contractNumber,
      contractDate,
      contractUntil,
      subsoilUser,
      workBasis,
      comment,
      priority,
      plannedCompletion,
      subject,
      corePlan,
      program,
      sampleIds,
      fields,
      needs,
      programMeta,
      clarifications,
    },
  }
}

/**
 * Completeness for a future send action.
 * Draft save does not call this. The desired result date stays optional.
 */
export function inspectRequestForSend(input: {
  customerOrganizationId: number | null
  executorOrganizationId: number | null
  details: RequestDraftDetails
  hasBasisDocument?: boolean
}): { ok: true } | { ok: false; gaps: SendGap[] } {
  const gaps: SendGap[] = []
  const party = (value: number | null) => typeof value === 'number' && Number.isInteger(value) && value > 0
  if (!party(input.customerOrganizationId) || !party(input.executorOrganizationId)) gaps.push('parties')
  if (input.details.projectName.trim() === '') gaps.push('project_name')
  if (!input.hasBasisDocument) gaps.push('basis_document')
  if (!studyHasNamedWell(input.details.fields)) gaps.push('well')
  for (const need of input.details.needs) {
    for (const gap of researchNeedSendGaps(need)) {
      if (!gaps.includes(gap)) gaps.push(gap)
    }
  }
  if (inspectNeedLinks(input.details.fields, input.details.needs).length > 0) gaps.push('need_links')
  const readyNeed = input.details.needs.some((need) => researchNeedIsReady(need))
  if (!readyNeed) gaps.push('program')
  return gaps.length === 0 ? { ok: true } : { ok: false, gaps }
}

function inspectFields(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestField[] | null {
  const parsed = inspectStudyFields(value, catalog)
  if (parsed.ok) return parsed.fields
  issues.push(...parsed.issues)
  return null
}

function inspectNeeds(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestResearchNeed[] | null {
  const parsed = inspectResearchNeeds(value, catalog)
  if (parsed.ok) return parsed.needs
  issues.push(...parsed.issues)
  return null
}

const PROGRAM_META_OPTIONAL = [
  'lines',
  'note',
  'version',
  'preparedAt',
  'submittedAt',
  'approvedAt',
  'approvedByUserId',
  'returnReason',
  'approvedSnapshot',
] as const

function inspectProgramMeta(value: unknown, issues: DraftIssue[]): RequestProgramMeta | null {
  if (value === undefined) return emptyProgramMeta()
  const body = asRecord(value)
  if (!body || !knownKeys(body, ['authorUserId', 'preparedBy', 'approval'], PROGRAM_META_OPTIONAL)) {
    issues.push({ field: 'programMeta', code: 'invalid_draft' })
    return null
  }
  const authorUserId = authorId(body.authorUserId)
  if (authorUserId === undefined) issues.push({ field: 'programMeta.authorUserId', code: 'invalid_object' })
  const preparedBy = body.preparedBy === '' || body.preparedBy === 'customer' || body.preparedBy === 'laboratory' ? body.preparedBy : null
  if (preparedBy == null) issues.push({ field: 'programMeta.preparedBy', code: 'invalid_object' })
  if (body.approval !== 'unspecified' || !draftProgramMetaIsBlank(value)) {
    issues.push({ field: 'programMeta.approval', code: 'invalid_object' })
  }
  if (authorUserId === undefined || preparedBy == null || body.approval !== 'unspecified' || !draftProgramMetaIsBlank(value)) return null
  return { ...emptyProgramMeta(), authorUserId, preparedBy }
}

function inspectClarifications(value: unknown, issues: DraftIssue[]): RequestDraftClarification[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    issues.push({ field: 'clarifications', code: 'invalid_draft' })
    return null
  }
  const notes: RequestDraftClarification[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    const id = body && typeof body.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.id) ? body.id : null
    const code = body?.code === 'legacy_subject_kept' || body?.code === 'legacy_program_unlinked' ? body.code : null
    const sourceId = body && typeof body.sourceId === 'string' && body.sourceId.trim().length > 0 && body.sourceId.trim().length <= 80
      ? body.sourceId.trim()
      : null
    if (!body || !knownKeys(body, ['id', 'code', 'sourceId']) || id == null || seen.has(id ?? '') || code == null || sourceId == null) {
      issues.push({ field: 'clarifications', code: 'invalid_draft' })
      return null
    }
    seen.add(id)
    notes.push({ id, code, sourceId })
  }
  return notes
}

function inspectSubject(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestSubject | null {
  const body = asRecord(value)
  if (!body || !exactKeys(body, SUBJECT_KEYS)) {
    issues.push({ field: 'subject', code: 'invalid_draft' })
    return null
  }
  const objectKind = body.objectKind
  if (objectKind !== '' && objectKind !== 'core' && objectKind !== 'fluid') {
    issues.push({ field: 'subject.objectKind', code: 'invalid_object' })
  }
  const fieldId = choice(body.fieldId, catalog.fields)
  const wellId = choice(body.wellId, catalog.wells)
  const padId = choice(body.padId, catalog.pads)
  const formationId = choice(body.formationId, catalog.formations)
  const materialId = choice(body.materialId, catalog.materials)
  const objectNumber = text(body.objectNumber, REQUEST_DRAFT_TEXT_MAX)
  const note = text(body.note, REQUEST_DRAFT_NOTE_MAX)
  const deliveryDate = day(body.deliveryDate)
  if (fieldId == null) issues.push({ field: 'subject.fieldId', code: 'invalid_object' })
  if (wellId == null) issues.push({ field: 'subject.wellId', code: 'invalid_object' })
  if (padId == null) issues.push({ field: 'subject.padId', code: 'invalid_object' })
  if (formationId == null) issues.push({ field: 'subject.formationId', code: 'invalid_object' })
  if (materialId == null) issues.push({ field: 'subject.materialId', code: 'invalid_object' })
  if (objectNumber == null) issues.push({ field: 'subject.objectNumber', code: 'invalid_text' })
  if (note == null) issues.push({ field: 'subject.note', code: 'invalid_text' })
  if (deliveryDate == null) issues.push({ field: 'subject.deliveryDate', code: 'invalid_date' })
  const core = inspectCore(body.core, issues)
  const fluid = inspectFluid(body.fluid, catalog, issues)
  if (
    (objectKind !== '' && objectKind !== 'core' && objectKind !== 'fluid')
    || fieldId == null || wellId == null || padId == null || formationId == null || materialId == null
    || objectNumber == null || note == null || deliveryDate == null || !core || !fluid
  ) return null
  return {
    objectKind,
    fieldId,
    wellId,
    padId,
    formationId,
    objectNumber,
    materialId,
    deliveryDate,
    note,
    core,
    fluid,
  }
}

function inspectCore(value: unknown, issues: DraftIssue[]): RequestSubject['core'] | null {
  const body = asRecord(value)
  if (!body || !exactKeys(body, CORE_KEYS)) {
    issues.push({ field: 'subject.core', code: 'invalid_draft' })
    return null
  }
  const diameterMm = text(body.diameterMm, 20)
  const recoveryPercent = text(body.recoveryPercent, 20)
  if (diameterMm == null || !positive(diameterMm ?? '')) issues.push({ field: 'subject.core.diameterMm', code: 'invalid_number' })
  if (recoveryPercent == null || !percent(recoveryPercent ?? '')) issues.push({ field: 'subject.core.recoveryPercent', code: 'invalid_number' })
  if (diameterMm == null || recoveryPercent == null || !positive(diameterMm) || !percent(recoveryPercent)) return null
  return { diameterMm, recoveryPercent }
}

function inspectFluid(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestSubject['fluid'] | null {
  const body = asRecord(value)
  if (!body || !knownKeys(body, FLUID_KEYS, FLUID_OPTIONAL)) {
    issues.push({ field: 'subject.fluid', code: 'invalid_draft' })
    return null
  }
  const wellTypeId = optionalChoice(body, 'wellTypeId', catalog.wellTypes)
  const sampleKindId = optionalChoice(body, 'sampleKindId', catalog.sampleKinds)
  const fluidKindId = choice(body.fluidKindId, catalog.fluidKinds)
  const sampledOn = optionalDay(body, 'sampledOn')
  const sampleVolumeMl = text(body.sampleVolumeMl, 20)
  const sampleCounts = inspectSampleCounts(body.sampleCounts, catalog, issues)
  if (wellTypeId == null) issues.push({ field: 'subject.fluid.wellTypeId', code: 'invalid_object' })
  if (sampleKindId == null) issues.push({ field: 'subject.fluid.sampleKindId', code: 'invalid_object' })
  if (fluidKindId == null) issues.push({ field: 'subject.fluid.fluidKindId', code: 'invalid_object' })
  if (sampledOn == null) issues.push({ field: 'subject.fluid.sampledOn', code: 'invalid_date' })
  if (sampleVolumeMl == null || !nonNegative(sampleVolumeMl)) issues.push({ field: 'subject.fluid.sampleVolumeMl', code: 'invalid_number' })
  if (wellTypeId == null || sampleKindId == null || fluidKindId == null || sampledOn == null || sampleVolumeMl == null || !nonNegative(sampleVolumeMl) || !sampleCounts) return null
  return { wellTypeId, sampleKindId, fluidKindId, sampledOn, sampleVolumeMl, sampleCounts }
}

function inspectSampleCounts(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestSampleCount[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    issues.push({ field: 'subject.fluid.sampleCounts', code: 'invalid_draft' })
    return null
  }
  const counts: RequestSampleCount[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const body = asRecord(item)
    const fluidKindId = body ? choice(body.fluidKindId, catalog.fluidKinds) : null
    const count = body ? text(body.count, 20) : null
    if (!body || !knownKeys(body, ['fluidKindId', 'count']) || fluidKindId == null || fluidKindId === '' || seen.has(fluidKindId) || count == null || !nonNegative(count)) {
      issues.push({ field: 'subject.fluid.sampleCounts', code: 'invalid_number' })
      return null
    }
    seen.add(fluidKindId)
    counts.push({ fluidKindId, count })
  }
  return counts
}

function inspectCorePlan(value: unknown, issues: DraftIssue[]): RequestCorePlan | null {
  if (value === undefined) return emptyCorePlan()
  const body = asRecord(value)
  if (!body || !knownKeys(body, [], CORE_PLAN_KEYS)) {
    issues.push({ field: 'corePlan', code: 'invalid_draft' })
    return null
  }
  const totalRecovery = optionalText(body, 'totalRecovery', 20)
  const consolidated = optionalText(body, 'consolidated', 20)
  const unconsolidated = optionalText(body, 'unconsolidated', 20)
  const jurassic = optionalText(body, 'jurassic', 20)
  const wellCount = optionalText(body, 'wellCount', 20)
  const cylinderYield = optionalText(body, 'cylinderYield', 20)
  const thinSectionsPerMeter = optionalText(body, 'thinSectionsPerMeter', 20)
  const programDue = optionalDay(body, 'programDue')
  const meters = [
    ['corePlan.totalRecovery', totalRecovery],
    ['corePlan.consolidated', consolidated],
    ['corePlan.unconsolidated', unconsolidated],
    ['corePlan.jurassic', jurassic],
    ['corePlan.cylinderYield', cylinderYield],
    ['corePlan.thinSectionsPerMeter', thinSectionsPerMeter],
  ] as const
  for (const [field, amount] of meters) {
    if (amount == null || !nonNegative(amount)) issues.push({ field, code: 'invalid_number' })
  }
  if (wellCount == null || !nonNegativeInt(wellCount)) issues.push({ field: 'corePlan.wellCount', code: 'invalid_number' })
  if (programDue == null) issues.push({ field: 'corePlan.programDue', code: 'invalid_date' })
  if (
    totalRecovery == null || consolidated == null || unconsolidated == null || jurassic == null
    || wellCount == null || cylinderYield == null || thinSectionsPerMeter == null || programDue == null
    || !nonNegative(totalRecovery) || !nonNegative(consolidated) || !nonNegative(unconsolidated) || !nonNegative(jurassic)
    || !nonNegativeInt(wellCount) || !nonNegative(cylinderYield) || !nonNegative(thinSectionsPerMeter)
  ) return null
  const total = amount(totalRecovery)
  const firm = amount(consolidated)
  const loose = amount(unconsolidated)
  const jurassicAmount = amount(jurassic)
  if (total != null && firm != null && loose != null && firm + loose > total + 0.001) {
    issues.push({ field: 'corePlan.unconsolidated', code: 'inconsistent_core' })
  }
  if (firm != null && jurassicAmount != null && jurassicAmount > firm + 0.001) {
    issues.push({ field: 'corePlan.jurassic', code: 'inconsistent_core' })
  }
  if (issues.some((item) => item.field.startsWith('corePlan'))) return null
  return {
    totalRecovery,
    consolidated,
    unconsolidated,
    jurassic,
    wellCount,
    cylinderYield,
    thinSectionsPerMeter,
    programDue,
  }
}

function inspectProgram(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): RequestProgramLine[] | null {
  if (!Array.isArray(value)) {
    issues.push({ field: 'program', code: 'invalid_draft' })
    return null
  }
  if (value.length > REQUEST_PROGRAM_MAX) {
    issues.push({ field: 'program', code: 'invalid_program' })
    return null
  }
  const lines: RequestProgramLine[] = []
  const seen = new Set<string>()
  let valid = true
  value.forEach((item, index) => {
    const body = asRecord(item)
    const field = `program.${index}`
    if (!body || !knownKeys(body, LINE_KEYS, LINE_OPTIONAL)) {
      issues.push({ field, code: 'invalid_program' })
      valid = false
      return
    }
    const id = typeof body.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(body.id) ? body.id : null
    const duplicate = id != null && seen.has(id)
    const workKindId = choice(body.workKindId, catalog.workKinds)
    const unitId = choice(body.unitId, catalog.units)
    const curatorId = choice(body.curatorId, catalog.curators)
    const quantity = text(body.quantity, 20)
    const demand = optionalText(body, 'demand', 20)
    const dueDate = day(body.dueDate)
    const code = optionalText(body, 'code', REQUEST_DRAFT_TEXT_MAX)
    const note = text(body.note, REQUEST_DRAFT_NOTE_MAX)
    if (id == null || duplicate) issues.push({ field: `${field}.id`, code: 'invalid_program' })
    if (id && !duplicate) seen.add(id)
    if (workKindId == null) issues.push({ field: `${field}.workKindId`, code: 'invalid_program' })
    if (unitId == null) issues.push({ field: `${field}.unitId`, code: 'invalid_program' })
    if (curatorId == null) issues.push({ field: `${field}.curatorId`, code: 'invalid_program' })
    if (quantity == null || !positive(quantity)) issues.push({ field: `${field}.quantity`, code: 'invalid_quantity' })
    if (demand == null || !nonNegative(demand)) issues.push({ field: `${field}.demand`, code: 'invalid_number' })
    if (dueDate == null) issues.push({ field: `${field}.dueDate`, code: 'invalid_date' })
    if (code == null) issues.push({ field: `${field}.code`, code: 'invalid_text' })
    if (note == null) issues.push({ field: `${field}.note`, code: 'invalid_text' })
    if (id == null || duplicate || workKindId == null || unitId == null || curatorId == null || quantity == null || !positive(quantity) || demand == null || !nonNegative(demand) || dueDate == null || code == null || note == null) {
      valid = false
      return
    }
    lines.push({ id, workKindId, unitId, quantity, demand, curatorId, dueDate, code, note })
  })
  return valid ? lines : null
}

function inspectSamples(value: unknown, catalog: RequestDraftCatalogIds, issues: DraftIssue[]): string[] | null {
  if (!Array.isArray(value)) {
    issues.push({ field: 'sampleIds', code: 'invalid_draft' })
    return null
  }
  if (value.length > REQUEST_SAMPLE_MAX) {
    issues.push({ field: 'sampleIds', code: 'invalid_sample' })
    return null
  }
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !catalog.samples.includes(item) || seen.has(item)) {
      issues.push({ field: 'sampleIds', code: 'invalid_sample' })
      return null
    }
    seen.add(item)
    ids.push(item)
  }
  return ids
}

function programLineFrom(value: unknown): RequestProgramLine | null {
  const body = asRecord(value)
  if (!body) return null
  if (typeof body.id !== 'string') return null
  return {
    id: body.id,
    workKindId: typeof body.workKindId === 'string' ? body.workKindId : '',
    unitId: typeof body.unitId === 'string' ? body.unitId : '',
    quantity: typeof body.quantity === 'string' ? body.quantity : '',
    demand: typeof body.demand === 'string' ? body.demand : '',
    curatorId: typeof body.curatorId === 'string' ? body.curatorId : '',
    dueDate: typeof body.dueDate === 'string' ? body.dueDate : '',
    code: typeof body.code === 'string' ? body.code : (typeof body.note === 'string' ? body.note : ''),
    note: typeof body.note === 'string' ? body.note : '',
  }
}

function sampleCountsFrom(value: unknown): RequestSampleCount[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const body = asRecord(item)
    if (!body || typeof body.fluidKindId !== 'string') return []
    return [{ fluidKindId: body.fluidKindId, count: typeof body.count === 'string' ? body.count : '' }]
  })
}

function corePlanFrom(value: unknown): RequestCorePlan {
  const empty = emptyCorePlan()
  const body = asRecord(value)
  if (!body) return empty
  return {
    totalRecovery: typeof body.totalRecovery === 'string' ? body.totalRecovery : '',
    consolidated: typeof body.consolidated === 'string' ? body.consolidated : '',
    unconsolidated: typeof body.unconsolidated === 'string' ? body.unconsolidated : '',
    jurassic: typeof body.jurassic === 'string' ? body.jurassic : '',
    wellCount: typeof body.wellCount === 'string' ? body.wellCount : '',
    cylinderYield: typeof body.cylinderYield === 'string' ? body.cylinderYield : '',
    thinSectionsPerMeter: typeof body.thinSectionsPerMeter === 'string' ? body.thinSectionsPerMeter : '',
    programDue: typeof body.programDue === 'string' ? body.programDue : '',
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function exactKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return knownKeys(body, keys)
}

function knownKeys(body: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set<string>([...required, ...optional])
  const present = Object.keys(body)
  if (!present.every((key) => allowed.has(key))) return false
  return required.every((key) => Object.prototype.hasOwnProperty.call(body, key))
}

function optionalText(body: Record<string, unknown>, key: string, max: number): string | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return ''
  return text(body[key], max)
}

function optionalDay(body: Record<string, unknown>, key: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return ''
  return day(body[key])
}

function optionalChoice(body: Record<string, unknown>, key: string, allowed: readonly string[]): string | null {
  if (!Object.prototype.hasOwnProperty.call(body, key)) return ''
  return choice(body[key], allowed)
}

function authorId(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  return undefined
}

function optionalPriority(value: unknown): '' | RequestPriority | null {
  if (value === undefined || value === '') return ''
  return typeof value === 'string' && isRequestPriority(value) ? value : null
}

function amount(value: string): number | null {
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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

function day(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [year, month, date] = trimmed.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, date))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null
  return trimmed
}

function positive(value: string): boolean {
  if (value === '') return true
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return false
  return Number(value) > 0
}

function nonNegative(value: string): boolean {
  if (value === '') return true
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return false
  return Number(value) >= 0
}

function nonNegativeInt(value: string): boolean {
  if (value === '') return true
  return /^(?:0|[1-9]\d*)$/.test(value)
}

function percent(value: string): boolean {
  if (value === '') return true
  if (!/^(?:100(?:\.0{1,2})?|[1-9]?\d(?:\.\d{1,2})?)$/.test(value)) return false
  const number = Number(value)
  return number >= 0 && number <= 100
}
