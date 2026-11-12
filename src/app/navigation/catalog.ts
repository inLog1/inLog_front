import { grantAllows } from '../../entities/access/model/grants'
import {
  SYSTEM_REGISTRIES,
  registryRecordsResource,
  registrySchemaResource,
} from '../../entities/access/model/permission-catalog'
import type { EffectiveGrant, SystemCapabilityCode } from '../../entities/access/model/types'
import { isRequestPath } from '../../features/org-project-selector/model/workspace-context'
import { routes } from '../../shared/lib/routes'

/**
 * One registry for the shell and the home page.
 * Operational grants decide visibility. Role display names and delegation catalogs do not.
 * Live mode does not invent grants: implemented sections stay reachable and the server remains the authority.
 */

export type SectionGroup = 'primary' | 'work' | 'settings'
export type SectionContext = 'none' | 'organization' | 'project'
export type SectionSurface = 'navigation' | 'nested' | 'preserved' | 'account'

export type SectionAccess =
  | 'allowed'
  | 'needs-context'
  | 'denied-here'
  | 'unavailable'
  | 'not-enforced'

export type AppSection = {
  id: string
  labelKey: string
  descriptionKey: string
  path: string
  group: SectionGroup
  context: SectionContext
  /** navigation is the sidebar. nested stays inside a working section. preserved is a direct URL only. account is the profile and notification entry, not a menu row. */
  surface: SectionSurface
  /** False keeps the route and its grants, and hides the sidebar, home card and matching shortcut. */
  listed?: boolean
}

export type NavigationInput = {
  /** Mock applies operational grants. Live leaves this false. */
  enforceGrants: boolean
  /** True while session access has not arrived. Work sections stay hidden so they do not flash. */
  grantsPending: boolean
  grants: readonly EffectiveGrant[]
  /** Installation capability opens this settings section only. It does not open other sections. */
  systemCapabilities: readonly SystemCapabilityCode[]
  organizationId: number | null
  projectId: number | null
  /** True when the corporation already has an organization. Personnel and reference use this, not the open card. */
  hasOrganizations: boolean
}

export type QuickActionId = 'create-task' | 'open-constructor' | 'build-report'

const TASKS_READ = { resource: 'tasks', action: 'read' }
const TASKS_CREATE = { resource: 'tasks', action: 'create' }
const REQUESTS_READ = { resource: 'requests', action: 'read' }
const SCHEMA_READ = { resource: 'constructor.schema', action: 'read' }
const REPORTS_READ = { resource: 'reports', action: 'read' }
const REPORTS_GENERATE = { resource: 'reports', action: 'generate' }
const FORMS_READ = { resource: 'forms', action: 'read' }

