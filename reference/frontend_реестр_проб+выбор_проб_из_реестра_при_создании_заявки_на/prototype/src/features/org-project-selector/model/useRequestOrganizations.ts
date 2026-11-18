import { useEffect, useMemo, useRef } from 'react'
import { useGetSessionAccessQuery } from '../../../entities/access'
import { useEnsureOrgProjectParams } from './useEnsureOrgProjectParams'
import { organizationIdsForAction } from './request-organizations'

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

/**
 * Organizations the subject may use on the requests pages.
 * Live mode trusts the organization list. Mock mode keeps organizations where requests.read is granted.
 * One allowed organization is selected immediately. Several stay choosable.
 */
export function useRequestOrganizations() {
  const workspace = useEnsureOrgProjectParams('organization')
  const access = useGetSessionAccessQuery(undefined, { skip: !mockMode })
  const accessFailed = mockMode && access.isError
  const grantsReady = !mockMode || accessFailed || access.data?.accessState === 'ready'
  const grants = access.data?.accessState === 'ready' ? access.data.effectiveGrants : []
  const options = useMemo(() => {
    const rows = workspace.organizations
    if (!grantsReady) return []
    if (!mockMode || accessFailed) return rows
    const allowed = new Set(organizationIdsForAction(rows.map((item) => item.id), grants, 'requests', 'read'))
    return rows.filter((item) => allowed.has(item.id))
  }, [accessFailed, grants, grantsReady, workspace.organizations])

  const pending = workspace.orgsLoading || !grantsReady
  const currentOrgId = workspace.currentOrgId
  const aligned = currentOrgId != null && options.some((item) => item.id === currentOrgId)
  const firstId = options[0]?.id ?? null
  const selectRef = useRef(workspace.selectOrganization)
  selectRef.current = workspace.selectOrganization

  useEffect(() => {
    if (pending || aligned || firstId == null) return
    selectRef.current(firstId)
  }, [aligned, firstId, pending])

  return {
    pending,
    hold: pending || (options.length > 0 && !aligned),
    options,
    selected: options.find((item) => item.id === currentOrgId) ?? null,
    select: workspace.selectOrganization,
  }
}
