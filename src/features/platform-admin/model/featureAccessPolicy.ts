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
const EMPTY_DRAFTS: Drafts = {}

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

let drafts = readDrafts()
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

/** Админ меняет разделы только у обычных пользователей, супер-админ — у всех, кроме супер-админов. */
export function canEditUserFeatures(actorRole: string | null | undefined, targetRole: string) {
  if (isSuperAdmin(actorRole)) return targetRole !== 'super_admin'
  if (actorRole === 'admin') return targetRole === 'member'
  return false
}

export function useUserAccessDrafts() {
  return useSyncExternalStore(subscribe, () => drafts, () => EMPTY_DRAFTS)
}

export function readUserAccessDraft(userId: number) {
  return drafts[userId]
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