export const APP_SECTIONS: readonly AppSection[] = [
  {
    id: 'home',
    labelKey: 'home.title',
    descriptionKey: 'home.lead',
    path: routes.dashboard(),
    group: 'primary',
    context: 'none',
    surface: 'navigation',
  },
  {
    id: 'tasks',
    labelKey: 'nav.tasks',
    descriptionKey: 'nav.tasks-description',
    path: routes.scheduler.tasks(),
    group: 'work',
    context: 'project',
    surface: 'navigation',
  },
  {
    id: 'requests',
    labelKey: 'nav.requests',
    descriptionKey: 'nav.requests-description',
    path: routes.requests.list(),
    group: 'work',
    context: 'organization',
    surface: 'navigation',
  },
  {
    id: 'reports',
    labelKey: 'nav.reports',
    descriptionKey: 'nav.reports-description',
    path: routes.admin.reports(),
    group: 'work',
    context: 'organization',
    surface: 'navigation',
  },
  {
    id: 'forms',
    labelKey: 'nav.forms',
    descriptionKey: 'nav.forms-description',
    path: routes.forms.list(),
    group: 'settings',
    context: 'organization',
    surface: 'navigation',
    listed: false,
  },
  {
    id: 'sections',
    labelKey: 'nav.sections',
    descriptionKey: 'nav.sections-description',
    path: routes.settings.sections(),
    group: 'settings',
    context: 'organization',
    surface: 'navigation',
    listed: false,
  },
  {
    id: 'constructor',
    labelKey: 'nav.constructor',
    descriptionKey: 'nav.constructor-description',
    path: routes.admin.constructor(),
    group: 'settings',
    context: 'organization',
    surface: 'navigation',
    listed: false,
  },
  {
    id: 'organizations-settings',
    labelKey: 'nav.corporation',
    descriptionKey: 'nav.corporation-description',
    path: routes.settings.organizations(),
    group: 'settings',
    context: 'none',
    surface: 'navigation',
  },
  {
    id: 'organization-personnel',
    labelKey: 'nav.personnel',
    descriptionKey: 'nav.personnel-description',
    path: '/settings/organizations/:organizationId/personnel',
    group: 'settings',
    context: 'organization',
    surface: 'nested',
  },
  {
    id: 'organization-reference',
    labelKey: 'nav.reference',
    descriptionKey: 'nav.reference-description',
    path: '/settings/organizations/:organizationId/reference',
    group: 'settings',
    context: 'organization',
    surface: 'nested',
  },
  {
    id: 'projects-settings',
    labelKey: 'nav.projects',
    descriptionKey: 'nav.projects-description',
    path: routes.settings.projects(),
    group: 'settings',
    context: 'organization',
    surface: 'preserved',
  },
  {
    id: 'access',
    labelKey: 'nav.access',
    descriptionKey: 'nav.access-description',
    path: routes.settings.access(),
    group: 'settings',
    context: 'organization',
    surface: 'navigation',
  },
  {
    id: 'profile',
    labelKey: 'nav.profile',
    descriptionKey: 'nav.profile-description',
    path: routes.settings.profile(),
    group: 'settings',
    context: 'none',
    surface: 'account',
  },
  {
    id: 'notifications',
    labelKey: 'nav.notifications',
    descriptionKey: 'nav.notifications-description',
    path: routes.settings.notifications(),
    group: 'settings',
    context: 'none',
    surface: 'account',
  },
  {
    id: 'templates',
    labelKey: 'nav.templates',
    descriptionKey: 'nav.templates-description',
    path: routes.scheduler.templates(),
    group: 'work',
    context: 'project',
    surface: 'nested',
  },
  {
    id: 'geo-mechanics',
    labelKey: 'nav.geo-mechanics',
    descriptionKey: 'nav.geo-mechanics-description',
    path: routes.geoMechanics.list(),
    group: 'work',
    context: 'none',
    surface: 'preserved',
  },
  {
    id: 'platform-admin',
    labelKey: 'nav.platform-admin',
    descriptionKey: 'nav.platform-admin-description',
    path: routes.admin.users(),
    group: 'settings',
    context: 'none',
    surface: 'preserved',
  },
  {
    id: 'scheduler-statuses',
    labelKey: 'nav.statuses',
    descriptionKey: 'nav.statuses-description',
    path: routes.scheduler.statuses(),
    group: 'work',
    context: 'project',
    surface: 'preserved',
  },
  {
    id: 'scheduler-roadmap',
    labelKey: 'nav.roadmap',
    descriptionKey: 'nav.roadmap-description',
    path: routes.scheduler.roadmap(),
    group: 'work',
    context: 'project',
    surface: 'preserved',
  },
]

function hasOperational(
  grants: readonly EffectiveGrant[],
  resource: string,
  action: string,
): boolean {
  return grants.some((grant) =>
    grant.resource === resource
    && grant.action === action
    && (grant.scope.type === 'project' || grant.scope.type === 'organization' || grant.scope.type === 'corporation'),
  )
}

function coversOrganization(
  grants: readonly EffectiveGrant[],
  resource: string,
  action: string,
  organizationId: number,
): boolean {
  return grants.some((grant) => {
    if (grant.resource !== resource || grant.action !== action) return false
    if (grant.scope.type === 'corporation') return true
    if (grant.scope.type === 'organization') return grant.scope.organizationId === organizationId
    return grant.scope.type === 'project' && grant.scope.organizationId === organizationId
  })
}

