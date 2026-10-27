import { can } from '../../../entities/access/model/grants'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type {
  ConstructorFieldType,
  MockConstructorField,
  MockConstructorNode,
  MockConstructorRecord,
  MockConstructorTab,
  MockState,
} from '../db/types'

const FIELD_TYPES: readonly ConstructorFieldType[] = ['string', 'integer', 'date', 'file', 'dropdown']

const DEPENDENT_DETAIL = 'Linked nodes, tabs, fields, or records still exist. Remove them first. Nothing was deleted.'
const TYPE_DETAIL = 'This field already has saved values. The type was not changed, and the values were kept.'
const CHOICE_DETAIL = 'A saved value still uses a dropdown choice that would disappear. The choices were not changed.'
const RELATION_DETAIL = 'A related id does not belong to this organization. Nothing was saved.'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string, detail?: string): FlowResult {
  return done(state, status, detail ? { code, detail } : { code })
}

function gate(
  state: MockState,
  token: string | null,
  organizationId: number,
  resource: 'constructor.schema' | 'constructor.records',
  action: 'read' | 'create' | 'update' | 'delete',
) {
  const who = principal(state, token)
  if (!who.ok) return who
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization || organization.corporationId !== state.corporation.id) {
    return { ok: false as const, result: done(state, 404, { code: 'not_found' }) }
  }
  const allowed = can(toSnapshot(state), who.user.id, resource, action, {
    type: 'organization',
    organizationId: organization.id,
    corporationId: organization.corporationId,
  })
  if (!allowed) return { ok: false as const, result: done(state, 403, { code: 'forbidden' }) }
  return { ok: true as const, user: who.user }
}

