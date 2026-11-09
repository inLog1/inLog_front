import {
  SYSTEM_REGISTRIES,
  registryRecordsResource,
  registrySchemaResource,
  type SystemRegistryId,
} from '../../../entities/access/model/permission-catalog'
import { directoryFieldId, directoryId, STARTER_DIRECTORY_KEYS } from '../../../entities/personnel/model/template'
import {
  DIRECTORY_CATALOG_SECTIONS,
  type DirectoryCatalogSection,
  type DirectoryDefinition,
  type DirectoryEntry,
  type DirectoryField,
  type DirectoryPermissions,
  type ReferenceOption,
} from '../../../entities/personnel/model/types'
import { departmentParent } from '../../../entities/personnel/model/rules'
import type { Department, Workplace } from '../../../entities/personnel/model/types'
import type { MockState } from '../db/types'
import { allowedKeys, allows, authenticate, done, enter, optionalText, problem, requiredText, revisionOf } from './gate'
import { ensureOrganizationWorkspace } from './workspace'
import type { FlowResult } from '../auth/flow'
import { constraintsEqual, parseCatalogFieldType, parseDirectoryConstraints } from './attribute-fields'

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

function manualPermissions(state: MockState, userId: number, organizationId: number): DirectoryPermissions {
  const update = allows(state, userId, organizationId, 'directories', 'update')
  const structure = allows(state, userId, organizationId, 'directories.structure', 'update')
  return {
    read: allows(state, userId, organizationId, 'directories', 'read'),
    create: update,
    update,
    archive: allows(state, userId, organizationId, 'directories', 'archive'),
    delete: allows(state, userId, organizationId, 'directories', 'delete'),
    structure,
    schemaRead: allows(state, userId, organizationId, 'directories', 'read'),
    schemaCreate: structure,
    schemaUpdate: structure,
    schemaDelete: structure,
  }
}

function registryPermissionSet(
  state: MockState,
  userId: number,
  organizationId: number,
  registry: SystemRegistryId,
): DirectoryPermissions {
  const records = registryRecordsResource(registry)
  const schema = registrySchemaResource(registry)
  const schemaUpdate = allows(state, userId, organizationId, schema, 'update')
  return {
    read: allows(state, userId, organizationId, records, 'read'),
    create: allows(state, userId, organizationId, records, 'create'),
    update: allows(state, userId, organizationId, records, 'update'),
    archive: allows(state, userId, organizationId, records, 'archive'),
    delete: allows(state, userId, organizationId, records, 'delete'),
    structure: schemaUpdate,
    schemaRead: allows(state, userId, organizationId, schema, 'read'),
    schemaCreate: allows(state, userId, organizationId, schema, 'create'),
    schemaUpdate,
    schemaDelete: allows(state, userId, organizationId, schema, 'delete'),
  }
}

export function directoryPermissions(state: MockState, userId: number, organizationId: number): DirectoryPermissions {
  return manualPermissions(state, userId, organizationId)
}

export function permissionsForDefinition(
  state: MockState,
  userId: number,
  definition: DirectoryDefinition,
): DirectoryPermissions {
  if (definition.source.type === 'registry') {
    return registryPermissionSet(state, userId, definition.organizationId, definition.source.registry)
  }
  return manualPermissions(state, userId, definition.organizationId)
}

export function canCreateDirectoryRecord(state: MockState, userId: number, definition: DirectoryDefinition): boolean {
  return !definition.archived && permissionsForDefinition(state, userId, definition).create
}

function canOpenDirectory(state: MockState, userId: number, definition: DirectoryDefinition): boolean {
  const permissions = permissionsForDefinition(state, userId, definition)
  return permissions.read || permissions.schemaRead
}

function canListDirectories(state: MockState, userId: number, organizationId: number): boolean {
  if (allows(state, userId, organizationId, 'directories', 'read')) return true
  return SYSTEM_REGISTRIES.some((registry) => {
    const permissions = registryPermissionSet(state, userId, organizationId, registry)
    return permissions.read || permissions.schemaRead
  })
}

type RecordAction = 'create' | 'update' | 'archive' | 'delete'