function permissionAccess(
  input: NavigationInput,
  permission: { resource: string; action: string },
  context: 'organization' | 'project',
): SectionAccess {
  if (!input.enforceGrants) return 'not-enforced'
  if (input.grantsPending) return 'unavailable'
  if (!hasOperational(input.grants, permission.resource, permission.action)) return 'unavailable'
  if (input.organizationId == null) return 'needs-context'
  if (!coversOrganization(input.grants, permission.resource, permission.action, input.organizationId)) {
    return 'denied-here'
  }
  if (context === 'organization') {
    return grantAllows(input.grants, permission.resource, permission.action, {
      organizationId: input.organizationId,
      projectId: null,
    }) ? 'allowed' : 'denied-here'
  }
  if (input.projectId == null) return 'needs-context'
  return grantAllows(input.grants, permission.resource, permission.action, {
    organizationId: input.organizationId,
    projectId: input.projectId,
  }) ? 'allowed' : 'denied-here'
}

function sectionsDesk(input: NavigationInput): SectionAccess {
  const create = permissionAccess(input, { resource: 'sections', action: 'create' }, 'organization')
  const update = permissionAccess(input, { resource: 'sections', action: 'update' }, 'organization')
  const states = [create, update]
  if (states.includes('allowed')) return 'allowed'
  if (states.includes('not-enforced')) return 'not-enforced'
  if (states.includes('needs-context')) return 'needs-context'
  if (states.includes('denied-here')) return 'denied-here'
  return 'unavailable'
}

const ORGANIZATION_PERMISSIONS = [
  ['organizations', 'read'],
  ['organizations', 'create'],
  ['organizations', 'update'],
] as const

const PERSONNEL_SCREEN_PERMISSIONS = [
  ['personnel', 'read'],
  ['personnel', 'create'],
  ['personnel', 'update'],
  ['personnel', 'archive'],
] as const

const PROJECT_PERMISSIONS = [
  ['projects', 'read'],
  ['projects', 'create'],
  ['projects', 'update'],
] as const

const ROLE_PERMISSIONS = [
  ['roles', 'read'],
  ['roles', 'create'],
  ['roles', 'update'],
  ['roles', 'delete'],
] as const

/**
 * The corporation screen does not need a selected organization.
 * Organization and personnel rights open it independently and do not grant each other.
 * A delegation is not an operational grant. The role display name is not an input.
 */
function organizationsSection(input: NavigationInput): SectionAccess {
  if (!input.enforceGrants) return 'not-enforced'
  if (input.grantsPending) return 'unavailable'
  if (input.systemCapabilities.includes('corporate_superadmin')) return 'allowed'
  const screenPermissions = [...ORGANIZATION_PERMISSIONS, ...PERSONNEL_SCREEN_PERMISSIONS]
  const allowed = input.grants.some((grant) =>
    screenPermissions.some(([resource, action]) => grant.resource === resource && grant.action === action)
    && (grant.scope.type === 'project' || grant.scope.type === 'organization' || grant.scope.type === 'corporation'),
  )
  return allowed ? 'allowed' : 'unavailable'
}

/**
 * Personnel and reference use their own permissions.
 * organizations.read does not open either module.
 * They stay hidden until the corporation has an organization, and they stay visible after leaving its card.
 * A selected organization only narrows a grant to that organization.
 */
function organizationModuleAccess(
  input: NavigationInput,
  resource: string,
  action: string,
): SectionAccess {
  if (input.grantsPending) return 'unavailable'
  if (!input.hasOrganizations && input.organizationId == null) return 'unavailable'
  if (!input.enforceGrants) return 'not-enforced'
  if (input.systemCapabilities.includes('corporate_superadmin')) return 'allowed'
  if (input.organizationId == null) {
    return hasOperational(input.grants, resource, action) ? 'allowed' : 'unavailable'
  }
  const access = permissionAccess(input, { resource, action }, 'organization')
  return access === 'allowed' ? 'allowed' : 'unavailable'
}

