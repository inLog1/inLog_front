import type { User } from '../../entities/user/model/types'
import { isPlatformAdmin, isSuperAdmin } from '../types/platform-role'
import { isPlatformConsolePath, routes } from './routes'

/** Коды из `availableFeatures`, которые открывают раздел. */
export const AVAILABLE_FEATURES = [
  'constructor',
  'notifications',
  'organizations',
  'projects',
  'tasks',
  'users',
] as const

export type AvailableFeature = (typeof AVAILABLE_FEATURES)[number]

/** Устаревшие коды: на разделы не влияют. */
const IGNORED_FEATURES = new Set(['measurements', 'wells'])

export type AppSection =
  | 'home'
  | 'organizations'
  | 'projects'
  | 'notifications'
  | 'constructor'
  | 'users'
  | 'tasks'
  | 'scheduler'

type FeatureUser = Pick<User, 'role' | 'availableFeatures' | 'available_features'> | null | undefined

function pathMatches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function readAvailableFeatures(user: FeatureUser): string[] {
  const raw = user?.availableFeatures ?? user?.available_features
  if (!Array.isArray(raw)) return []

  return raw.filter(
    (item): item is string => typeof item === 'string' && !IGNORED_FEATURES.has(item),
  )
}

export function hasAvailableFeature(user: FeatureUser, feature: AvailableFeature): boolean {
  if (isSuperAdmin(user?.role)) return true
  return readAvailableFeatures(user).includes(feature)
}

/**
 * `tasks` в availableFeatures открывает админский раздел задач для роли admin и выше,
 * а обычному пользователю — планировщик. Супер-админ видит оба раздела.
 */
export function canAccessSection(user: FeatureUser, section: AppSection): boolean {
  if (section === 'home' || isSuperAdmin(user?.role)) return true

  switch (section) {
    case 'organizations':
    case 'projects':
    case 'notifications':
    case 'constructor':
    case 'users':
      return hasAvailableFeature(user, section)
    case 'tasks':
      return hasAvailableFeature(user, 'tasks') && isPlatformAdmin(user?.role)
    case 'scheduler':
      return hasAvailableFeature(user, 'tasks') && !isPlatformAdmin(user?.role)
    default:
      return false
  }
}

const SECTION_PATHS: { section: AppSection; paths: string[] }[] = [
  {
    section: 'organizations',
    paths: [
      routes.settings.organizations(),
      routes.settings.organizationsAndProjects(),
      routes.admin.organizations(),
      routes.admin.organizationsAndProjects(),
      routes.organizations.list(),
      routes.organizations.new(),
    ],
  },
  {
    section: 'projects',
    paths: [
      routes.settings.projects(),
      routes.admin.projects(),
      routes.projects.list(),
      routes.projects.new(),
    ],
  },
  {
    section: 'scheduler',
    paths: [routes.scheduler.list()],
  },
  {
    section: 'tasks',
    paths: [routes.admin.tasks()],
  },
  {
    section: 'constructor',
    paths: [routes.admin.constructor()],
  },
  {
    section: 'users',
    paths: [routes.admin.users(), routes.admin.members()],
  },
  {
    section: 'notifications',
    paths: [routes.settings.notifications()],
  },
]

export function sectionForPathname(pathname: string): AppSection | null {
  if (pathMatches(pathname, routes.settings.profile())) return null

  for (const entry of SECTION_PATHS) {
    if (entry.paths.some((path) => pathMatches(pathname, path))) return entry.section
  }

  if (pathname === routes.settings.list()) return 'notifications'

  return null
}

const PLATFORM_SECTION_PATHS: { section: AppSection; path: string }[] = [
  { section: 'users', path: routes.admin.users() },
  { section: 'organizations', path: routes.admin.organizations() },
  { section: 'projects', path: routes.admin.projects() },
  { section: 'tasks', path: routes.admin.tasks() },
  { section: 'constructor', path: routes.admin.constructor() },
]

/** Первый открытый раздел админки. Каталог не зависит от availableFeatures. */
export function firstAccessiblePlatformPath(user: FeatureUser): string {
  const match = PLATFORM_SECTION_PATHS.find((item) => canAccessSection(user, item.section))
  return match?.path ?? routes.admin.catalog()
}

/** Куда увести с закрытого раздела. Главная остаётся доступной всегда. */
export function deniedSectionRedirect(user: FeatureUser, pathname: string): string | null {
  const section = sectionForPathname(pathname)
  if (!section || canAccessSection(user, section)) return null

  if (isPlatformConsolePath(pathname) && isPlatformAdmin(user?.role)) {
    const next = firstAccessiblePlatformPath(user)
    return next === pathname ? null : next
  }

  return routes.dashboard()
}

export function canSeeHomeTasks(user: FeatureUser) {
  return canAccessSection(user, 'scheduler') || canAccessSection(user, 'tasks')
}

export function homeTasksPath(user: FeatureUser) {
  return canAccessSection(user, 'scheduler') ? routes.scheduler.tasks() : routes.admin.tasks()
}