function recordPermission(definition: DirectoryDefinition, action: RecordAction): { resource: string; action: string } {
  if (definition.source.type === 'registry') {
    return { resource: registryRecordsResource(definition.source.registry), action }
  }
  if (action === 'create' || action === 'update') return { resource: 'directories', action: 'update' }
  return { resource: 'directories', action }
}

function mayProbeRecords(state: MockState, userId: number, organizationId: number, action: RecordAction): boolean {
  const manualAction = action === 'create' || action === 'update' ? 'update' : action
  if (allows(state, userId, organizationId, 'directories', manualAction)) return true
  return SYSTEM_REGISTRIES.some((registry) =>
    allows(state, userId, organizationId, registryRecordsResource(registry), action),
  )
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
      .map((item) => ({
        id: item.id,
        label: item.name,
        archived: item.archived,
        departmentId: item.departmentId,
      }))
  }
  return entries(state)
    .filter((item) => item.directoryId === definition.id && item.organizationId === organizationId)
    .map((item) => ({ id: item.id, label: entryLabel(definition, item), archived: item.archived }))
}

function definitionReferenced(state: MockState, organizationId: number, directoryKey: string): boolean {
  const config = (state.personnelConfigs ?? []).find((item) => item.organizationId === organizationId)
  if (config?.fields.some((field) => field.directoryKey === directoryKey)) return true
  const definition = directories(state).find((item) => item.organizationId === organizationId && item.key === directoryKey)
  if (!definition) return false
  const recordIds = new Set<string>()
  if (definition.source.type === 'registry') return true
  for (const entry of entries(state)) {
    if (entry.directoryId === definition.id && entry.organizationId === organizationId) recordIds.add(entry.id)
  }
  return (state.employees ?? []).some((employee) =>
    employee.organizationId === organizationId
    && Object.values(employee.values).some((value) => typeof value === 'string' && recordIds.has(value)),
  )
}

function recordUsed(state: MockState, organizationId: number, recordId: string): boolean {
  if (departments(state).some((item) => item.organizationId === organizationId && item.parentId === recordId)) return true
  if (workplaces(state).some((item) => item.organizationId === organizationId && item.departmentId === recordId)) return true
  return (state.employees ?? []).some((employee) =>
    employee.organizationId === organizationId
    && Object.values(employee.values).some((value) => value === recordId),
  )
}

function viewDefinition(definition: DirectoryDefinition, permissions: DirectoryPermissions) {
  return {
    id: definition.id,
    key: definition.key,
    title: definition.title,
    description: definition.description,
    revision: definition.revision,
    archived: definition.archived,
    source: definition.source,
    sections: definition.sections,
    fields: definition.fields,
    permissions,
  }
}

