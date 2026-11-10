import type { RequestDraftDetails, RequestProgramLine } from './draft'
import type { RequestResearchNeed } from './needs'
import { emptyProgramMeta } from './normalize'
import type { RequestField, RequestInterval, RequestWell } from './study'

/**
 * A new draft keeps the research content and receives new ids.
 * Need targets point at the copied wells and intervals, not at the source request.
 * Programme approval is a later decision and is not copied.
 */
export function copyRequestDetails(
  details: RequestDraftDetails,
  nextId: (prefix: string) => string,
): RequestDraftDetails {
  const wellIds = new Map<string, string>()
  const intervalIds = new Map<string, string>()
  const lineIds = new Map<string, string>()
  const fields = details.fields.map((field) => copyField(field, nextId, wellIds, intervalIds))
  const program = details.program.map((line) => copyLine(line, nextId, lineIds))
  const needs = details.needs.map((need) => copyNeed(need, nextId, wellIds, intervalIds, lineIds))
  return {
    ...details,
    subject: {
      ...details.subject,
      core: { ...details.subject.core },
      fluid: {
        ...details.subject.fluid,
        sampleCounts: details.subject.fluid.sampleCounts.map((item) => ({ ...item })),
      },
    },
    corePlan: { ...details.corePlan },
    sampleIds: [...details.sampleIds],
    fields,
    program,
    needs,
    clarifications: details.clarifications.map((item) => ({ ...item, id: nextId('note') })),
    programMeta: emptyProgramMeta(),
  }
}

function copyField(
  field: RequestField,
  nextId: (prefix: string) => string,
  wellIds: Map<string, string>,
  intervalIds: Map<string, string>,
): RequestField {
  return {
    ...field,
    id: nextId('field'),
    wells: field.wells.map((well) => copyWell(well, nextId, wellIds, intervalIds)),
  }
}

function copyWell(
  well: RequestWell,
  nextId: (prefix: string) => string,
  wellIds: Map<string, string>,
  intervalIds: Map<string, string>,
): RequestWell {
  const id = nextId('well')
  wellIds.set(well.id, id)
  return {
    ...well,
    id,
    intervals: well.intervals.map((interval) => copyInterval(interval, nextId, intervalIds)),
  }
}

function copyInterval(
  interval: RequestInterval,
  nextId: (prefix: string) => string,
  intervalIds: Map<string, string>,
): RequestInterval {
  const id = nextId('interval')
  intervalIds.set(interval.id, id)
  return { ...interval, id }
}

function copyLine(
  line: RequestProgramLine,
  nextId: (prefix: string) => string,
  lineIds: Map<string, string>,
): RequestProgramLine {
  const id = nextId('line')
  lineIds.set(line.id, id)
  return { ...line, id }
}

function copyNeed(
  need: RequestResearchNeed,
  nextId: (prefix: string) => string,
  wellIds: Map<string, string>,
  intervalIds: Map<string, string>,
  lineIds: Map<string, string>,
): RequestResearchNeed {
  return {
    ...need,
    id: nextId('need'),
    legacyLineId: need.legacyLineId ? lineIds.get(need.legacyLineId) ?? '' : '',
    targets: need.targets.map((target) => ({
      ...target,
      wellId: wellIds.get(target.wellId) ?? '',
      intervalIds: target.intervalIds.flatMap((intervalId) => {
        const next = intervalIds.get(intervalId)
        return next ? [next] : []
      }),
    })),
  }
}
