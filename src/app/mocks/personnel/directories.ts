import type { DirectoryDefinition, DirectoryEntry, DirectoryField, DirectoryPermissions, ReferenceOption } from '../../../entities/personnel/model/types'
import { departmentParent } from '../../../entities/personnel/model/rules'
import type { Department, Workplace } from '../../../entities/personnel/model/types'
import type { MockState } from '../db/types'
import { allowedKeys, allows, done, enter, optionalText, problem, requiredText, revisionOf, type Gate } from './gate'
import { ensureOrganizationWorkspace } from './workspace'
import type { FlowResult } from '../auth/flow'

function directories(state: MockState): DirectoryDefinition[] {
  return state.directoryDefinitions ?? []
}

function entries(state: MockState): DirectoryEntry[] {
  return state.directoryEntries ?? []
}

function departments(state: MockState): Department[] {
  return state.departments ?? []
}

function workplaces(state: MockState): Workplace[] {
  return state.workplaces ?? []
}

function definitionIn(state: MockState, organizationId: number, directoryId: string): DirectoryDefinition | null {
  return directories(state).find((item) => item.id === directoryId && item.organizationId === organizationId) ?? null
}

export function directoryPermissions(state: MockState, userId: number, organizationId: number): DirectoryPermissions {
  return {
    update: allows(state, userId, organizationId, 'directories', 'update'),
    archive: allows(state, userId, organizationId, 'directories', 'archive'),
    delete: allows(state, userId, organizationId, 'directories', 'delete'),
    structure: allows(state, userId, organizationId, 'directories.structure', 'update'),
  }
}

export type ResolvedReference = {
  id: string
  organizationId: number
  label: string
  archived: boolean
}

export function findReference(
  state: MockState,
  organizationId: number,
  directoryKey: string | null,
  recordId: string,
): ResolvedReference | null {
  if (!directoryKey) return null
  const definition = directories(state).find((item) => item.organizationId === organizationId && item.key === directoryKey)
  if (!definition) return null
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    const row = departments(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    return row ? { id: row.id, organizationId, label: row.name, archived: row.archived } : null
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    const row = workplaces(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    return row ? { id: row.id, organizationId, label: row.name, archived: row.archived } : null
  }
  const row = entries(state).find((item) => item.id === recordId && item.directoryId === definition.id && item.organizationId === organizationId)
  if (!row) return null
  return { id: row.id, organizationId, label: entryLabel(definition, row), archived: row.archived }
}

function entryLabel(definition: DirectoryDefinition, row: DirectoryEntry): string {
  const titled = definition.fields.find((field) => field.key === 'title') ?? definition.fields.find((field) => !field.archived)
  const value = titled ? row.values[titled.id] : ''
  return value?.trim() || row.id
}

export function referenceOptions(state: MockState, organizationId: number, directoryKey: string): ReferenceOption[] {
  const definition = directories(state).find((item) => item.organizationId === organizationId && item.key === directoryKey)
  if (!definition || definition.archived) return []
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    return departments(state)
      .filter((item) => item.organizationId === organizationId)
      .map((item) => ({ id: item.id, label: item.name, archived: item.archived }))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    return workplaces(state)
      .filter((item) => item.organizationId === organizationId)
      .map((item) => ({ id: item.id, label: item.name, archived: item.archived }))
  }
  return entries(state)
    .filter((item) => item.directoryId === definition.id && item.organizationId === organizationId)
    .map((item) => ({ id: item.id, label: entryLabel(definition, item), archived: item.archived }))
}

function recordUsed(state: MockState, organizationId: number, recordId: string): boolean {
  if (departments(state).some((item) => item.organizationId === organizationId && item.parentId === recordId)) return true
  if (workplaces(state).some((item) => item.organizationId === organizationId && item.departmentId === recordId)) return true
  return (state.employees ?? []).some((employee) =>
    employee.organizationId === organizationId
    && Object.values(employee.values).some((value) => value === recordId),
  )
}