function parseCatalogSection(value: unknown): DirectoryCatalogSection | null {
  if (typeof value !== 'string') return null
  return (DIRECTORY_CATALOG_SECTIONS as readonly string[]).includes(value) ? value as DirectoryCatalogSection : null
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
    values: row.values ?? {},
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
    values: row.values ?? {},
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

export function listDirectories(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = authenticate(state, token, organizationId)
  if (!who.ok) return who.result
  if (!canListDirectories(state, who.user.id, organizationId)) return problem(state, 403, 'forbidden')
  const workspace = (state.organizationWorkspaces ?? []).some((item) => item.organizationId === organizationId)
  const visible = directories(state).filter((item) =>
    item.organizationId === organizationId && canOpenDirectory(state, who.user.id, item),
  )
  return done(state, 200, {
    initialized: workspace,
    canInitialize: allows(state, who.user.id, organizationId, 'personnel.structure', 'update'),
    permissions: directoryPermissions(state, who.user.id, organizationId),
    directories: visible.map((item) => viewDefinition(item, permissionsForDefinition(state, who.user.id, item))),
  })
}

export function readDirectory(state: MockState, token: string | null, organizationId: number, directoryId: string): FlowResult {
  const who = authenticate(state, token, organizationId)
  if (!who.ok) return who.result
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) {
    return canListDirectories(state, who.user.id, organizationId)
      ? problem(state, 404, 'not_found')
      : problem(state, 403, 'forbidden')
  }
  if (!canOpenDirectory(state, who.user.id, definition)) return problem(state, 403, 'forbidden')
  const permissions = permissionsForDefinition(state, who.user.id, definition)
  return done(state, 200, {
    directory: viewDefinition(definition, permissions),
    records: permissions.read ? recordsOf(state, definition) : [],
    usedFieldIds: usedFieldIdsOf(state, definition),
    permissions,
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

function requireRecordPermission(
  state: MockState,
  token: string | null,
  organizationId: number,
  directoryId: string,
  action: RecordAction,
): { ok: true; userId: number; definition: DirectoryDefinition } | { ok: false; result: FlowResult } {
  const who = authenticate(state, token, organizationId)
  if (!who.ok) return who
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) {
    return {
      ok: false,
      result: mayProbeRecords(state, who.user.id, organizationId, action)
        ? problem(state, 404, 'not_found')
        : problem(state, 403, 'forbidden'),
    }
  }
  const permission = recordPermission(definition, action)
  if (!allows(state, who.user.id, organizationId, permission.resource, permission.action)) {
    return { ok: false, result: problem(state, 403, 'forbidden') }
  }
  return { ok: true, userId: who.user.id, definition }
}

export function createDirectoryRecord(
  state: MockState,
  token: string | null,
  directoryId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = requireRecordPermission(state, token, organizationId, directoryId, 'create')
  if (!who.ok) return who.result
  const definition = who.definition
  if (definition.archived) return problem(state, 404, 'not_found')
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    if (!allowedKeys(body, ['organizationId', 'name', 'code', 'parentId', 'values'])) return problem(state, 400, 'unknown_key')
    const name = requiredText(body.name, 200)
    const code = optionalText(body.code, 80)
    if (!name || code === undefined) return problem(state, 400, 'invalid_value')
    const parentId = body.parentId == null || body.parentId === '' ? null : body.parentId
    if (parentId != null && typeof parentId !== 'string') return problem(state, 400, 'invalid_parent')
    const parsed = extensionValues(definition, body.values, null)
    if ('error' in parsed) return problem(state, 400, parsed.error)
    const id = `dep-${crypto.randomUUID()}`
    const parentError = parentChoice(state, organizationId, id, parentId, null)
    if (parentError) return parentError
    const row: Department = {
      id,
      organizationId,
      name,
      code: code ?? '',
      parentId,
      revision: 1,
      archived: false,
      values: parsed.values,
    }
    const next = { ...state, departments: [...departments(state), row] }
    return done(next, 201, departmentView(next, row))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    if (!allowedKeys(body, ['organizationId', 'name', 'departmentId', 'values'])) return problem(state, 400, 'unknown_key')
    const name = requiredText(body.name, 200)
    if (!name) return problem(state, 400, 'invalid_value')
    const departmentId = body.departmentId == null || body.departmentId === '' ? null : body.departmentId
    if (departmentId != null && typeof departmentId !== 'string') return problem(state, 400, 'invalid_value')
    if (departmentId) {
      const department = departments(state).find((item) => item.id === departmentId && item.organizationId === organizationId)
      if (!department) return problem(state, 400, 'invalid_value')
      if (department.archived) return problem(state, 400, 'archived_value')
    }
    const parsed = extensionValues(definition, body.values, null)
    if ('error' in parsed) return problem(state, 400, parsed.error)
    const row: Workplace = {
      id: `wp-${crypto.randomUUID()}`,
      organizationId,
      name,
      departmentId,
      revision: 1,
      archived: false,
      values: parsed.values,
    }
    const next = { ...state, workplaces: [...workplaces(state), row] }
    return done(next, 201, workplaceView(next, row))
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

function extensionValues(
  definition: DirectoryDefinition,
  raw: unknown,
  previous: Record<string, string> | null,
): { values: Record<string, string> } | { error: string } {
  const custom = definition.fields.filter((field) => field.key === 'custom')
  if (raw == null) {
    const values = { ...(previous ?? {}) }
    for (const field of custom) {
      if (field.archived || !field.required) continue
      if (!values[field.id]?.trim()) return { error: 'required' }
    }
    return { values }
  }
  return manualValues({ ...definition, fields: custom }, raw, previous)
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
  const who = requireRecordPermission(state, token, organizationId, directoryId, 'update')
  if (!who.ok) return who.result
  const definition = who.definition
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'name', 'code', 'parentId', 'values'])) return problem(state, 400, 'unknown_key')
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
    const parsed = extensionValues(definition, body.values, current.values ?? {})
    if ('error' in parsed) return problem(state, 400, parsed.error)
    const next: Department = { ...current, name, code: code ?? '', parentId, values: parsed.values, revision: current.revision + 1 }
    const list = departments(state).map((item) => item.id === current.id ? next : item)
    return done({ ...state, departments: list }, 200, departmentView({ ...state, departments: list }, next))
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'name', 'departmentId', 'values'])) return problem(state, 400, 'unknown_key')
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
    const parsed = extensionValues(definition, body.values, current.values ?? {})
    if ('error' in parsed) return problem(state, 400, parsed.error)
    const next: Workplace = { ...current, name, departmentId, values: parsed.values, revision: current.revision + 1 }
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
  const who = requireRecordPermission(state, token, organizationId, directoryId, 'archive')
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
  const who = requireRecordPermission(state, token, organizationId, directoryId, 'delete')
  if (!who.ok) return who.result
  if (expectedRevision == null) return problem(state, 400, 'invalid_version')
  const definition = who.definition
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

