/**
 * The URL is the only stored selection.
 * These functions decide whether that selection is allowed.
 * They do not keep a second copy of the choice.
 */

export type WorkspaceScope = 'organization' | 'project'

export type WorkspaceStatus = 'loading' | 'ready' | 'choose' | 'empty' | 'forbidden' | 'not-found' | 'error'

export type WorkspaceReason =
  | 'invalid-organization'
  | 'unknown-organization'
  | 'forbidden-organization'
  | 'invalid-project'
  | 'unknown-project'
  | 'forbidden-project'
  | 'project-organization-mismatch'
  | 'organizations-empty'
  | 'projects-empty'
  | 'organizations-error'
  | 'projects-error'
  | 'access-error'
  | 'choose-organization'
  | 'choose-project'
  | 'missing-permission'

export type ListedOrganization = { id: number }

export type ListedProject = { id: number; organizationId: number | null }

export type CatalogLoad<T> = {
  status: 'loading' | 'error' | 'ready'
  items: T[]
}

export type IdProbe =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'forbidden' }
  | { status: 'ready'; organizationId: number | null }

export type OrganizationResolution = {
  status: Exclude<WorkspaceStatus, 'ready'> | 'ready'
  reason: WorkspaceReason | null
  organizationId: number | null
  /** Present when a missing org param can be filled. Never replaces an explicit param. */
  autoOrgId: string | null
  /** Explicit id that is not in the accessible list and must be classified by the server. */
  probeId: number | null
}

export type ProjectResolution = {
  status: WorkspaceStatus
  reason: WorkspaceReason | null
  projectId: number | null
  autoProjectId: string | null
  probeId: number | null
}

const ABSENT = { kind: 'absent' } as const
const INVALID = { kind: 'invalid' } as const

export function parseRouteId(raw: string | null): { kind: 'absent' } | { kind: 'invalid' } | { kind: 'id'; id: number } {
  if (raw == null) return ABSENT
  const value = raw.trim()
  if (value === '') return ABSENT
  if (!/^[1-9]\d*$/.test(value)) return INVALID
  const id = Number(value)
  if (!Number.isSafeInteger(id)) return INVALID
  return { kind: 'id', id }
}

export function resolveOrganization(
  organizations: CatalogLoad<ListedOrganization>,
  orgParam: string | null,
  probe: IdProbe,
): OrganizationResolution {
  if (organizations.status === 'loading') {
    return { status: 'loading', reason: null, organizationId: null, autoOrgId: null, probeId: null }
  }
  if (organizations.status === 'error') {
    return { status: 'error', reason: 'organizations-error', organizationId: null, autoOrgId: null, probeId: null }
  }

  const parsed = parseRouteId(orgParam)
  if (parsed.kind === 'invalid') {
    return { status: 'not-found', reason: 'invalid-organization', organizationId: null, autoOrgId: null, probeId: null }
  }
  if (parsed.kind === 'absent') {
    if (organizations.items.length === 0) {
      return { status: 'empty', reason: 'organizations-empty', organizationId: null, autoOrgId: null, probeId: null }
    }
    if (organizations.items.length === 1) {
      const id = organizations.items[0].id
      return { status: 'ready', reason: null, organizationId: id, autoOrgId: String(id), probeId: null }
    }
    return { status: 'choose', reason: 'choose-organization', organizationId: null, autoOrgId: null, probeId: null }
  }

  if (organizations.items.some((item) => item.id === parsed.id)) {
    return { status: 'ready', reason: null, organizationId: parsed.id, autoOrgId: null, probeId: null }
  }
  if (probe.status === 'idle' || probe.status === 'loading') {
    return { status: 'loading', reason: null, organizationId: null, autoOrgId: null, probeId: parsed.id }
  }
  if (probe.status === 'error') {
    return { status: 'error', reason: 'organizations-error', organizationId: null, autoOrgId: null, probeId: parsed.id }
  }
  if (probe.status === 'not-found') {
    return { status: 'not-found', reason: 'unknown-organization', organizationId: null, autoOrgId: null, probeId: parsed.id }
  }
  if (probe.status === 'forbidden') {
    return { status: 'forbidden', reason: 'forbidden-organization', organizationId: null, autoOrgId: null, probeId: parsed.id }
  }
  return { status: 'ready', reason: null, organizationId: parsed.id, autoOrgId: null, probeId: parsed.id }
}

export function projectsOfOrganization(items: ListedProject[], organizationId: number): ListedProject[] {
  return items.filter((item) => item.organizationId === organizationId)
}

