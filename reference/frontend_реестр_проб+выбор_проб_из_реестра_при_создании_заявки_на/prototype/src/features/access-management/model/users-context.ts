import type { AccessScope, AccessUsersQueryEcho } from '../../../entities/access'

export type UsersRequest = {
  organization: number | 'all'
  q: string
  page: number
  pageSize: number
}

/** A late response belongs to the screen only when its echoed query is the one on screen. */
export function usersRequestMatches(loaded: AccessUsersQueryEcho | null | undefined, requested: UsersRequest): boolean {
  if (!loaded) return false
  return loaded.organization === requested.organization
    && loaded.q === requested.q
    && loaded.page === requested.page
    && loaded.pageSize === requested.pageSize
}

export function scopeKey(scope: AccessScope): string {
  if (scope.type === 'corporation') return `corporation:${scope.corporationId}`
  if (scope.type === 'organization') return `organization:${scope.organizationId}`
  if (scope.type === 'project') return `project:${scope.projectId}`
  return `own:${scope.userId}`
}

export function sameScopeKey(scope: AccessScope, key: string): boolean {
  return scopeKey(scope) === key
}
