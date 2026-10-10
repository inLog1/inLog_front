import type { FeatureProfile, FeatureProfileWriteBody } from '../../../entities/platform-admin/model/types'
import { applyFeatureToggle } from './featureAccessPolicy'
import type { BulkAudience } from './featureAccessPolicy'

export const AUDIENCE_PROFILE_NAMES: Record<BulkAudience, string> = {
  admin: 'Админы',
  member: 'Пользователи',
}

type ProfileWriter = {
  createProfile: (body: FeatureProfileWriteBody) => { unwrap: () => Promise<unknown> }
  updateProfile: (args: { id: number; body: Partial<FeatureProfileWriteBody> }) => {
    unwrap: () => Promise<unknown>
  }
}

/** `null` — профиля нет, открыты все разделы каталога. */
export function readUserFeatures(
  userId: number,
  profiles: readonly FeatureProfile[],
  catalog: readonly string[],
): string[] | null {
  const profile = profiles.find((item) => item.members.includes(userId))
  if (!profile) return null

  const selected = catalog.filter((feature) => profile.features.includes(feature))
  if (catalog.length > 0 && selected.length === catalog.length) return null
  return selected
}

export function toggledFeatureMap(
  userIds: readonly number[],
  feature: string,
  enabled: boolean,
  profiles: readonly FeatureProfile[],
  catalog: readonly string[],
): Map<number, string[] | null> {
  const next = new Map<number, string[] | null>()
  for (const userId of userIds) {
    next.set(userId, applyFeatureToggle(readUserFeatures(userId, profiles, catalog), feature, enabled, catalog))
  }
  return next
}

export function uniformFeatureMap(userIds: readonly number[], features: string[] | null) {
  return new Map(userIds.map((userId) => [userId, features]))
}

function sameFeatures(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const selected = new Set(left)
  return right.every((feature) => selected.has(feature))
}

function featureKey(features: readonly string[]) {
  return [...features].sort().join('|')
}

function nextProfileName(preferred: string | undefined, taken: Set<string>) {
  const base = preferred && !taken.has(preferred) ? preferred : preferred ? `${preferred} 2` : 'Профиль'
  if (!taken.has(base)) return base
  let index = 2
  let name = `${preferred ?? 'Профиль'} ${index}`
  while (taken.has(name)) {
    index += 1
    name = `${preferred ?? 'Профиль'} ${index}`
  }
  return name
}

/**
 * Записывает набор разделов в FeatureProfile.
 * `null` снимает профиль: без профиля открыты все разделы.
 * Участники одного набора делят один профиль; новое назначение заменяет прежнее.
 */
export async function syncFeatureAssignments(
  overrides: Map<number, string[] | null>,
  profiles: readonly FeatureProfile[],
  writer: ProfileWriter,
  preferredName?: string,
) {
  if (overrides.size === 0) return

  const final = new Map<number, string[] | null>()
  for (const profile of profiles) {
    for (const userId of profile.members) {
      if (!final.has(userId)) final.set(userId, profile.features)
    }
  }
  for (const [userId, features] of overrides) final.set(userId, features)

  const groups = new Map<string, { features: string[]; ids: number[] }>()
  for (const [userId, features] of final) {
    if (features == null) continue
    const key = featureKey(features)
    const group = groups.get(key) ?? { features: [...features], ids: [] }
    group.ids.push(userId)
    groups.set(key, group)
  }

  const unused = new Set(profiles.map((profile) => profile.id))
  const assigned = new Map<number, { features: string[]; members: number[] }>()

  for (const group of groups.values()) {
    const exact = profiles.find((profile) => unused.has(profile.id) && sameFeatures(profile.features, group.features))
    if (!exact) continue
    unused.delete(exact.id)
    assigned.set(exact.id, { features: group.features, members: group.ids })
  }

  const pending = [...groups.values()].filter((group) => {
    return ![...assigned.values()].some((plan) => sameFeatures(plan.features, group.features))
  })

  for (const group of pending) {
    const empty = profiles.find((profile) => unused.has(profile.id) && profile.members.length === 0)
    if (!empty) continue
    unused.delete(empty.id)
    assigned.set(empty.id, { features: group.features, members: group.ids })
  }

  const stillPending = pending.filter((group) => {
    return ![...assigned.values()].some((plan) => sameFeatures(plan.features, group.features))
  })

  const takenNames = new Set(profiles.map((profile) => profile.name))
  const creates: FeatureProfileWriteBody[] = stillPending.map((group) => {
    const name = nextProfileName(preferredName, takenNames)
    takenNames.add(name)
    return { name, features: group.features, members: group.ids }
  })

  const shrinking: { id: number; members: number[] }[] = []
  for (const profile of profiles) {
    const plan = assigned.get(profile.id)
    const nextMembers = plan?.members ?? []
    const shrunk = profile.members.filter((userId) => nextMembers.includes(userId))
    if (shrunk.length !== profile.members.length) shrinking.push({ id: profile.id, members: shrunk })
  }

  for (const patch of shrinking) {
    await writer.updateProfile({ id: patch.id, body: { members: patch.members } }).unwrap()
  }

  for (const [id, plan] of assigned) {
    const current = profiles.find((profile) => profile.id === id)
    const featuresChanged = !current || !sameFeatures(current.features, plan.features)
    const membersChanged = !current || !sameIdList(current.members, plan.members)
    if (!featuresChanged && !membersChanged) continue
    await writer.updateProfile({
      id,
      body: {
        ...(featuresChanged ? { features: plan.features } : {}),
        ...(membersChanged ? { members: plan.members } : {}),
      },
    }).unwrap()
  }

  for (const body of creates) {
    await writer.createProfile(body).unwrap()
  }
}

function sameIdList(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length) return false
  const selected = new Set(left)
  return right.every((id) => selected.has(id))
}
