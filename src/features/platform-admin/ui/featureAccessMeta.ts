import {
  Bell,
  Building2,
  CheckSquare,
  FolderOpen,
  LayoutGrid,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { AvailableFeature } from '../../../shared/lib/available-features'

export const FEATURE_ORDER: AvailableFeature[] = [
  'organizations',
  'projects',
  'notifications',
  'tasks',
  'users',
  'constructor',
]

export const FEATURE_ICONS: Record<AvailableFeature, LucideIcon> = {
  organizations: Building2,
  projects: FolderOpen,
  notifications: Bell,
  tasks: CheckSquare,
  users: Users,
  constructor: Wrench,
}

export function featureHintKey(feature: string, audience: 'admin' | 'member') {
  if (feature === 'tasks') {
    return audience === 'member'
      ? 'admin-page.feature-access.hints.tasks-member'
      : 'admin-page.feature-access.hints.tasks-admin'
  }
  if (feature === 'users') return 'admin-page.feature-access.hints.users'
  if (feature === 'constructor') return 'admin-page.feature-access.hints.constructor'
  return null
}

export function featureIcon(feature: string): LucideIcon {
  return FEATURE_ICONS[feature as AvailableFeature] ?? LayoutGrid
}

/** Известные разделы идут в фиксированном порядке, остальные — как пришли из каталога. */
export function orderFeatureKeys(features: readonly string[]): string[] {
  const known = new Set<string>(FEATURE_ORDER)
  const leading = FEATURE_ORDER.filter((feature) => features.includes(feature))
  const rest = features.filter((feature) => !known.has(feature))
  return [...leading, ...rest]
}