function viewDefinition(definition: DirectoryDefinition) {
  return {
    id: definition.id,
    key: definition.key,
    title: definition.title,
    description: definition.description,
    revision: definition.revision,
    archived: definition.archived,
    source: definition.source,
    fields: definition.fields,
  }
}

function departmentView(state: MockState, row: Department) {
  const parent = row.parentId
    ? departments(state).find((item) => item.id === row.parentId && item.organizationId === row.organizationId) ?? null
    : null
  return {
    id: row.id,
    revision: row.revision,
    archived: row.archived,
    label: row.name,
    name: row.name,
    code: row.code,
    parentId: row.parentId,
    parentLabel: parent?.name ?? null,
  }
}

function workplaceView(state: MockState, row: Workplace) {
  const department = row.departmentId
    ? departments(state).find((item) => item.id === row.departmentId && item.organizationId === row.organizationId) ?? null
    : null
  return {
    id: row.id,
    revision: row.revision,
    archived: row.archived,
    label: row.name,
    name: row.name,
    departmentId: row.departmentId,
    departmentLabel: department?.name ?? null,
  }
}

function manualView(definition: DirectoryDefinition, row: DirectoryEntry) {
  return {
    id: row.id,
    revision: row.revision,
    archived: row.archived,
    label: entryLabel(definition, row),
    values: row.values,
  }
}

function recordsOf(state: MockState, definition: DirectoryDefinition) {
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    return departments(state)
      .filter((item) => item.organizationId === definition.organizationId)
      .map((item) => departmentView(state, item))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    return workplaces(state)
      .filter((item) => item.organizationId === definition.organizationId)
      .map((item) => workplaceView(state, item))
  }
  return entries(state)
    .filter((item) => item.directoryId === definition.id)
    .map((item) => manualView(definition, item))
}

function readGate(state: MockState, token: string | null, organizationId: number): Gate {
  return enter(state, token, organizationId, 'directories', 'read')
}

export function listDirectories(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = readGate(state, token, organizationId)
  if (!who.ok) return who.result
  const workspace = (state.organizationWorkspaces ?? []).some((item) => item.organizationId === organizationId)
  return done(state, 200, {
    initialized: workspace,
    canInitialize: allows(state, who.user.id, organizationId, 'personnel.structure', 'update'),
    permissions: directoryPermissions(state, who.user.id, organizationId),
    directories: directories(state)
      .filter((item) => item.organizationId === organizationId)
      .map(viewDefinition),
  })
}

export function readDirectory(state: MockState, token: string | null, organizationId: number, directoryId: string): FlowResult {
  const who = readGate(state, token, organizationId)
  if (!who.ok) return who.result
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) return problem(state, 404, 'not_found')
  return done(state, 200, {
    directory: viewDefinition(definition),
    records: recordsOf(state, definition),
    permissions: directoryPermissions(state, who.user.id, organizationId),
  })
}

function parentChoice(
  state: MockState,
  organizationId: number,
  departmentId: string,
  parentId: string | null,
  previous: string | null,
): FlowResult | null {
  if (parentId === previous) return null
  if (parentId == null) return null
  const parent = departments(state).find((item) => item.id === parentId)
  if (!parent || parent.organizationId !== organizationId) return problem(state, 400, 'invalid_parent')
  if (parent.archived) return problem(state, 400, 'archived_value')
  const check = departmentParent(departments(state), organizationId, departmentId, parentId)
  if (check === 'cycle') return problem(state, 400, 'cycle')
  if (check !== 'ok') return problem(state, 400, 'invalid_parent')
  return null
}