function directoryKeyBase(title: string): string {
  const base = title.trim().toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || `directory-${crypto.randomUUID().slice(0, 8)}`
}

function uniqueDirectoryKey(state: MockState, organizationId: number, title: string): string {
  let key = directoryKeyBase(title)
  const taken = () => directories(state).some((item) => item.organizationId === organizationId && item.key === key)
  let suffix = 1
  while (taken()) {
    key = `${directoryKeyBase(title)}-${suffix}`
    suffix += 1
  }
  return key
}

export function deleteDirectoryDefinition(
  state: MockState,
  token: string | null,
  organizationId: number,
  targetDirectoryId: string,
  expectedRevision: number | null,
): FlowResult {
  const who = enter(state, token, organizationId, 'directories', 'delete')
  if (!who.ok) return who.result
  if (expectedRevision == null) return problem(state, 400, 'invalid_version')
  const definition = definitionIn(state, organizationId, targetDirectoryId)
  if (!definition) return problem(state, 404, 'not_found')
  if (definition.revision !== expectedRevision) return problem(state, 409, 'stale_write')
  if (definition.source.type === 'registry') return problem(state, 409, 'system_directory')
  if ((STARTER_DIRECTORY_KEYS as readonly string[]).includes(definition.key)) return problem(state, 409, 'system_directory')
  if (definitionReferenced(state, organizationId, definition.key)) return problem(state, 409, 'in_use')
  return done({
    ...state,
    directoryDefinitions: directories(state).filter((item) => item.id !== definition.id),
    directoryEntries: entries(state).filter((item) => item.directoryId !== definition.id),
  }, 200, { id: definition.id })
}

export function createDirectoryDefinition(
  state: MockState,
  token: string | null,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'directories.structure', 'update')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'title', 'description', 'section'])) return problem(state, 400, 'unknown_key')
  const title = requiredText(body.title, 200)
  const description = optionalText(body.description, 500)
  const section = body.section === undefined ? 'other' : parseCatalogSection(body.section)
  if (!title || description === undefined || section == null) return problem(state, 400, 'invalid_value')
  const workspace = ensureOrganizationWorkspace(state, organizationId)
  if (!workspace) return problem(state, 404, 'not_found')
  const key = uniqueDirectoryKey(workspace, organizationId, title)
  const definition: DirectoryDefinition = {
    id: directoryId(organizationId, key),
    organizationId,
    key,
    title,
    description: description ?? '',
    revision: 1,
    source: { type: 'manual' },
    sections: [section],
    archived: false,
    fields: [{
      id: directoryFieldId(organizationId, key, 'title'),
      key: 'title',
      label: 'Название',
      type: 'text',
      required: true,
      archived: false,
    }],
  }
  return done({
    ...workspace,
    directoryDefinitions: [...directories(workspace), definition],
  }, 201, viewDefinition(definition, permissionsForDefinition(workspace, who.user.id, definition)))
}

function mayProbeSchema(state: MockState, userId: number, organizationId: number): boolean {
  if (allows(state, userId, organizationId, 'directories.structure', 'update')) return true
  return SYSTEM_REGISTRIES.some((registry) => {
    const resource = registrySchemaResource(registry)
    return (['create', 'update', 'delete'] as const).some((action) => allows(state, userId, organizationId, resource, action))
  })
}

