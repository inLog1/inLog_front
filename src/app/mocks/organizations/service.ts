import { can } from '../../../entities/access/model/grants'
import type { AccessScope } from '../../../entities/access/model/types'
import { principal, toSnapshot, type FlowResult } from '../auth/flow'
import type { MockOrganization, MockProject, MockState } from '../db/types'

/**
 * Management directory. It is not the workspace list.
 * listOrganizations still admits an organization when any operational grant reaches it,
 * so a person with tasks.read keeps a working selector.
 * This directory returns full organization requisites only for organizations.read
 * and projects only for projects.read.
 */

export type OrganizationContextMinimum = {
  id: number
  short_name: string
}

export type DirectoryOrganization = {
  id: number
  full_name: string
  short_name: string
  address: string
  kind: 'laboratory' | 'customer'
  revision: number
  can_update: boolean
}

export type DirectoryProject = {
  id: number
  name: string
  reservoir: string
  organization_id: number
  revision: number
  can_update: boolean
  organization: OrganizationContextMinimum
}

export type DirectoryBody = {
  corporation_empty: boolean
  organizations_hidden: boolean
  create_organization: boolean
  organizations: DirectoryOrganization[]
  projects: DirectoryProject[]
  project_create_targets: OrganizationContextMinimum[]
  projects_concealed_organization_ids: number[]
}

export type OrganizationPatch = {
  fullName?: string
  shortName?: string
  address?: string
  kind?: string
  expectedRevision: number | null
  id?: unknown
  corporationId?: unknown
  organizationId?: unknown
}

export type ProjectPatch = {
  name?: string
  reservoir?: string
  expectedRevision: number | null
  id?: unknown
  corporationId?: unknown
  organizationId?: unknown
}

function fail(state: MockState, status: number, code: string): FlowResult {
  return { state, status, body: { code } }
}

export function objectRevision(revision: number | undefined): number {
  return typeof revision === 'number' && Number.isInteger(revision) && revision > 0 ? revision : 1
}

/** The installation id is authoritative. A corporation id from a URL or body is not. */
export function verifiedInstallationId(state: MockState): number | null {
  const explicit = state.installationCorporationId
  if (typeof explicit !== 'number' || !Number.isInteger(explicit) || explicit <= 0) return null
  if (state.corporation.id !== explicit) return null
  return explicit
}

function installationOrganizations(state: MockState, corporationId: number): MockOrganization[] {
  return state.organizations.filter((item) => item.corporationId === corporationId)
}

function installationProjects(state: MockState, corporationId: number): MockProject[] {
  const organizations = new Set(installationOrganizations(state, corporationId).map((item) => item.id))
  return state.projects.filter((item) => item.corporationId === corporationId && organizations.has(item.organizationId))
}

function organizationScope(organization: MockOrganization): AccessScope {
  return { type: 'organization', organizationId: organization.id, corporationId: organization.corporationId }
}

function projectScope(project: MockProject): AccessScope {
  return {
    type: 'project',
    projectId: project.id,
    organizationId: project.organizationId,
    corporationId: project.corporationId,
  }
}

function contextMinimum(organization: MockOrganization): OrganizationContextMinimum {
  return { id: organization.id, short_name: organization.shortName }
}

function canReadOrganizationRecord(state: MockState, userId: number, organization: MockOrganization): boolean {
  return can(toSnapshot(state), userId, 'organizations', 'read', organizationScope(organization))
}

function canUpdateOrganizationRecord(state: MockState, userId: number, organization: MockOrganization): boolean {
  return can(toSnapshot(state), userId, 'organizations', 'update', organizationScope(organization))
}

function canReadProjectRecord(state: MockState, userId: number, project: MockProject): boolean {
  return can(toSnapshot(state), userId, 'projects', 'read', projectScope(project))
}

function canUpdateProjectRecord(state: MockState, userId: number, project: MockProject): boolean {
  return can(toSnapshot(state), userId, 'projects', 'update', projectScope(project))
}

function canCreateProjectIn(state: MockState, userId: number, organization: MockOrganization): boolean {
  return can(toSnapshot(state), userId, 'projects', 'create', organizationScope(organization))
}