function nextId(ids: number[]): number {
  return ids.reduce((max, id) => Math.max(max, id), 0) + 1
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function namesOf(body: Record<string, unknown>, state: MockState): { nameEn: string; nameRu: string } | FlowResult {
  const nameEn = text(body.name_en)
  const nameRu = text(body.name_ru)
  if (nameEn == null || nameRu == null || (nameEn === '' && nameRu === '')) {
    return problem(state, 400, 'invalid_name', 'A node, tab, or field needs a name. Nothing was saved.')
  }
  return { nameEn, nameRu }
}

function organizationMismatch(body: Record<string, unknown>, organizationId: number, state: MockState): FlowResult | null {
  for (const key of ['organization', 'organizationId'] as const) {
    if (!(key in body) || body[key] == null || body[key] === '' || body[key] === 0) continue
    if (body[key] !== organizationId) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  return null
}

function nodeIn(state: MockState, organizationId: number, id: number): MockConstructorNode | null {
  return state.constructorNodes.find((node) => node.id === id && node.organizationId === organizationId) ?? null
}

function tabIn(state: MockState, organizationId: number, id: number): MockConstructorTab | null {
  return state.constructorTabs.find((tab) => tab.id === id && tab.organizationId === organizationId) ?? null
}

function fieldIn(state: MockState, organizationId: number, id: number): MockConstructorField | null {
  return state.constructorFields.find((field) => field.id === id && field.organizationId === organizationId) ?? null
}

function idList(value: unknown): number[] | null {
  if (value == null) return []
  if (!Array.isArray(value)) return null
  const ids: number[] = []
  for (const item of value) {
    const id = positive(item)
    if (id == null) return null
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

function parentCycle(state: MockState, organizationId: number, nodeId: number, parentId: number | null): boolean {
  let cursor = parentId
  const seen = new Set<number>()
  while (cursor != null) {
    if (cursor === nodeId || seen.has(cursor)) return true
    seen.add(cursor)
    cursor = nodeIn(state, organizationId, cursor)?.parentId ?? null
  }
  return false
}

function fieldDto(field: MockConstructorField) {
  return {
    id: field.id,
    group: field.nodeId,
    name_en: field.nameEn,
    name_ru: field.nameRu,
    structure_element: field.tabId ?? 0,
    type: field.type,
    dropdown_choices: field.dropdownChoices,
    parent_node: field.nodeId,
    parent_tab: field.tabId ?? undefined,
  }
}

function tabDto(state: MockState, tab: MockConstructorTab) {
  return {
    id: tab.id,
    group: tab.nodeId,
    name_en: tab.nameEn,
    name_ru: tab.nameRu,
    related_structure_elements: tab.relatedTabIds,
    structure_element_fields: state.constructorFields
      .filter((field) => field.tabId === tab.id && field.organizationId === tab.organizationId)
      .map(fieldDto),
  }
}

function nodeDto(state: MockState, node: MockConstructorNode) {
  return {
    id: node.id,
    name_en: node.nameEn,
    name_ru: node.nameRu,
    organization: node.organizationId,
    parent: node.parentId ?? 0,
    related_groups: node.relatedNodeIds,
    pre_made_structure_elements: state.constructorTabs
      .filter((tab) => tab.nodeId === node.id && tab.organizationId === node.organizationId)
      .map((tab) => tabDto(state, tab)),
  }
}

function relatedNodes(state: MockState, organizationId: number, ids: number[], selfId?: number): number[] | null {
  if (selfId != null && ids.includes(selfId)) return null
  for (const id of ids) {
    if (!nodeIn(state, organizationId, id)) return null
  }
  return ids
}

function nodeHasDependents(state: MockState, node: MockConstructorNode): boolean {
  return state.constructorNodes.some((item) => item.parentId === node.id && item.organizationId === node.organizationId)
    || state.constructorTabs.some((tab) => tab.nodeId === node.id)
    || state.constructorFields.some((field) => field.nodeId === node.id)
    || state.constructorRecords.some((record) => record.nodeId === node.id)
}

function tabHasDependents(state: MockState, tab: MockConstructorTab): boolean {
  return state.constructorFields.some((field) => field.tabId === tab.id)
    || state.constructorRecords.some((record) => record.tabId === tab.id)
    || state.constructorTabs.some((item) => item.id !== tab.id && item.relatedTabIds.includes(tab.id))
}

function fieldHasValues(state: MockState, fieldId: number): boolean {
  return state.constructorRecords.some((record) => record.values.some((value) => value.fieldId === fieldId))
}

export function listNodes(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'read')
  if (!access.ok) return access.result
  const nodes = state.constructorNodes
    .filter((node) => node.organizationId === organizationId)
    .map((node) => nodeDto(state, node))
  return done(state, 200, nodes)
}

export function readNode(state: MockState, token: string | null, organizationId: number, nodeId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'read')
  if (!access.ok) return access.result
  const node = nodeIn(state, organizationId, nodeId)
  if (!node) return done(state, 404, { code: 'not_found' })
  return done(state, 200, nodeDto(state, node))
}

export function createNode(state: MockState, token: string | null, organizationId: number, body: Record<string, unknown>): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'create')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const names = namesOf(body, state)
  if ('status' in names) return names
  const parentRaw = body.parent
  const parentId = parentRaw == null || parentRaw === '' || parentRaw === 0 ? null : positive(parentRaw)
  if (parentRaw != null && parentRaw !== '' && parentRaw !== 0 && parentId == null) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  if (parentId != null && !nodeIn(state, organizationId, parentId)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const related = idList(body.related_groups)
  if (!related || !relatedNodes(state, organizationId, related)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const node: MockConstructorNode = {
    id: nextId(state.constructorNodes.map((item) => item.id)),
    organizationId,
    parentId,
    nameEn: names.nameEn,
    nameRu: names.nameRu,
    relatedNodeIds: related,
  }
  const next: MockState = { ...state, constructorNodes: [...state.constructorNodes, node] }
  return done(next, 201, nodeDto(next, node))
}

export function updateNode(
  state: MockState,
  token: string | null,
  organizationId: number,
  nodeId: number,
  body: Record<string, unknown>,
): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'update')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const current = nodeIn(state, organizationId, nodeId)
  if (!current) return done(state, 404, { code: 'not_found' })
  const names = namesOf(body, state)
  if ('status' in names) return names
  let parentId = current.parentId
  if ('parent' in body) {
    const parentRaw = body.parent
    parentId = parentRaw == null || parentRaw === '' || parentRaw === 0 ? null : positive(parentRaw)
    if (parentRaw != null && parentRaw !== '' && parentRaw !== 0 && parentId == null) {
      return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    }
    if (parentId != null && !nodeIn(state, organizationId, parentId)) {
      return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    }
    if (parentCycle(state, organizationId, current.id, parentId)) {
      return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    }
  }
  let related = current.relatedNodeIds
  if ('related_groups' in body) {
    const parsed = idList(body.related_groups)
    const checked = parsed ? relatedNodes(state, organizationId, parsed, current.id) : null
    if (!checked) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    related = checked
  }
  const node: MockConstructorNode = {
    ...current,
    nameEn: names.nameEn,
    nameRu: names.nameRu,
    parentId,
    relatedNodeIds: related,
  }
  const next: MockState = {
    ...state,
    constructorNodes: state.constructorNodes.map((item) => item.id === node.id ? node : item),
  }
  return done(next, 200, nodeDto(next, node))
}

