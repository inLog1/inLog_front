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