export function readDirectory(state: MockState, token: string | null): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const corporationId = verifiedInstallationId(state)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const snapshot = toSnapshot(state)
  const userId = who.user.id
  const organizations = installationOrganizations(state, corporationId)
  const projects = installationProjects(state, corporationId)
  const readable = organizations.filter((organization) => canReadOrganizationRecord(state, userId, organization))
  const visibleProjects = projects.filter((project) => canReadProjectRecord(state, userId, project))
  const createTargets = organizations.filter((organization) => canCreateProjectIn(state, userId, organization))
  const named = new Set<number>([
    ...readable.map((organization) => organization.id),
    ...visibleProjects.map((project) => project.organizationId),
    ...createTargets.map((organization) => organization.id),
  ])
  const concealed = organizations
    .filter((organization) => named.has(organization.id))
    .filter((organization) => projects.some((project) =>
      project.organizationId === organization.id && !canReadProjectRecord(state, userId, project),
    ))
    .map((organization) => organization.id)
  const body: DirectoryBody = {
    corporation_empty: organizations.length === 0,
    organizations_hidden: organizations.length > 0 && readable.length === 0,
    create_organization: can(snapshot, userId, 'organizations', 'create', { type: 'corporation', corporationId }),
    organizations: readable.map((organization) => ({
      id: organization.id,
      full_name: organization.fullName,
      short_name: organization.shortName,
      address: organization.address,
      kind: organization.kind,
      revision: objectRevision(organization.revision),
      can_update: canUpdateOrganizationRecord(state, userId, organization),
    })),
    projects: visibleProjects.map((project) => {
      const organization = organizations.find((item) => item.id === project.organizationId)
      return {
        id: project.id,
        name: project.name,
        reservoir: project.reservoir ?? '',
        organization_id: project.organizationId,
        revision: objectRevision(project.revision),
        can_update: canUpdateProjectRecord(state, userId, project),
        organization: organization
          ? contextMinimum(organization)
          : { id: project.organizationId, short_name: '' },
      }
    }),
    project_create_targets: createTargets.map(contextMinimum),
    projects_concealed_organization_ids: concealed,
  }
  return { state, status: 200, body }
}

function identityRejected(supplied: unknown, current: number): boolean {
  if (supplied === undefined) return false
  return supplied !== current
}

export function updateOrganizationRecord(
  state: MockState,
  token: string | null,
  organizationId: number,
  patch: OrganizationPatch,
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const corporationId = verifiedInstallationId(state)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const organization = installationOrganizations(state, corporationId).find((item) => item.id === organizationId)
  if (!organization) return fail(state, 404, 'not_found')
  if (identityRejected(patch.id, organization.id)) return fail(state, 400, 'invalid_identity')
  if (identityRejected(patch.corporationId, organization.corporationId)) return fail(state, 400, 'invalid_identity')
  if (patch.organizationId !== undefined) return fail(state, 400, 'invalid_identity')
  if (!canUpdateOrganizationRecord(state, who.user.id, organization)) return fail(state, 403, 'forbidden')
  if (patch.expectedRevision == null) return fail(state, 400, 'invalid_revision')
  if (patch.expectedRevision !== objectRevision(organization.revision)) return fail(state, 409, 'stale_write')
  const fullName = patch.fullName === undefined ? organization.fullName : patch.fullName.trim()
  const shortName = patch.shortName === undefined ? organization.shortName : patch.shortName.trim()
  const address = patch.address === undefined ? organization.address : patch.address.trim()
  const kind = patch.kind === undefined ? organization.kind : patch.kind
  if (!fullName || !shortName || !address) return fail(state, 400, 'invalid_organization')
  if (kind !== 'laboratory' && kind !== 'customer') return fail(state, 400, 'invalid_organization')
  const next: MockOrganization = {
    ...organization,
    fullName,
    shortName,
    address,
    kind,
    revision: objectRevision(organization.revision) + 1,
  }
  return {
    state: {
      ...state,
      organizations: state.organizations.map((item) => item.id === organization.id ? next : item),
    },
    status: 200,
    body: {
      id: next.id,
      full_name: next.fullName,
      short_name: next.shortName,
      address: next.address,
      kind: next.kind,
      revision: next.revision,
    },
  }
}

export function updateProjectRecord(
  state: MockState,
  token: string | null,
  projectId: number,
  patch: ProjectPatch,
): FlowResult {
  const who = principal(state, token)
  if (!who.ok) return who.result
  const corporationId = verifiedInstallationId(state)
  if (corporationId == null) return fail(state, 403, 'forbidden')
  const project = installationProjects(state, corporationId).find((item) => item.id === projectId)
  if (!project) return fail(state, 404, 'not_found')
  if (identityRejected(patch.id, project.id)) return fail(state, 400, 'invalid_identity')
  if (identityRejected(patch.corporationId, project.corporationId)) return fail(state, 400, 'invalid_identity')
  if (identityRejected(patch.organizationId, project.organizationId)) return fail(state, 400, 'invalid_identity')
  if (!canUpdateProjectRecord(state, who.user.id, project)) return fail(state, 403, 'forbidden')
  if (patch.expectedRevision == null) return fail(state, 400, 'invalid_revision')
  if (patch.expectedRevision !== objectRevision(project.revision)) return fail(state, 409, 'stale_write')
  const name = patch.name === undefined ? project.name : patch.name.trim()
  const reservoir = patch.reservoir === undefined ? (project.reservoir ?? '') : patch.reservoir.trim()
  if (!name || (patch.reservoir !== undefined && !reservoir)) return fail(state, 400, 'invalid_project')
  const next: MockProject = {
    ...project,
    name,
    reservoir,
    revision: objectRevision(project.revision) + 1,
  }
  return {
    state: {
      ...state,
      projects: state.projects.map((item) => item.id === project.id ? next : item),
    },
    status: 200,
    body: {
      id: next.id,
      name: next.name,
      reservoir: next.reservoir,
      organization_id: next.organizationId,
      revision: next.revision,
    },
  }
}