export function createDirectoryRecord(
  state: MockState,
  token: string | null,
  directoryId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'directories', 'update')
  if (!who.ok) return who.result
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition || definition.archived) return problem(state, 404, 'not_found')
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    if (!allowedKeys(body, ['organizationId', 'name', 'code', 'parentId'])) return problem(state, 400, 'unknown_key')
    const name = requiredText(body.name, 200)
    const code = optionalText(body.code, 80)
    if (!name || code === undefined) return problem(state, 400, 'invalid_value')
    const parentId = body.parentId == null || body.parentId === '' ? null : body.parentId
    if (parentId != null && typeof parentId !== 'string') return problem(state, 400, 'invalid_parent')
    const id = `dep-${crypto.randomUUID()}`
    const parentError = parentChoice(state, organizationId, id, parentId, null)
    if (parentError) return parentError
    const row: Department = { id, organizationId, name, code: code ?? '', parentId, revision: 1, archived: false }
    return done({ ...state, departments: [...departments(state), row] }, 201, departmentView(state, row))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    if (!allowedKeys(body, ['organizationId', 'name', 'departmentId'])) return problem(state, 400, 'unknown_key')
    const name = requiredText(body.name, 200)
    if (!name) return problem(state, 400, 'invalid_value')
    const departmentId = body.departmentId == null || body.departmentId === '' ? null : body.departmentId
    if (departmentId != null && typeof departmentId !== 'string') return problem(state, 400, 'invalid_value')
    if (departmentId) {
      const department = departments(state).find((item) => item.id === departmentId && item.organizationId === organizationId)
      if (!department) return problem(state, 400, 'invalid_value')
      if (department.archived) return problem(state, 400, 'archived_value')
    }
    const row: Workplace = {
      id: `wp-${crypto.randomUUID()}`,
      organizationId,
      name,
      departmentId,
      revision: 1,
      archived: false,
    }
    return done({ ...state, workplaces: [...workplaces(state), row] }, 201, workplaceView({ ...state, workplaces: [...workplaces(state), row] }, row))
  }
  if (!allowedKeys(body, ['organizationId', 'values'])) return problem(state, 400, 'unknown_key')
  const parsed = manualValues(definition, body.values, null)
  if ('error' in parsed) return problem(state, 400, parsed.error)
  const row: DirectoryEntry = {
    id: `de-${crypto.randomUUID()}`,
    organizationId,
    directoryId: definition.id,
    values: parsed.values,
    revision: 1,
    archived: false,
  }
  return done({ ...state, directoryEntries: [...entries(state), row] }, 201, manualView(definition, row))
}

function manualValues(
  definition: DirectoryDefinition,
  raw: unknown,
  previous: Record<string, string> | null,
): { values: Record<string, string> } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_value' }
  const input = raw as Record<string, unknown>
  const known = new Set(definition.fields.map((field) => field.id))
  if (Object.keys(input).some((key) => !known.has(key))) return { error: 'unknown_field' }
  const values: Record<string, string> = { ...(previous ?? {}) }
  for (const field of definition.fields) {
    if (!(field.id in input)) continue
    if (field.archived && input[field.id] !== previous?.[field.id]) return { error: 'archived_value' }
    const text = optionalText(input[field.id], 300)
    if (text == null) return { error: 'invalid_value' }
    values[field.id] = text
  }
  for (const field of definition.fields) {
    if (field.archived || !field.required) continue
    if (!values[field.id]?.trim()) return { error: 'required' }
  }
  return { values }
}