export function visibleOrganizationModules(input: NavigationInput): AppSection[] {
  return APP_SECTIONS.filter((section) => {
    if (section.id !== 'organization-personnel' && section.id !== 'organization-reference') return false
    const access = sectionAccess(section, input)
    return access === 'allowed' || access === 'not-enforced'
  })
}

/** Direct project management. Menu visibility is separate and does not grant this. */
export function canOpenProjectManagement(input: NavigationInput): boolean {
  if (input.grantsPending) return false
  if (!input.enforceGrants) return true
  if (input.systemCapabilities.includes('corporate_superadmin')) return true
  return input.grants.some((grant) =>
    PROJECT_PERMISSIONS.some(([resource, action]) => grant.resource === resource && grant.action === action)
    && (grant.scope.type === 'project' || grant.scope.type === 'organization' || grant.scope.type === 'corporation'),
  )
}

function accessSection(input: NavigationInput): SectionAccess {
  if (!input.enforceGrants) return 'not-enforced'
  if (input.grantsPending) return 'unavailable'
  if (input.systemCapabilities.includes('corporate_superadmin')) return 'allowed'
  const manages = permissionAccess(input, { resource: 'assignments', action: 'update' }, 'organization')
  const readsUsers = permissionAccess(input, { resource: 'access-users', action: 'read' }, 'organization')
  const roleStates = ROLE_PERMISSIONS.map(([resource, action]) => permissionAccess(input, { resource, action }, 'organization'))
  const states = [manages, readsUsers, ...roleStates]
  if (states.includes('allowed')) return 'allowed'
  if (states.includes('needs-context')) return 'needs-context'
  if (states.includes('denied-here')) return 'denied-here'
  return 'unavailable'
}

function referenceSection(input: NavigationInput): SectionAccess {
  const reads = [
    ['directories', 'read'] as const,
    ...SYSTEM_REGISTRIES.flatMap((registry) => [
      [registryRecordsResource(registry), 'read'] as const,
      [registrySchemaResource(registry), 'read'] as const,
    ]),
  ]
  let fallback: SectionAccess = 'unavailable'
  for (const [resource, action] of reads) {
    const access = organizationModuleAccess(input, resource, action)
    if (access === 'allowed' || access === 'not-enforced') return access
    fallback = access
  }
  return fallback
}

export function sectionAccess(section: AppSection, input: NavigationInput): SectionAccess {
  if (section.surface === 'preserved') return 'unavailable'
  if (section.id === 'home' || section.id === 'profile' || section.id === 'notifications') return 'allowed'
  if (section.id === 'access') return accessSection(input)
  if (section.id === 'organizations-settings') return organizationsSection(input)
  if (section.id === 'organization-personnel') return organizationModuleAccess(input, 'personnel', 'read')
  if (section.id === 'organization-reference') return referenceSection(input)
  if (section.id === 'sections') return sectionsDesk(input)
  if (section.id === 'tasks' || section.id === 'templates') return permissionAccess(input, TASKS_READ, 'project')
  if (section.id === 'requests') return permissionAccess(input, REQUESTS_READ, 'organization')
  if (section.id === 'constructor') return permissionAccess(input, SCHEMA_READ, 'organization')
  if (section.id === 'forms') return permissionAccess(input, FORMS_READ, 'organization')
  if (section.id === 'reports') return permissionAccess(input, REPORTS_READ, 'organization')
  return 'unavailable'
}

export function sectionIsNavigable(access: SectionAccess): boolean {
  return access === 'allowed' || access === 'needs-context' || access === 'denied-here' || access === 'not-enforced'
}

export function visibleNavigation(input: NavigationInput): AppSection[] {
  return APP_SECTIONS.filter((section) =>
    section.surface === 'navigation' && section.listed !== false && sectionIsNavigable(sectionAccess(section, input)),
  )
}