function schemaActions(
  before: DirectoryField[],
  after: DirectoryField[],
  metaChanged: boolean,
): Array<'create' | 'update' | 'delete'> {
  const actions = new Set<'create' | 'update' | 'delete'>()
  if (metaChanged) actions.add('update')
  const beforeIds = new Set(before.map((field) => field.id))
  const afterIds = new Set(after.map((field) => field.id))
  if (after.some((field) => !beforeIds.has(field.id))) actions.add('create')
  if (before.some((field) => !afterIds.has(field.id))) actions.add('delete')
  const sharedBefore = before.filter((field) => afterIds.has(field.id)).map((field) => field.id).join('\n')
  const sharedAfter = after.filter((field) => beforeIds.has(field.id)).map((field) => field.id).join('\n')
  if (sharedBefore !== sharedAfter) actions.add('update')
  for (const field of before) {
    const next = after.find((item) => item.id === field.id)
    if (!next) continue
    if (next.label !== field.label
      || next.required !== field.required
      || next.archived !== field.archived
      || next.type !== field.type
      || !constraintsEqual(next.constraints, field.constraints)) actions.add('update')
  }
  if (actions.size === 0) actions.add('update')
  return [...actions]
}

export function updateDirectoryDefinition(
  state: MockState,
  token: string | null,
  directoryId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = authenticate(state, token, organizationId)
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'title', 'description', 'archived', 'fields', 'section'])) {
    return problem(state, 400, 'unknown_key')
  }
  const definition = definitionIn(state, organizationId, directoryId)
  if (!definition) {
    return mayProbeSchema(state, who.user.id, organizationId)
      ? problem(state, 404, 'not_found')
      : problem(state, 403, 'forbidden')
  }
  const registry = definition.source.type === 'registry' ? definition.source.registry : null
  if (!registry && !allows(state, who.user.id, organizationId, 'directories.structure', 'update')) {
    return problem(state, 403, 'forbidden')
  }
  if (registry) {
    const resource = registrySchemaResource(registry)
    const canWrite = (['create', 'update', 'delete'] as const).some((action) =>
      allows(state, who.user.id, organizationId, resource, action),
    )
    if (!canWrite) return problem(state, 403, 'forbidden')
  }
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
  let sections = definition.sections
  if (body.section !== undefined) {
    const section = parseCatalogSection(body.section)
    if (!section) return problem(state, 400, 'invalid_value')
    sections = [section]
  }
  if (registry) {
    const metaChanged = title !== definition.title
      || (description ?? '') !== definition.description
      || body.archived !== definition.archived
      || (sections ?? []).join('\n') !== (definition.sections ?? []).join('\n')
    const resource = registrySchemaResource(registry)
    for (const action of schemaActions(definition.fields, rewritten.fields, metaChanged)) {
      if (!allows(state, who.user.id, organizationId, resource, action)) return problem(state, 403, 'forbidden')
    }
  }
  const next: DirectoryDefinition = {
    ...definition,
    title,
    description: description ?? '',
    archived: body.archived,
    fields: rewritten.fields,
    sections,
    revision: definition.revision + 1,
  }
  return done({
    ...state,
    directoryDefinitions: directories(state).map((item) => item.id === definition.id ? next : item),
  }, 200, viewDefinition(next, permissionsForDefinition(state, who.user.id, next)))
}

function fieldHasValues(state: MockState, definition: DirectoryDefinition, fieldId: string): boolean {
  const field = definition.fields.find((item) => item.id === fieldId)
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    return departments(state).some((row) => {
      if (row.organizationId !== definition.organizationId) return false
      if (field?.key === 'name') return row.name.trim() !== ''
      if (field?.key === 'code') return row.code.trim() !== ''
      if (field?.key === 'parent') return row.parentId != null
      return (row.values?.[fieldId] ?? '').trim() !== ''
    })
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    return workplaces(state).some((row) => {
      if (row.organizationId !== definition.organizationId) return false
      if (field?.key === 'name') return row.name.trim() !== ''
      if (field?.key === 'department') return row.departmentId != null
      return (row.values?.[fieldId] ?? '').trim() !== ''
    })
  }
  return entries(state).some((entry) =>
    entry.directoryId === definition.id && (entry.values[fieldId] ?? '').trim() !== '',
  )
}

