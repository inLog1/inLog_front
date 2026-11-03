import {
  COLUMN_FIO,
  COLUMN_STATE,
  IDENTITY_FIELD_KEYS,
  PERSONNEL_FIELD_TYPES,
  PERSONNEL_GROUPS,
  type DirectoryDefinition,
  type Employee,
  type PersonnelConfig,
  type PersonnelField,
  type PersonnelFieldType,
  type PersonnelGroup,
  type PersonnelPermissions,
  type PersonnelTab,
  type PersonnelValue,
} from '../../../entities/personnel/model/types'
import { externalIdentityClash, isCalendarDate, valueOccupied } from '../../../entities/personnel/model/rules'
import type { FlowResult } from '../auth/flow'
import type { MockState, MockUser } from '../db/types'
import { canCreateDirectoryRecord, directoryPermissions, findReference, referenceOptions } from './directories'
import { allowedKeys, allows, done, enter, problem, revisionOf } from './gate'

function configs(state: MockState): PersonnelConfig[] {
  return state.personnelConfigs ?? []
}

function employees(state: MockState): Employee[] {
  return state.employees ?? []
}

function configOf(state: MockState, organizationId: number): PersonnelConfig | null {
  return configs(state).find((item) => item.organizationId === organizationId) ?? null
}

export function personnelPermissions(state: MockState, userId: number, organizationId: number): PersonnelPermissions {
  return {
    create: allows(state, userId, organizationId, 'personnel', 'create'),
    update: allows(state, userId, organizationId, 'personnel', 'update'),
    archive: allows(state, userId, organizationId, 'personnel', 'archive'),
    structure: allows(state, userId, organizationId, 'personnel.structure', 'update'),
    account: allows(state, userId, organizationId, 'personnel.account', 'update'),
    users: allows(state, userId, organizationId, 'access-users', 'read'),
    roles: allows(state, userId, organizationId, 'roles', 'read'),
    directoriesUpdate: directoryPermissions(state, userId, organizationId).update,
  }
}

function workspaceReady(state: MockState, organizationId: number): boolean {
  return (state.organizationWorkspaces ?? []).some((item) => item.organizationId === organizationId) && configOf(state, organizationId) != null
}

function optionsFor(state: MockState, userId: number, config: PersonnelConfig) {
  const keys = [...new Set(config.fields.flatMap((field) => field.directoryKey ? [field.directoryKey] : []))]
  const options: Record<string, {
    directoryId: string
    title: string
    archived: boolean
    canAdd: boolean
    source: DirectoryDefinition['source']
    fields: DirectoryDefinition['fields']
    records: ReturnType<typeof referenceOptions>
  }> = {}
  for (const key of keys) {
    const definition = (state.directoryDefinitions ?? []).find((item) => item.organizationId === config.organizationId && item.key === key)
    if (!definition) continue
    options[key] = {
      directoryId: definition.id,
      title: definition.title,
      archived: definition.archived,
      canAdd: canCreateDirectoryRecord(state, userId, definition),
      source: definition.source,
      fields: definition.fields,
      records: referenceOptions(state, config.organizationId, key),
    }
  }
  return options
}

function configBody(state: MockState, userId: number, config: PersonnelConfig) {
  return {
    initialized: true,
    canInitialize: false,
    config,
    options: optionsFor(state, userId, config),
    permissions: personnelPermissions(state, userId, config.organizationId),
  }
}

export function readPersonnelConfig(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = enter(state, token, organizationId, 'personnel', 'read')
  if (!who.ok) return who.result
  const config = configOf(state, organizationId)
  if (!workspaceReady(state, organizationId) || !config) {
    return done(state, 200, {
      initialized: false,
      canInitialize: allows(state, who.user.id, organizationId, 'personnel.structure', 'update'),
      permissions: personnelPermissions(state, who.user.id, organizationId),
    })
  }
  return done(state, 200, configBody(state, who.user.id, config))
}

function isGroup(value: unknown): value is PersonnelGroup {
  return typeof value === 'string' && (PERSONNEL_GROUPS as readonly string[]).includes(value)
}

function isFieldType(value: unknown): value is PersonnelFieldType {
  return typeof value === 'string' && (PERSONNEL_FIELD_TYPES as readonly string[]).includes(value)
}

