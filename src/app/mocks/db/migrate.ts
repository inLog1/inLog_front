import { migrateCreatedAtFilters } from '../../../entities/table-view/model/created-at'
import { taskFixturesForProjects } from '../tasks/fixtures'
import { FORM_GRANT_DEFINITIONS } from './form-grants'
import { SECTION_GRANT_DEFINITIONS } from './section-grants'
import { TABLE_VIEW_GRANT_DEFINITIONS } from './table-view-grants'
import { MOCK_SCHEMA_VERSION } from './constants'
import type { MockState } from './types'
import type { AccessRole } from '../../../entities/access/model/types'

/**
 * Document versions this build can open.
 * IndexedDB's own version stays at MOCK_DB_VERSION and is not a document version.
 * Version 1 is the snapshot from before delegationGrantIds was stored.
 * Version 2 has no task catalog. Missing task arrays are filled once.
 * Version 3 has no constructor arrays. Missing arrays are added empty once.
 * Version 4 has no access audit. An empty audit is added once.
 * Version 5 has no form collections. Empty collections are added once.
 * Version 6 has no table views. An empty tableViews array is added once.
 * Version 7 has table views and no section collections. Version 8 adds those collections empty.
 * A created-at filter stored as a bare calendar day is rewritten to an explicit UTC day.
 * Other created-at strings stay exact timestamp comparisons.
 * Missing form, table-view and section catalog rows are added so the editor can offer them.
 * Role grant lists already stored are not extended. ownerScope is not filled in.
 */
export function migrateMockDocument(record: MockState): { state: MockState; changed: boolean } | null {
  if (!Number.isInteger(record.schemaVersion) || record.schemaVersion < 1 || record.schemaVersion > MOCK_SCHEMA_VERSION) {
    return null
  }
  if (!Array.isArray(record.roles) || !Array.isArray(record.users)) return null

  let rolesChanged = false
  const roles = record.roles.map((role) => normalizeRole(role, () => {
    rolesChanged = true
  }))
  const recordRevision = typeof record.recordRevision === 'number' ? record.recordRevision : 0
  const revisionChanged = record.recordRevision !== recordRevision
  const versionChanged = record.schemaVersion !== MOCK_SCHEMA_VERSION
  const withTasks = ensureTaskCatalog(record)
  const tasksChanged = withTasks !== record
  const withConstructor = ensureConstructorCatalog(withTasks)
  const constructorChanged = withConstructor !== withTasks
  const withAudit = ensureAccessAudit(withConstructor)
  const auditChanged = withAudit !== withConstructor
  const withForms = ensureFormCatalog(withAudit)
  const formsChanged = withForms !== withAudit
  const withViews = ensureTableViews(withForms)
  const viewsChanged = withViews !== withForms
  const withDays = migrateStoredCreatedAtDays(withViews)
  const daysChanged = withDays !== withViews
  const withSections = ensureSections(withDays)
  const sectionsChanged = withSections !== withDays
  if (!rolesChanged && !revisionChanged && !versionChanged && !tasksChanged && !constructorChanged && !auditChanged && !formsChanged && !viewsChanged && !daysChanged && !sectionsChanged) {
    return { state: record, changed: false }
  }
  return {
    changed: true,
    state: {
      ...withSections,
      schemaVersion: MOCK_SCHEMA_VERSION,
      recordRevision,
      roles,
    },
  }
}

function migrateStoredCreatedAtDays(record: MockState): MockState {
  if (!Array.isArray(record.tableViews)) return record
  let changed = false
  const tableViews = record.tableViews.map((view) => {
    if (!Array.isArray(view.filters)) return view
    const rewritten = migrateCreatedAtFilters(view.filters)
    if (!rewritten.changed) return view
    changed = true
    return { ...view, filters: rewritten.filters }
  })
  if (!changed) return record
  return { ...record, tableViews }
}

function ensureSections(record: MockState): MockState {
  const source = record as MockState & {
    sections?: unknown
    sectionDrafts?: unknown
    sectionVersions?: unknown
  }
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let grantsChanged = false
  for (const definition of SECTION_GRANT_DEFINITIONS) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      grantsChanged = true
    }
  }
  const missing = !Array.isArray(source.sections)
    || !Array.isArray(source.sectionDrafts)
    || !Array.isArray(source.sectionVersions)
  if (!missing && !grantsChanged) return record
  return {
    ...record,
    grants,
    sections: Array.isArray(source.sections) ? source.sections : [],
    sectionDrafts: Array.isArray(source.sectionDrafts) ? source.sectionDrafts : [],
    sectionVersions: Array.isArray(source.sectionVersions) ? source.sectionVersions : [],
  }
}