export function deleteNode(state: MockState, token: string | null, organizationId: number, nodeId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'delete')
  if (!access.ok) return access.result
  const node = nodeIn(state, organizationId, nodeId)
  if (!node) return done(state, 404, { code: 'not_found' })
  if (nodeHasDependents(state, node)) return problem(state, 409, 'has_dependents', DEPENDENT_DETAIL)
  return done({
    ...state,
    constructorNodes: state.constructorNodes.filter((item) => item.id !== node.id),
  }, 204, null)
}

export function listTabs(state: MockState, token: string | null, organizationId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'read')
  if (!access.ok) return access.result
  return done(state, 200, state.constructorTabs
    .filter((tab) => tab.organizationId === organizationId)
    .map((tab) => tabDto(state, tab)))
}

export function createTab(state: MockState, token: string | null, organizationId: number, body: Record<string, unknown>): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'create')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const names = namesOf(body, state)
  if ('status' in names) return names
  const nodeId = positive(body.group)
  if (nodeId == null || !nodeIn(state, organizationId, nodeId)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const related = idList(body.related_structure_elements)
  if (!related) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  for (const id of related) {
    const tab = tabIn(state, organizationId, id)
    if (!tab) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const tab: MockConstructorTab = {
    id: nextId(state.constructorTabs.map((item) => item.id)),
    organizationId,
    nodeId,
    nameEn: names.nameEn,
    nameRu: names.nameRu,
    relatedTabIds: related,
  }
  const next: MockState = { ...state, constructorTabs: [...state.constructorTabs, tab] }
  return done(next, 201, tabDto(next, tab))
}

export function updateTabs(state: MockState, token: string | null, organizationId: number, body: Record<string, unknown>): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'update')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const targetId = positive(body.id)
  if (targetId == null) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  const source = Array.isArray(body.structure_elements) && body.structure_elements.length > 0
    ? body.structure_elements
    : [body]
  const patches: Array<{ id: number; nameEn: string; nameRu: string; related: number[] | null }> = []
  for (const item of source) {
    if (!item || typeof item !== 'object') return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    const record = item as Record<string, unknown>
    const id = positive(record.id)
    const tab = id == null ? null : tabIn(state, organizationId, id)
    if (!tab) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    const group = positive(body.group)
    if (group != null && tab.nodeId !== group) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    const names = namesOf(record, state)
    if ('status' in names) return names
    let related: number[] | null = null
    if ('related_structure_elements' in record && Array.isArray(record.related_structure_elements) && record.related_structure_elements.length > 0) {
      const parsed = idList(record.related_structure_elements)
      if (!parsed) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
      for (const relatedId of parsed) {
        const other = tabIn(state, organizationId, relatedId)
        if (!other || other.id === tab.id) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
      }
      related = parsed
    }
    patches.push({ id: tab.id, nameEn: names.nameEn, nameRu: names.nameRu, related })
  }
  if (!patches.some((patch) => patch.id === targetId)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const next: MockState = {
    ...state,
    constructorTabs: state.constructorTabs.map((tab) => {
      const patch = patches.find((item) => item.id === tab.id)
      if (!patch) return tab
      return {
        ...tab,
        nameEn: patch.nameEn,
        nameRu: patch.nameRu,
        relatedTabIds: patch.related ?? tab.relatedTabIds,
      }
    }),
  }
  const updated = tabIn(next, organizationId, targetId)
  if (!updated) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  return done(next, 200, tabDto(next, updated))
}

