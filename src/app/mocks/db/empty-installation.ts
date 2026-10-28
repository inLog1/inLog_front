import { ORGANIZATION_CREATE_GRANT } from './organization-grants'
import { createSeed } from './seed'
import { MOCK_SCHEMA_VERSION } from './constants'
import type { MockState } from './types'

/**
 * A personal installation before primary setup.
 * The grant rows are the technical catalog, not a copy of demonstration users or work data.
 */
export function createEmptyInstallation(namespace: string): MockState {
  const catalog = createSeed().grants.map((grant) => ({
    id: grant.id,
    resource: grant.resource,
    action: grant.action,
  }))
  if (!catalog.some((grant) => grant.id === ORGANIZATION_CREATE_GRANT.id)) {
    catalog.push({
      id: ORGANIZATION_CREATE_GRANT.id,
      resource: ORGANIZATION_CREATE_GRANT.resource,
      action: ORGANIZATION_CREATE_GRANT.action,
    })
  }
  return {
    schemaVersion: MOCK_SCHEMA_VERSION,
    recordRevision: 1,
    namespace,
    installationPhase: 'uninitialized',
    authMode: 'mixed',
    accessVersion: 1,
    corporation: { id: 0, name: '' },
    installationCorporationId: null,
    users: [],
    localCredentials: [],
    directoryEmployees: [],
    identities: [],
    organizations: [],
    projects: [],
    memberships: [],
    roles: [],
    grants: catalog,
    assignments: [],
    delegations: [],
    systemCapabilities: [],
    accessAudit: [],
    sessions: [],
    taskStatuses: [],
    taskTags: [],
    tasks: [],
    taskComments: [],
    taskFiles: [],
    constructorNodes: [],
    constructorTabs: [],
    constructorFields: [],
    constructorRecords: [],
    forms: [],
    formDrafts: [],
    formVersions: [],
    formRecords: [],
    tableViews: [],
    sections: [],
    sectionDrafts: [],
    sectionVersions: [],
    notifications: [],
    fault: null,
  }
}