export function updateDirectoryRecord(
  state: MockState,
  token: string | null,
  directoryId: string,
  recordId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'directories', 'update')
  if (!who.ok) return who.result
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'name', 'code', 'parentId'])) return problem(state, 400, 'unknown_key')
    const current = departments(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expected) return problem(state, 409, 'stale_write')
    const name = requiredText(body.name, 200)
    const code = optionalText(body.code, 80)
    if (!name || code === undefined) return problem(state, 400, 'invalid_value')
    const parentId = body.parentId == null || body.parentId === '' ? null : body.parentId
    if (parentId != null && typeof parentId !== 'string') return problem(state, 400, 'invalid_parent')
    const parentError = parentChoice(state, organizationId, current.id, parentId, current.parentId)
    if (parentError) return parentError
    const next: Department = { ...current, name, code: code ?? '', parentId, revision: current.revision + 1 }
    const list = departments(state).map((item) => item.id === current.id ? next : item)
    return done({ ...state, departments: list }, 200, departmentView({ ...state, departments: list }, next))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'name', 'departmentId'])) return problem(state, 400, 'unknown_key')
    const current = workplaces(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expected) return problem(state, 409, 'stale_write')
    const name = requiredText(body.name, 200)
    if (!name) return problem(state, 400, 'invalid_value')
    const departmentId = body.departmentId == null || body.departmentId === '' ? null : body.departmentId
    if (departmentId != null && typeof departmentId !== 'string') return problem(state, 400, 'invalid_value')
    if (departmentId && departmentId !== current.departmentId) {
      const department = departments(state).find((item) => item.id === departmentId && item.organizationId === organizationId)
      if (!department) return problem(state, 400, 'invalid_value')
      if (department.archived) return problem(state, 400, 'archived_value')
    }
    const next: Workplace = { ...current, name, departmentId, revision: current.revision + 1 }
    const list = workplaces(state).map((item) => item.id === current.id ? next : item)
    return done({ ...state, workplaces: list }, 200, workplaceView({ ...state, workplaces: list }, next))
  }
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'values'])) return problem(state, 400, 'unknown_key')
  const current = entries(state).find((item) => item.id === recordId && item.directoryId === definition.id)
  if (!current || current.organizationId !== organizationId) return problem(state, 404, 'not_found')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  const parsed = manualValues(definition, body.values, current.values)
  if ('error' in parsed) return problem(state, 400, parsed.error)
  const next: DirectoryEntry = { ...current, values: parsed.values, revision: current.revision + 1 }
  const list = entries(state).map((item) => item.id === current.id ? next : item)
  return done({ ...state, directoryEntries: list }, 200, manualView(definition, next))
}

export function archiveDirectoryRecord(
  state: MockState,
  token: string | null,
  directoryId: string,
  recordId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'directories', 'archive')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'archived'])) return problem(state, 400, 'unknown_key')
  if (typeof body.archived !== 'boolean') return problem(state, 400, 'invalid_value')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) return problem(state, 404, 'not_found')
  return setArchived(state, definition, recordId, organizationId, expected, body.archived)
}

function setArchived(
  state: MockState,
  definition: DirectoryDefinition,
  recordId: string,
  organizationId: number,
  expected: number,
  archived: boolean,
): FlowResult {
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    const current = departments(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expected) return problem(state, 409, 'stale_write')
    const next = { ...current, archived, revision: current.revision + 1 }
    const list = departments(state).map((item) => item.id === current.id ? next : item)
    return done({ ...state, departments: list }, 200, departmentView({ ...state, departments: list }, next))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    const current = workplaces(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expected) return problem(state, 409, 'stale_write')
    const next = { ...current, archived, revision: current.revision + 1 }
    const list = workplaces(state).map((item) => item.id === current.id ? next : item)
    return done({ ...state, workplaces: list }, 200, workplaceView({ ...state, workplaces: list }, next))
  }
  const current = entries(state).find((item) => item.id === recordId && item.directoryId === definition.id && item.organizationId === organizationId)
  if (!current) return problem(state, 404, 'not_found')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  const next = { ...current, archived, revision: current.revision + 1 }
  const list = entries(state).map((item) => item.id === current.id ? next : item)
  return done({ ...state, directoryEntries: list }, 200, manualView(definition, next))
}

export function deleteDirectoryRecord(
  state: MockState,
  token: string | null,
  organizationId: number,
  directoryId: string,
  recordId: string,
  expectedRevision: number | null,
): FlowResult {
  const who = enter(state, token, organizationId, 'directories', 'delete')
  if (!who.ok) return who.result
  if (expectedRevision == null) return problem(state, 400, 'invalid_version')
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) return problem(state, 404, 'not_found')
  if (recordUsed(state, organizationId, recordId)) return problem(state, 409, 'in_use')
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    const current = departments(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expectedRevision) return problem(state, 409, 'stale_write')
    return done({ ...state, departments: departments(state).filter((item) => item.id !== current.id) }, 200, { id: current.id })
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    const current = workplaces(state).find((item) => item.id === recordId && item.organizationId === organizationId)
    if (!current) return problem(state, 404, 'not_found')
    if (current.revision !== expectedRevision) return problem(state, 409, 'stale_write')
    return done({ ...state, workplaces: workplaces(state).filter((item) => item.id !== current.id) }, 200, { id: current.id })
  }
  const current = entries(state).find((item) => item.id === recordId && item.directoryId === definition.id && item.organizationId === organizationId)
  if (!current) return problem(state, 404, 'not_found')
  if (current.revision !== expectedRevision) return problem(state, 409, 'stale_write')
  return done({
    ...state,
    directoryEntries: entries(state).filter((item) => item.id !== current.id),
  }, 200, { id: current.id })
}