export function deleteTab(state: MockState, token: string | null, organizationId: number, tabId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'delete')
  if (!access.ok) return access.result
  const tab = tabIn(state, organizationId, tabId)
  if (!tab) return done(state, 404, { code: 'not_found' })
  if (tabHasDependents(state, tab)) return problem(state, 409, 'has_dependents', DEPENDENT_DETAIL)
  return done({
    ...state,
    constructorTabs: state.constructorTabs.filter((item) => item.id !== tab.id),
  }, 204, null)
}

export function listFields(
  state: MockState,
  token: string | null,
  organizationId: number,
  query: { group?: number | null; structureElement?: number | null },
): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'read')
  if (!access.ok) return access.result
  if (query.group != null && !nodeIn(state, organizationId, query.group)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  if (query.structureElement != null && !tabIn(state, organizationId, query.structureElement)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const fields = state.constructorFields.filter((field) => {
    if (field.organizationId !== organizationId) return false
    if (query.group != null && field.nodeId !== query.group) return false
    if (query.structureElement != null && field.tabId !== query.structureElement) return false
    return true
  })
  return done(state, 200, fields.map(fieldDto))
}

function choicesOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const choices: string[] = []
  for (const item of value) {
    const choice = text(item)
    if (!choice) return null
    if (!choices.includes(choice)) choices.push(choice)
  }
  return choices
}

function placement(
  state: MockState,
  organizationId: number,
  body: Record<string, unknown>,
): { nodeId: number; tabId: number | null } | FlowResult {
  const element = positive(body.structure_element)
  const group = positive(body.group)
  if ('structure_element' in body && body.structure_element != null && body.structure_element !== 0 && element == null) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  if (element != null) {
    const tab = tabIn(state, organizationId, element)
    if (!tab) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    if (group != null && group !== tab.nodeId) return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    return { nodeId: tab.nodeId, tabId: tab.id }
  }
  if (group == null || !nodeIn(state, organizationId, group)) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  return { nodeId: group, tabId: null }
}

function duplicateLabel(fields: MockConstructorField[], nameEn: string, nameRu: string, ignoreId?: number): boolean {
  return fields.some((field) => {
    if (field.id === ignoreId) return false
    if (nameEn !== '' && field.nameEn === nameEn) return true
    if (nameRu !== '' && field.nameRu === nameRu) return true
    return false
  })
}

export function createField(state: MockState, token: string | null, organizationId: number, body: Record<string, unknown>): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'create')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const names = namesOf(body, state)
  if ('status' in names) return names
  if (typeof body.type !== 'string' || !FIELD_TYPES.includes(body.type as ConstructorFieldType)) {
    return problem(state, 400, 'invalid_type', 'The field type is not supported. Nothing was saved.')
  }
  const type = body.type as ConstructorFieldType
  const choices = type === 'dropdown' ? choicesOf(body.dropdown_choices) : []
  if (type === 'dropdown' && (!choices || choices.length === 0)) {
    return problem(state, 400, 'invalid_type', 'A dropdown needs at least one choice. Nothing was saved.')
  }
  const place = placement(state, organizationId, body)
  if ('status' in place) return place
  const scope = state.constructorFields.filter((field) => field.nodeId === place.nodeId && field.tabId === place.tabId)
  if (duplicateLabel(scope, names.nameEn, names.nameRu)) {
    return problem(state, 409, 'duplicate_field', 'A field with this name already exists in this table. Nothing was saved.')
  }
  const field: MockConstructorField = {
    id: nextId(state.constructorFields.map((item) => item.id)),
    organizationId,
    nodeId: place.nodeId,
    tabId: place.tabId,
    nameEn: names.nameEn,
    nameRu: names.nameRu,
    type,
    dropdownChoices: choices ?? [],
  }
  const next: MockState = { ...state, constructorFields: [...state.constructorFields, field] }
  return done(next, 201, fieldDto(field))
}

