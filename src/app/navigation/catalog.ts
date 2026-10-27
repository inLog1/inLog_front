import { grantAllows } from '../../entities/access/model/grants'
import type { EffectiveGrant, SystemCapabilityCode } from '../../entities/access/model/types'
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
}

export type QuickActionId = 'create-task' | 'open-constructor' | 'build-report'

const TASKS_READ = { resource: 'tasks', action: 'read' }
const TASKS_CREATE = { resource: 'tasks', action: 'create' }
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
  },
  {
    id: 'sections',
    labelKey: 'nav.sections',
    descriptionKey: 'nav.sections-description',
    path: routes.settings.sections(),
    group: 'settings',
    context: 'organization',
    surface: 'navigation',
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
    id: 'constructor',
    labelKey: 'nav.constructor',
    descriptionKey: 'nav.constructor-description',
    path: routes.admin.constructor(),
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
  {
    id: 'organizations-settings',
    labelKey: 'nav.organizations',
    descriptionKey: 'nav.organizations-description',
    path: routes.settings.organizationsAndProjects(),
    group: 'settings',
    context: 'none',
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

function accessSection(input: NavigationInput): SectionAccess {
  if (!input.enforceGrants) return 'not-enforced'
  if (input.grantsPending) return 'unavailable'
  const capable = input.systemCapabilities.includes('corporate_superadmin')
  const manages = hasOperational(input.grants, 'assignments', 'update')
  if (!capable && !manages) return 'unavailable'
  if (input.organizationId == null) return 'needs-context'
  if (capable) return 'allowed'
  return permissionAccess(input, { resource: 'assignments', action: 'update' }, 'organization')
}

export function sectionAccess(section: AppSection, input: NavigationInput): SectionAccess {
  if (section.surface === 'preserved') return 'unavailable'
  if (section.id === 'home' || section.id === 'profile' || section.id === 'notifications') return 'allowed'
  if (section.id === 'access') return accessSection(input)
  if (section.id === 'sections') return sectionsDesk(input)
  if (section.id === 'tasks' || section.id === 'templates') return permissionAccess(input, TASKS_READ, 'project')
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
    section.surface === 'navigation' && sectionIsNavigable(sectionAccess(section, input)),
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
  if (actionVisible(input, SCHEMA_READ, SCHEMA_READ, 'organization')) actions.push('open-constructor')
  if (actionVisible(input, REPORTS_READ, REPORTS_GENERATE, 'organization')) actions.push('build-report')
  return actions
}

export function showRequestsNotice(input: NavigationInput): boolean {
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

export function sectionByPath(pathname: string): AppSection | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const matches = APP_SECTIONS.filter((section) =>
    section.path === '/' ? path === '/' : path === section.path || path.startsWith(`${section.path}/`),
  )
  matches.sort((left, right) => right.path.length - left.path.length)
  return matches[0] ?? null
}

export function showsProjectSelector(pathname: string): boolean {
  const section = sectionByPath(pathname)
  if (!section) return false
  return section.context === 'project' || section.id === 'home'
}
