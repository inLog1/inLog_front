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
  | 'reports'
  | 'geoMechanics'

/** Код из `available_features`, который открывает раздел и задаёт его место в меню. */
const SECTION_FEATURE: Record<Exclude<AppSection, 'home'>, string> = {
  organizations: 'organizations',
  projects: 'projects',
  notifications: 'notifications',
  constructor: 'constructor',
  users: 'users',
  tasks: 'tasks',
  scheduler: 'tasks',
  reports: 'reports',
  geoMechanics: 'geo_mechanics',
}

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

export function hasAvailableFeature(user: FeatureUser, feature: string): boolean {
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
    case 'reports':
    case 'geoMechanics':
      return hasAvailableFeature(user, SECTION_FEATURE[section])
    case 'tasks':
      return hasAvailableFeature(user, 'tasks') && isPlatformAdmin(user?.role)
    case 'scheduler':
      return hasAvailableFeature(user, 'tasks') && !isPlatformAdmin(user?.role)
    default:
      return false
  }
}

type OrderedEntry = {
  section?: AppSection
  /** `start` — всегда первым (главная). `end` — всегда последним (каталог). */
  pin?: 'start' | 'end'
}

/**
 * Пункты меню в порядке `available_features`.
 * Главная закреплена первой. Раздел без своего кода в списке не показывается.
 */
export function orderSidebarEntries<T extends OrderedEntry>(user: FeatureUser, items: readonly T[]): T[] {
  const features = readAvailableFeatures(user)

  return items
    .filter((item) => item.pin != null || (item.section != null && canAccessSection(user, item.section)))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => entryRank(a.item, a.index, features) - entryRank(b.item, b.index, features))
    .map(({ item }) => item)
}

function entryRank(item: OrderedEntry, index: number, features: string[]) {
  if (item.pin === 'start') return -1_000_000
  if (item.pin === 'end') return 1_000_000 + index

  const feature = item.section && item.section !== 'home' ? SECTION_FEATURE[item.section] : undefined
  const featureIndex = feature ? features.indexOf(feature) : -1
  if (featureIndex === -1) return 100_000 + index
  return featureIndex
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
  {
    section: 'reports',
    paths: [routes.admin.reports()],
  },
  {
    section: 'geoMechanics',
    paths: [routes.geoMechanics.list()],
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

/** Первый открытый раздел админки в порядке `available_features`. Каталог от списка не зависит. */
export function firstAccessiblePlatformPath(user: FeatureUser): string {
  const features = readAvailableFeatures(user)
  const accessible = PLATFORM_SECTION_PATHS.filter((item) => canAccessSection(user, item.section))
  accessible.sort((a, b) => featureRank(features, a.section) - featureRank(features, b.section))
  return accessible[0]?.path ?? routes.admin.catalog()
}

function featureRank(features: string[], section: AppSection) {
  if (section === 'home') return -1
  const index = features.indexOf(SECTION_FEATURE[section])
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
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