function identityKey(key: string): boolean {
  return (IDENTITY_FIELD_KEYS as readonly string[]).includes(key)
}

export function updatePersonnelConfig(
  state: MockState,
  token: string | null,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'personnel.structure', 'update')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'tabs', 'fields', 'columns'])) return problem(state, 400, 'unknown_key')
  const current = configOf(state, organizationId)
  if (!current) return problem(state, 404, 'workspace_missing')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  if (!Array.isArray(body.tabs) || !Array.isArray(body.fields) || !Array.isArray(body.columns)) return problem(state, 400, 'invalid_config')
  const tabs = parseTabs(current, body.tabs)
  if ('error' in tabs) return problem(state, 400, tabs.error)
  const fields = parseFields(state, current, tabs.tabs, body.fields)
  if ('error' in fields) return problem(state, 400, fields.error, fields.fieldId ? { fieldId: fields.fieldId } : undefined)
  const columns = parseColumns(fields.fields, body.columns)
  if ('error' in columns) return problem(state, 400, columns.error)
  const next: PersonnelConfig = {
    ...current,
    revision: current.revision + 1,
    tabs: tabs.tabs,
    fields: fields.fields,
    columns: columns.columns,
  }
  return done({
    ...state,
    personnelConfigs: configs(state).map((item) => item.organizationId === organizationId ? next : item),
  }, 200, configBody({
    ...state,
    personnelConfigs: configs(state).map((item) => item.organizationId === organizationId ? next : item),
  }, who.user.id, next))
}

function parseTabs(current: PersonnelConfig, raw: unknown[]): { tabs: PersonnelTab[] } | { error: string } {
  const tabs: PersonnelTab[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'invalid_config' }
    const tab = item as Record<string, unknown>
    if (!allowedKeys(tab, ['id', 'label', 'order'])) return { error: 'unknown_key' }
    if (typeof tab.label !== 'string' || !tab.label.trim() || tab.label.trim().length > 80) return { error: 'invalid_config' }
    if (typeof tab.order !== 'number' || !Number.isInteger(tab.order)) return { error: 'invalid_config' }
    const id = typeof tab.id === 'string' ? tab.id : ''
    if (id.startsWith('new:')) {
      tabs.push({ id: `tab-${crypto.randomUUID()}`, label: tab.label.trim(), order: tab.order, system: false })
      continue
    }
    const previous = current.tabs.find((entry) => entry.id === id)
    if (!previous || seen.has(previous.id)) return { error: 'invalid_config' }
    seen.add(previous.id)
    tabs.push({ ...previous, label: tab.label.trim(), order: tab.order })
  }
  if (!current.tabs.filter((tab) => tab.system).every((tab) => seen.has(tab.id))) return { error: 'system_field' }
  return { tabs }
}