export function updateDirectoryDefinition(
  state: MockState,
  token: string | null,
  directoryId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'directories.structure', 'update')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'title', 'description', 'archived', 'fields'])) {
    return problem(state, 400, 'unknown_key')
  }
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (definition.revision !== expected) return problem(state, 409, 'stale_write')
  const title = requiredText(body.title, 200)
  const description = optionalText(body.description, 500)
  if (!title || description === undefined || typeof body.archived !== 'boolean' || !Array.isArray(body.fields)) {
    return problem(state, 400, 'invalid_value')
  }
  const rewritten = rewriteFields(state, definition, body.fields)
  if ('error' in rewritten) return problem(state, 400, rewritten.error)
  const next: DirectoryDefinition = {
    ...definition,
    title,
    description: description ?? '',
    archived: body.archived,
    fields: rewritten.fields,
    revision: definition.revision + 1,
  }
  return done({
    ...state,
    directoryDefinitions: directories(state).map((item) => item.id === definition.id ? next : item),
  }, 200, viewDefinition(next))
}

function fieldHasValues(state: MockState, definition: DirectoryDefinition, fieldId: string): boolean {
  return entries(state).some((entry) =>
    entry.directoryId === definition.id && (entry.values[fieldId] ?? '').trim() !== '',
  )
}

function rewriteFields(
  state: MockState,
  definition: DirectoryDefinition,
  raw: unknown[],
): { fields: DirectoryField[] } | { error: string } {
  const registry = definition.source.type === 'registry'
  const seen = new Set<string>()
  const next: DirectoryField[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'invalid_value' }
    const field = item as Record<string, unknown>
    if (!allowedKeys(field, ['id', 'label', 'required', 'archived', 'type'])) return { error: 'unknown_key' }
    const label = requiredText(field.label, 200)
    if (!label || typeof field.required !== 'boolean' || typeof field.archived !== 'boolean') return { error: 'invalid_value' }
    if (field.type != null && field.type !== 'text') return { error: 'type_change_blocked' }
    const id = typeof field.id === 'string' ? field.id : ''
    if (id.startsWith('new:')) {
      if (registry) return { error: 'system_field' }
      next.push({
        id: `df-${crypto.randomUUID()}`,
        key: 'custom',
        label,
        type: 'text',
        required: field.required,
        archived: field.archived,
      })
      continue
    }
    const current = definition.fields.find((entry) => entry.id === id)
    if (!current) return { error: 'unknown_field' }
    if (seen.has(current.id)) return { error: 'invalid_value' }
    seen.add(current.id)
    if (registry && (field.archived !== current.archived || field.required !== current.required)) return { error: 'system_field' }
    if (!registry && field.archived && !current.archived && field.required && fieldHasValues(state, definition, current.id)) {
      return { error: 'invalid_value' }
    }
    next.push({ ...current, label, required: field.required, archived: field.archived })
  }
  for (const current of definition.fields) {
    if (seen.has(current.id)) continue
    if (registry || fieldHasValues(state, definition, current.id)) return { error: 'system_field' }
  }
  if (registry && next.length !== definition.fields.length) return { error: 'system_field' }
  return { fields: next }
}

export function initializeWorkspace(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = enter(state, token, organizationId, 'personnel.structure', 'update')
  if (!who.ok) return who.result
  const next = ensureOrganizationWorkspace(state, organizationId)
  if (!next) return problem(state, 404, 'not_found')
  const workspace = next.organizationWorkspaces.find((item) => item.organizationId === organizationId)
  return done(next, 200, {
    initialized: true,
    templateId: workspace?.templateId ?? null,
    templateVersion: workspace?.templateVersion ?? null,
  })
}
