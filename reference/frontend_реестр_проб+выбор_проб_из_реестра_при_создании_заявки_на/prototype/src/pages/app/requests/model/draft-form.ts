import {
  findWellById,
  inspectDepthInterval,
  type RequestDraftDetails,
  type RequestField,
  type RequestInterval,
  type RequestResearchNeed,
  type RequestWell,
} from '../../../../entities/request'

export type WellPlacement = {
  fieldId: string
  catalogFieldId: string
  fieldName: string
  wellId: string
  catalogWellId: string
  wellName: string
}

export function studyEntityId(prefix: 'field' | 'well' | 'interval' | 'need'): string {
  return `${prefix}-${crypto.randomUUID()}`
}

/** Adds a well to the matching deposit, or opens a new deposit group. */
export function appendStudyWell(
  details: RequestDraftDetails,
  placement: WellPlacement,
): { ok: true; details: RequestDraftDetails } | { ok: false; reason: 'duplicate' | 'unnamed' } {
  const fieldName = placement.fieldName.trim()
  const wellName = placement.wellName.trim()
  const catalogFieldId = placement.catalogFieldId.trim()
  const catalogWellId = placement.catalogWellId.trim()
  if ((catalogFieldId === '' && fieldName === '') || (catalogWellId === '' && wellName === '')) {
    return { ok: false, reason: 'unnamed' }
  }
  const well: RequestWell = {
    id: placement.wellId,
    catalogWellId,
    wellName,
    intervals: [],
  }
  const index = details.fields.findIndex((field) => sameField(field, catalogFieldId, fieldName))
  if (index >= 0) {
    const current = details.fields[index]
    if (!current) return { ok: false, reason: 'unnamed' }
    if (current.wells.some((item) => sameWell(item, catalogWellId, wellName))) {
      return { ok: false, reason: 'duplicate' }
    }
    const nextField: RequestField = {
      ...current,
      fieldName: current.fieldName.trim() === '' ? fieldName : current.fieldName,
      wells: [...current.wells, well],
    }
    return {
      ok: true,
      details: {
        ...details,
        fields: details.fields.map((field, fieldIndex) => fieldIndex === index ? nextField : field),
      },
    }
  }
  return {
    ok: true,
    details: {
      ...details,
      fields: [...details.fields, { id: placement.fieldId, catalogFieldId, fieldName, wells: [well] }],
    },
  }
}

export function upsertWellInterval(
  details: RequestDraftDetails,
  wellId: string,
  interval: RequestInterval,
): RequestDraftDetails | null {
  const found = findWellById(details.fields, wellId)
  if (!found) return null
  return {
    ...details,
    fields: details.fields.map((field) => field.id !== found.field.id ? field : {
      ...field,
      wells: field.wells.map((well) => well.id !== wellId ? well : {
        ...well,
        intervals: well.intervals.some((item) => item.id === interval.id)
          ? well.intervals.map((item) => item.id === interval.id ? interval : item)
          : [...well.intervals, interval],
      }),
    }),
  }
}

export function setNeedWholeWell(need: RequestResearchNeed, wellId: string, selected: boolean): RequestResearchNeed {
  if (!selected) return { ...need, targets: need.targets.filter((target) => target.wellId !== wellId) }
  const next = { wellId, selection: 'well' as const, intervalIds: [] }
  if (!need.targets.some((target) => target.wellId === wellId)) {
    return { ...need, targets: [...need.targets, next] }
  }
  return { ...need, targets: need.targets.map((target) => target.wellId === wellId ? next : target) }
}

/**
 * Checking an interval replaces a whole-well target.
 * The last cleared interval drops the target and does not become "the whole well".
 */
export function setNeedInterval(
  need: RequestResearchNeed,
  wellId: string,
  intervalId: string,
  selected: boolean,
): RequestResearchNeed {
  const current = need.targets.find((target) => target.wellId === wellId)
  const ids = new Set(current?.selection === 'intervals' ? current.intervalIds : [])
  if (selected) ids.add(intervalId)
  else ids.delete(intervalId)
  if (ids.size === 0) return { ...need, targets: need.targets.filter((target) => target.wellId !== wellId) }
  const next = { wellId, selection: 'intervals' as const, intervalIds: [...ids] }
  if (!current) return { ...need, targets: [...need.targets, next] }
  return { ...need, targets: need.targets.map((target) => target.wellId === wellId ? next : target) }
}

export function intervalDraftIssue(
  from: string,
  to: string,
  unit: string,
): 'invalid_number' | 'invalid_bounds' | 'invalid_unit' | null {
  if (from.trim() === '' || to.trim() === '') return 'invalid_number'
  const checked = inspectDepthInterval({
    from: Number(from.trim().replace(',', '.')),
    to: Number(to.trim().replace(',', '.')),
    unit,
  })
  return checked.ok ? null : checked.code
}

export function quantityDraftValue(raw: string): { ok: true; quantity: number | null } | { ok: false } {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { ok: true, quantity: null }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmed)) return { ok: false }
  const quantity = Number(trimmed)
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false }
  return { ok: true, quantity }
}

export function countStudyWells(fields: readonly RequestField[]): number {
  return fields.reduce((sum, field) => sum + field.wells.length, 0)
}

function sameField(field: RequestField, catalogFieldId: string, fieldName: string): boolean {
  if (catalogFieldId !== '') return field.catalogFieldId === catalogFieldId
  return field.catalogFieldId === '' && field.fieldName.trim() === fieldName
}

function sameWell(well: RequestWell, catalogWellId: string, wellName: string): boolean {
  if (catalogWellId !== '') return well.catalogWellId === catalogWellId
  return well.catalogWellId === '' && well.wellName.trim() === wellName
}