function parseFields(
  state: MockState,
  current: PersonnelConfig,
  tabs: PersonnelTab[],
  raw: unknown[],
): { fields: PersonnelField[] } | { error: string; fieldId?: string } {
  const fields: PersonnelField[] = []
  const seen = new Set<string>()
  const tabIds = new Set(tabs.map((tab) => tab.id))
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'invalid_config' }
    const field = item as Record<string, unknown>
    if (!allowedKeys(field, ['id', 'label', 'tabId', 'group', 'type', 'directoryKey', 'required', 'visible', 'archived', 'order'])) {
      return { error: 'unknown_key' }
    }
    if (typeof field.label !== 'string' || !field.label.trim() || field.label.trim().length > 120) return { error: 'invalid_config' }
    if (typeof field.tabId !== 'string' || !tabIds.has(field.tabId)) return { error: 'invalid_config' }
    if (!isGroup(field.group) || !isFieldType(field.type)) return { error: 'invalid_config' }
    if (typeof field.required !== 'boolean' || typeof field.visible !== 'boolean' || typeof field.archived !== 'boolean') {
      return { error: 'invalid_config' }
    }
    if (typeof field.order !== 'number' || !Number.isInteger(field.order)) return { error: 'invalid_config' }
    if (field.required && (!field.visible || field.archived)) return { error: 'invalid_config' }
    const directoryKey = field.directoryKey == null ? null : field.directoryKey
    if (directoryKey != null && typeof directoryKey !== 'string') return { error: 'invalid_config' }
    if (field.type === 'directory') {
      const definition = (state.directoryDefinitions ?? []).find((entry) => entry.organizationId === current.organizationId && entry.key === directoryKey)
      if (!definition) return { error: 'invalid_config' }
    } else if (directoryKey != null) return { error: 'invalid_config' }
    const id = typeof field.id === 'string' ? field.id : ''
    if (id.startsWith('new:')) {
      fields.push({
        id: `pf:${current.organizationId}:custom:${crypto.randomUUID()}`,
        key: 'custom',
        label: field.label.trim(),
        tabId: field.tabId,
        group: field.group,
        type: field.type,
        directoryKey,
        required: field.required,
        visible: field.visible,
        system: false,
        archived: field.archived,
        order: field.order,
        sourceOwned: false,
      })
      continue
    }
    const previous = current.fields.find((entry) => entry.id === id)
    if (!previous || seen.has(previous.id)) return { error: 'unknown_field' }
    seen.add(previous.id)
    if (previous.system && (previous.type !== field.type || previous.directoryKey !== directoryKey)) {
      return { error: 'system_field', fieldId: previous.id }
    }
    if (identityKey(previous.key) && (!field.visible || !field.required || field.archived)) {
      return { error: 'system_field', fieldId: previous.id }
    }
    if (!previous.system && (previous.type !== field.type || previous.directoryKey !== directoryKey) && employees(state).some((employee) =>
      employee.organizationId === current.organizationId && valueOccupied(employee.values[previous.id]),
    )) return { error: 'type_change_blocked', fieldId: previous.id }
    fields.push({
      ...previous,
      label: field.label.trim(),
      tabId: field.tabId,
      group: field.group,
      type: previous.system ? previous.type : field.type,
      directoryKey: previous.system ? previous.directoryKey : directoryKey,
      required: field.required,
      visible: field.visible,
      archived: field.archived,
      order: field.order,
    })
  }
  for (const previous of current.fields) {
    if (previous.system && !seen.has(previous.id)) return { error: 'system_field', fieldId: previous.id }
  }
  return { fields }
}

function parseColumns(fields: PersonnelField[], raw: unknown[]): { columns: string[] } | { error: string } {
  if (!raw.includes(COLUMN_FIO) || !raw.includes(COLUMN_STATE)) return { error: 'system_field' }
  const allowed = new Set(fields.filter((field) => field.visible && !field.archived).map((field) => field.id))
  allowed.add(COLUMN_FIO)
  allowed.add(COLUMN_STATE)
  const columns: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item) || columns.includes(item)) return { error: 'invalid_config' }
    columns.push(item)
  }
  return { columns }
}

function accountOf(state: MockState, userId: number | null) {
  if (userId == null) return null
  const user = state.users.find((item) => item.id === userId)
  if (!user) return null
  const name = [user.surname, user.name, user.patronymic].filter((part) => part.trim()).join(' ')
  return { id: user.id, email: user.email, name }
}

export function assignedRoles(state: MockState, userId: number | null, organizationId: number) {
  return rolesOf(state, userId, organizationId)
}

function rolesOf(state: MockState, userId: number | null, organizationId: number) {
  if (userId == null) return []
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization) return []
  const assigned = state.assignments.filter((item) => {
    if (item.userId !== userId) return false
    if (item.scope.type === 'organization') return item.scope.organizationId === organizationId
    if (item.scope.type === 'project') return item.scope.organizationId === organizationId
    return item.scope.type === 'corporation' && item.scope.corporationId === organization.corporationId
  })
  return assigned.flatMap((item) => {
    const role = state.roles.find((entry) => entry.id === item.roleId)
    return role ? [{ id: role.id, displayName: role.displayName, assignmentId: item.id }] : []
  })
}

function referencesOf(state: MockState, config: PersonnelConfig, employee: Employee) {
  const references: Record<string, { id: string; label: string; archived: boolean; missing: boolean }> = {}
  for (const field of config.fields) {
    if (field.type !== 'directory') continue
    const value = employee.values[field.id]
    if (typeof value !== 'string' || !value) continue
    const found = findReference(state, employee.organizationId, field.directoryKey, value)
    references[field.id] = found
      ? { id: found.id, label: found.label, archived: found.archived, missing: false }
      : { id: value, label: '', archived: false, missing: true }
  }
  return references
}

