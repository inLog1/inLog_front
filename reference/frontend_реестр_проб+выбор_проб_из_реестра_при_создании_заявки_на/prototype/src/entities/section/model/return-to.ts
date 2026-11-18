import { isSectionId, sectionPath } from './rules'

/**
 * A return path is a relative section address for the same organization.
 * An external URL, another path, or another organization is refused.
 */
export function sectionReturnPath(sectionId: string, organizationId: number): string {
  const params = new URLSearchParams()
  params.set('org', String(organizationId))
  return `${sectionPath(sectionId)}?${params.toString()}`
}

export function acceptReturnTo(raw: string | null, organizationId: number): string | null {
  if (raw == null || raw.length === 0 || raw.length > 500) return null
  if (raw.includes('\\') || raw.startsWith('//') || raw.includes('://')) return null
  let url: URL
  try {
    url = new URL(raw, 'http://inlog.local')
  } catch {
    return null
  }
  if (url.origin !== 'http://inlog.local') return null
  if (url.username !== '' || url.password !== '') return null
  const match = /^\/workspace\/sections\/([^/]+)$/.exec(url.pathname)
  if (!match || !isSectionId(decodeURIComponent(match[1]))) return null
  if (url.searchParams.get('org') !== String(organizationId)) return null
  for (const key of url.searchParams.keys()) {
    if (key !== 'org' && key !== 'project') return null
  }
  const project = url.searchParams.get('project')
  if (project != null && !/^[1-9]\d*$/.test(project)) return null
  const path = sectionPath(decodeURIComponent(match[1]))
  const params = new URLSearchParams()
  params.set('org', String(organizationId))
  if (project != null) params.set('project', project)
  return `${path}?${params.toString()}`
}
