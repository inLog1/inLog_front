import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { routes } from '../../../shared/lib/routes'

export type AccessDeskScope = 'organization' | 'corporation'

const STORAGE_KEY = 'inlog:access:organization-id'
const LIST_FILTER_KEY = 'inlog:access:organization-filter'

export type AccessOrganizationFilter = number | 'all'

export type AccessLocationHint = {
  accessOrganizationId?: number
}

export function readStoredAccessOrganizationId(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw || !/^[1-9]\d*$/.test(raw)) return null
    return Number(raw)
  } catch {
    return null
  }
}

export function writeStoredAccessOrganizationId(organizationId: number | null): void {
  try {
    if (organizationId == null) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, String(organizationId))
  } catch {
    // sessionStorage may be unavailable
  }
}

export function readStoredAccessOrganizationFilter(): AccessOrganizationFilter | null {
  try {
    const raw = sessionStorage.getItem(LIST_FILTER_KEY)
    if (raw === 'all') return 'all'
    if (raw && /^[1-9]\d*$/.test(raw)) return Number(raw)
    return readStoredAccessOrganizationId()
  } catch {
    return null
  }
}

export function writeStoredAccessOrganizationFilter(value: AccessOrganizationFilter): void {
  try {
    sessionStorage.setItem(LIST_FILTER_KEY, String(value))
    if (typeof value === 'number') writeStoredAccessOrganizationId(value)
  } catch {
    // sessionStorage may be unavailable
  }
}

export function useConsumeAccessLocationHint(): void {
  const location = useLocation()
  useEffect(() => {
    const hint = (location.state as AccessLocationHint | null)?.accessOrganizationId
    if (hint == null || !Number.isInteger(hint)) return
    writeStoredAccessOrganizationId(hint)
  }, [location.state])
}

/** Access routes do not use workspace org/project in the URL. */
export function useScrubAccessWorkspaceParams(): void {
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (!searchParams.has('org') && !searchParams.has('project')) return
    const next = new URLSearchParams(searchParams)
    next.delete('org')
    next.delete('project')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
}

export function accessListHref(options: { owner?: 'corporation'; tab?: 'users' } = {}): string {
  const params = new URLSearchParams()
  if (options.owner === 'corporation') params.set('owner', 'corporation')
  if (options.tab === 'users') params.set('tab', 'users')
  const query = params.toString()
  return query ? `${routes.settings.access()}?${query}` : routes.settings.access()
}

export function accessRoleHref(roleId: string | 'new', deskScope: AccessDeskScope): string {
  const path = roleId === 'new' ? routes.settings.accessRoleNew() : routes.settings.accessRole(roleId)
  if (deskScope !== 'corporation') return path
  return `${path}?owner=corporation`
}

export function accessUserBackHref(): string {
  return accessListHref({ tab: 'users' })
}

export function readAccessDeskScope(searchParams: URLSearchParams): AccessDeskScope {
  return searchParams.get('owner') === 'corporation' ? 'corporation' : 'organization'
}
