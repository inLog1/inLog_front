import { draftFromRecord } from '../../../entities/request/model/draft'
import { migrateCreatedAtFilters } from '../../../entities/table-view/model/created-at'
import { taskFixturesForProjects } from '../tasks/fixtures'
import { FORM_GRANT_DEFINITIONS } from './form-grants'
import { ROLE_GRANT_DEFINITIONS } from './role-grants'
import { SECTION_GRANT_DEFINITIONS } from './section-grants'
import { TABLE_VIEW_GRANT_DEFINITIONS } from './table-view-grants'
import { MOCK_SCHEMA_VERSION } from './constants'
import { DIRECTORY_CATALOG_GRANTS } from './organization-grants'
import { PERSONNEL_GRANT_DEFINITIONS } from './personnel-grants'
import { REGISTRY_GRANT_DEFINITIONS } from './registry-grants'
import { REQUEST_GRANT_DEFINITIONS } from './request-grants'
import { ensureOrganizationWorkspaces } from '../personnel/workspace'
import { withResidentUsers } from './resident-users'
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
 * Version 9 records the installation corporation, local password verifiers and the simulated directory.
 * Those collections start empty. Existing users without a verifier flag keep the demonstration password.
 * Organization and project catalog rows are added, including read and update.
 * Stored role grant lists are not extended. A missing organization or project revision becomes 1.
 * A created-at filter stored as a bare calendar day is rewritten to an explicit UTC day.
 * Other created-at strings stay exact timestamp comparisons.
 * Missing form, table-view, section and role-administration catalog rows are added so the editor can offer them.
 * Role grant lists already stored are not extended. ownerScope is not filled in.
 * Version 10 adds empty personnel collections and the personnel grant rows.
 * Organizations that have no workspace row receive the starter once. Existing workspace rows,
 * edited records and stored role grant lists are left as they are. Role origin is not invented.
 * A ready personal installation also receives the resident accounts when their emails are absent.
 * Those accounts have no grants. Other namespaces are not extended.
 * Version 11 adds the system-registry grant rows for departments and workplaces.
 * Stored role grant lists are not extended. directories.* stays on manual directories only.
 * Version 12 does not add a role field and does not rewrite ownerScope.
 * A missing ownerScope stays missing. Stored role ids, grant lists and assignments stay as they are.
 * Version 13 recognizes an optional organizationIds list on a local role.
 * The list is not invented for older roles. A missing list still means ownerScope alone.
 * Version 14 adds the request grant rows that were not already stored.
 * requests.read and requests.create keep their existing ids. Stored role grant lists are not extended.
 * The requests collection is not invented and serviceRequests is left in place.
 * Version 15 normalizes request details that were saved before fields and needs existed.
 * Records without details stay without details. Request revision, parties and title stay as stored.
 * Running the migration again does not append a second copy of a derived field or need.
 * Programme grants are added only to a role that already holds the full filing set or the full review set.
 * A role that was stored without that set is left unchanged. Employees do not receive the grants.
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
  const withRoleGrants = ensureRoleAdminGrants(withSections)
  const roleGrantsChanged = withRoleGrants !== withSections
  const withInstallation = ensureInstallationRecord(withRoleGrants)
  const installationChanged = withInstallation !== withRoleGrants
  const withRevisions = ensureDirectoryRevisions(withInstallation)
  const revisionsChanged = withRevisions !== withInstallation
  const withPersonnel = ensurePersonnelCatalog(withRevisions)
  const personnelChanged = withPersonnel !== withRevisions
  const withResidents = withResidentUsers(withPersonnel)
  const residentsChanged = withResidents !== withPersonnel
  const withRequests = ensureRequestGrants(withResidents)
  const requestsChanged = withRequests !== withResidents
  const withRequestBodies = migrateStoredRequestDetails(withRequests)
  const requestBodiesChanged = withRequestBodies !== withRequests
  const withRequestFiles = ensureRequestStorage(withRequestBodies)
  const requestFilesChanged = withRequestFiles !== withRequestBodies
  const programRoles = attachRequestProgramGrants(roles)
  const programRolesChanged = programRoles.changed
  if (!rolesChanged && !revisionChanged && !versionChanged && !tasksChanged && !constructorChanged && !auditChanged && !formsChanged && !viewsChanged && !daysChanged && !sectionsChanged && !roleGrantsChanged && !installationChanged && !revisionsChanged && !personnelChanged && !residentsChanged && !requestsChanged && !requestBodiesChanged && !requestFilesChanged && !programRolesChanged) {
    return { state: record, changed: false }
  }
  return {
    changed: true,
    state: {
      ...withRequestFiles,
      schemaVersion: MOCK_SCHEMA_VERSION,
      recordRevision,
      roles: programRoles.roles,
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

function ensureDirectoryRevisions(record: MockState): MockState {
  const organizations = Array.isArray(record.organizations) ? record.organizations : []
  const projects = Array.isArray(record.projects) ? record.projects : []
  let changed = false
  const nextOrganizations = organizations.map((organization) => {
    if (typeof organization.revision === 'number' && organization.revision > 0) return organization
    changed = true
    return { ...organization, revision: 1 }
  })
  const nextProjects = projects.map((project) => {
    if (typeof project.revision === 'number' && project.revision > 0) return project
    changed = true
    return { ...project, revision: 1 }
  })
  if (!changed) return record
  return { ...record, organizations: nextOrganizations, projects: nextProjects }
}

function ensureInstallationRecord(record: MockState): MockState {
  const source = record as MockState & {
    localCredentials?: unknown
    directoryEmployees?: unknown
    installationCorporationId?: unknown
  }
  const users = record.users.map((user) => (
    typeof user.fixturePassword === 'boolean' ? user : { ...user, fixturePassword: true }
  ))
  const usersChanged = users.some((user, index) => user !== record.users[index])
  const credentialsMissing = !Array.isArray(source.localCredentials)
  const directoryMissing = !Array.isArray(source.directoryEmployees)
  const identityMissing = source.installationCorporationId === undefined
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  const catalogGrants = DIRECTORY_CATALOG_GRANTS
  let grantsChanged = false
  for (const definition of catalogGrants) {
    if (grants.some((grant) => grant.id === definition.id)) continue
    grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
    grantsChanged = true
  }
  if (!usersChanged && !credentialsMissing && !directoryMissing && !identityMissing && !grantsChanged) return record
  return {
    ...record,
    users,
    grants,
    localCredentials: Array.isArray(source.localCredentials) ? source.localCredentials : [],
    directoryEmployees: Array.isArray(source.directoryEmployees) ? source.directoryEmployees : [],
    installationCorporationId: identityMissing ? derivedInstallationId(record) : source.installationCorporationId as number | null,
  }
}

function derivedInstallationId(record: MockState): number | null {
  const stored = record.corporation?.id
  if (typeof stored !== 'number' || !Number.isInteger(stored) || stored <= 0) return null
  const ids = new Set<number>()
  for (const organization of record.organizations ?? []) ids.add(organization.corporationId)
  for (const project of record.projects ?? []) ids.add(project.corporationId)
  if (ids.size === 0 || (ids.size === 1 && ids.has(stored))) return stored
  return null
}

function ensureRoleAdminGrants(record: MockState): MockState {
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let grantsChanged = false
  for (const definition of ROLE_GRANT_DEFINITIONS) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      grantsChanged = true
    }
  }
  if (!grantsChanged) return record
  return { ...record, grants }
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

function ensureRequestStorage(record: MockState): MockState {
  const source = record as MockState & { requestBasisFiles?: unknown; requestEvents?: unknown }
  const missing = !Array.isArray(source.requestBasisFiles) || !Array.isArray(source.requestEvents)
  if (!missing) return record
  return {
    ...record,
    requestBasisFiles: Array.isArray(source.requestBasisFiles) ? source.requestBasisFiles : [],
    requestEvents: Array.isArray(source.requestEvents) ? source.requestEvents : [],
  }
}

function migrateStoredRequestDetails(record: MockState): MockState {
  if (!Array.isArray(record.requests)) return record
  let changed = false
  const requests = record.requests.map((request) => {
    if (request.details == null) return request
    const details = draftFromRecord({ title: request.title, details: request.details })
    if (JSON.stringify(request.details) === JSON.stringify(details)) return request
    changed = true
    return { ...request, details }
  })
  if (!changed) return record
  return { ...record, requests }
}

const REQUEST_REVIEW_ROLE_GRANTS = [
  'g-requests-read',
  'g-requests-create',
  'g-requests-update',
  'g-requests-send',
  'g-requests-accept',
  'g-requests-reject',
  'g-requests-assign',
  'g-requests-cancel',
] as const

const REQUEST_AUTHOR_ROLE_GRANTS = [
  'g-requests-read',
  'g-requests-create',
  'g-requests-update',
  'g-requests-send',
  'g-requests-cancel',
] as const

const REQUEST_PROGRAM_ROLE_GRANTS = ['g-requests-manage-program', 'g-requests-approve-program'] as const

function grantListCovers(ids: readonly string[], required: readonly string[]): boolean {
  return required.every((id) => ids.includes(id))
}

function withProgramGrants(ids: readonly string[], patterns: readonly (readonly string[])[]): { ids: string[]; changed: boolean } {
  if (!patterns.some((pattern) => grantListCovers(ids, pattern))) return { ids: [...ids], changed: false }
  const missing = REQUEST_PROGRAM_ROLE_GRANTS.filter((id) => !ids.includes(id))
  if (missing.length === 0) return { ids: [...ids], changed: false }
  return { ids: [...ids, ...missing], changed: true }
}

/**
 * Demo filing and review roles already name a complete request set.
 * Those roles gain programme preparation and approval. A shorter list is not completed.
 */
function attachRequestProgramGrants(roles: AccessRole[]): { roles: AccessRole[]; changed: boolean } {
  let changed = false
  const next = roles.map((role) => {
    const grants = withProgramGrants(role.grantIds, [REQUEST_REVIEW_ROLE_GRANTS, REQUEST_AUTHOR_ROLE_GRANTS])
    const delegation = withProgramGrants(role.delegationGrantIds ?? [], [REQUEST_REVIEW_ROLE_GRANTS])
    if (!grants.changed && !delegation.changed) return role
    changed = true
    return { ...role, grantIds: grants.ids, delegationGrantIds: delegation.ids }
  })
  return { roles: changed ? next : roles, changed }
}

function ensureRequestGrants(record: MockState): MockState {
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let changed = false
  for (const definition of REQUEST_GRANT_DEFINITIONS) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      changed = true
    }
  }
  if (!changed) return record
  return { ...record, grants }
}

function ensurePersonnelCatalog(record: MockState): MockState {
  const grants = Array.isArray(record.grants) ? [...record.grants] : []
  let grantsChanged = false
  for (const definition of [...PERSONNEL_GRANT_DEFINITIONS, ...REGISTRY_GRANT_DEFINITIONS]) {
    if (!grants.some((grant) => grant.id === definition.id)) {
      grants.push({ id: definition.id, resource: definition.resource, action: definition.action })
      grantsChanged = true
    }
  }
  const withGrants = grantsChanged ? { ...record, grants } : record
  const ensured = ensureOrganizationWorkspaces(withGrants)
  return ensured
}

function normalizeRole(role: AccessRole, onChange: () => void): AccessRole {
  if (role && Array.isArray(role.delegationGrantIds)) return role
  onChange()
  const next: AccessRole = { ...role, delegationGrantIds: [] }
  return next
}
