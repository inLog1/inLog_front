import type { AdminTask, AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { getUserFullName, getValidText } from '../../../shared/lib/get-valid-text'

export function getAdminUserDisplayName(user?: AdminUserBrief | null) {
  if (!user) return ''

  return getValidText(user.full_name) || getUserFullName(user) || getValidText(user.email)
}

export function getAdminUserInitials(user?: AdminUserBrief | null) {
  const displayName = getAdminUserDisplayName(user)
  if (!displayName) return '?'

  const parts = displayName.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts[1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase() || displayName[0]?.toUpperCase() || '?'
}

/** One letter: the name when it exists, otherwise the email. */
export function getPersonLetter(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || ''
  return source[0]?.toUpperCase() || '?'
}

const PERSON_COLORS = [
  'bg-sky-600 text-white',
  'bg-violet-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-500 text-white',
  'bg-rose-600 text-white',
  'bg-cyan-600 text-white',
  'bg-fuchsia-600 text-white',
  'bg-lime-600 text-white',
  'bg-orange-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
  'bg-pink-600 text-white',
  'bg-blue-700 text-white',
  'bg-red-600 text-white',
  'bg-green-700 text-white',
  'bg-purple-700 text-white',
]

function colorHash(value: string) {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash
}

export function personColorClass(key: string) {
  return PERSON_COLORS[colorHash(key || '?') % PERSON_COLORS.length]
}

/** Picks a stable color and skips colors already used in the same row. */
export function personColorClassUnique(key: string, used: Set<number>) {
  let index = colorHash(key || '?') % PERSON_COLORS.length
  if (used.has(index)) {
    const start = index
    do {
      index = (index + 1) % PERSON_COLORS.length
    } while (used.has(index) && index !== start)
  }
  used.add(index)
  return PERSON_COLORS[index]
}

export function getAdminUserAvatarUrl(user?: AdminUserBrief | null) {
  return user?.avatar?.small || user?.avatar?.medium
}

export function getAdminTaskCreator(task: AdminTask): AdminUserBrief | null {
  if (task.creator) {
    return task.creator
  }

  if (!task.creator_id && !task.creator_email) {
    return null
  }

  return {
    id: task.creator_id,
    email: task.creator_email,
    full_name: task.creator_name,
  }
}

export function getAdminTaskDoerUsers(task: AdminTask): AdminUserBrief[] {
  const users = (task.doers ?? [])
    .map((doer) => doer.user)
    .filter((user): user is AdminUserBrief => Boolean(user?.id))

  const seen = new Set<number>()
  return users.filter((user) => {
    if (seen.has(user.id)) return false
    seen.add(user.id)
    return true
  })
}

export function getAdminTaskMembers(task: AdminTask): AdminUserBrief[] {
  const members = task.members?.length
    ? task.members
    : task.doers
        ?.map((doer) => doer.user)
        .filter((user): user is AdminUserBrief => Boolean(user)) ?? []

  const seen = new Set<number>()

  return members.filter((user) => {
    if (seen.has(user.id)) {
      return false
    }

    seen.add(user.id)
    return true
  })
}