function presentEmployee(state: MockState, viewerId: number, config: PersonnelConfig, employee: Employee) {
  const permissions = personnelPermissions(state, viewerId, employee.organizationId)
  return {
    id: employee.id,
    organizationId: employee.organizationId,
    revision: employee.revision,
    archived: employee.archived,
    source: employee.source,
    sourceId: employee.sourceId,
    externalId: employee.externalId,
    accountVisible: permissions.users,
    account: permissions.users ? accountOf(state, employee.accountId) : null,
    roles: permissions.roles ? rolesOf(state, employee.accountId, employee.organizationId) : null,
    values: employee.values,
    references: referencesOf(state, config, employee),
    permissions,
  }
}

function fio(config: PersonnelConfig, employee: Employee): string {
  const parts = ['last-name', 'first-name', 'patronymic'].map((key) => textFieldValue(config, employee, key)).filter(Boolean)
  return parts.join(' ')
}

function textFieldValue(config: PersonnelConfig, employee: Employee, key: string): string {
  const field = config.fields.find((item) => item.key === key)
  const value = field ? employee.values[field.id] : null
  return typeof value === 'string' ? value.trim() : ''
}

function directoryFact(
  state: MockState,
  config: PersonnelConfig,
  employee: Employee,
  key: string,
): { id: string; label: string } {
  const field = config.fields.find((item) => item.key === key)
  const id = textFieldValue(config, employee, key)
  if (!field || !id) return { id: '', label: '' }
  const found = findReference(state, employee.organizationId, field.directoryKey, id)
  return { id, label: found?.label ?? '' }
}

function employeeSummary(state: MockState, config: PersonnelConfig, employee: Employee) {
  const position = directoryFact(state, config, employee, 'position')
  const department = directoryFact(state, config, employee, 'department')
  const qualification = directoryFact(state, config, employee, 'qualification-status')
  return {
    name: fio(config, employee),
    email: textFieldValue(config, employee, 'email'),
    personnelNumber: textFieldValue(config, employee, 'personnel-number'),
    position: position.label,
    positionId: position.id,
    department: department.label,
    departmentId: department.id,
    qualification: qualification.label,
    qualificationId: qualification.id,
    certificationUntil: textFieldValue(config, employee, 'certification-until'),
  }
}

function listItem(state: MockState, config: PersonnelConfig, employee: Employee) {
  const cells: Record<string, string> = {}
  const marks: Record<string, 'archived' | 'missing' | null> = {}
  for (const columnId of config.columns) {
    if (columnId === COLUMN_FIO) {
      cells[columnId] = fio(config, employee)
      marks[columnId] = null
      continue
    }
    if (columnId === COLUMN_STATE) {
      cells[columnId] = employee.archived ? 'archived' : 'active'
      marks[columnId] = null
      continue
    }
    const field = config.fields.find((item) => item.id === columnId)
    const value = field ? employee.values[field.id] : null
    if (field?.type === 'directory' && typeof value === 'string' && value) {
      const found = findReference(state, employee.organizationId, field.directoryKey, value)
      cells[columnId] = found?.label ?? ''
      marks[columnId] = found ? (found.archived ? 'archived' : null) : 'missing'
      continue
    }
    if (typeof value === 'boolean') cells[columnId] = value ? 'true' : 'false'
    else cells[columnId] = value == null ? '' : String(value)
    marks[columnId] = null
  }
  return {
    id: employee.id,
    revision: employee.revision,
    archived: employee.archived,
    cells,
    marks,
    summary: employeeSummary(state, config, employee),
  }
}