function usedFieldIdsOf(state: MockState, definition: DirectoryDefinition): string[] {
  return definition.fields.filter((field) => fieldHasValues(state, definition, field.id)).map((field) => field.id)
}

function directoryHasRecords(state: MockState, definition: DirectoryDefinition): boolean {
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    return departments(state).some((row) => row.organizationId === definition.organizationId)
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    return workplaces(state).some((row) => row.organizationId === definition.organizationId)
  }
  return entries(state).some((entry) => entry.directoryId === definition.id)
}

function recordsMissingValue(state: MockState, definition: DirectoryDefinition, fieldId: string): boolean {
  if (definition.source.type === 'registry' && definition.source.registry === 'departments') {
    return departments(state).some((row) =>
      row.organizationId === definition.organizationId && !(row.values?.[fieldId] ?? '').trim(),
    )
  }
  if (definition.source.type === 'registry' && definition.source.registry === 'workplaces') {
    return workplaces(state).some((row) =>
      row.organizationId === definition.organizationId && !(row.values?.[fieldId] ?? '').trim(),
    )
  }
  return entries(state).some((entry) =>
    entry.directoryId === definition.id && !(entry.values[fieldId] ?? '').trim(),
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
    if (!allowedKeys(field, ['id', 'label', 'required', 'archived', 'type', 'constraints'])) return { error: 'unknown_key' }
    const label = requiredText(field.label, 200)
    if (!label || typeof field.required !== 'boolean' || typeof field.archived !== 'boolean') return { error: 'invalid_value' }
    const id = typeof field.id === 'string' ? field.id : ''
    if (id.startsWith('new:')) {
      const parsedType = parseCatalogFieldType(field.type, 'text')
      if (parsedType == null) return { error: 'invalid_value' }
      const constraints = parseDirectoryConstraints(parsedType, field.constraints)
      if (constraints === 'invalid') return { error: 'invalid_value' }
      if (field.required && !field.archived && directoryHasRecords(state, definition)) return { error: 'required' }
      next.push({
        id: `df-${crypto.randomUUID()}`,
        key: 'custom',
        label,
        type: parsedType,
        required: field.required,
        archived: field.archived,
        ...(constraints ? { constraints } : {}),
      })
      continue
    }
    const current = definition.fields.find((entry) => entry.id === id)
    if (!current) return { error: 'unknown_field' }
    if (seen.has(current.id)) return { error: 'invalid_value' }
    seen.add(current.id)
    const protectedField = registry && current.key !== 'custom'
    if (protectedField && (field.archived !== current.archived || field.required !== current.required)) {
      return { error: 'system_field' }
    }
    if (!protectedField && field.archived && !current.archived && field.required && fieldHasValues(state, definition, current.id)) {
      return { error: 'invalid_value' }
    }
    const becomesRequired = !protectedField && field.required && !field.archived && (!current.required || current.archived)
    if (becomesRequired && recordsMissingValue(state, definition, current.id)) return { error: 'required' }
    if (!protectedField && field.type != null && field.type !== current.type) return { error: 'type_change_blocked' }
    const parsedType = protectedField ? current.type : (parseCatalogFieldType(field.type, current.type) ?? null)
    if (parsedType == null) return { error: 'invalid_value' }
    let nextConstraints = current.constraints
    if (!protectedField && field.constraints !== undefined) {
      const parsed = parseDirectoryConstraints(current.type, field.constraints)
      if (parsed === 'invalid') return { error: 'invalid_value' }
      nextConstraints = parsed
    }
    next.push(protectedField
      ? { ...current, label, required: current.required, archived: current.archived }
      : {
        ...current,
        label,
        required: field.required,
        archived: field.archived,
        type: current.type,
        ...(nextConstraints ? { constraints: nextConstraints } : {}),
      })
  }
  for (const current of definition.fields) {
    if (seen.has(current.id)) continue
    if (registry && current.key !== 'custom') return { error: 'system_field' }
    if (fieldHasValues(state, definition, current.id)) return { error: 'system_field' }
  }
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