function ensureFormCatalog(record: MockState): MockState {
  const source = record as MockState & {
    forms?: unknown
    formDrafts?: unknown
    formVersions?: unknown
    formRecords?: unknown
  }
  const arraysMissing = !Array.isArray(source.forms)
    || !Array.isArray(source.formDrafts)
    || !Array.isArray(source.formVersions)
    || !Array.isArray(source.formRecords)
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let grantsChanged = false
  for (const definition of FORM_GRANT_DEFINITIONS) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      grantsChanged = true
    }
  }
  if (!arraysMissing && !grantsChanged) return record
  return {
    ...record,
    grants,
    forms: Array.isArray(source.forms) ? source.forms : [],
    formDrafts: Array.isArray(source.formDrafts) ? source.formDrafts : [],
    formVersions: Array.isArray(source.formVersions) ? source.formVersions : [],
    formRecords: Array.isArray(source.formRecords) ? source.formRecords : [],
  }
}

function ensureTableViews(record: MockState): MockState {
  const source = record as MockState & { tableViews?: unknown }
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let grantsChanged = false
  for (const definition of TABLE_VIEW_GRANT_DEFINITIONS) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      grantsChanged = true
    }
  }
  const missing = !Array.isArray(source.tableViews)
  if (!missing && !grantsChanged) return record
  return {
    ...record,
    grants,
    tableViews: Array.isArray(source.tableViews) ? source.tableViews : [],
  }
}

function ensureAccessAudit(record: MockState): MockState {
  if (Array.isArray(record.accessAudit)) return record
  return { ...record, accessAudit: [] }
}

function ensureConstructorCatalog(record: MockState): MockState {
  const source = record as MockState & {
    constructorNodes?: unknown
    constructorTabs?: unknown
    constructorFields?: unknown
    constructorRecords?: unknown
    notifications?: unknown
  }
  const missing = !Array.isArray(source.constructorNodes)
    || !Array.isArray(source.constructorTabs)
    || !Array.isArray(source.constructorFields)
    || !Array.isArray(source.constructorRecords)
    || !Array.isArray(source.notifications)
  if (!missing) return record
  return {
    ...record,
    constructorNodes: Array.isArray(source.constructorNodes) ? source.constructorNodes : [],
    constructorTabs: Array.isArray(source.constructorTabs) ? source.constructorTabs : [],
    constructorFields: Array.isArray(source.constructorFields) ? source.constructorFields : [],
    constructorRecords: Array.isArray(source.constructorRecords) ? source.constructorRecords : [],
    notifications: Array.isArray(source.notifications) ? source.notifications : [],
  }
}

function ensureTaskCatalog(record: MockState): MockState {
  const source = record as MockState & {
    tasks?: unknown
    taskStatuses?: unknown
    taskTags?: unknown
    taskComments?: unknown
    taskFiles?: unknown
  }
  const missing = !Array.isArray(source.tasks)
    || !Array.isArray(source.taskStatuses)
    || !Array.isArray(source.taskTags)
    || !Array.isArray(source.taskComments)
    || !Array.isArray(source.taskFiles)
  if (!missing) return record
  const projectIds = Array.isArray(record.projects) ? record.projects.map((project) => project.id) : []
  const catalog = taskFixturesForProjects(projectIds)
  return {
    ...record,
    tasks: Array.isArray(source.tasks) ? source.tasks : catalog.tasks,
    taskStatuses: Array.isArray(source.taskStatuses) ? source.taskStatuses : catalog.taskStatuses,
    taskTags: Array.isArray(source.taskTags) ? source.taskTags : catalog.taskTags,
    taskComments: Array.isArray(source.taskComments) ? source.taskComments : catalog.taskComments,
    taskFiles: Array.isArray(source.taskFiles) ? source.taskFiles : catalog.taskFiles,
  }
}

function normalizeRole(role: AccessRole, onChange: () => void): AccessRole {
  if (role && Array.isArray(role.delegationGrantIds)) return role
  onChange()
  const next: AccessRole = { ...role, delegationGrantIds: [] }
  return next
}