export function listEmployees(
  state: MockState,
  token: string | null,
  organizationId: number,
  archived: boolean,
  query: string,
): FlowResult {
  const who = enter(state, token, organizationId, 'personnel', 'read')
  if (!who.ok) return who.result
  const config = configOf(state, organizationId)
  if (!config) {
    return done(state, 200, {
      initialized: false,
      employees: [],
      columns: [],
      permissions: personnelPermissions(state, who.user.id, organizationId),
    })
  }
  const needle = query.trim().toLowerCase()
  const rows = employees(state).filter((employee) => {
    if (employee.organizationId !== organizationId || employee.archived !== archived) return false
    if (!needle) return true
    const haystack = ['last-name', 'first-name', 'patronymic', 'email', 'personnel-number'].map((key) => {
      const field = config.fields.find((item) => item.key === key)
      const value = field ? employee.values[field.id] : ''
      return typeof value === 'string' ? value : ''
    }).join(' ').toLowerCase()
    return haystack.includes(needle)
  })
  return done(state, 200, {
    initialized: true,
    columns: config.columns,
    fields: config.fields,
    employees: rows.map((employee) => listItem(state, config, employee)),
    permissions: personnelPermissions(state, who.user.id, organizationId),
  })
}

export function readEmployee(state: MockState, token: string | null, organizationId: number, employeeId: string): FlowResult {
  const who = enter(state, token, organizationId, 'personnel', 'read')
  if (!who.ok) return who.result
  const config = configOf(state, organizationId)
  const employee = employees(state).find((item) => item.id === employeeId && item.organizationId === organizationId)
  if (!config || !employee) return problem(state, 404, 'not_found')
  return done(state, 200, {
    employee: presentEmployee(state, who.user.id, config, employee),
    config,
    options: optionsFor(state, who.user.id, config),
  })
}

function sameValue(left: PersonnelValue | undefined, right: PersonnelValue): boolean {
  return (left ?? null) === right
}

function normalizeValue(field: PersonnelField, raw: unknown): { value: PersonnelValue } | { error: string } {
  if (raw == null || raw === '') {
    return { value: field.type === 'checkbox' ? false : null }
  }
  if (field.type === 'text' || field.type === 'textarea' || field.type === 'directory') {
    if (typeof raw !== 'string') return { error: 'invalid_value' }
    const trimmed = raw.trim()
    const max = field.type === 'textarea' ? 4000 : 300
    if (trimmed.length > max) return { error: 'invalid_value' }
    if (field.key === 'email' && trimmed && (!trimmed.includes('@') || /\s/.test(trimmed))) return { error: 'invalid_value' }
    return { value: trimmed || null }
  }
  if (field.type === 'number') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: 'invalid_value' }
    return { value: raw }
  }
  if (field.type === 'date') {
    if (typeof raw !== 'string' || !isCalendarDate(raw)) return { error: 'invalid_value' }
    return { value: raw }
  }
  if (field.type === 'checkbox') {
    if (typeof raw !== 'boolean') return { error: 'invalid_value' }
    return { value: raw }
  }
  return { error: 'invalid_value' }
}

function applyValues(
  state: MockState,
  config: PersonnelConfig,
  employee: Pick<Employee, 'organizationId' | 'source' | 'values'> & { id?: string },
  raw: unknown,
): { values: Record<string, PersonnelValue> } | { error: string; fieldId?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'invalid_value' }
  const input = raw as Record<string, unknown>
  const known = new Map(config.fields.map((field) => [field.id, field]))
  for (const key of Object.keys(input)) {
    if (!known.has(key)) return { error: 'unknown_field', fieldId: key }
  }
  const values: Record<string, PersonnelValue> = { ...employee.values }
  for (const [id, field] of known) {
    if (!(id in input)) continue
    const parsed = normalizeValue(field, input[id])
    if ('error' in parsed) return { error: parsed.error, fieldId: id }
    if ((field.archived || !field.visible) && !sameValue(employee.values[id], parsed.value)) {
      return { error: 'invalid_value', fieldId: id }
    }
    if (employee.source === 'integration' && field.sourceOwned && !sameValue(employee.values[id], parsed.value)) {
      return { error: 'source_owned', fieldId: id }
    }
    if (field.type === 'directory' && typeof parsed.value === 'string' && parsed.value && employee.values[id] !== parsed.value) {
      const found = findReference(state, employee.organizationId, field.directoryKey, parsed.value)
      if (!found) return { error: 'not_found', fieldId: id }
      const definition = (state.directoryDefinitions ?? []).find((item) => item.organizationId === employee.organizationId && item.key === field.directoryKey)
      if (found.archived || definition?.archived) return { error: 'archived_value', fieldId: id }
    }
    values[id] = parsed.value
  }
  for (const field of config.fields) {
    if (!field.required || !field.visible || field.archived) continue
    const value = values[field.id] ?? null
    if (field.type === 'checkbox') {
      if (value !== true) return { error: 'required', fieldId: field.id }
      continue
    }
    if (!valueOccupied(value)) return { error: 'required', fieldId: field.id }
  }
  const duplicate = duplicatePersonnelNumber(state, config, employee, values)
  if (duplicate) return duplicate
  const workplace = workplaceDepartment(state, config, employee.organizationId, values)
  if (workplace) return workplace
  return { values }
}

