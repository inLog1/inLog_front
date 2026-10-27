import { can } from '../../../entities/access/model/grants'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockConstructorField, MockConstructorRecord, MockState } from '../db/types'

const RELATION_DETAIL = 'A selected id does not belong to this organization. The report was not built.'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function allowedToReadRecords(state: MockState, userId: number, organizationId: number): boolean {
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) return false
  const scope = {
    type: 'organization' as const,
    organizationId: organization.id,
    corporationId: organization.corporationId,
  }
  const snapshot = toSnapshot(state)
  return can(snapshot, userId, 'constructor.records', 'read', scope)
    || can(snapshot, userId, 'reports', 'generate', scope)
}

function labelOf(field: MockConstructorField): string {
  return field.nameEn || field.nameRu || `field-${field.id}`
}

function fieldDto(field: MockConstructorField) {
  return {
    group: field.nodeId,
    id: field.id,
    name_en: field.nameEn,
    name_ru: field.nameRu,
    structure_element: field.tabId ?? 0,
    type: field.type,
  }
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

/**
 * Legacy combined payload. The client transformResponse turns this into a table.
 * Values are stored by field id and copied here under the current label.
 */
export function combinedConstructorData(state: MockState, token: string | null, organizationId: number, body: unknown): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) return done(state, 404, { code: 'not_found' })
  if (!allowedToReadRecords(state, who.user.id, organizationId)) return done(state, 403, { code: 'forbidden' })
  if (!Array.isArray(body)) return done(state, 400, { code: 'invalid_report', detail: 'The report request must be a list. Nothing was built.' })

  const reports = []
  for (const item of body) {
    if (!item || typeof item !== 'object') return done(state, 400, { code: 'invalid_report', detail: RELATION_DETAIL })
    const request = item as { group?: unknown; element?: unknown; fields?: unknown }
    const group = positive(request.group)
    const element = positive(request.element)
    if ((request.group != null && request.group !== 0 && group == null) || (request.element != null && request.element !== 0 && element == null)) {
      return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
    }
    const node = group == null ? null : state.constructorNodes.find((entry) => entry.id === group && entry.organizationId === organizationId)
    const tab = element == null ? null : state.constructorTabs.find((entry) => entry.id === element && entry.organizationId === organizationId)
    if (group != null && !node) return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
    if (element != null && (!tab || (node != null && tab.nodeId !== node.id))) {
      return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
    }
    if (!node && !tab) return done(state, 400, { code: 'invalid_report', detail: RELATION_DETAIL })
    const nodeId = tab?.nodeId ?? node!.id
    const owner = state.constructorNodes.find((entry) => entry.id === nodeId && entry.organizationId === organizationId)
    if (!owner) return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
    if (!Array.isArray(request.fields) || request.fields.some((id) => positive(id) == null)) {
      return done(state, 400, { code: 'invalid_report', detail: RELATION_DETAIL })
    }
    const fieldIds = request.fields.map((id) => Number(id))
    if (tab) {
      const scope = state.constructorFields.filter((field) =>
        field.organizationId === organizationId && field.nodeId === owner.id && field.tabId === tab.id,
      )
      const selected: MockConstructorField[] = []
      for (const id of fieldIds) {
        const field = scope.find((entry) => entry.id === id)
        if (!field) return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
        selected.push(field)
      }
      const records = recordsFor(state, organizationId, owner.id, tab.id)
      reports.push(reportDto(owner, tab, organizationId, selected, records))
      continue
    }
    const nodeFields = state.constructorFields.filter((field) => field.organizationId === organizationId && field.nodeId === owner.id)
    const selected: MockConstructorField[] = []
    for (const id of fieldIds) {
      const field = nodeFields.find((entry) => entry.id === id)
      if (!field) return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
      selected.push(field)
    }
    const byScope = new Map<number | null, MockConstructorField[]>()
    for (const field of selected) {
      const list = byScope.get(field.tabId) ?? []
      list.push(field)
      byScope.set(field.tabId, list)
    }
    if (byScope.size === 0) {
      reports.push(reportDto(owner, null, organizationId, [], recordsFor(state, organizationId, owner.id, null)))
      continue
    }
    for (const [tabId, fields] of byScope) {
      const scopeTab = tabId == null ? null : state.constructorTabs.find((entry) => entry.id === tabId && entry.organizationId === organizationId) ?? null
      if (tabId != null && !scopeTab) return done(state, 400, { code: 'invalid_relation', detail: RELATION_DETAIL })
      reports.push(reportDto(owner, scopeTab, organizationId, fields, recordsFor(state, organizationId, owner.id, tabId)))
    }
  }
  return done(state, 200, reports)
}

function recordsFor(state: MockState, organizationId: number, nodeId: number, tabId: number | null): MockConstructorRecord[] {
  return state.constructorRecords.filter((record) =>
    record.organizationId === organizationId && record.nodeId === nodeId && record.tabId === tabId,
  )
}

function reportDto(
  node: { id: number; nameEn: string; nameRu: string; parentId: number | null; relatedNodeIds: number[] },
  tab: { id: number; nameEn: string; nameRu: string } | null,
  organizationId: number,
  fields: MockConstructorField[],
  records: MockConstructorRecord[],
) {
  const subject = tab ?? node
  return {
    id: subject.id,
    structure_element: tab?.id ?? node.id,
    type: tab ? 'element' as const : 'group' as const,
    data: {
      id: subject.id,
      name_en: subject.nameEn,
      name_ru: subject.nameRu,
      organization: organizationId,
      parent: node.parentId ?? 0,
      related_groups: node.relatedNodeIds,
      requested_fields: fields.map(fieldDto),
      objects: records.map((record) => ({
        id: record.id,
        data: Object.fromEntries(fields.flatMap((field) => {
          const stored = record.values.find((value) => value.fieldId === field.id)
          if (!stored) return []
          return [[labelOf(field), { type: field.type, value: stored.value }]]
        })),
      })),
    },
  }
}