export function updateField(
  state: MockState,
  token: string | null,
  organizationId: number,
  fieldId: number,
  body: Record<string, unknown>,
): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'update')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const current = fieldIn(state, organizationId, fieldId)
  if (!current) return done(state, 404, { code: 'not_found' })
  const names = namesOf(body, state)
  if ('status' in names) return names
  if (typeof body.type !== 'string' || !FIELD_TYPES.includes(body.type as ConstructorFieldType)) {
    return problem(state, 400, 'invalid_type', 'The field type is not supported. Nothing was saved.')
  }
  const type = body.type as ConstructorFieldType
  const used = fieldHasValues(state, current.id)
  if (used && type !== current.type) return problem(state, 409, 'type_change_blocked', TYPE_DETAIL)
  let choices = current.dropdownChoices
  if (type === 'dropdown') {
    const parsed = choicesOf(body.dropdown_choices ?? current.dropdownChoices)
    if (!parsed || parsed.length === 0) {
      return problem(state, 400, 'invalid_type', 'A dropdown needs at least one choice. Nothing was saved.')
    }
    if (used) {
      const removed = current.dropdownChoices.filter((choice) => !parsed.includes(choice))
      const blocked = state.constructorRecords.some((record) => record.values.some((value) =>
        value.fieldId === current.id && value.value !== '' && removed.includes(value.value),
      ))
      if (blocked) return problem(state, 409, 'choice_in_use', CHOICE_DETAIL)
    }
    choices = parsed
  } else {
    choices = []
  }
  let nodeId = current.nodeId
  let tabId = current.tabId
  if ('structure_element' in body && positive(body.structure_element) != null) {
    const place = placement(state, organizationId, body)
    if ('status' in place) return place
    nodeId = place.nodeId
    tabId = place.tabId
  } else if ('group' in body) {
    const group = positive(body.group)
    if (group == null || !nodeIn(state, organizationId, group) || group !== current.nodeId) {
      return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
    }
  }
  const scope = state.constructorFields.filter((field) => field.nodeId === nodeId && field.tabId === tabId)
  if (duplicateLabel(scope, names.nameEn, names.nameRu, current.id)) {
    return problem(state, 409, 'duplicate_field', 'A field with this name already exists in this table. Nothing was saved.')
  }
  const field: MockConstructorField = {
    ...current,
    nodeId,
    tabId,
    nameEn: names.nameEn,
    nameRu: names.nameRu,
    type,
    dropdownChoices: choices,
  }
  const next: MockState = {
    ...state,
    constructorFields: state.constructorFields.map((item) => item.id === field.id ? field : item),
  }
  return done(next, 200, fieldDto(field))
}

export function deleteField(state: MockState, token: string | null, organizationId: number, fieldId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.schema', 'delete')
  if (!access.ok) return access.result
  const field = fieldIn(state, organizationId, fieldId)
  if (!field) return done(state, 404, { code: 'not_found' })
  if (fieldHasValues(state, field.id)) return problem(state, 409, 'has_dependents', DEPENDENT_DETAIL)
  return done({
    ...state,
    constructorFields: state.constructorFields.filter((item) => item.id !== field.id),
  }, 204, null)
}

function scopeFields(state: MockState, organizationId: number, nodeId: number, tabId: number | null): MockConstructorField[] {
  return state.constructorFields.filter((field) =>
    field.organizationId === organizationId && field.nodeId === nodeId && field.tabId === tabId,
  )
}

function resolveField(fields: MockConstructorField[], key: string): MockConstructorField | null | 'ambiguous' {
  const byEnglish = fields.filter((field) => field.nameEn !== '' && field.nameEn === key)
  if (byEnglish.length > 1) return 'ambiguous'
  if (byEnglish.length === 1) return byEnglish[0]
  const byRussian = fields.filter((field) => field.nameRu !== '' && field.nameRu === key)
  if (byRussian.length > 1) return 'ambiguous'
  if (byRussian.length === 1) return byRussian[0]
  return null
}

