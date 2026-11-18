import { useLocation, useSearchParams } from 'react-router-dom'
import { useGetSessionAccessQuery } from '../../entities/access'
import { useGetOrganizationsQuery } from '../../entities/organization/model/organizationSlice'
import { parseRouteId } from '../../features/org-project-selector/model/workspace-context'
import { organizationIdFromPath, type NavigationInput } from './catalog'

export function listedOrganizationId(ids: readonly number[]): number | null {
  return ids.find((id) => Number.isInteger(id) && id > 0) ?? null
}

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

/**
 * Menu visibility uses the URL selection, session grants, and whether an organization exists.
 * It does not query tasks, constructor records, or reports.
 */
export function useNavigationInput(): NavigationInput & { listedOrganizationId: number | null } {
  const location = useLocation()
  const [params] = useSearchParams()
  const organization = parseRouteId(params.get('org'))
  const pathOrganizationId = organizationIdFromPath(location.pathname)
  const project = parseRouteId(params.get('project'))
  const access = useGetSessionAccessQuery(undefined, { skip: !mockMode })
  const organizations = useGetOrganizationsQuery()
  const ready = access.data?.accessState === 'ready'
  const listedId = listedOrganizationId((organizations.data ?? []).map((item) => item.id))
  return {
    enforceGrants: mockMode,
    grantsPending: mockMode && !access.isError && !ready,
    grants: ready && access.data ? access.data.effectiveGrants : [],
    systemCapabilities: ready && access.data ? access.data.systemCapabilities : [],
    organizationId: pathOrganizationId ?? (organization.kind === 'id' ? organization.id : null),
    projectId: project.kind === 'id' ? project.id : null,
    hasOrganizations: listedId != null,
    listedOrganizationId: listedId,
  }
}
