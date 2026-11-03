import { useLocation, useSearchParams } from 'react-router-dom'
import { useGetSessionAccessQuery } from '../../entities/access'
import { parseRouteId } from '../../features/org-project-selector/model/workspace-context'
import { organizationIdFromPath, type NavigationInput } from './catalog'

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

/**
 * Menu visibility uses the URL selection and grants already loaded for the session.
 * It does not query tasks, constructor records, or reports.
 */
export function useNavigationInput(): NavigationInput {
  const location = useLocation()
  const [params] = useSearchParams()
  const organization = parseRouteId(params.get('org'))
  const pathOrganizationId = organizationIdFromPath(location.pathname)
  const project = parseRouteId(params.get('project'))
  const access = useGetSessionAccessQuery(undefined, { skip: !mockMode })
  const ready = access.data?.accessState === 'ready'
  return {
    enforceGrants: mockMode,
    grantsPending: mockMode && !access.isError && !ready,
    grants: ready && access.data ? access.data.effectiveGrants : [],
    systemCapabilities: ready && access.data ? access.data.systemCapabilities : [],
    organizationId: pathOrganizationId ?? (organization.kind === 'id' ? organization.id : null),
    projectId: project.kind === 'id' ? project.id : null,
  }
}