export function resolveProject(
  organizationId: number,
  projects: CatalogLoad<ListedProject>,
  projectParam: string | null,
  probe: IdProbe,
): ProjectResolution {
  if (projects.status === 'loading') {
    return { status: 'loading', reason: null, projectId: null, autoProjectId: null, probeId: null }
  }
  if (projects.status === 'error') {
    return { status: 'error', reason: 'projects-error', projectId: null, autoProjectId: null, probeId: null }
  }

  const visible = projectsOfOrganization(projects.items, organizationId)
  const parsed = parseRouteId(projectParam)
  if (parsed.kind === 'invalid') {
    return { status: 'not-found', reason: 'invalid-project', projectId: null, autoProjectId: null, probeId: null }
  }
  if (parsed.kind === 'absent') {
    if (visible.length === 0) {
      return { status: 'empty', reason: 'projects-empty', projectId: null, autoProjectId: null, probeId: null }
    }
    if (visible.length === 1) {
      const id = visible[0].id
      return { status: 'ready', reason: null, projectId: id, autoProjectId: String(id), probeId: null }
    }
    return { status: 'choose', reason: 'choose-project', projectId: null, autoProjectId: null, probeId: null }
  }

  if (visible.some((item) => item.id === parsed.id)) {
    return { status: 'ready', reason: null, projectId: parsed.id, autoProjectId: null, probeId: null }
  }
  if (probe.status === 'idle' || probe.status === 'loading') {
    return { status: 'loading', reason: null, projectId: null, autoProjectId: null, probeId: parsed.id }
  }
  if (probe.status === 'error') {
    return { status: 'error', reason: 'projects-error', projectId: null, autoProjectId: null, probeId: parsed.id }
  }
  if (probe.status === 'not-found') {
    return { status: 'not-found', reason: 'unknown-project', projectId: null, autoProjectId: null, probeId: parsed.id }
  }
  if (probe.status === 'forbidden') {
    return { status: 'forbidden', reason: 'forbidden-project', projectId: null, autoProjectId: null, probeId: parsed.id }
  }
  if (probe.organizationId !== organizationId) {
    return {
      status: 'forbidden',
      reason: 'project-organization-mismatch',
      projectId: null,
      autoProjectId: null,
      probeId: parsed.id,
    }
  }
  return { status: 'ready', reason: null, projectId: parsed.id, autoProjectId: null, probeId: parsed.id }
}

export function applyAutoSelection(
  current: URLSearchParams,
  patch: { org: string | null; project: string | null },
): URLSearchParams | null {
  const next = new URLSearchParams(current)
  let changed = false
  if (patch.org != null && current.get('org') == null) {
    next.set('org', patch.org)
    changed = true
  }
  const orgNow = next.get('org')
  const projectOrgMatches = patch.org == null || patch.org === orgNow
  if (patch.project != null && current.get('project') == null && orgNow != null && projectOrgMatches) {
    next.set('project', patch.project)
    changed = true
  }
  return changed ? next : null
}

const CONTEXT_PARAMS = ['project', 'task', 'node', 'tab'] as const

export function selectOrganizationParams(current: URLSearchParams, organizationId: number): URLSearchParams {
  const next = new URLSearchParams(current)
  next.set('org', String(organizationId))
  for (const key of CONTEXT_PARAMS) next.delete(key)
  return next
}

export function selectProjectParams(current: URLSearchParams, projectId: number): URLSearchParams {
  const next = new URLSearchParams(current)
  next.set('project', String(projectId))
  next.delete('task')
  return next
}

export function preserveLocationSearch(pathname: string, search: string): { pathname: string; search: string } {
  return { pathname, search }
}

export type WorkspaceLinkScope = 'project' | 'organization' | 'app' | 'public'

const WORKSPACE_KEYS = ['org', 'project', 'task', 'node', 'tab'] as const

/**
 * One builder for section links.
 * Project and other in-app sections keep a verified org and project.
 * An organization section keeps org, and a project only when it is already verified in the URL.
 * task, node and tab are never copied. Public destinations and logout get none of them.
 */
export function workspaceHref(
  pathname: string,
  scope: WorkspaceLinkScope,
  verified: { organizationId: number | null; projectId: number | null },
  explicitProject: boolean,
): string {
  if (scope === 'public') return pathname
  const params = new URLSearchParams()
  if (verified.organizationId != null) params.set('org', String(verified.organizationId))
  const keepProject = scope === 'organization' ? explicitProject : verified.projectId != null
  if (keepProject && verified.projectId != null) params.set('project', String(verified.projectId))
  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function searchWithoutWorkspace(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  for (const key of WORKSPACE_KEYS) params.delete(key)
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** Project sections may query only after the verified project is ready. */
export function canQueryProject(status: WorkspaceStatus, projectId: number | null): boolean {
  return status === 'ready' && projectId != null
}

/** Organization sections may query only after the verified organization is ready. */
export function canQueryOrganization(status: WorkspaceStatus, organizationId: number | null): boolean {
  return status === 'ready' && organizationId != null
}