export function homeWorkCards(input: NavigationInput): AppSection[] {
  return visibleNavigation(input).filter((section) => section.group === 'work')
}

export function homeSetupCards(input: NavigationInput): AppSection[] {
  return visibleNavigation(input).filter((section) => section.group === 'settings')
}

function actionVisible(
  input: NavigationInput,
  read: { resource: string; action: string },
  perform: { resource: string; action: string },
  context: 'organization' | 'project',
): boolean {
  const reading = permissionAccess(input, read, context)
  const performing = permissionAccess(input, perform, context)
  if (!sectionIsNavigable(reading) || !sectionIsNavigable(performing)) return false
  if (performing === 'denied-here' || reading === 'denied-here') return false
  return true
}

/** Actions that open an existing screen. A missing right hides the action. A missing context still offers it. */
export function visibleQuickActions(input: NavigationInput): QuickActionId[] {
  const actions: QuickActionId[] = []
  if (actionVisible(input, TASKS_READ, TASKS_CREATE, 'project')) actions.push('create-task')
  const constructor = APP_SECTIONS.find((section) => section.id === 'constructor')
  if (constructor?.listed !== false && actionVisible(input, SCHEMA_READ, SCHEMA_READ, 'organization')) actions.push('open-constructor')
  if (actionVisible(input, REPORTS_READ, REPORTS_GENERATE, 'organization')) actions.push('build-report')
  return actions
}

/**
 * Placeholder from before the requests section existed.
 * A listed section replaces it. The grant check remains for a build that has not added the section.
 */
export function showRequestsNotice(input: NavigationInput): boolean {
  const section = APP_SECTIONS.find((item) => item.id === 'requests')
  if (section && section.surface === 'navigation' && section.listed !== false) return false
  if (!input.enforceGrants || input.grantsPending) return false
  return hasOperational(input.grants, 'requests', 'read') || hasOperational(input.grants, 'requests', 'create')
}

/** Task rows are loaded only for a ready project the subject may read. */
export function shouldLoadProjectTasks(input: NavigationInput): boolean {
  if (input.organizationId == null || input.projectId == null) return false
  if (!input.enforceGrants) return true
  if (input.grantsPending) return false
  return grantAllows(input.grants, 'tasks', 'read', {
    organizationId: input.organizationId,
    projectId: input.projectId,
  })
}

function sectionMatchScore(pattern: string, path: string): number | null {
  if (pattern === '/') return path === '/' ? 1 : null
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  if (pathParts.length < patternParts.length) return null
  for (let index = 0; index < patternParts.length; index += 1) {
    const token = patternParts[index]
    const actual = pathParts[index]
    if (token.startsWith(':')) {
      if (!/^[1-9]\d*$/.test(actual ?? '')) return null
    } else if (token !== actual) return null
  }
  if (pathParts.length !== patternParts.length && patternParts.some((part) => part.startsWith(':'))) return null
  return patternParts.length
}

/** Organization card, not a personnel or reference module. */
export function isOrganizationDetailPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return /^\/settings\/organizations\/[1-9]\d*$/.test(path)
}

/** Organization id carried by a settings path, including its personnel and reference pages. */
export function organizationIdFromPath(pathname: string): number | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const match = /^\/settings\/organizations\/([1-9]\d*)(?:\/|$)/.exec(path)
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) ? id : null
}

export function sectionByPath(pathname: string): AppSection | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  let best: AppSection | null = null
  let bestScore = 0
  for (const section of APP_SECTIONS) {
    const score = sectionMatchScore(section.path, path)
    if (score != null && score > bestScore) {
      best = section
      bestScore = score
    }
  }
  return best
}

/** Project sections keep both header workspace controls. */
export function showsProjectSelector(pathname: string): boolean {
  const section = sectionByPath(pathname)
  if (!section) return false
  return section.context === 'project'
}

/** Requests keep the organization control and not the project control. */
export function showsOrganizationSelector(pathname: string): boolean {
  return isRequestPath(pathname)
}