function duplicatePersonnelNumber(
  state: MockState,
  config: PersonnelConfig,
  employee: { id?: string; organizationId: number },
  values: Record<string, PersonnelValue>,
): { error: string; fieldId: string } | null {
  const field = config.fields.find((item) => item.key === 'personnel-number' && item.visible && !item.archived)
  if (!field) return null
  const value = values[field.id]
  if (typeof value !== 'string') return null
  const needle = value.trim().toLowerCase()
  if (!needle) return null
  const taken = employees(state).some((item) => {
    if (item.organizationId !== employee.organizationId || item.archived) return false
    if (employee.id && item.id === employee.id) return false
    const current = item.values[field.id]
    return typeof current === 'string' && current.trim().toLowerCase() === needle
  })
  return taken ? { error: 'duplicate_value', fieldId: field.id } : null
}

function workplaceDepartment(
  state: MockState,
  config: PersonnelConfig,
  organizationId: number,
  values: Record<string, PersonnelValue>,
): { error: string; fieldId: string } | null {
  const field = config.fields.find((item) => item.key === 'workplace' && item.visible && !item.archived)
  if (!field) return null
  const workplaceId = values[field.id]
  if (typeof workplaceId !== 'string' || !workplaceId) return null
  const workplace = (state.workplaces ?? []).find((item) => item.id === workplaceId && item.organizationId === organizationId)
  if (!workplace) return { error: 'not_found', fieldId: field.id }
  if (!workplace.departmentId) return null
  const departmentField = config.fields.find((item) => item.key === 'department')
  const departmentId = departmentField && typeof values[departmentField.id] === 'string' ? values[departmentField.id] : ''
  if (!departmentId || workplace.departmentId === departmentId) return null
  return { error: 'workplace_department', fieldId: field.id }
  return null
}

/** Inserts a card. Manual HTTP creation always uses source manual and an empty external id. */
export function insertEmployee(state: MockState, employee: Employee): { state: MockState } | { error: 'external_id_taken' } {
  if (externalIdentityClash(employees(state), employee)) return { error: 'external_id_taken' }
  return { state: { ...state, employees: [...employees(state), employee] } }
}

export function createEmployee(state: MockState, token: string | null, body: Record<string, unknown>): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'personnel', 'create')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'values'])) return problem(state, 400, 'unknown_key')
  const config = configOf(state, organizationId)
  if (!config) return problem(state, 404, 'workspace_missing')
  const draft: Employee = {
    id: `emp-${crypto.randomUUID()}`,
    organizationId,
    accountId: null,
    revision: 1,
    archived: false,
    source: 'manual',
    sourceId: null,
    externalId: null,
    values: {},
  }
  const applied = applyValues(state, config, draft, body.values)
  if ('error' in applied) return problem(state, 400, applied.error, applied.fieldId ? { fieldId: applied.fieldId } : undefined)
  draft.values = applied.values
  const saved = insertEmployee(state, draft)
  if ('error' in saved) return problem(state, 409, saved.error)
  return done(saved.state, 201, { employee: presentEmployee(saved.state, who.user.id, config, draft) })
}

export function updateEmployee(
  state: MockState,
  token: string | null,
  employeeId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'personnel', 'update')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'values'])) return problem(state, 400, 'unknown_key')
  const config = configOf(state, organizationId)
  const current = employees(state).find((item) => item.id === employeeId && item.organizationId === organizationId)
  if (!config || !current) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  const applied = applyValues(state, config, current, body.values)
  if ('error' in applied) return problem(state, 400, applied.error, applied.fieldId ? { fieldId: applied.fieldId } : undefined)
  const next: Employee = { ...current, values: applied.values, revision: current.revision + 1 }
  const saved = { ...state, employees: employees(state).map((item) => item.id === current.id ? next : item) }
  return done(saved, 200, { employee: presentEmployee(saved, who.user.id, config, next) })
}

