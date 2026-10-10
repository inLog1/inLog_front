import { useSyncExternalStore } from 'react'
import { isSuperAdmin } from '../../../shared/types/platform-role'

/**
 * Локальный черновик доступа.
 * `features: null` — профиля нет, открыты все разделы.
 * Массив — личный набор, как у FeatureProfile.
 */
export type UserAccessDraft = {
  name?: string
  surname?: string
  role?: string
  features: string[] | null
}

type Drafts = Record<number, UserAccessDraft>

const STORAGE_KEY = 'inlog.user-access-drafts'
const PRESET_KEY = 'inlog.audience-access-presets'
const EMPTY_DRAFTS: Drafts = {}

type AudiencePresets = Record<'admin' | 'member', string[] | null>

const DEFAULT_PRESETS: AudiencePresets = { admin: null, member: null }

function sanitizeFeatures(value: unknown): string[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
}

function readDrafts(): Drafts {
  if (typeof window === 'undefined') return EMPTY_DRAFTS

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DRAFTS
    const parsed = JSON.parse(raw) as Record<string, Partial<UserAccessDraft>>
    const next: Drafts = {}

    for (const [id, draft] of Object.entries(parsed)) {
      const userId = Number(id)
      if (!Number.isFinite(userId) || !draft || typeof draft !== 'object') continue
      next[userId] = {
        name: typeof draft.name === 'string' ? draft.name : undefined,
        surname: typeof draft.surname === 'string' ? draft.surname : undefined,
        role: typeof draft.role === 'string' ? draft.role : undefined,
        features: sanitizeFeatures(draft.features),
      }
    }

    return next
  } catch {
    return EMPTY_DRAFTS
  }
}

function readPresets(): AudiencePresets {
  if (typeof window === 'undefined') return DEFAULT_PRESETS

  try {
    const raw = window.localStorage.getItem(PRESET_KEY)
    if (!raw) return DEFAULT_PRESETS
    const parsed = JSON.parse(raw) as Partial<AudiencePresets>
    return {
      admin: sanitizeFeatures(parsed.admin),
      member: sanitizeFeatures(parsed.member),
    }
  } catch {
    return DEFAULT_PRESETS
  }
}

let drafts = readDrafts()
let audiencePresets = readPresets()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit() {
  listeners.forEach((listener) => listener())
}

function persist(next: Drafts) {
  drafts = next
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  emit()
}

function persistPresets(next: AudiencePresets) {
  audiencePresets = next
  window.localStorage.setItem(PRESET_KEY, JSON.stringify(next))
  emit()
}

export function canManageFeatureAccess(role?: string | null) {
  return role === 'admin' || isSuperAdmin(role)
}

export type BulkAudience = 'admin' | 'member'

/** Супер-админ видит две группы, админ — только пользователей. */
export function bulkAudiencesForActor(role?: string | null): BulkAudience[] {
  if (isSuperAdmin(role)) return ['admin', 'member']
  if (role === 'admin') return ['member']
  return []
}

export function isInBulkAudience(audience: BulkAudience, targetRole: string) {
  return audience === 'admin' ? targetRole === 'admin' : targetRole === 'member'
}

/** Кого затрагивает общий переключатель. Админ — только обычных пользователей. */
export function isBulkAccessTarget(actorRole: string | null | undefined, targetRole: string) {
  if (isSuperAdmin(actorRole)) return targetRole !== 'super_admin'
  if (actorRole === 'admin') return targetRole === 'member'
  return false
}

export function canEditUserFeatures(actorRole: string | null | undefined, targetRole: string) {
  return isBulkAccessTarget(actorRole, targetRole)
}

export function useUserAccessDrafts() {
  return useSyncExternalStore(subscribe, () => drafts, () => EMPTY_DRAFTS)
}

/** Набор разделов роли, когда на странице ещё нет таких пользователей. `null` — открыты все. */
export function useAudiencePreset(audience: 'admin' | 'member') {
  const presets = useSyncExternalStore(subscribe, () => audiencePresets, () => DEFAULT_PRESETS)
  return presets[audience]
}

export function setAudiencePresetFeature(
  audience: 'admin' | 'member',
  feature: string,
  enabled: boolean,
  catalog: readonly string[],
) {
  persistPresets({
    ...audiencePresets,
    [audience]: applyFeatureToggle(audiencePresets[audience], feature, enabled, catalog),
  })
}

export function setAudiencePresetAll(audience: 'admin' | 'member', enabled: boolean) {
  persistPresets({
    ...audiencePresets,
    [audience]: enabled ? null : [],
  })
}

export function readUserAccessDraft(userId: number) {
  return drafts[userId]
}

/** `null` в черновике — открыты все разделы из каталога `GET /api/admin/features/`. */
export function resolvedFeatures(draft: UserAccessDraft | undefined, catalog: readonly string[]): string[] {
  if (!draft || draft.features == null) return [...catalog]
  const selected = new Set(draft.features)
  return catalog.filter((feature) => selected.has(feature))
}

export function applyFeatureToggle(
  features: string[] | null,
  feature: string,
  enabled: boolean,
  catalog: readonly string[],
): string[] | null {
  const next = new Set(features == null ? catalog : catalog.filter((item) => features.includes(item)))
  if (enabled) next.add(feature)
  else next.delete(feature)
  const list = catalog.filter((item) => next.has(item))
  return list.length === catalog.length ? null : list
}

export function saveUserAccess(userId: number, draft: UserAccessDraft) {
  persist({
    ...drafts,
    [userId]: {
      ...drafts[userId],
      ...draft,
      features: sanitizeFeatures(draft.features),
    },
  })
}

export function clearUserAccess(userId: number) {
  if (!(userId in drafts)) return
  const next = { ...drafts }
  delete next[userId]
  persist(next)
}

export function setUsersFeature(
  userIds: number[],
  feature: string,
  enabled: boolean,
  catalog: readonly string[],
) {
  if (userIds.length === 0) return
  const next = { ...drafts }

  for (const userId of userIds) {
    const current = next[userId]
    next[userId] = {
      ...current,
      features: applyFeatureToggle(current?.features ?? null, feature, enabled, catalog),
    }
  }

  persist(next)
}

export function setUsersAllFeatures(userIds: number[], enabled: boolean) {
  if (userIds.length === 0) return
  const next = { ...drafts }

  for (const userId of userIds) {
    next[userId] = {
      ...next[userId],
      features: enabled ? null : [],
    }
  }

  persist(next)
}
