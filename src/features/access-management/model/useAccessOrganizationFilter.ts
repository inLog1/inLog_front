import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useGetOrganizationsQuery } from '../../../entities/organization/model/organizationSlice'
import type { AccessLocationHint, AccessOrganizationFilter } from './access-address'
import { readStoredAccessOrganizationFilter, writeStoredAccessOrganizationFilter, writeStoredAccessOrganizationId } from './access-address'

export function useAccessOrganizationFilter() {
  const location = useLocation()
  const organizationsQuery = useGetOrganizationsQuery()
  const organizations = (organizationsQuery.data ?? []).filter((item) => Number.isInteger(item.id))
  const [organizationId, setOrganizationId] = useState<AccessOrganizationFilter | null>(() => readStoredAccessOrganizationFilter())

  useEffect(() => {
    const hint = (location.state as AccessLocationHint | null)?.accessOrganizationId
    if (hint == null || !Number.isInteger(hint)) return
    setOrganizationId(hint)
    writeStoredAccessOrganizationFilter(hint)
  }, [location.state])

  useEffect(() => {
    if (organizationId === 'all') return
    if (organizationId != null && organizations.some((item) => item.id === organizationId)) return
    if (organizations.length === 0) {
      setOrganizationId(null)
      return
    }
    const stored = readStoredAccessOrganizationFilter()
    const next = stored === 'all'
      ? 'all'
      : stored != null && organizations.some((item) => item.id === stored)
        ? stored
        : organizations[0].id
    setOrganizationId(next)
    writeStoredAccessOrganizationFilter(next)
    if (typeof next === 'number') writeStoredAccessOrganizationId(next)
  }, [organizationId, organizations])

  const selectOrganization = (id: AccessOrganizationFilter) => {
    setOrganizationId(id)
    writeStoredAccessOrganizationFilter(id)
  }

  return {
    organizations,
    organizationId,
    selectOrganization,
    loading: organizationsQuery.isLoading,
    error: organizationsQuery.isError,
    refetch: () => void organizationsQuery.refetch(),
  }
}