function activeAccountTaken(state: MockState, organizationId: number, accountId: number, exceptEmployeeId: string): boolean {
  return employees(state).some((item) =>
    item.id !== exceptEmployeeId
    && item.organizationId === organizationId
    && !item.archived
    && item.accountId === accountId,
  )
}

export function archiveEmployee(
  state: MockState,
  token: string | null,
  employeeId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'personnel', 'archive')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'archived'])) return problem(state, 400, 'unknown_key')
  if (typeof body.archived !== 'boolean') return problem(state, 400, 'invalid_value')
  const config = configOf(state, organizationId)
  const current = employees(state).find((item) => item.id === employeeId && item.organizationId === organizationId)
  if (!config || !current) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  if (!body.archived && current.accountId != null && activeAccountTaken(state, organizationId, current.accountId, current.id)) {
    return problem(state, 409, 'account_taken')
  }
  const next: Employee = { ...current, archived: body.archived, revision: current.revision + 1 }
  const saved = { ...state, employees: employees(state).map((item) => item.id === current.id ? next : item) }
  return done(saved, 200, { employee: presentEmployee(saved, who.user.id, config, next) })
}

export function linkEmployeeAccount(
  state: MockState,
  token: string | null,
  employeeId: string,
  body: Record<string, unknown>,
): FlowResult {
  const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
  const who = enter(state, token, organizationId, 'personnel.account', 'update')
  if (!who.ok) return who.result
  if (!allowedKeys(body, ['organizationId', 'expectedRevision', 'accountId'])) return problem(state, 400, 'unknown_key')
  const config = configOf(state, organizationId)
  const current = employees(state).find((item) => item.id === employeeId && item.organizationId === organizationId)
  if (!config || !current) return problem(state, 404, 'not_found')
  const expected = revisionOf(body.expectedRevision)
  if (expected == null) return problem(state, 400, 'invalid_version')
  if (current.revision !== expected) return problem(state, 409, 'stale_write')
  const accountId = body.accountId == null ? null : body.accountId
  if (accountId != null && (typeof accountId !== 'number' || !Number.isInteger(accountId))) return problem(state, 400, 'invalid_value')
  if (accountId != null) {
    const user = state.users.find((item) => item.id === accountId)
    const member = state.memberships.some((item) => item.userId === accountId && item.organizationId === organizationId)
    if (!user || user.status !== 'active' || !member) return problem(state, 400, 'account_unavailable')
    if (!current.archived && activeAccountTaken(state, organizationId, accountId, current.id)) return problem(state, 409, 'account_taken')
  }
  const next: Employee = { ...current, accountId, revision: current.revision + 1 }
  const saved = { ...state, employees: employees(state).map((item) => item.id === current.id ? next : item) }
  if (saved.memberships !== state.memberships || saved.assignments !== state.assignments || saved.users !== state.users) {
    return problem(state, 500, 'empty')
  }
  return done(saved, 200, { employee: presentEmployee(saved, who.user.id, config, next) })
}

export function listLinkableAccounts(state: MockState, token: string | null, organizationId: number): FlowResult {
  const who = enter(state, token, organizationId, 'access-users', 'read')
  if (!who.ok) return who.result
  if (!allows(state, who.user.id, organizationId, 'personnel.account', 'update') && !allows(state, who.user.id, organizationId, 'personnel', 'read')) {
    return problem(state, 403, 'forbidden')
  }
  const accounts = state.memberships
    .filter((item) => item.organizationId === organizationId)
    .flatMap((item) => {
      const user = state.users.find((entry) => entry.id === item.userId && entry.status === 'active')
      if (!user) return []
      const name = [user.surname, user.name, user.patronymic].filter((part) => part.trim()).join(' ')
      return [{ id: user.id, email: user.email, name }]
    })
  return done(state, 200, { accounts })
}

export function memberUser(state: MockState, organizationId: number, userId: number): MockUser | null {
  const user = state.users.find((item) => item.id === userId && item.status === 'active')
  if (!user) return null
  return state.memberships.some((item) => item.userId === userId && item.organizationId === organizationId) ? user : null
}