function normalizeValue(field: MockConstructorField, entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as { type?: unknown; value?: unknown }
  if (typeof record.type === 'string' && record.type !== field.type) {
    const dropdownAlias = field.type === 'dropdown' && record.type === 'string'
    if (!dropdownAlias) return null
  }
  const raw = record.value
  if (field.type === 'integer') {
    if (typeof raw === 'number' && Number.isInteger(raw)) return String(raw)
    if (typeof raw === 'string' && /^-?\d+$/.test(raw)) return String(Number(raw))
    return null
  }
  let value = ''
  if (typeof raw === 'string') value = raw
  else if (raw == null) value = ''
  else if (field.type === 'file' && typeof raw === 'object' && raw && typeof (raw as { name?: unknown }).name === 'string') {
    value = (raw as { name: string }).name
  } else return null
  if (value.startsWith('blob:')) return null
  if (field.type === 'date' && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  if (field.type === 'dropdown' && value !== '' && !field.dropdownChoices.includes(value)) return null
  return value
}

function applyValues(
  state: MockState,
  fields: MockConstructorField[],
  current: MockConstructorRecord['values'],
  data: unknown,
): MockConstructorRecord['values'] | FlowResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return problem(state, 400, 'invalid_value', 'The record data is not an object. Nothing was saved.')
  }
  const next = current.map((value) => ({ ...value }))
  for (const [key, entry] of Object.entries(data)) {
    const field = resolveField(fields, key)
    if (field == null || field === 'ambiguous') {
      return problem(state, 400, 'invalid_field', 'A value does not match a field of this table. Nothing was saved.')
    }
    const value = normalizeValue(field, entry)
    if (value == null) return problem(state, 400, 'invalid_value', 'A value does not match the field type. Nothing was saved.')
    const index = next.findIndex((item) => item.fieldId === field.id)
    const stored = { fieldId: field.id, value }
    if (index >= 0) next[index] = stored
    else next.push(stored)
  }
  return next
}

function recordPlace(state: MockState, organizationId: number, body: Record<string, unknown>) {
  return placement(state, organizationId, body)
}

export function createRecord(state: MockState, token: string | null, organizationId: number, body: Record<string, unknown>): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.records', 'create')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const place = recordPlace(state, organizationId, body)
  if ('status' in place) return place
  const fields = scopeFields(state, organizationId, place.nodeId, place.tabId)
  const values = applyValues(state, fields, [], body.data)
  if (!Array.isArray(values)) return values
  const record: MockConstructorRecord = {
    id: nextId(state.constructorRecords.map((item) => item.id)),
    organizationId,
    nodeId: place.nodeId,
    tabId: place.tabId,
    values,
  }
  return done({ ...state, constructorRecords: [...state.constructorRecords, record] }, 201, { id: record.id })
}

export function updateRecord(
  state: MockState,
  token: string | null,
  organizationId: number,
  recordId: number,
  body: Record<string, unknown>,
): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.records', 'update')
  if (!access.ok) return access.result
  const mismatch = organizationMismatch(body, organizationId, state)
  if (mismatch) return mismatch
  const current = state.constructorRecords.find((record) => record.id === recordId && record.organizationId === organizationId)
  if (!current) return done(state, 404, { code: 'not_found' })
  const place = recordPlace(state, organizationId, body)
  if ('status' in place) return place
  if (place.nodeId !== current.nodeId || place.tabId !== current.tabId) {
    return problem(state, 400, 'invalid_relation', RELATION_DETAIL)
  }
  const fields = scopeFields(state, organizationId, current.nodeId, current.tabId)
  const values = applyValues(state, fields, current.values, body.data)
  if (!Array.isArray(values)) return values
  const record: MockConstructorRecord = { ...current, values }
  return done({
    ...state,
    constructorRecords: state.constructorRecords.map((item) => item.id === record.id ? record : item),
  }, 200, { id: record.id })
}

export function deleteRecord(state: MockState, token: string | null, organizationId: number, recordId: number): FlowResult {
  const access = gate(state, token, organizationId, 'constructor.records', 'delete')
  if (!access.ok) return access.result
  const current = state.constructorRecords.find((record) => record.id === recordId && record.organizationId === organizationId)
  if (!current) return done(state, 404, { code: 'not_found' })
  return done({
    ...state,
    constructorRecords: state.constructorRecords.filter((record) => record.id !== current.id),
  }, 204, null)
}
